require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {estadoVacio}=require('../src/model.ts'),{registrarRondaGeneral}=require('../src/recorridos.ts'),{aplicarCambios}=require('../src/mutaciones.ts'),{iniciarServicio}=require('../src/servicio.ts'),{categoriaAsiento}=require('../src/reporte.ts');
const g={id:'autor',nombre:'Ana',apellido:'Prueba'},otro={id:'guardia',nombre:'Juan',apellido:'Ejemplo'};
function estado(){let s=estadoVacio();s.guards=[g,otro];s.posts=[{id:'playa-1',nombre:'Playa 1'}];return aplicarCambios(s,iniciarServicio(s,g,new Date('2026-09-24T18:00:00'),true,'telefono-a'),g,true);}
test('inicio y fin registran guardia, puesto, sin novedades e imágenes automáticamente y cruzan medianoche',()=>{
 let s=estado();const datos={id:'ronda',guardId:otro.id,puestoId:'playa-1',novedades:'  ',fotos:['data:image/jpeg;base64,prueba']};
 const inicio=registrarRondaGeneral(s,g,'telefono-a',datos,undefined,new Date('2026-09-24T23:50:00'));
 s=aplicarCambios(s,inicio,g,false,'telefono-a');assert.equal(s.novedades.length,1);assert.equal(s.rounds[0].guardId,otro.id);assert.equal(s.rounds[0].createdBy,g.id);
 assert.match(s.novedades[0].texto,/Playa 1 inicia ronda de control\. Sin novedades/);assert.equal(categoriaAsiento(s.novedades[0]),'INICIO DE RONDA');assert.deepEqual(s.novedades[0].fotos,datos.fotos);
 const fin=registrarRondaGeneral(s,g,'telefono-a',{...datos,novedades:'Portón verificado'},s.rounds[0],new Date('2026-09-25T00:10:00'));
 s=aplicarCambios(s,fin,g,false,'telefono-a');assert.equal(s.novedades.length,2);assert.equal(s.rounds[0].fechaFin,'2026-09-25');assert.equal(s.novedades[1].fecha,'2026-09-25');assert.match(s.novedades[1].texto,/finaliza ronda.*Portón verificado/);assert.equal(categoriaAsiento(s.novedades[1]),'FIN DE RONDA');
 const repetido=aplicarCambios(s,fin,g,false,'telefono-a');assert.equal(repetido.novedades.length,2);assert.equal(repetido.rounds.length,1);
});
test('rechaza guardia o puesto inválido y no permite finalizar la ronda del otro teléfono',()=>{
 const s=estado(),datos={id:'r',guardId:otro.id,puestoId:'playa-1',novedades:'',fotos:[]};
 assert.throws(()=>registrarRondaGeneral(s,g,'telefono-a',{...datos,guardId:''}),/guardia/);
 assert.throws(()=>registrarRondaGeneral(s,g,'telefono-a',{...datos,puestoId:''}),/puesto/);
 const r=registrarRondaGeneral(s,g,'telefono-a',datos)[0].obj;assert.throws(()=>registrarRondaGeneral(s,g,'telefono-b',datos,r),/otro teléfono/);
});
