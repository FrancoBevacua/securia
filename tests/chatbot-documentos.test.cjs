require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module'),crypto=require('node:crypto');
const disco=new Map(),load=Module._load;
const aes={AESKeySize:{AES256:256},AESEncryptionKey:{import:async(s,f)=>Buffer.from(s,f),generate:async()=>{const k=crypto.randomBytes(32);k.encoded=async f=>k.toString(f);return k;}},AESSealedData:{fromCombined:b=>Buffer.from(b)},
 async aesEncryptAsync(bytes,k){const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',k,iv),b=Buffer.concat([iv,c.update(bytes),c.final(),c.getAuthTag()]);return{combined:async()=>b.toString('base64')};},
 async aesDecryptAsync(b,k){const d=crypto.createDecipheriv('aes-256-gcm',k,b.subarray(0,12));d.setAuthTag(b.subarray(-16));return Buffer.concat([d.update(b.subarray(12,-16)),d.final()]);}};
Module._load=function(n,...a){if(n==='expo-crypto')return aes;if(n==='./almacenLocal')return{almacenLocal:{claves:async p=>[...disco.keys()].filter(k=>k.startsWith(p)),getItem:async k=>disco.get(k)||null,setItem:async(k,v)=>disco.set(k,v)}};return load.call(this,n,...a);};
const {leerDocumentosChat,guardarDocumentosChat}=require('../src/documentosChat.ts');
test('biblioteca cifrada separada por guardia, sin perder documentos ante texto inválido o corrupción',async()=>{
 const docs=[{id:'d',nombre:'Directivas generales.pdf',texto:'Texto confidencial ficticio de directivas para una prueba local.',puestoId:'',createdAt:1}];
 await guardarDocumentosChat('guardia-a',docs);assert.deepEqual(await leerDocumentosChat('guardia-a'),docs);assert.deepEqual(await leerDocumentosChat('guardia-b'),[]);assert.ok(![...disco.values()][0].includes('confidencial'));
 await assert.rejects(guardarDocumentosChat('guardia-a',[{...docs[0],texto:'x'}]));assert.deepEqual(await leerDocumentosChat('guardia-a'),docs);
 const key=[...disco.keys()][0],anterior=disco.get(key);disco.set(key,anterior.slice(0,-10)+'AAAAAAAAAA');await assert.rejects(leerDocumentosChat('guardia-a'));assert.equal(disco.size,1);disco.set(key,anterior);
});
