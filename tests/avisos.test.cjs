require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module');
const {estadoVacio,isoDate,addDays}=require('../src/model.ts');
const avisos=new Map(),eventos=[];
const load=Module._load;
Module._load=function(n,...a){
 if(n==='react-native')return {Platform:{OS:'android'}};
 if(n==='expo')return {requireOptionalNativeModule:()=>({puedeProgramarExactas:async()=>false,canalHabilitado:async()=>true})};
 if(n==='expo-notifications')return {
  AndroidImportance:{MAX:5},SchedulableTriggerInputTypes:{DATE:'date'},IosAuthorizationStatus:{PROVISIONAL:3},
  setNotificationChannelAsync:async()=>eventos.push('canal'),
  getPermissionsAsync:async()=>({granted:false,canAskAgain:true}),
  requestPermissionsAsync:async()=>{eventos.push('permiso');return {granted:true};},
  getAllScheduledNotificationsAsync:async()=>[...avisos.values()],
  scheduleNotificationAsync:async(a)=>{eventos.push('programar');avisos.set(a.identifier,a);},
  cancelScheduledNotificationAsync:async(id)=>{eventos.push('cancelar');avisos.delete(id);},
 };
 return load.call(this,n,...a);
};
const {estadoPermisosAvisos,reprogramarAvisos,perfilAvisos,avisosProgramados,programarAvisoDePrueba}=require('../src/avisos.ts');

test('Android crea el canal antes de pedir permiso e informa si puede usar alarmas exactas',async()=>{
 assert.deepEqual(await estadoPermisosAvisos(true),{permitido:true,canal:true,exactas:false});
 assert.deepEqual(eventos.splice(0),['canal','permiso']);
});

test('Rondín nocturno programa 02:50 y 03:00, rearma al abrir y conserva avisos demorados',async(t)=>{
 t.mock.timers.enable({apis:['Date'],now:new Date(2026,10,14,23,30)});
 const e=estadoVacio();
 e.franjas=[{id:'noche',puestoId:'rondin',entrada:'23:00',salida:'07:00'},{id:'referencia',puestoId:'otro'}];
 e.directives=[{id:'ronda',nombre:'Recorrido',hora:'03:00',puestoId:'rondin',franjaId:'noche',dias:[0]}];
 const guardia=perfilAvisos(e,{id:'guardia',puestoId:'rondin'},{id:'corp',puestoId:'otro',franjaId:'referencia'});
 assert.equal(guardia.franjaId,'noche');
 const anticipo=new Date(2026,10,15,2,50).getTime(),hora=new Date(2026,10,15,3,0).getTime();
 const id='securia.directivas.'+anticipo;
 avisos.set(id,{identifier:id,content:{title:'En 10 minutos · 03:00',body:'Recorrido',data:{exactas:true}}});
 assert.equal(await reprogramarAvisos(e,guardia,true),2);
 assert.deepEqual(eventos.splice(0),['programar','programar']);
 assert.deepEqual((await avisosProgramados()).map(a=>a.hora),[anticipo,hora]);
 const prueba=avisos.get('securia.aviso-prueba');
 assert.equal(prueba,undefined);
 assert.equal(await programarAvisoDePrueba(),Date.now()+60_000);
 assert.equal(avisos.get('securia.aviso-prueba').trigger.channelId,'directivas');
 assert.equal((await avisosProgramados()).length,2);
 t.mock.timers.setTime(new Date(2026,10,15,3,1).getTime());
 assert.equal(await reprogramarAvisos(e,guardia,true),0);
 assert.ok(avisos.has(id));
 assert.ok(avisos.has('securia.directivas.'+hora));
 assert.ok(avisos.has('securia.aviso-prueba'));
 avisos.clear();eventos.length=0;
});

test('reconcilia por horario sin cancelar avisos ajenos y reprograma al obtener permiso exacto',async()=>{
 const e=estadoVacio(),fecha=addDays(isoDate(),1),dia=new Date(fecha+'T12:00:00').getDay();
 const guardia={id:'guardia',puestoId:'puesto',franjaId:'turno'};
 e.directives=[
  {id:'a',nombre:'Prueba A',hora:'11:00',puestoId:'puesto',franjaId:'turno',dias:[dia]},
  {id:'b',nombre:'Prueba B',hora:'11:00',puestoId:'puesto',franjaId:'turno',dias:[dia]},
  {id:'c',nombre:'Otro puesto',hora:'11:00',puestoId:'otro',dias:[dia]},
 ];
 avisos.set('ajeno',{identifier:'ajeno',content:{data:{}}});
 avisos.set('anterior',{identifier:'anterior',content:{data:{directivaId:'a'}}});
 assert.equal(await reprogramarAvisos(e,guardia,true,false),2);
 assert.equal(avisos.size,3);
 const programados=[...avisos.values()].filter(a=>a.trigger);
 assert.deepEqual(programados.map(a=>a.trigger.channelId),['directivas','directivas']);
 assert.equal(programados[1].trigger.date-programados[0].trigger.date,600000);
 assert.match(programados[0].content.body,/Prueba A[\s\S]*Prueba B/);
 assert.doesNotMatch(programados[0].content.body,/Otro puesto/);
 eventos.length=0;
 assert.equal(await reprogramarAvisos(e,guardia,true,false),2);
 assert.deepEqual(eventos,[]);
 assert.equal(await reprogramarAvisos(e,guardia,true,true),2);
 assert.deepEqual(eventos.splice(0),['programar','programar']);
 e.dlogs=[{directiveId:'a',fecha},{directiveId:'b',fecha}];
 assert.equal(await reprogramarAvisos(e,guardia,true,true),0);
 assert.deepEqual([...avisos.keys()],['ajeno']);
});
