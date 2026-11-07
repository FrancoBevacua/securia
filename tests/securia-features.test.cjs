require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {estadoVacio,accVacio,fmtDNI}=require('../src/model.ts');
const {fichaExterno,historialExternos,accesoDesdeFicha}=require('../src/externos.ts');
const {generarInformeSeguridad}=require('../src/informesSeguridad.ts');
const {aplicarCambios}=require('../src/mutaciones.ts');
const {validarDescanso,datosDescanso}=require('../src/descansos.ts');
const {categoriaAsiento,redactarAsiento}=require('../src/reporte.ts');
const {guardiaEnServicio}=require('../src/controlesServicio.ts');
const {lineaPrecintos,textoInformeAccesos,textoAlogLibro}=require('../src/text.ts');
const {parsearPrecintos}=require('../src/precintos.ts');
const {pedirIA}=require('../src/ai.ts');
function base(){const S=estadoVacio();S.guards=[{id:'a',apellido:'Prueba',nombre:'Ana',rol:'vigilador'},{id:'b',apellido:'Prueba',nombre:'Bruno',rol:'vigilador'}];S.posts=[{id:'playa',nombre:'Playa'}];S.punches=[{id:'turno',guardId:'a',fecha:'2026-10-24',in:'19:00',out:'',dispositivoId:'telefono'}];return S;}
test('DNI argentino y fichas reúnen empleados por documento sin reutilizar permisos',()=>{
 const S=base(),acc={...accVacio(),empresa:' ACME ',tarea:'Control',lugar:'Playa',autoriz:'admin',personas:[{nombre:'Persona Uno',dni:'36010660'}]};
 assert.equal(fmtDNI(acc.personas[0].dni),'36.010.660');const f=fichaExterno(S,acc,'a');S.externals=[f];
 const segunda=fichaExterno(S,{...acc,empresa:'acme',personas:[{nombre:'Persona Uno actualizada',dni:'36.010.660'},{nombre:'Persona Dos',dni:'27123456'}]},'b');
 assert.equal(f.id,segunda.id);assert.equal(segunda.createdBy,'a');assert.equal(segunda.personas.length,2);assert.equal(segunda.personas[0].nombre,'Persona Uno actualizada');
 assert.equal(accesoDesdeFicha(segunda).autoriz,'cctv');assert.deepEqual(accesoDesdeFicha(segunda).vehiculo.adjuntos,[]);
 assert.throws(()=>fichaExterno(S,{...acc,personas:[{nombre:'Persona',dni:'123'}]},'a'),/DNI/);
 S.visits=[{id:'v1',acc,updatedAt:1},{id:'v2',acc:{...acc,personas:[{nombre:'Persona Dos',dni:'27123456'}]},updatedAt:2}];S.externals=[];
 assert.equal(historialExternos(S)[0].personas.length,2);
});
test('guardar externo conserva una ficha independiente incluso al borrar la novedad',()=>{
 const S=base(),actor=S.guards[0],acc={...accVacio(),empresa:'ACME',personas:[{nombre:'Persona',dni:'36010660'}]};
 const e=aplicarCambios(S,[{col:'novedades',obj:{id:'externo',fecha:'2026-10-24',hora:'20:00',guardId:'a',categoria:'Externo',texto:'Ingreso',acc}}],actor,false,'telefono');
 assert.equal(e.externals.length,1);assert.equal(S.externals.length,0);
 const borrado=aplicarCambios(e,[{col:'novedades',obj:{id:'externo',deleted:true}}],actor,false,'telefono');assert.equal(borrado.externals.length,1);
});
test('informe y resumen se guardan juntos sin IA y un reintento conserva los IDs',()=>{
 const S=base(),r={id:'informe',f3:'24/10/2026',fecha:'2026-10-24',hora:'20:00',f4:'Control',f6:'Se detectó una luminaria apagada.',firmaId:'b',createdBy:'a',fotos:[]};
 const cambios=generarInformeSeguridad(S,r,'a','telefono');assert.deepEqual(cambios.map(x=>x.col),['reports','novedades']);assert.equal(cambios[0].obj.estado,'generado');
 const e=aplicarCambios(S,cambios,S.guards[0],false,'telefono');
 const otra=aplicarCambios(e,generarInformeSeguridad(e,{...r,f6:'Se informó al responsable.'},'a','telefono'),S.guards[0],false,'telefono');
 assert.equal(otra.reports.length,1);assert.equal(otra.novedades.length,1);assert.match(otra.novedades[0].texto,/responsable/);assert.ok(otra.novedades[0].texto.length<350);
 assert.throws(()=>generarInformeSeguridad(S,{...r,hora:''},'a','telefono'),/fecha|horario/);assert.equal(S.reports.length,0);
});
test('descanso controla cobertura y fin de madrugada y aparece en el libro',()=>{
 const S=base(),d={guardiaDescansoId:'a',puestoId:'playa',requiereCobertura:true,cubreId:'b',finDescanso:'00:15',fechaFinDescanso:'2026-10-25'};
 assert.doesNotThrow(()=>validarDescanso(S,d,'2026-10-24','23:45'));assert.throws(()=>validarDescanso(S,{...d,cubreId:'a'},'2026-10-24','23:45'),/otro guardia/);
 assert.throws(()=>validarDescanso(S,{...d,fechaFinDescanso:'2026-10-24'},'2026-10-24','23:45'),/posterior/);
 const texto=redactarAsiento('Descanso',datosDescanso(S,d),undefined,'Playa');assert.match(texto,/Ana/);assert.match(texto,/Bruno/);assert.match(texto,/00:15/);assert.equal(categoriaAsiento({categoria:'Descanso'}),'DESCANSO');
});
test('accesos conservan tres puertas y todos sus precintos en las salidas',()=>{
 const r={id:'puertas',fecha:'2026-10-24',hora:'20:00',tipo:'cierre',acceso:'Emergencia E2',gs:'Gs Prueba',p1:'1000001',p2:'1000002',puertas:[{id:'1',nombre:'Puerta 1',precintos:['1000001','1000002']},{id:'2',nombre:'Puerta 2',precintos:['1000003']},{id:'3',nombre:'Puerta 3',precintos:['1000004','1000005','1000006']}]};
 for(const salida of [lineaPrecintos(r),textoAlogLibro(r),textoInformeAccesos([r],r.fecha,{tipo:'ambos',orden:'carga'})]){assert.match(salida,/Puerta 3/);assert.match(salida,/1000006/);}
});
test('servicio acreditado cruza medianoche y el egreso del libro prevalece sobre sesión abierta',()=>{
 const S=base();assert.equal(guardiaEnServicio(S,'a','2026-10-25','01:00'),true);assert.equal(guardiaEnServicio(S,'b','2026-10-24','20:00'),false);
 S.novedades=[{fecha:'2026-10-24',hora:'20:00',categoria:'Egreso',datos:{apellido:'Prueba',nombre:'Ana'}}];assert.equal(guardiaEnServicio(S,'a','2026-10-24','20:10'),false);
 S.punches[0]={...S.punches[0],out:'02:00',fechaOut:'2026-10-25'};S.novedades=[];assert.equal(guardiaEnServicio(S,'a','2026-10-25','02:00'),false);
});
test('lectura de precintos conserva números como texto y rechaza JSON incompleto o ambiguo',()=>{
 const p=parsearPrecintos('```json\n{"puertas":[{"nombre":"Puerta E2","precintos":["0123456","1234567"]}]}\n```');assert.deepEqual(p[0].precintos,['0123456','1234567']);
 for(const t of ['{"puertas":[]}','{"puertas":[{"nombre":"E2","precintos":[1234567]}]}','{"puertas":[{"nombre":"E2","precintos":["123"]}]}','texto'])assert.throws(()=>parsearPrecintos(t));
});
test('GPT envía texto e imágenes al endpoint fijo de OpenAI y oculta la clave en errores',async t=>{
 let pedido;
 t.mock.method(globalThis,'fetch',async(url,op)=>{pedido={url,op,body:JSON.parse(op.body)};return{ok:true,status:200,json:async()=>({choices:[{message:{content:'Lectura de prueba'},finish_reason:'stop'}]})};});
 const cfg={proveedor:'openai',modelo:'gpt-4.1',apiKey:'clave-ficticia',baseUrl:'https://no-usar.invalid'};
 assert.equal(await pedirIA('Prueba',cfg,'Sistema',[{mime:'image/jpeg',base64:'YWJj'}]),'Lectura de prueba');
 assert.equal(pedido.url,'https://api.openai.com/v1/chat/completions');assert.equal(pedido.op.headers.Authorization,'Bearer clave-ficticia');assert.equal(pedido.body.messages[1].content[1].image_url.url,'data:image/jpeg;base64,YWJj');assert.ok(pedido.body.max_completion_tokens);assert.equal(pedido.body.max_tokens,undefined);
 t.mock.method(globalThis,'fetch',async()=>({ok:false,status:400,json:async()=>({error:{message:'Error clave-ficticia'}})}));await assert.rejects(pedirIA('Prueba',cfg),e=>!e.message.includes('clave-ficticia'));
});


