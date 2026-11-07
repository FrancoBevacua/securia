require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {redactarAsiento}=require('../src/reporte.ts');
const {textoAlogLibro,textoInformeAccesos}=require('../src/text.ts');
const {entradasDeVentana}=require('../src/informedia.ts');
const {estadoVacio,merge}=require('../src/model.ts');
const {aplicarCambios}=require('../src/mutaciones.ts');

const datos={acceso:'Puertas E2 y E2 Bis',incluirMotivo:true,motivo:'Para el ingreso del personal de limpieza'};
const apertura='Se procede a la apertura de las puertas E2 y E2 Bis para el ingreso del personal de limpieza.';
const ventana={fecha:'2026-09-15',corte:'00:00'};

test('varios accesos generan una lista, mantienen el motivo y se reflejan en móvil y web',()=>{
 const d={grupoAccesos:'portones',accesos:['Oroño','Ombú','Peatonal']};
 const texto='Se procede a la apertura de los portones de playa:\n- Oroño\n- Ombú\n- Peatonal';
 assert.equal(redactarAsiento('Apertura',d),texto);
 assert.equal(redactarAsiento('Cierre',{grupoAccesos:'emergencias',accesos:['E1','E2']}),
  'Se procede al cierre de las puertas de emergencias:\n- E1\n- E2');
 assert.equal(redactarAsiento('Apertura',{...d,accesos:[]}), '');
 assert.equal(redactarAsiento('Apertura',{...d,accesos:['Oroño','Oroño','  ']}), 'Se procede a la apertura de los portones de playa:\n- Oroño');
 const r={...d,tipo:'apertura',acceso:'Portones de playa',hora:'08:00',gs:'Ana',p1:'',p2:'',nota:'',incluirMotivo:true,motivo:'Por indicación del CCTV'};
 const generado=textoAlogLibro(r);assert.equal(generado,texto+'\n\nMotivo: Por indicación del CCTV');
 assert.equal(require('../admin/shared/text.ts').textoAlogLibro(r),generado);
 const cctv=textoInformeAccesos([r],ventana.fecha,{orden:'hora',tipo:'ambos',encabezado:false},estadoVacio().site);
 assert.match(cctv,/- Oroño\n- Ombú\n- Peatonal/);assert.equal(cctv.match(/Motivo:/g).length,1);
});

test('apertura y cierre integran el motivo y conservan los artículos del acceso',()=>{
 assert.equal(redactarAsiento('Apertura',datos),apertura);
 assert.equal(redactarAsiento('Cierre',{acceso:'Puerta E2',incluirMotivo:true,motivo:'Por finalización de las tareas.'}),
  'Se procede al cierre de la puerta E2 por finalización de las tareas.');
 assert.equal(redactarAsiento('Apertura',{...datos,motivo:'Ingreso autorizado por CCTV'}),
  'Se procede a la apertura de las puertas E2 y E2 Bis. Motivo: Ingreso autorizado por CCTV.');
});

test('desmarcar motivo lo excluye y los registros anteriores no cambian',()=>{
 assert.equal(redactarAsiento('Apertura',{...datos,incluirMotivo:false}), 'Se procede a la apertura de las puertas E2 y E2 Bis.');
 assert.equal(redactarAsiento('Cierre',{acceso:'Portón Oroño',observaciones:'Se verifica el precinto.'}),
  'Se procede al cierre del portón Oroño. Se verifica el precinto.');
 assert.equal(redactarAsiento('Apertura',{...datos,motivo:'  '}),'Se procede a la apertura de las puertas E2 y E2 Bis.');
});

test('el motivo persiste en novedades y accesos y se incluye una vez en los informes móvil/web y CCTV',()=>{
 let S=estadoVacio();const g={id:'g',nombre:'Ana',apellido:'Prueba'};
 S.guards=[g];S.punches=[{id:'t',guardId:g.id,fecha:ventana.fecha,in:'07:00',out:''}];
 const r={id:'a',tipo:'apertura',...datos,fecha:ventana.fecha,hora:'08:00',guardId:g.id,gs:'Gs Prueba, Ana',nota:'',p1:'1234567',p2:''};
 S=aplicarCambios(S,[{col:'alogs',obj:r},{col:'novedades',obj:{id:'n',fecha:ventana.fecha,hora:'09:00',guardId:g.id,categoria:'Apertura',datos,texto:redactarAsiento('Apertura',datos)}}],g);
 S=merge(estadoVacio(),JSON.parse(JSON.stringify(S)));
 assert.equal(S.alogs[0].motivo,datos.motivo);assert.deepEqual(S.novedades[0].datos,datos);
 const entradas=entradasDeVentana(S,ventana);
 assert.equal(entradas.length,1);assert.equal(entradas[0].texto,apertura);
 assert.match(textoInformeAccesos(S.alogs,ventana.fecha,{orden:'hora',tipo:'ambos',encabezado:false},S.site),/Motivo: Para el ingreso del personal de limpieza/);
 const ligado={id:'vinculada',fecha:ventana.fecha,hora:r.hora,guardId:g.id,categoria:'Acceso',alogId:r.id,texto:textoAlogLibro(r)};
 S.novedades.push(ligado);
 const conVinculada=entradasDeVentana(S,ventana);
 assert.equal(conVinculada.length,1);assert.equal(conVinculada[0].texto,apertura);
 const web=require('../admin/shared/informedia.ts');
 assert.deepEqual(web.entradasDeVentana(S,ventana),conVinculada);
 S.alogs[0].incluirMotivo=false;
 assert.doesNotMatch(textoAlogLibro(S.alogs[0]),/limpieza/);
 assert.doesNotMatch(textoInformeAccesos(S.alogs,ventana.fecha,{orden:'hora',tipo:'ambos',encabezado:false},S.site),/Motivo:/);
});
