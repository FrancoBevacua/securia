require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module'),React=require('react');
const {create,act}=require('react-test-renderer');global.IS_REACT_ACT_ENVIRONMENT=true;
const {estadoVacio}=require('../src/model.ts');
const g={id:'guardia',apellido:'Prueba',nombre:'Ana',cuenta:true,rol:'admin'},memoria=new Map();
let remoto=estadoVacio();remoto.guards=[{...g,puestoId:'p1'}];remoto.posts=[{id:'p1',nombre:'Paseo'},{id:'p2',nombre:'Playa 1'}];remoto.punches=[{id:'otro-telefono',guardId:g.id,dispositivoId:'telefono-b',in:'07:00',out:''}];let api,salidas=0;
const estadoNube={vinculada:true,guardando:false,pendiente:false,error:'',ultima:''};
const load=Module._load;
Module._load=function(n,...a){
 if(n==='react-native')return{Platform:{OS:'android'},AppState:{currentState:'active',addEventListener:()=>({remove(){}})}};
 if(n==='@react-native-async-storage/async-storage')return{getItem:async k=>memoria.get(k)||null,setItem:async(k,v)=>memoria.set(k,v),removeItem:async k=>memoria.delete(k)};
 if(n==='./almacenLocal')return{almacenLocal:{getItem:async()=>null,setItem:async()=>{},removeItem:async()=>{}}};
 if(n==='./pdf')return{pdfInformeDia:async()=>{}};
 if(n==='./assistant')return{setVocabulario:()=>{}};
 if(n==='./nube')return{telefonoId:()=>'telefono-a',verEstadoNube:()=>estadoNube,escucharNube:()=>()=>{},iniciarNube:async()=>true,restaurarSesionNube:async()=>null,conectarTelefono:async()=>{},catalogoNube:async()=>remoto,
  ingresarNube:async()=>({estado:structuredClone(remoto),guardia:g.id,base:structuredClone(remoto)}),
  ingresarCorporativoNube:async()=>({estado:structuredClone(remoto),guardia:'corporativo',base:structuredClone(remoto)}),guardarLocal:async e=>{remoto=structuredClone(e);},
  guardarEnNube:async e=>{remoto=structuredClone(e);},cerrarSesionNube:async()=>{salidas++;},reintentarNube:async()=>{}};
 return load.call(this,n,...a);
};
const {StoreProvider,useStore}=require('../src/store.tsx');
function Captura(){api=useStore();return null;}
test('iniciar y cerrar sesión administra la actividad sin botones de turno ni duplicados',async()=>{
 let r;await act(async()=>{r=create(React.createElement(StoreProvider,null,React.createElement(Captura)));});
 await act(async()=>api.ingresarNube('12345678','1234','p2'));
 assert.equal(api.me.id,g.id);assert.equal(api.S.punches.length,2);assert.equal(api.S.punches[0].out,'');
 assert.equal(api.me.puestoId,'p2');assert.equal(api.S.guards[0].puestoId,'p1');assert.equal(api.S.punches.find(p=>p.dispositivoId==='telefono-a').puestoId,'p2');assert.equal(api.iniciarTurno,undefined);assert.equal(api.cerrarTurno,undefined);
 await act(async()=>api.ingresarNube('12345678','1234','p2'));assert.equal(api.S.punches.length,2);
 await act(async()=>{api.put('novedades',{id:'nota',guardId:g.id,fecha:'2026-09-22',hora:'12:00',texto:'Registro de prueba'});await api.confirmarGuardado();});
 await act(async()=>api.salir());
 assert.equal(api.me,null);assert.equal(salidas,1);assert.ok(remoto.punches.find(p=>p.dispositivoId==='telefono-a').closedAt);assert.equal(remoto.punches[0].out,'');assert.ok(remoto.novedades[0].lockedAt);
 assert.equal(remoto.novedades.length,1);
 await act(async()=>r.unmount());
});

test('el corporativo espera la elección del responsable y conserva el relevo al reiniciar la vista',async()=>{
 const cuenta={...g,id:'corporativo',nombre:'Guardia Paseo',apellido:'',corporativo:true,puestoId:'p1'};
 remoto=estadoVacio();remoto.guards=[cuenta,{...g,rol:'vigilador'}];remoto.posts=[{id:'p1',nombre:'Paseo'}];remoto.franjas=[{id:'f',puestoId:'p1',nombre:'Mañana',entrada:'06:00',salida:'14:00'}];
 let r;await act(async()=>{r=create(React.createElement(StoreProvider,null,React.createElement(Captura)));});
 await act(async()=>api.ingresarCorporativo('638201'));
 assert.equal(api.me.id,cuenta.id);assert.equal(api.responsable,null);assert.equal(api.S.punches.length,0);
 await act(async()=>api.seleccionarResponsable(g.id));
 assert.equal(api.responsable.id,g.id);assert.equal(api.S.punches.length,1);assert.equal(api.S.punches[0].guardId,cuenta.id);assert.equal(api.S.punches[0].responsableId,g.id);
 await act(async()=>api.seleccionarResponsable(g.id));assert.equal(api.S.punches.length,1);
 await act(async()=>api.ingresarCorporativo('638201'));assert.equal(api.responsable.id,g.id);assert.equal(api.S.punches.length,1);
 await act(async()=>api.salir());assert.ok(remoto.punches[0].closedAt);await act(async()=>r.unmount());
});
