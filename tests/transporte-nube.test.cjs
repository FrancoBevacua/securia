require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {solicitarNube,errorDeRed}=require('../src/transporteNube.ts');
const {ColaNube}=require('../src/colaNube.ts');

test('reconoce la cancelación exacta de Expo aunque sea Error y no AbortError',()=>{
 for(const e of [Error('fetch failed: Fetch request has been canceled'),Error('fetch failed: The operation was aborted.'),
   Object.assign(Error('Cancelado'),{name:'AbortError'}),new TypeError('Network request failed')]){
  const red=errorDeRed(e);assert.equal(red.sinConexion,true);assert.match(red.message,/guardados en el teléfono/);assert.doesNotMatch(red.message,/fetch failed/);
 }
 assert.equal(errorDeRed(Error('DNI o PIN incorrectos.')),null);
 assert.equal(errorDeRed(Object.assign(Error('Conflicto'),{codigo:'conflicto'})),null);
});

test('el vencimiento cancela el fetch y libera el temporizador también al leer el cuerpo',async t=>{
 const original=global.fetch;t.after(()=>global.fetch=original);
 for(const enCuerpo of [false,true]){
  let signal;
  global.fetch=async(_url,op)=>{
   signal=op.signal;
   const espera=()=>new Promise((_,no)=>signal.addEventListener('abort',()=>no(Error('fetch failed: Fetch request has been canceled')),{once:true}));
   return enCuerpo?{ok:true,status:200,json:espera}:espera();
  };
  await assert.rejects(solicitarNube('https://example.invalid',{},5),e=>e.sinConexion===true);
  assert.equal(signal.aborted,true);
 }
 let signal;
 global.fetch=async(_url,op)=>{signal=op.signal;return{ok:true,status:200,json:async()=>({ok:true})};};
 await solicitarNube('https://example.invalid',{},5);
 await new Promise(r=>setTimeout(r,10));assert.equal(signal.aborted,false);
});

test('un corte transitorio del servicio se reconoce aunque la respuesta no sea JSON',async t=>{
 const original=global.fetch;t.after(()=>global.fetch=original);
 for(const status of [408,429,502,503,504,520,521,522,523,524]){
  global.fetch=async()=>({ok:false,status,json:async()=>{throw Error('No debe leer HTML');}});
  await assert.rejects(solicitarNube('https://example.invalid',{},100),e=>e.sinConexion===true);
 }
 const negocio={ok:false,error:'Sesión inválida',codigo:'sesion'};
 global.fetch=async()=>({ok:true,status:200,json:async()=>negocio});
 assert.deepEqual((await solicitarNube('https://example.invalid',{},100)).datos,negocio);
});

test('respuestas vacías, HTML, truncadas y el parse error nativo de Android conservan los pendientes',async t=>{
 const original=global.fetch;t.after(()=>global.fetch=original);
 for(const error of [new SyntaxError('Unexpected end of JSON input'),new SyntaxError('Unexpected token <'),Error('JSON Parse error: Unexpected EOF')]){
  global.fetch=async()=>({ok:true,status:200,json:async()=>{throw error;}});
  await assert.rejects(solicitarNube('https://example.invalid',{},100),e=>e.sinConexion===true&&!/parse|unexpected|EOF/i.test(e.message));
 }
 for(const datos of [null,'Sin respuesta',[],{}]){
  global.fetch=async()=>({ok:true,status:200,json:async()=>datos});
  await assert.rejects(solicitarNube('https://example.invalid',{},100),e=>e.sinConexion===true);
 }
});

test('reconoce el timeout real de Postgres 57014 sin ocultar validaciones ni permisos',async t=>{
 const original=global.fetch;t.after(()=>global.fetch=original);
 for(const code of ['57014','55P03','08006']){
  global.fetch=async()=>({ok:false,status:500,json:async()=>({code,message:'canceling statement due to statement timeout'})});
  await assert.rejects(solicitarNube('https://example.invalid',{},100),e=>e.sinConexion===true);
 }
 for(const code of ['P0001','42501','PGRST202']){
  const datos={code,message:'Validación o configuración'};
  global.fetch=async()=>({ok:false,status:400,json:async()=>datos});
  assert.deepEqual((await solicitarNube('https://example.invalid',{},100)).datos,datos);
 }
});

function escenario(){
 const s={local:null,remoto:{n:0},revision:1,envios:0,consultas:0};
 const io={leer:async()=>structuredClone(s.local),escribir:async p=>{s.local=structuredClone(p);},quitar:async()=>{s.local=null;},
  consultar:async()=>{s.consultas++;return{estado:structuredClone(s.remoto),revision:s.revision};},
  enviar:async p=>{s.envios++;s.remoto=structuredClone(p.estado);return ++s.revision;},
  actor:()=>'a',revision:()=>1,confirmar:()=>{}};
 return{s,io};
}

test('reconsulta una respuesta cancelada después del guardado y no duplica el envío',async()=>{
 const {s,io}=escenario(),enviar=io.enviar;
 io.enviar=async p=>{await enviar(p);throw errorDeRed(Error('fetch failed: Fetch request has been canceled'));};
 await new ColaNube(io).guardar({n:1});
 assert.equal(s.envios,1);assert.equal(s.consultas,2);assert.equal(s.local,null);assert.deepEqual(s.remoto,{n:1});
});

test('una respuesta JSON truncada después del guardado se reconcilia sin duplicar la novedad',async t=>{
 const original=global.fetch;t.after(()=>global.fetch=original);
 const {s,io}=escenario(),enviar=io.enviar;
 io.enviar=async p=>{await enviar(p);return solicitarNube('https://example.invalid',{},100);};
 global.fetch=async()=>({ok:true,status:200,json:async()=>{throw new SyntaxError('Unexpected end of JSON input');}});
 await new ColaNube(io).guardar({n:1});
 assert.equal(s.envios,1);assert.equal(s.local,null);assert.deepEqual(s.remoto,{n:1});
});

test('los reintentos son limitados y conservan la copia local si la red sigue cancelándose',async()=>{
 const {s,io}=escenario();io.consultar=async()=>{s.consultas++;throw errorDeRed(Error('fetch failed: Fetch request has been canceled'));};
 await assert.rejects(new ColaNube(io).guardar({n:1}),e=>e.sinConexion===true);
 assert.equal(s.consultas,3);assert.equal(s.envios,0);assert.deepEqual(s.local.estado,{n:1});
});

test('no reintenta automáticamente errores de sesión, permisos ni validación',async()=>{
 const {s,io}=escenario();io.consultar=async()=>{s.consultas++;throw Object.assign(Error('Sesión vencida'),{codigo:'sesion'});};
 await assert.rejects(new ColaNube(io).guardar({n:1}),/Sesión vencida/);
 assert.equal(s.consultas,1);assert.deepEqual(s.local.estado,{n:1});
});
