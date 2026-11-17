require('./register.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const Module=require('node:module');
const cargar=Module._load;
// Contrato estricto de Android y AES-GCM real, sin sustituir el código de la caché.
const aes={
 CryptoDigestAlgorithm:{SHA256:'sha256'},digestStringAsync:async(alg,s)=>crypto.createHash(alg).update(s).digest('hex'),
 getRandomBytesAsync:async n=>crypto.randomBytes(n),
 AESKeySize:{AES256:256},
 AESEncryptionKey:{import:async(s,formato)=>Buffer.from(s,formato),generate:async()=>{const key=crypto.randomBytes(32);key.encoded=async formato=>key.toString(formato);return key;}},
 AESSealedData:{fromCombined(bytes){assert.ok(bytes instanceof Uint8Array,'Android exige ByteArray');return Buffer.from(bytes);}},
 async aesDecryptAsync(bytes,key){const d=crypto.createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12));d.setAuthTag(bytes.subarray(-16));return Buffer.concat([d.update(bytes.subarray(12,-16)),d.final()]);},
 async aesEncryptAsync(bytes,key){const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',key,iv);const b=Buffer.concat([iv,c.update(bytes),c.final(),c.getAuthTag()]);return {combined:async()=>b.toString('base64')};}
};
const almacenamiento=new Map();
Module._load=function(name,...args){if(name==='@react-native-async-storage/async-storage')return {getItem:async k=>almacenamiento.get(k)||null,setItem:async(k,v)=>{almacenamiento.set(k,v);},removeItem:async k=>{almacenamiento.delete(k);}};return name==='expo-crypto'?aes:cargar.call(this,name,...args);};
const {abrirCache,sellarCache}=require('../src/cacheCifrada.ts');
const clave=crypto.randomBytes(32),sobre={estado:{guards:[],novedades:[{texto:'Información pendiente: acción'}]},guardia:'prueba',revision:2,numero:3};
test('recupera el formato Base64 anterior mediante bytes compatibles con Kotlin',async()=>{
 const original=await aes.aesEncryptAsync(Buffer.from(JSON.stringify(sobre)),clave);
 assert.deepEqual(await abrirCache(await original.combined(),clave),sobre);
});
test('cifra y recupera los cambios sin almacenar texto legible',async()=>{
 const guardado=await sellarCache(sobre,clave);assert.ok(!guardado.includes('Información'));assert.deepEqual(await abrirCache(guardado,clave),sobre);
});
test('clave incorrecta, corrupción o formato inválido producen un error breve sin revelar el cifrado',async()=>{
 const guardado=await sellarCache(sobre,clave),bytes=Buffer.from(guardado,'base64');bytes[20]^=1;
 for(const [valor,key] of [[guardado,crypto.randomBytes(32)],[bytes.toString('base64'),clave],['invalido',clave]]){
  await assert.rejects(abrirCache(valor,key),e=>e.message.length<180&&!e.message.includes(valor)&&e.message.includes('Se conserva intacta'));
 }
 assert.deepEqual(await abrirCache(guardado,clave),sobre);
});
test('acceso, cola por filas cifrada sin red y reingreso conservan pendientes y reintentos idempotentes',async()=>{
 let nube=require('../src/nube.ts');const {estadoVacio}=require('../src/model.ts'),{almacenLocal}=require('../src/almacenLocal.ts');
 const remoto=new Map(),recibos=new Map();let secuencia=1,sinRed=false,perder=false,consultas=0,sesionVencida=false;
 const estado=estadoVacio();estado.guards=[{id:'guardia-prueba',dni:'12345678',nombre:'Ana',apellido:'Prueba',cuenta:true,rol:'vigilador'}];
 for(const col of ['site','guards']){const valor=col==='site'?estado.site:estado.guards[0],id=col==='site'?'site':valor.id;remoto.set(col+'/'+id,{col,id,valor,hash:'h'+secuencia,secuencia:secuencia++});}
 const snapshot=()=>{const e=estadoVacio();for(const f of remoto.values()){if(f.col==='site')e.site=f.valor;else e[f.col].push(f.valor);}return e;};
 const originalFetch=global.fetch;
 global.fetch=async(url,opciones)=>{
  const p=JSON.parse(opciones.body).p_request;let r={ok:true};
  if(p.accion==='salir'&&sesionVencida)return {ok:true,json:async()=>({ok:false,codigo:'sesion',error:'Iniciá sesión con tu DNI y PIN'})};
  if(p.accion==='ingresar')r=p.pin==='654321'?{ok:true,estado:snapshot(),guardia:'guardia-prueba',token:'a'.repeat(64),revision:1}:{ok:false,error:'DNI o PIN incorrectos.'};
  if(p.accion==='consultar'){consultas++;if(sinRed)throw new TypeError('sin red');r={ok:true,filas:[...remoto.values()].filter(f=>f.secuencia>p.cursor),cursor:secuencia-1,mas:false};}
  if(p.accion==='guardar'){
   if(sinRed)throw new TypeError('sin red');assert.ok(Array.isArray(p.filas));assert.equal(p.estado,undefined);assert.equal(p.cambios,undefined);
   if(recibos.has(p.lote))r=recibos.get(p.lote);else{r={ok:true,acuses:p.filas.map(f=>{const fila={col:f.col,id:f.id,valor:f.valor,hash:'h'+secuencia,secuencia:secuencia++};remoto.set(f.col+'/'+f.id,fila);return {...fila,estado:'confirmado'};})};recibos.set(p.lote,r);if(perder){perder=false;throw new TypeError('respuesta perdida');}}
  }
  return {ok:true,json:async()=>r};
 };
 try{
  await nube.iniciarNube();await nube.conectarTelefono();await nube.ingresarNube('12345678','654321');
  const local=snapshot();local.novedades=[{id:'pendiente',texto:'Novedad pendiente'}];sinRed=true;
  await assert.rejects(nube.guardarEnNube(local),/Revise Internet/);
  const claves=await almacenLocal.claves('sync.v2/guardia-prueba/cola/');assert.equal(claves.length,1);
  const cifrado=await almacenLocal.getItem(claves[0]);assert.ok(cifrado&&!cifrado.includes('Novedad pendiente'));assert.equal(await almacenLocal.getItem('guardia.nube.cola.v1'),null);
  await assert.rejects(nube.cerrarSesionNube());assert.equal(await almacenLocal.getItem(claves[0]),cifrado);
  delete require.cache[require.resolve('../src/nube.ts')];nube=require('../src/nube.ts');await nube.iniciarNube();
  const antes=consultas,offline=await nube.restaurarSesionNube();assert.equal(consultas,antes);assert.equal(offline.estado.novedades[0].texto,'Novedad pendiente');
  await assert.rejects(nube.ingresarNube('12345678','000000'),/PIN incorrectos/);assert.equal(await almacenLocal.getItem(claves[0]),cifrado);
  sinRed=false;await nube.ingresarNube('12345678','654321');perder=true;await assert.rejects(nube.reintentarNube(),/Revise Internet/);
  assert.equal((await almacenLocal.claves('sync.v2/guardia-prueba/cola/')).length,1);await nube.reintentarNube();assert.equal(recibos.size,1);
  assert.equal(nube.verEstadoNube().pendiente,false);assert.equal((await almacenLocal.claves('sync.v2/guardia-prueba/cola/')).length,0);
  delete require.cache[require.resolve('../src/nube.ts')];nube=require('../src/nube.ts');await nube.iniciarNube();assert.equal((await nube.restaurarSesionNube()).estado.novedades[0].texto,'Novedad pendiente');
  sesionVencida=true;
  await Promise.all([nube.cerrarSesionNube(),nube.cerrarSesionNube(),nube.reintentarNube()]);assert.equal(await nube.restaurarSesionNube(),null);
  assert.equal(nube.verEstadoNube().error,'');assert.equal(nube.verEstadoNube().reautenticar,false);
  const cerradas=consultas;await nube.reintentarNube();assert.equal(consultas,cerradas);
 }finally{global.fetch=originalFetch;}
});
