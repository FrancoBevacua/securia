const stubs=require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {crearPDF}=require('../src/pdfw.ts');
const {extraerTextoPDFConCobertura}=require('../src/pdfr.ts');
const {elegirDocumento}=require('../src/lectura.ts');
test('un PDF con texto en todas sus páginas se lee completo, incluido el final',async()=>{
 const p=crearPDF();p.text('Directivas de la primera página.');p.newPage();p.text('Siempre usar el uniforme completo en el servicio.');const bytes=p.build();
 const r=await extraerTextoPDFConCobertura(bytes.buffer);assert.equal(r.lecturaCompleta,true);assert.equal(r.paginasDetectadas,2);assert.match(r.texto,/uniforme completo/);
});
test('un PDF mixto conserva todas las páginas para visión y no devuelve sólo la capa parcial de texto',async()=>{
 const p=crearPDF();p.text('Texto legible de la primera página.');p.newPage();p.rule();const bytes=p.build();
 const r=await extraerTextoPDFConCobertura(bytes.buffer);assert.equal(r.lecturaCompleta,false);assert.equal(r.paginasDetectadas,2);assert.equal(r.paginasConTexto,1);
 stubs.bytes=bytes;stubs.picker.getDocumentAsync=async()=>({assets:[{uri:'file://mixto.pdf',name:'mixto.pdf',mimeType:'application/pdf'}]});
 const doc=await elegirDocumento();assert.equal(doc.clase,'pdf');assert.equal(doc.imagen.base64,Buffer.from(bytes).toString('base64'));
});
