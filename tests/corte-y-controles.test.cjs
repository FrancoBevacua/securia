require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {ventanaDelHecho,ventanaReciente,limites,entradasDeVentana,horaCorte}=require('../src/informedia.ts');
const {fechaDelControl,valorDelControl}=require('../src/fechaHora.ts');
const {estadoVacio}=require('../src/model.ts');
for(const [fecha,hora,inicio,fin] of [
 ['2026-09-19','18:59','2026-09-18','2026-09-19'],['2026-09-19','19:00','2026-09-19','2026-09-20'],
 ['2026-09-19','19:05','2026-09-19','2026-09-20'],['2026-09-20','00:05','2026-09-19','2026-09-20'],
 ['2026-12-31','23:59','2026-12-31','2027-01-01']]){
 test(fecha+' '+hora+' conserva su día y pertenece al informe correcto',()=>{
  const v=ventanaDelHecho(fecha,hora),S=estadoVacio();S.novedades=[{id:'n',fecha,hora,texto:'Hecho real'}];
  assert.equal(v.fecha,inicio);assert.equal(limites(v).hasta.fecha,fin);
  assert.equal(entradasDeVentana(S,v)[0].fecha,fecha);
  assert.equal(ventanaReciente('19:00',24,false,new Date(fecha+'T'+hora+':00')).fecha,inicio);
 });
}
test('calendario conserva día local, formato de nacimiento y minutos de corte',()=>{
 const d=new Date(2026,8,19,19,5);
 assert.equal(valorDelControl(d,'fecha'),'2026-09-19');assert.equal(valorDelControl(d,'fecha','dmy'),'19/09/2026');
 assert.equal(valorDelControl(d,'hora'),'19:05');assert.equal(fechaDelControl('29/02/2000','fecha','dmy').getDate(),29);
 assert.equal(fechaDelControl('31/02/2026','fecha','dmy',d).getTime(),d.getTime());
 assert.equal(horaCorte({site:{corteInforme:'19:30'}}),'19:30');
});
