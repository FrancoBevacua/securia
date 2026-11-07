require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module');
const {estadoVacio}=require('../src/model.ts');
const {prepararReporteProgramado,CONFIG_ENVIO}=require('../src/envioProgramado.ts');
const load=Module._load;Module._load=function(name,...args){
 if(name==='../_shared/envioProgramado.ts')return require('../src/envioProgramado.ts');
 if(name==='../_shared/pdfplantilla.ts')return require('../src/pdfplantilla.ts');
 return load.call(this,name,...args);
};
const {procesarTrabajo}=require('../supabase/functions/whatsapp-reportes/procesar.ts');
const config={...CONFIG_ENVIO,nombre:'Ana',numero:'5493410000000',habilitado:true,consentimiento:true};
const meta={token:'prueba',phoneId:'123',version:'v99.0',plantilla:'reporte_prueba',idioma:'es_AR'};
test('envío de las 18 es avance del libro de 19 a 19 y excluye horas futuras y Accesos',()=>{
 const S=estadoVacio();S.novedades=[{id:'a',fecha:'2026-09-19',hora:'17:00',texto:'Incluida'},
  {id:'b',fecha:'2026-09-19',hora:'18:30',texto:'Todavía no'}, {id:'c',fecha:'2026-09-19',hora:'19:05',texto:'Día siguiente'}];
 S.alogs=[{id:'acceso',fecha:'2026-09-19',hora:'12:00',acceso:'Sólo CCTV'}];
 const r=prepararReporteProgramado(S,'2026-09-19',config);
 assert.match(r.texto,/Incluida/);assert.doesNotMatch(r.texto,/Todavía no|Día siguiente|CCTV/);
 assert.match(r.mensaje,/Buenas tardes, Ana/);assert.match(r.mensaje,/Avance hasta las 18:00/);assert.equal(r.parametros.length,5);
 const completo=prepararReporteProgramado(S,'2026-09-19',{...config,hora:'19:00'});
 assert.equal(completo.parcial,false);assert.match(completo.texto,/Todavía no/);assert.doesNotMatch(completo.texto,/Día siguiente/);
});
test('genera PDF, carga documento y manda plantilla una vez; registra aceptación sin afirmar entrega',async()=>{
 const estados=[],peticiones=[],job={id:'job',fecha:'2026-09-19',config,estado:estadoVacio()};
 await procesarTrabajo(job,meta,async p=>estados.push(p),async(url,p)=>{
   peticiones.push({url,p});
   if(url.endsWith('/media')){assert.equal(p.body.get('file').type,'application/pdf');return Response.json({id:'media'});}
   const b=JSON.parse(p.body);assert.equal(b.to,config.numero);assert.equal(b.template.components[0].parameters[0].document.id,'media');
   return Response.json({messages:[{id:'wamid.prueba'}]});
 });
 assert.equal(peticiones.length,2);assert.deepEqual(estados.map(x=>x.estado),['enviando','aceptado']);
 assert.equal(estados[1].mensaje_id,'wamid.prueba');
});
test('una respuesta perdida después del envío queda incierta y nunca se reintenta en el worker',async()=>{
 let mensajes=0;const estados=[];
 await procesarTrabajo({id:'j',fecha:'2026-09-19',config,estado:estadoVacio()},meta,async p=>estados.push(p.estado),async url=>{
   if(url.endsWith('/media'))return Response.json({id:'m'});mensajes++;throw new TypeError('Respuesta perdida');
 });
 assert.equal(mensajes,1);assert.deepEqual(estados,['enviando','incierto']);
});
test('evidencia ausente bloquea la entrega de un reporte incompleto',async()=>{
 const S=estadoVacio();S.novedades=[{id:'n',fecha:'2026-09-19',hora:'12:00',texto:'Con foto',fotos:['file://foto.jpg']}];
 const estados=[];await procesarTrabajo({id:'j',fecha:'2026-09-19',config,estado:S},meta,async p=>estados.push(p),async()=>{assert.fail('No debe contactar Meta');});
 assert.equal(estados[0].estado,'fallido');
});
test('el reporte descarga sólo su evidencia separada antes de construir el PDF',async()=>{
 const refs=[],estados=[],S=estadoVacio();
 // Usar un JPEG de prueba real generado por el codificador.
 const jpeg=require('jpeg-js').encode({data:Buffer.from([255,255,255,255]),width:1,height:1},80).data;
 S.novedades=[{id:'n',fecha:'2026-09-19',hora:'12:00',texto:'Con evidencia',fotos:['vige://objetivo/hash']}];
 await procesarTrabajo({id:'j',fecha:'2026-09-19',config,estado:S},meta,async p=>{
  if(p.accion==='foto'){refs.push(p);return {foto:'data:image/jpeg;base64,'+jpeg.toString('base64')};}estados.push(p.estado);
 },async url=>url.endsWith('/media')?Response.json({id:'media'}):Response.json({messages:[{id:'m'}]}));
 assert.deepEqual(refs,[{accion:'foto',id:'j',ref:'vige://objetivo/hash'}]);assert.deepEqual(estados,['enviando','aceptado']);
});