test('precintos opcionales omiten valores viejos y las puertas mixtas se describen en CCTV',()=>{
 const {completarPuertas,nuevasPuertas,todosPrecintos}=require('../src/precintos.ts');
 assert.deepEqual(nuevasPuertas('porton','ingreso').map(p=>p.precintos.length),[1]);
 assert.deepEqual(nuevasPuertas('porton','ingreso-egreso').map(p=>p.precintos.length),[1]);
 assert.deepEqual(nuevasPuertas('otro'),[]);
 const puertas=[{id:'a',nombre:'Emergencia E1',precintos:['001'],sinPrecinto:false},{id:'b',nombre:'Puerta chica',precintos:['1234002'],sinPrecinto:true}];
 const normal=completarPuertas(puertas,'1234');assert.deepEqual(normal.map(p=>p.precintos),[['1234001'],[]]);
 const r={fecha:'2026-10-25',hora:'08:00',tipo:'apertura',acceso:'Sector 1',gs:'Gs Prueba',p1:'1234001',p2:'',puertas:normal};
 assert.match(textoInformeAccesos([r],r.fecha,{tipo:'ambos',orden:'carga'},{}),/Puerta chica: sin precinto/);
 assert.deepEqual(completarPuertas(puertas,'1234',true),[]);
 assert.deepEqual(todosPrecintos({...r,sinPrecinto:true}),[]);assert.doesNotMatch(lineaPrecintos({...r,sinPrecinto:true}),/1234001/);
 for(const precintos of [[],[''],['1234'],['123456'],['12345678']])assert.throws(()=>completarPuertas([{id:'x',nombre:'E2',precintos}],'1234'),/precinto/);
});

test('historial policial une ingreso y egreso sin duplicar personas y recupera el turno del ingreso',()=>{
 const {historialAdicionales}=require('../src/adicionales.ts');
 const registros=[
  {id:'in',categoria:'Adicional',fecha:'2026-10-24',hora:'09:00',datos:{apellido:'Pérez',nombre:'Ana',turno:'09:00-16:00'}},
  {id:'out',categoria:'Adicional',fecha:'2026-10-24',hora:'16:00',datos:{apellido:' PÉREZ ',nombre:' Ana '}},
  {id:'vigilador',categoria:'Ingreso',fecha:'2026-10-24',hora:'08:00',datos:{apellido:'Otro',nombre:'Guardia'}},
  {id:'borrado',categoria:'Adicional',fecha:'2026-10-25',hora:'09:00',deleted:true,datos:{apellido:'Borrado',nombre:'Policía'}}
 ];
 const h=historialAdicionales(registros);assert.equal(h.length,1);assert.equal(h[0].turno,'09:00-16:00');assert.equal(h[0].hora,'16:00');assert.equal(registros[1].datos.turno,undefined);
});
