require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {estadoVacio}=require('../src/model.ts');
const {aplicarCambios}=require('../src/mutaciones.ts');
const {asegurarPuestosCobertura,idsPuestosGuardia,nombresPuestosGuardia}=require('../src/puestosGuardia.ts');
const {directivasDeHoy}=require('../src/logic.ts');

test('la actualización incorpora Bicicletero y Franquero sin tocar cuentas, historial ni puestos existentes',()=>{
 const S=estadoVacio();S.posts=[{id:'paseo',nombre:'Paseo',orden:0}];S.guards=[{id:'g',puestoId:'paseo'}];S.novedades=[{id:'n',texto:'Registro anterior'}];
 const anterior=JSON.stringify({guards:S.guards,novedades:S.novedades});
 asegurarPuestosCobertura(S,1);assert.equal(S.posts.length,3);assert.ok(S.franjas.length>=3);
 asegurarPuestosCobertura(S,2);assert.equal(S.posts.length,3);
 assert.equal(JSON.stringify({guards:S.guards,novedades:S.novedades}),anterior);
 const manual=estadoVacio();manual.posts=[{id:'manual',nombre:' BICICLETERO ',orden:0},{id:'baja',nombre:'Franquero',deleted:true}];asegurarPuestosCobertura(manual);assert.equal(manual.posts.length,2);
});

test('se guardan tres puestos sin duplicados y se conserva el principal de perfiles antiguos',()=>{
 let S=estadoVacio();S.posts=[{id:'p',nombre:'Paseo'}];asegurarPuestosCobertura(S);
 const ids=S.posts.map(p=>p.id),g={id:'g',apellido:'Prueba',nombre:'Ana',puestoId:'p',rol:'vigilador'};
 assert.deepEqual(idsPuestosGuardia(g),['p']);
 S=aplicarCambios(S,[{col:'guards',obj:{...g,puestoIds:[...ids,ids[1]]}}],null);
 assert.deepEqual(S.guards[0].puestoIds,ids);assert.equal(S.guards[0].puestoId,'p');
 assert.equal(nombresPuestosGuardia(S,S.guards[0]),'Paseo · Bicicletero · Franquero');
 assert.throws(()=>aplicarCambios(S,[{col:'guards',obj:{id:'g',puestoIds:['inexistente']}}],null),/no está disponible/);
 assert.throws(()=>aplicarCambios(S,[{col:'guards',obj:{id:'g',puestoIds:'p'}}],null),/válidos/);
 S=aplicarCambios(S,[{col:'guards',obj:{id:'g',tel:'123'}}],null);assert.deepEqual(S.guards[0].puestoIds,ids);
});

test('tener varios puestos asignados mantiene las directivas del puesto que se está cubriendo',()=>{
 const S=estadoVacio();S.posts=[{id:'p1',nombre:'Paseo'},{id:'p2',nombre:'Playa'}];
 S.directives=[{id:'d1',puestoId:'p1',activa:true,hora:'09:00'},{id:'d2',puestoId:'p2',activa:true,hora:'09:00'}];
 assert.deepEqual(directivasDeHoy(S,{puestoId:'p2',puestoIds:['p1','p2']},'2026-11-01').map(d=>d.id),['d2']);
});
