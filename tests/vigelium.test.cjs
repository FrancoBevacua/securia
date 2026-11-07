require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {redactarAsiento,categoriaAsiento,apellidoNombre,numeroSupervisor,nombreArchivoReporte}=require('../src/reporte.ts');
const {gsName}=require('../src/text.ts');
const {textoMovimientoBreve,novTextoCompleto,validarFormatoMovimientos}=require('../src/text.ts');
const {textoInformeDia,validarRedaccionDia,entradasDeVentana}=require('../src/informedia.ts');
const {estadoVacio}=require('../src/model.ts');
test('el ingreso y el egreso manuales siempre ubican apellido antes del nombre',()=>{
 const d={apellido:'De la Cruz',nombre:'Ana María',movimiento:'ingreso',turno:'10:00-22:00'};
 assert.equal(redactarAsiento('Ingreso/Egreso',d,undefined,'Playa 2'),'Ingresa Gs De la Cruz, Ana María al puesto Playa 2. Turno: 10:00-22:00.');
 assert.equal(redactarAsiento('Ingreso/Egreso',{...d,movimiento:'egreso'}),'Se retira el Gs De la Cruz, Ana María.');
 assert.equal(gsName({apellido:'De la Cruz',nombre:'Ana María'},{}),'Gs De la Cruz, Ana María');
});
test('adicional y recorrido generan el formato formal requerido',()=>{
 assert.equal(redactarAsiento('Adicional',{apellido:'Murillo',nombre:'Jesica',turno:'09:00-16:00'}),'Ingresa adicional policial Murillo, Jesica. Turno: 09:00-16:00.');
 assert.equal(redactarAsiento('Recorrido',{}),'Se realiza recorrido del paseo. Sin novedades.');
 assert.equal(redactarAsiento('Recorrido',{lugar:'la playa',observaciones:'Se informa una luminaria apagada.'}),'Se realiza recorrido de la playa. Se informa una luminaria apagada.');
 assert.equal(redactarAsiento('Ingreso/Egreso',{}),'');
});

test('el ingreso extenso se muestra breve con sus datos históricos y observaciones intactos',()=>{
 const texto='Se registra el ingreso de Gs Villaroel, Sebastián al puesto Playa 1 para cumplir el turno de 23:00 a 07:00 horas.';
 const breve='Ingresa Gs Villaroel, Sebastián al puesto Playa 1. Turno: 23:00-07:00.';
 assert.equal(textoMovimientoBreve(texto),breve);
 assert.equal(textoMovimientoBreve(texto+' Se informa una demora.'),breve+' Se informa una demora.');
 const S=estadoVacio();S.novedades=[{id:'historico',fecha:'2026-10-24',hora:'23:00',categoria:'Ingreso',origenTipo:'guardia',texto}];
 const respaldo=JSON.stringify(S);
 assert.equal(entradasDeVentana(S,{fecha:'2026-10-24',corte:'00:00'})[0].texto,breve);
 assert.equal(novTextoCompleto(S.novedades[0]),breve);
 assert.equal(JSON.stringify(S),respaldo);
 for(const libre of ['Se registra el ingreso de un proveedor.','Se registra el ingreso de Gs Prueba al puesto Paseo.','Ingresa Gs Cuevas, Gustavo al puesto Paseo. Turno: 23:00-07:00.'])assert.equal(textoMovimientoBreve(libre),libre);
});

