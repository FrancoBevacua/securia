require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {estadoVacio}=require('../src/model.ts');
const {cambiosNube}=require('../src/cambiosNube.ts');
const {ColaNube}=require('../src/colaNube.ts');
const {reconciliarNube}=require('../src/reconciliarNube.ts');
const copia=x=>structuredClone(x);
test('un registro nuevo no reenvía reportes, informes ni fotos ya existentes',()=>{
 const remoto=estadoVacio();
 for(const col of ['reports','infdias','novedades'])remoto[col]=Array.from({length:100},(_,i)=>({id:col+i,texto:'Registro '+i,fotos:['data:image/jpeg;base64,'+'a'.repeat(1000)]}));
 const local=copia(remoto);local.novedades.push({id:'nueva',texto:'Nueva'});local.updatedAt=2;
 const delta=cambiosNube(local,remoto);
 assert.deepEqual(delta,{novedades:[{id:'nueva',texto:'Nueva'}],updatedAt:2});
 assert.ok(JSON.stringify(delta).length<JSON.stringify(local).length/100);
 assert.deepEqual(cambiosNube(local,copia(local)),{});
});
test('conserva ediciones y bajas lógicas sin eliminar historial',()=>{
 const remoto=estadoVacio();remoto.reports=[{id:'a',texto:'Anterior'},{id:'b',texto:'Otro'}];
 const local=copia(remoto);local.reports[0].texto='Corregido';local.reports[1].deleted=true;
 assert.deepEqual(cambiosNube(local,remoto).reports,local.reports);
 local.reports.pop();assert.throws(()=>cambiosNube(local,remoto),/historial/);
});
test('la cola compara con la consulta más reciente y recupera respuestas perdidas sin reenviar',async()=>{
 const base=estadoVacio();let remoto=copia(base),pendiente=null,revision=1,envios=0,cliente=1;
 remoto.novedades=[{id:'otro-telefono',texto:'Remota'}];revision++;
 const local=copia(base);local.novedades=[{id:'local',texto:'Nueva'}];
 const cola=new ColaNube({leer:async()=>copia(pendiente),escribir:async p=>pendiente=copia(p),quitar:async()=>pendiente=null,
  consultar:async()=>({estado:copia(remoto),revision}),
  enviar:async(p,consultado)=>{assert.deepEqual(consultado,remoto);const delta=cambiosNube(p.estado,consultado);assert.deepEqual(delta.novedades,local.novedades);remoto=copia(p.estado);revision++;envios++;throw Error('Respuesta perdida');},
  actor:()=> 'a',revision:()=>cliente,base:()=>base,reconciliar:reconciliarNube,confirmar:r=>cliente=r});
 await assert.rejects(cola.guardar(local),/perdida/);await cola.reintentar();
 assert.equal(envios,1);assert.equal(pendiente,null);assert.equal(cliente,3);assert.equal(remoto.novedades.length,2);
});
