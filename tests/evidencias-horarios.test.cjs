require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {horariosPuesto}=require('../src/horarios.ts'),{estadoVacio}=require('../src/model.ts'),{agruparEvidencias}=require('../src/evidencias.ts');
const {construirPDFDia}=require('../src/pdfplantilla.ts'),{validarRedaccionDia}=require('../src/informedia.ts');
test('horarios por puesto y adicional, sin confundir Playa 2 con Motero',()=>{
 for(const [p,v] of Object.entries({'Paseo':['06:00-14:00','14:00-23:00'],'Rondín Nocturno':['23:00-07:00'],'Playa 1':['10:00-22:00','23:00-07:00'],'Playa 2 Motero':['05:00-14:00','14:00-22:00'],'Playa 3':['14:00-23:00']}))assert.deepEqual(horariosPuesto(p).map(x=>x.v),v);
 assert.deepEqual(horariosPuesto('Playa 2'),[]);assert.equal(horariosPuesto('',true)[0].v,'09:00-16:00');
});
test('evidencias conservan su novedad, sector, fecha y hora, incluidas rondas anteriores',()=>{
 const s=estadoVacio();s.novedades=[{id:'a',fecha:'2026-09-26',hora:'10:00',categoria:'Inicio de ronda',texto:'Control',origenId:'r',fotos:['foto1','foto2']},{id:'b',fecha:'2026-09-26',hora:'11:00',categoria:'Novedad',texto:'Otra novedad',sector:'Puerta E2',fotos:['foto3']}];s.rounds=[{id:'r',puesto:'Playa 1'}];
 const g=agruparEvidencias(s,['foto1','foto2','foto3']);assert.equal(g.length,2);assert.deepEqual(g[0].fotos,['foto1','foto2']);assert.equal(g[0].sector,'Playa 1');assert.equal(g[1].sector,'Puerta E2');assert.equal(g[0].fecha,'26/09/2026');assert.equal(g[0].hora,'10:00');
});

test('la evidencia sólo lleva hora, tipo y descripción breve, nunca el ingreso completo',()=>{
 const s=estadoVacio();s.novedades=[{id:'a',fecha:'2026-09-29',hora:'10:00',categoria:'Externo',texto:'Ingreso de contratista con lista extensa de personas y documentos'.repeat(100),descripcionEvidencia:'  Herramientas\n revisadas  ',fotos:['f1']},{id:'b',fecha:'2026-09-29',hora:'11:00',categoria:'Novedad',texto:'Texto antiguo muy largo',fotos:['f2']}];
 const g=agruparEvidencias(s,['f1','f2']);assert.equal(g[0].titulo,'10:00 EXTERNO — Herramientas revisadas');assert.equal(g[1].titulo,'11:00 NOVEDAD');
 const {descripcionEvidencia}=require('../src/evidencias.ts');assert.equal(descripcionEvidencia('x'.repeat(500)).length,100);
});

test('cuatro imágenes, incluso panorámicas, comparten una fila con un margen pequeño',()=>{
 const jpeg=require('jpeg-js');
 const foto=jpeg.encode({width:200,height:100,data:Buffer.alloc(200*100*4,255)},75).data;
 const fotos=Array(5).fill(foto),grupos=[{titulo:'10:00 NOVEDAD — Precinto dañado',fecha:'29/09/2026',hora:'10:00',sector:'Portón',fotos}];
 const pdf=Buffer.from(construirPDFDia('Novedades:',fotos,grupos)).toString('latin1');
 const posiciones=[...pdf.matchAll(/q ([\d.]+) 0 0 ([\d.]+) ([\d.]+) ([\d.]+) cm \/Im\d+ Do Q/g)].map(m=>m.slice(1).map(Number));
 assert.equal(posiciones.length,5);assert.equal(new Set(posiciones.slice(0,4).map(p=>p[3])).size,1);
 for(let i=1;i<4;i++)assert.ok(Math.abs(posiciones[i][2]-posiciones[i-1][2]-posiciones[i-1][0]-4)<.02);
 assert.ok(posiciones[4][3]<posiciones[0][3]);
 assert.equal(posiciones[4][0],posiciones[0][0]);
});
test('los títulos de ronda y sus horas usan fuente negrita y la IA no puede omitirlos',()=>{
 const texto='10:00 INICIO DE RONDA\nControl de Playa 1\nGs Pérez, Juan\n11:00 FIN DE RONDA\nSin novedades\nGs Pérez, Juan';
 const pdf=Buffer.from(construirPDFDia(texto)).toString('latin1');assert.match(pdf,/\/F2 9.5 Tf[^\n]*10:00 INICIO DE RONDA/);assert.match(pdf,/\/F2 9.5 Tf[^\n]*11:00 FIN DE RONDA/);
 assert.throws(()=>validarRedaccionDia(texto,texto.replace('10:00 INICIO DE RONDA','Inicio')));
});