test('la IA conserva literalmente el ingreso y puede corregir otras novedades del informe',()=>{
 const ingreso='Ingresa Gs Cuevas, Gustavo al puesto Paseo. Turno: 23:00-07:00.';
 const largo='Se registra el ingreso de Gs Cuevas, Gustavo al puesto Paseo para cumplir el turno de 23:00 a 07:00 horas.';
 assert.doesNotThrow(()=>validarFormatoMovimientos(ingreso,ingreso));
 assert.doesNotThrow(()=>validarFormatoMovimientos('Notas de ingreso aún sin redactar.',ingreso));
 for(const alterado of [largo,ingreso.replace('Gustavo','Sebastián'),ingreso.replace('Paseo','Playa 1'),ingreso.replace('23:00','22:00')])assert.throws(()=>validarFormatoMovimientos(ingreso,alterado),/La IA cambió/);
 const original=textoInformeDia([{fecha:'2026-10-24',hora:'23:00',categoria:'INGRESO',texto:ingreso,firma:'Gs Prueba, Ana'},{fecha:'2026-10-24',hora:'23:15',categoria:'NOVEDAD',texto:'Se abre el portón.',firma:'Gs Prueba, Ana'}],{site:'Prueba',fecha:'2026-10-24',cierre:'',fotos:0});
 assert.throws(()=>validarRedaccionDia(original,original.replace(ingreso,largo)),/La IA cambió/);
 assert.doesNotThrow(()=>validarRedaccionDia(original,original.replace('Se abre','Se procede a abrir')));
});
test('los egresos nuevos y anteriores conservan Se retira el Gs y sus observaciones',()=>{
 const breve='Se retira el Gs Cuevas, Gustavo.';
 assert.equal(textoMovimientoBreve('Se registra el egreso de Gs Cuevas, Gustavo.'),breve);
 assert.equal(textoMovimientoBreve('Se retira Gs Cuevas, Gustavo.'),breve);
 assert.equal(textoMovimientoBreve('Se registra el egreso de Gs Cuevas, Gustavo. Entrega el puesto sin novedades.'),breve+' Entrega el puesto sin novedades.');
 assert.equal(textoMovimientoBreve('Se registra el egreso de Gs Cuevas, Gustavo del puesto Paseo, turno 23:00-07:00.'),'Se retira el Gs Cuevas, Gustavo del puesto Paseo, turno 23:00-07:00.');
 assert.equal(redactarAsiento('Ingresos/Egresos',{apellido:'Cuevas',nombre:'Gustavo',movimiento:'egreso'}),breve);
 const S=estadoVacio();S.novedades=[{id:'egreso',fecha:'2026-10-25',hora:'07:00',categoria:'Egreso',texto:'Se registra el egreso de Gs Cuevas, Gustavo.'}];
 const respaldo=JSON.stringify(S);
 assert.equal(entradasDeVentana(S,{fecha:'2026-10-25',corte:'00:00'})[0].texto,breve);
 assert.equal(JSON.stringify(S),respaldo);
 assert.doesNotThrow(()=>validarFormatoMovimientos(breve,breve));
 assert.throws(()=>validarFormatoMovimientos(breve,'Se registra el egreso de Gs Cuevas, Gustavo.'),/La IA cambió/);
 assert.throws(()=>validarFormatoMovimientos(breve,breve.replace('Gustavo','Sebastián')),/La IA cambió/);
 const informe='07:00 EGRESO\n'+breve+'\nGs Prueba, Ana';
 assert.throws(()=>validarFormatoMovimientos(informe,informe.replace(breve,'Se registra el egreso de Gs Cuevas, Gustavo.')),/La IA cambió/);
});

test('las categorías de registros previos se normalizan sin perder información',()=>{
 assert.equal(redactarAsiento('Apertura',{acceso:'Portón Río Shop'}),'Se procede a la apertura del portón Río Shop.');
 assert.equal(redactarAsiento('Cierre',{acceso:'Puerta E8'}),'Se procede al cierre de la puerta E8.');
 assert.equal(categoriaAsiento({categoria:'Relevo',texto:'Se registra el egreso de Gs Roca Julio.'}),'EGRESO');
 assert.equal(categoriaAsiento({categoria:'Adicional policial',texto:''}),'ADICIONAL');
 assert.equal(categoriaAsiento({categoria:'Acceso',texto:'',visitId:'v'}),'EXTERNO');
});
test('los asientos automáticos antiguos de inicio y fin no contaminan el reporte nuevo',()=>{
 const S=estadoVacio();S.novedades=[{id:'servicio-in:t',fecha:'2026-09-10',hora:'07:00',texto:'Automático'},{id:'manual',fecha:'2026-09-10',hora:'07:01',texto:'Manual',categoria:'Ingreso'}];
 assert.deepEqual(entradasDeVentana(S,{fecha:'2026-09-10',corte:'00:00'}).map(x=>x.texto),['Manual']);assert.equal(S.novedades.length,2);
});
test('la IA debe conservar hora, categoría y firma en el nuevo formato',()=>{
 const original=textoInformeDia([{fecha:'2026-09-10',hora:'06:30',categoria:'APERTURA',texto:'Se abre el portón.',firma:'Gs Roca, Julio'}],{site:'Libertad Rosario',fecha:'2026-09-10',cierre:'',fotos:0});
 assert.match(original,/06:30 APERTURA\nSe abre el portón.\nGs Roca, Julio/);
 assert.throws(()=>validarRedaccionDia(original,original.replace('APERTURA','CIERRE')));
 assert.throws(()=>validarRedaccionDia(original,original.replace('Roca, Julio','Julio, Roca')));
 assert.doesNotThrow(()=>validarRedaccionDia(original,original.replace('Se abre','Se procede a abrir')));
});
test('el nombre exportado y el número del supervisor son válidos para Android',()=>{
 assert.equal(nombreArchivoReporte('2026-09-10'),'LIBERTAD ROSARIO - REPORTE DIARIO 2026-09-10.pdf');
 assert.equal(numeroSupervisor('+54 9 341 1234567'),'5493411234567');assert.throws(()=>numeroSupervisor('123'));
});
