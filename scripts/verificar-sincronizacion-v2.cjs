// Prueba HTTP con un objetivo sintético creado por el operador. No usar cuentas reales.
require('../tests/register.cjs');
const fs=require('fs'),crypto=require('crypto'),assert=require('node:assert/strict');
const {ColaRegistros}=require('../src/colaRegistros.ts');
const {solicitarNube}=require('../src/transporteNube.ts');
const {NUBE_URL,NUBE_PUBLICA}=require('../src/nubeConfig.ts');
const cred=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const inicio=Date.now(),medidas=[],disco=new Map();
const rpc=async p=>{
 const antes=Date.now();
 const {respuesta,datos}=await solicitarNube(NUBE_URL+'/rest/v1/rpc/guardia_sync',{method:'POST',headers:{apikey:NUBE_PUBLICA,'Content-Type':'application/json'},body:JSON.stringify({p_request:{...p,dispositivo:cred.dispositivo,token:cred.token}})},20000);
 medidas.push({accion:p.accion,ms:Date.now()-antes,bytes:JSON.stringify(datos).length});
 if(!respuesta.ok||!datos.ok)throw Error(datos.error||datos.message||'API '+respuesta.status);
 return datos;
};
async function main(){
 const contenido='data:image/jpeg;base64,'+crypto.randomBytes(170000).toString('base64'),hash=crypto.createHash('sha256').update(contenido).digest('hex'),partes=Math.ceil(contenido.length/131072);
 let ref;
 for(let numero=0;numero<partes;numero++){
  const r=await rpc({accion:'adjunto',hash,numero,partes,longitud:contenido.length,contenido:contenido.slice(numero*131072,(numero+1)*131072)});
  assert.equal(r.completo,numero===partes-1);ref=r.ref;
 }
 assert.equal((await rpc({accion:'adjunto',hash,numero:0,partes,longitud:contenido.length,contenido:contenido.slice(0,131072)})).completo,true);
 assert.equal((await rpc({accion:'foto',ref})).foto,contenido);
 const io={leer:async k=>structuredClone(disco.get(k)||null),escribir:async(k,v)=>disco.set(k,structuredClone(v)),quitar:async k=>disco.delete(k),claves:async prefijo=>[...disco.keys()].filter(k=>k.startsWith(prefijo))};
 let respuestaPerdida=true,envios=0;
 const net={consultar:cursor=>rpc({accion:'consultar',cursor}),preparar:async v=>structuredClone(v),enviar:async(lote,filas)=>{
  const r=await rpc({accion:'guardar',lote,filas});envios++;
  if(respuestaPerdida){respuestaPerdida=false;throw Error('Respuesta perdida simulada');}
  return r;
 }};
 let q=new ColaRegistros('api-sync-test',io,net);await q.iniciar();await q.sincronizar();
 const e=q.estado(),base=structuredClone(e),telefono=crypto.createHash('sha256').update(cred.dispositivo).digest('hex');
 e.punches=[{id:'offline-api',guardId:'api-sync-test',dispositivoId:telefono,fecha:'2026-10-01',in:'07:00',out:'19:00',fechaOut:'2026-10-01',startedAt:100,closedAt:200},
 {id:'siguiente-api',guardId:'api-sync-test',dispositivoId:telefono,fecha:'2026-10-01',in:'19:00',out:'',startedAt:201}];
 e.novedades=Array.from({length:500},(_,i)=>({id:'api-nota-'+i,guardId:'api-sync-test',createdBy:'api-sync-test',turnoId:'offline-api',fecha:'2026-10-01',hora:'12:00',texto:'Evidencia y lote de prueba '+i,...(i===0?{fotos:[ref]}:{})}));
 await q.guardar(e,base);await assert.rejects(q.sincronizar(),/perdida simulada/);
 q=new ColaRegistros('api-sync-test',io,net);await q.iniciar();await q.sincronizar();
 const final=q.estado();
 assert.equal(q.pendiente,false);assert.equal(q.resguardados,0);assert.equal(final.novedades.length,500);
 assert.equal(final.punches.find(p=>p.id==='offline-api').out,'19:00');assert.equal(final.novedades.find(n=>n.id==='api-nota-0').fotos[0],ref);
 assert.ok(final.novedades.every(n=>!JSON.stringify(n).includes('base64')));
 const nuevo=await rpc({accion:'consultar',cursor:0});
 assert.ok(nuevo.filas.length<=200);
 console.log(JSON.stringify({ok:true,registros:final.novedades.length,pendientes:q.pendiente,resguardos:q.resguardados,enviosHTTP:envios,totalMs:Date.now()-inicio,medidas},null,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
