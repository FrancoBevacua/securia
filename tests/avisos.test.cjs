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
const {estadoPermisosAvisos,reprogramarAvisos}=require('../src/avisos.ts');

test('Android crea el canal antes de pedir permiso e informa si puede usar alarmas exactas',async()=>{
 assert.deepEqual(await estadoPermisosAvisos(true),{permitido:true,canal:true,exactas:false});
 assert.deepEqual(eventos.splice(0),['canal','permiso']);
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
