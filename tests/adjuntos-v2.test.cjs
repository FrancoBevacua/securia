require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {configurarAdjuntos,resolverAdjunto}=require('../src/adjuntosNube.ts');
test('evidencia se descarga al solicitarla, comparte pedidos concurrentes y respeta sesión',async()=>{
 let llamadas=0;configurarAdjuntos(async p=>{llamadas++;assert.equal(p.accion,'foto');return {foto:'data:image/jpeg;base64,YWJj'};});
 assert.equal(llamadas,0);assert.equal(await resolverAdjunto('file:///local.jpg'),'file:///local.jpg');assert.equal(llamadas,0);
 const ref='vige://objetivo/'+'a'.repeat(64);
 const r=await Promise.all([resolverAdjunto(ref),resolverAdjunto(ref)]);assert.equal(llamadas,1);assert.equal(r[0],r[1]);
 await resolverAdjunto(ref);assert.equal(llamadas,1);
 configurarAdjuntos(async()=>{throw Error('Sesión vencida');});await assert.rejects(resolverAdjunto(ref),/Sesión/);
});
test('la memoria de imágenes expulsa fotos antiguas al alcanzar 8 MB',async()=>{
 let n=0;configurarAdjuntos(async()=>{n++;return {foto:'data:image/jpeg;base64,'+'a'.repeat(3*1024*1024)};});
 for(const ref of ['vige://a/1','vige://a/2','vige://a/3'])await resolverAdjunto(ref);
 assert.equal(n,3);await resolverAdjunto('vige://a/1');assert.equal(n,4);
});
