require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {estadoVacio,accVacio}=require('../src/model.ts');
const {externosEnPredio}=require('../src/presencias.ts');
const {historialExternos}=require('../src/externos.ts');
const {historialAdicionales}=require('../src/adicionales.ts');
const {resumenInforme}=require('../src/informesSeguridad.ts');
const {cambiosVisita}=require('../src/movimientosVisita.ts');
const {aplicarCambios}=require('../src/mutaciones.ts');
const ahora=new Date(2026,10,1,10,0);
const acc={...accVacio(),empresa:'Empresa',tarea:'Control',lugar:'Playa',personas:[{nombre:'Ana Pérez',dni:'30.123.456'}]};
const visita=(id,fecha,horaIn)=>({id,fecha,horaIn,horaOut:'',acc,tipo:'Proveedor',guardId:'g',createdAt:1,updatedAt:1});

test('caducan después de ocho horas, cruzan medianoche y una reentrada tiene su propio plazo',()=>{
 const S=estadoVacio();S.visits=[visita('v','2026-11-01','02:00')];
 assert.equal(externosEnPredio(S,ahora).length,1);
 assert.equal(externosEnPredio(S,new Date(2026,10,1,10,0,1)).length,0);
 S.visits=[visita('v','2026-10-31','23:00')];
 assert.equal(externosEnPredio(S,new Date(2026,10,1,6,59)).length,1);
 assert.equal(externosEnPredio(S,new Date(2026,10,1,7,1)).length,0);
 S.visits.push(visita('nuevo','2026-11-01','09:00'));
 assert.equal(externosEnPredio(S,ahora)[0].personas.length,1);
 assert.equal(externosEnPredio(S,ahora)[0].personas[0].registroId,'nuevo');
 S.visits[1].horaOut='09:30';assert.equal(externosEnPredio(S,ahora).length,0);
 assert.equal(S.visits.length,2);assert.equal(S.visits[0].horaOut,'');
});

test('el plazo es individual dentro del mismo equipo y la confirmación no lo reinicia',()=>{
 const S=estadoVacio();S.visits=[visita('viejo','2026-11-01','01:00'),{...visita('vigente','2026-11-01','09:00'),acc:{...acc,personas:[{nombre:'Bruno',dni:'31123456'}]}}];
 S.novedades=[{id:'conf',fecha:'2026-11-01',hora:'09:30',categoria:'Externo',mov:'conf',acc}];
 assert.deepEqual(externosEnPredio(S,ahora)[0].personas.map(p=>p.nombre),['Bruno']);
});

test('los historiales unifican acentos, espacios, DNI con puntos y fichas con ID antiguo',()=>{
 const S=estadoVacio();
 S.visits=[{...visita('v','2026-11-01','09:00'),acc:{...acc,empresa:' Servicios PÉREZ ',personas:[{nombre:'Ana Pérez',dni:''},{nombre:' ANA PEREZ ',dni:'30123456'},{nombre:'Ana Pérez',dni:'30.123.456'}]}}];
 S.externals=[{id:'legacy',empresa:'servicios perez',tarea:'Control',lugar:'Playa',personas:[{nombre:'Ana Pérez',dni:'30123456'}],updatedAt:3}];
 const h=historialExternos(S);assert.equal(h.length,1);assert.equal(h[0].personas.length,1);
 assert.equal(externosEnPredio(S,ahora)[0].personas.length,1);
 const base={categoria:'Adicional',fecha:'2026-11-01',hora:'09:00'};
 const adicionales=historialAdicionales([{...base,id:'1',datos:{apellido:'Pérez',nombre:'Ana',turno:'09-17'}},{...base,id:'2',hora:'10:00',datos:{apellido:' PEREZ ',nombre:' ANA '}}]);
 assert.equal(adicionales.length,1);assert.equal(adicionales[0].turno,'09-17');
});

test('visita y movimientos se aplican juntos y la eliminación quita la presencia',()=>{
 let S=estadoVacio();S.guards=[{id:'g',apellido:'Prueba',nombre:'Ana',rol:'vigilador'}];
 S.punches=[{id:'turno',guardId:'g',fecha:'2026-11-01',in:'00:00',out:''}];
 const actor=S.guards[0],v=visita('v','2026-11-01','09:00');
 S=aplicarCambios(S,cambiosVisita(v,['in'],'g',ahora),actor);
 assert.equal(S.visits.length,1);assert.equal(S.novedades.length,1);
 const cargada=S.visits[0],editar={...cargada,acc:{...acc,lugar:'Depósito'}};
 S=aplicarCambios(S,cambiosVisita(editar,['in'],'g',ahora,S.novedades),actor);
 assert.equal(S.novedades.length,1);assert.equal(externosEnPredio(S,ahora)[0].sector,'Depósito');
 const antes=JSON.stringify(S);
 assert.throws(()=>aplicarCambios(S,cambiosVisita({...editar,horaIn:'99:99'},['in'],'g',ahora),actor),/válidos/);
 assert.equal(JSON.stringify(S),antes);
 S=aplicarCambios(S,cambiosVisita({...editar,horaOut:'09:45'},['out'],'g',ahora),actor);
 assert.equal(externosEnPredio(S,ahora).length,0);assert.equal(S.novedades.length,2);
 S=aplicarCambios(S,[{col:'novedades',obj:{id:cargada.novIn,deleted:true}},{col:'visits',obj:{id:'v',deleted:true}}],actor);
 assert.equal(externosEnPredio(S,ahora).length,0);
});

test('el resumen reúne hecho, intervención y estado con frases completas y sin copiar el punto seis',()=>{
 const f6='Se detectó una pérdida de agua en el depósito. '+('Se relevaron los detalles del sector. '.repeat(40));
 const resumen=resumenInforme({f4:'Pérdida de agua',f6,f8:'Se cerró la llave de paso y se avisó a mantenimiento.',f12:'El sector quedó aislado.',f13:'Revisar la reparación.'});
 assert.match(resumen,/pérdida de agua/i);assert.match(resumen,/llave de paso/);assert.match(resumen,/sector quedó aislado/);
 assert.ok(resumen.length<650);assert.ok(!resumen.includes(f6));assert.doesNotMatch(resumen,/…|\.\.\./);assert.ok(resumen.endsWith('.'));
 const repetido=resumenInforme({f4:'Control',f6:'Se informó al responsable.',f8:'Se informó al responsable.',f12:'N/A'});
 assert.equal(repetido.split('Se informó al responsable').length-1,1);assert.doesNotMatch(repetido,/N\/A/);
 const identificado=resumenInforme({f4:'Acceso',f6:'Se identificó al Sr. Pérez, DNI 30.123.456, en el portón.',f8:'Se dio aviso a CCTV.',f12:'Finalizado.'});
 assert.match(identificado,/Sr\. Pérez, DNI 30\.123\.456, en el portón\./);
 const coordinada=resumenInforme({f4:'Derrame',f6:'Se detectó agua en el depósito, se registraron los detalles del sector y '+('se verificaron las instalaciones '.repeat(30)),f8:'Se cerró la llave de paso.',f12:'Sector aislado.'});
 assert.match(coordinada,/Hecho: Se detectó agua en el depósito\./);assert.ok(coordinada.length<650);
});
