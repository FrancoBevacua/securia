require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {ColaRegistros}=require('../src/colaRegistros.ts'),{estadoVacio}=require('../src/model.ts');
const copy=x=>x===undefined?undefined:structuredClone(x);
function banco(){
 const disco=new Map(),remoto=new Map(),recibos=new Map();let escrituras=[],envios=0,perder=false,barrera;
 const io={leer:async k=>copy(disco.get(k)||null),escribir:async(k,v)=>{disco.set(k,copy(v));escrituras.push([k,JSON.stringify(v).length]);},quitar:async k=>disco.delete(k),claves:async p=>[...disco.keys()].filter(k=>k.startsWith(p))};
 const net={consultar:async cursor=>({filas:cursor?[]:[...remoto.values()],cursor:1,mas:false}),preparar:async v=>copy(v),
 enviar:async(lote,filas)=>{if(barrera)await barrera;if(recibos.has(lote))return copy(recibos.get(lote));envios++;
 const r={acuses:filas.map(f=>{const a={col:f.col,id:f.id,valor:f.valor,hash:'h'+envios,estado:'confirmado'};remoto.set(f.col+'/'+f.id,a);return a;})};recibos.set(lote,r);if(perder){perder=false;throw Error('Respuesta perdida');}return copy(r);}};
 return {disco,io,net,remoto,get escrituras(){return escrituras;},reset(){escrituras=[];},get envios(){return envios;},perder(){perder=true;},bloquear(p){barrera=p;}};
}
test('un cambio escribe una sola fila y conserva el historial ausente de una vista local',async()=>{
 const b=banco(),q=new ColaRegistros('a',b.io,b.net),e=estadoVacio();e.reports=Array.from({length:1200},(_,i)=>({id:String(i),texto:'Histórico '+i}));
 await q.iniciar();await q.importar(e,e);b.reset();
 const vista=copy(e);vista.reports[8].texto='Edición';await q.guardar(vista,e);
 assert.equal(b.escrituras.length,1);assert.ok(b.escrituras[0][1]<500);assert.equal(q.estado().reports.length,1200);
 await q.guardar({...vista,reports:[vista.reports[8]]},e);assert.equal(q.estado().reports.length,1200);
});
test('una consulta al día reutiliza la vista, el cursor y las colecciones sin cambios',async()=>{
 const b=banco(),q=new ColaRegistros('a',b.io,b.net);
 const e=estadoVacio();e.reports=[{id:'r',texto:'Histórico'}];
 let consultas=0;b.net.consultar=async cursor=>{consultas++;return {filas:[],cursor,mas:false};};
 await q.iniciar();await q.importar(e,e);b.reset();
 const anterior=q.estado();
 await q.sincronizar();
 assert.equal(consultas,1);assert.equal(b.escrituras.length,0);assert.equal(q.estado(),anterior);
 await q.guardar({...anterior,rounds:[{id:'ronda'}]},anterior,anterior);
 assert.equal(q.estado().reports,anterior.reports);
 assert.equal(b.escrituras.length,1);
});
test('un recibo perdido se reintenta con el mismo lote después de reiniciar la aplicación',async()=>{
 const b=banco(),q=new ColaRegistros('a',b.io,b.net),e=estadoVacio();await q.iniciar();await q.importar(e,e);
 e.reports.push({id:'r',texto:'Pendiente'});await q.guardar(e);b.perder();await assert.rejects(q.sincronizar(),/perdida/);
 const reinicio=new ColaRegistros('a',b.io,b.net);await reinicio.iniciar();assert.equal(reinicio.pendiente,true);await reinicio.sincronizar();
 assert.equal(b.envios,1);assert.equal(reinicio.pendiente,false);assert.equal(reinicio.estado().reports[0].texto,'Pendiente');
});
test('una edición durante el envío sobrevive al recibo de la versión anterior',async()=>{
 const b=banco(),q=new ColaRegistros('a',b.io,b.net),e=estadoVacio();await q.iniciar();await q.importar(e,e);
 e.reports=[{id:'r',texto:'Primera'}];await q.guardar(e);
 let liberar;b.bloquear(new Promise(r=>liberar=r));const trabajo=q.sincronizar();
 while(![...b.disco.keys()].some(k=>k.endsWith('/envio')))await new Promise(r=>setTimeout(r,1));
 const segunda=copy(e);segunda.reports[0].texto='Segunda';await q.guardar(segunda,e);liberar();await trabajo;
 assert.equal(b.envios,2);assert.equal(q.pendiente,false);assert.equal(q.estado().reports[0].texto,'Segunda');
});
test('sin Internet se guarda antes de preparar o transferir fotos; la cola se conserva',async()=>{
 const b=banco();b.net.consultar=async()=>{throw Error('Sin Internet');};b.net.preparar=async()=>{throw Error('No debe ejecutarse al guardar');};
 const q=new ColaRegistros('a',b.io,b.net),e=estadoVacio();await q.iniciar();await q.importar(e,e);
 e.reports=[{id:'foto',fotos:['file:///interno/fotos/a.jpg']}];await q.guardar(e);
 assert.equal(q.pendiente,true);await assert.rejects(q.sincronizar(),/Internet/);
 const otra=new ColaRegistros('a',b.io,b.net);await otra.iniciar();assert.equal(otra.estado().reports[0].fotos[0],'file:///interno/fotos/a.jpg');
});
test('un rechazo queda respaldado y no bloquea otros registros; un recibo incompleto no limpia datos',async()=>{
 const b=banco(),q=new ColaRegistros('a',b.io,b.net),e=estadoVacio();await q.iniciar();await q.importar(e,e);
 e.reports=[{id:'a',texto:'A'},{id:'b',texto:'B'}];await q.guardar(e);b.net.enviar=async()=>({acuses:[]});
 await assert.rejects(q.sincronizar(),/todas las filas/);assert.equal(q.pendiente,true);
 b.net.enviar=async(_,filas)=>({acuses:filas.map(f=>({...f,estado:f.id==='a'?'resguardado':'confirmado',respaldo:'seguro',valor:f.id==='a'?null:f.valor}))});
 await q.sincronizar();assert.equal(q.pendiente,false);assert.equal(q.resguardados,1);assert.equal(q.estado().reports.length,1);
 assert.ok([...b.disco.keys()].some(k=>k.includes('/resguardo/')));
});
test('quinientas notas se envían antes del cierre y el siguiente turno espera',async()=>{
 const b=banco(),q=new ColaRegistros('a',b.io,b.net),e=estadoVacio();await q.iniciar();await q.importar(e,e);
 e.punches=[{id:'t',guardId:'a',in:'07:00',out:'19:00',closedAt:200},{id:'siguiente',guardId:'a',in:'19:00',out:''}];
 e.novedades=Array.from({length:500},(_,i)=>({id:'n'+i,turnoId:'t',texto:'Nota'}));
 const enviar=b.net.enviar;
 b.net.enviar=async(lote,filas)=>{
  assert.ok(filas.length<=250);
  for(const f of filas){
   if(f.col==='novedades')assert.equal(b.remoto.get('punches/t')?.valor.out||'', '');
   if(f.id==='t'&&f.valor.out)assert.equal([...b.remoto.values()].filter(f=>f.col==='novedades').length,500);
   if(f.id==='siguiente')assert.equal(b.remoto.get('punches/t').valor.out,'19:00');
  }
  return enviar(lote,filas);
 };
 await q.guardar(e);await q.sincronizar();assert.equal(q.pendiente,false);assert.equal(q.estado().novedades.length,500);assert.equal(q.estado().punches.find(p=>p.id==='t').out,'19:00');
});
