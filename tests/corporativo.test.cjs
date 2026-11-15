require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {estadoVacio}=require('../src/model.ts');
const {pinCorporativoValido,cambiarResponsable,guardiaResponsable,guardiasDelCorporativo}=require('../src/corporativo.ts');
const {aplicarCambios}=require('../src/mutaciones.ts');
const {segundosRonda,formatoCronometro}=require('../src/rondaNocturna.ts');
const {precintosPorton,nuevasPuertas,completarPuertas}=require('../src/precintos.ts');
const {normalizarAccesosRapidos,RAPIDAS_INICIALES}=require('../src/accionesRapidas.ts');
const {guardiasEnServicio}=require('../src/presencias.ts');
const ahora=new Date(2026,10,6,10,0),cuenta={id:'corp',corporativo:true,rol:'admin',cuenta:true,nombre:'Guardia Paseo',apellido:'',puestoId:'p',franjaId:'f'};
function base(){const S=estadoVacio();S.guards=[cuenta,{id:'a',nombre:'Ana',apellido:'Prueba',rol:'vigilador',puestoId:'p'},{id:'b',nombre:'Bruno',apellido:'Prueba',rol:'vigilador',puestoId:'playa',puestoIds:['playa','p']}];S.posts=[{id:'p',nombre:'Paseo'},{id:'playa',nombre:'Playa'}];S.franjas=[{id:'f',puestoId:'p',nombre:'Mañana',entrada:'06:00',salida:'14:00'}];return S;}
test('el PIN del corporativo admite exactamente seis números',()=>{
 assert.equal(pinCorporativoValido('638201'),true);for(const v of ['','63820','6382011','63820a',' 638201','６３８２０１'])assert.equal(pinCorporativoValido(v),false);
});
test('una cuenta administrativa ingresa con su propia identidad y nunca queda a cargo del corporativo',()=>{
 const S=base(),admin={id:'admin',nombre:'Administración',rol:'admin'};
 S.guards.push(admin);
 S.punches.push({id:'viejo',guardId:cuenta.id,dispositivoId:'telefono',responsableId:admin.id,out:''});
 assert.equal(guardiaResponsable(S,admin,'telefono'),admin);
 assert.equal(guardiaResponsable(S,cuenta,'telefono'),null);
 assert.throws(()=>cambiarResponsable(S,cuenta,admin.id,'telefono',ahora),/guardia asignado/);
 const e=aplicarCambios(S,cambiarResponsable(S,cuenta,'a','telefono',ahora),cuenta,true,'telefono');
 assert.ok(e.punches.find(p=>p.id==='viejo').closedAt);
 assert.equal(guardiaResponsable(e,cuenta,'telefono').id,'a');
});
test('el responsable se conserva en la actividad y el relevo cierra sólo la de este teléfono',()=>{
 let S=base();assert.equal(guardiaResponsable(S,cuenta,'telefono'),null);
 S=aplicarCambios(S,cambiarResponsable(S,cuenta,'a','telefono',ahora),cuenta,true,'telefono');
 assert.equal(guardiaResponsable(S,cuenta,'telefono').id,'a');assert.deepEqual(cambiarResponsable(S,cuenta,'a','telefono',ahora),[]);
 const anterior=S.punches[0];S.novedades=[{id:'nota',categoria:'General',fecha:'2026-11-06',hora:'10:01',guardId:'a',createdBy:'corp',turnoId:anterior.id,texto:'Texto original'}];
 S.punches.push({...anterior,id:'otro',dispositivoId:'otro-telefono',responsableId:'b'});
 S=aplicarCambios(S,cambiarResponsable(S,cuenta,'b','telefono',new Date(2026,10,6,11,0)),cuenta,true,'telefono');
 assert.ok(S.punches.find(p=>p.id===anterior.id).closedAt);assert.equal(S.punches.find(p=>p.id==='otro').out,'');assert.equal(S.novedades[0].guardId,'a');assert.equal(S.novedades[0].createdBy,'corp');assert.ok(S.novedades[0].lockedAt);assert.equal(guardiaResponsable(S,cuenta,'telefono').id,'b');
 assert.throws(()=>cambiarResponsable(S,cuenta,'corp','telefono'),/guardia asignado/);
 assert.ok(!guardiasEnServicio(S,new Date(2026,10,6,11,1)).some(g=>g.id==='corp'));
});
test('cada corporativo usa su puesto y reconoce la cobertura secundaria sin modificar el perfil del vigilador',()=>{
 const S=base();
 const playa={...cuenta,id:'corp-playa',puestoId:'playa'};
 S.guards.push(playa,{id:'c',rol:'vigilador',puestoId:'playa'},{id:'d',rol:'vigilador',puestoId:'p',deleted:true});
 assert.deepEqual(guardiasDelCorporativo(S,cuenta).map(g=>g.id),['a','b']);
 assert.deepEqual(guardiasDelCorporativo(S,playa).map(g=>g.id),['b','c']);
 assert.throws(()=>cambiarResponsable(S,cuenta,'c','telefono',ahora),/guardia asignado/);
 const e=aplicarCambios(S,cambiarResponsable(S,cuenta,'b','telefono',ahora),cuenta,true,'telefono');
 assert.equal(guardiaResponsable(e,cuenta,'telefono').puestoId,'p');
 assert.equal(e.guards.find(g=>g.id==='b').puestoId,'playa');
});
test('un cronómetro nocturno sigue contando al cruzar medianoche y después de reconstruir el estado',()=>{
 const inicio=new Date(2026,10,6,23,55).getTime(),r={fecha:'2026-11-06',inicio:'23:55',inicioAt:inicio};
 assert.equal(formatoCronometro(segundosRonda(JSON.parse(JSON.stringify(r)),new Date(2026,10,7,0,18,42).getTime())),'00:23:42');
 assert.equal(formatoCronometro(segundosRonda({fecha:r.fecha,inicio:r.inicio},inicio+3723000)),'01:02:03');
});
test('los portones no distinguen hojas y conservan todos los números de los registros anteriores',()=>{
 for(const conf of ['ingreso','egreso','ingreso-egreso']){const ps=nuevasPuertas('porton',conf,'1234');assert.equal(ps.length,1);assert.equal(ps[0].nombre,'Portón');}
 const antes=[{id:'in',nombre:'Hoja de ingreso',precintos:['1234567','1234568']},{id:'out',nombre:'Hoja de egreso',precintos:['1234569']}];
 const ps=precintosPorton(antes);assert.deepEqual(completarPuertas(ps)[0].precintos,['1234567','1234568','1234569']);assert.equal(antes[0].nombre,'Hoja de ingreso');
});
test('los accesos rápidos incluyen Recorridos por defecto y se deduplican al personalizarlos',()=>{
 assert.deepEqual(RAPIDAS_INICIALES,['accesos','ingresos','recorridos']);assert.deepEqual(normalizarAccesosRapidos(['libro','libro','recorridos','invalido']),['libro','recorridos']);assert.deepEqual(normalizarAccesosRapidos([]),[]);
});
