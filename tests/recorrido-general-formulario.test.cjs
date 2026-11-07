require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module'),React=require('react');
const {create,act}=require('react-test-renderer');global.IS_REACT_ACT_ENVIRONMENT=true;
const {estadoVacio}=require('../src/model.ts'),servicio=require('../src/servicio.ts');
const S=estadoVacio();S.guards=[{id:'guardia',apellido:'Prueba',nombre:'Ana'}];
let cambios=[],fallar=false,cerrados=0;
const store={S,me:S.guards[0],list:c=>S[c],byId:(c,id)=>S[c].find(x=>x.id===id),put:(col,obj)=>cambios.push({col,obj}),confirmarGuardado:async()=>{if(fallar)throw Error('Sin espacio');}};
const load=Module._load;Module._load=function(n,...a){
 if(n==='react-native')return{View:'View',Text:'Text',Image:'Image',Pressable:'Pressable'};
 if(n==='expo-router')return{Redirect:'Redirect'};
 if(n==='../store')return{useStore:()=>store};
 if(n==='../servicio')return{...servicio,turnoAbierto:()=>({id:'turno'}),motivoSoloLectura:()=>''};
 if(n==='../ui')return{useTheme:()=>({}),useToast:()=>()=>{},...Object.fromEntries(['Sheet','Input','Field','Chipbar','Chip','Row','Btn','Selector','Seg','Hint','Banner','Confirmar'].map(x=>[x,p=>React.createElement(x,p,p.children,p.footer)]))};
 if(['./Rondas','./ServicioActual','./BloqueAcceso','./Dictado','./RedaccionIA','./SelectorFirma'].includes(n))return()=>null;
 return load.call(this,n,...a);
};
const {EditorNovedad}=require('../src/pantallas/EditorAsiento.tsx');
const input=(r,label)=>r.root.findAllByType('Input').find(i=>i.props.label===label);
const guardar=r=>r.root.findAllByType('Btn').find(b=>b.props.label==='Guardar');
const props={abierto:true,novedad:null,fecha:'2026-10-25',categoriaInicial:'Recorrido',onClose:()=>cerrados++};

test('el recorrido de playa usa la categoría Recorrido y se guarda en el libro',async()=>{
 cambios=[];let r;await act(async()=>{r=create(React.createElement(EditorNovedad,props));});
 await act(async()=>r.root.findAllByType('Seg').find(s=>s.props.valor==='locales').props.onChange('playa'));
 assert.equal(r.root.findAllByType('Seg').some(s=>s.props.opciones.some(o=>o.v==='abiertos')),false);
 assert.match(r.root.findAllByType('Field').find(f=>f.props.label==='Vista previa del recorrido').findByType('Text').props.children,/recorrido de la playa/);
 await act(async()=>guardar(r).props.onPress());assert.equal(cambios[0].col,'novedades');assert.equal(cambios[0].obj.datos.tipoRecorrido,'playa');assert.equal(cambios[0].obj.datos.lugar,'la playa');
 await act(async()=>r.unmount());
});

test('las rutas anteriores abren Nueva novedad en Recorrido',async()=>{
 for(const nombre of ['Recorridos','Locales']){
  const Pantalla=require('../src/pantallas/'+nombre+'.tsx').default;let r;await act(async()=>{r=create(React.createElement(Pantalla));});
  assert.deepEqual(r.root.findByType('Redirect').props.href,{pathname:'/',params:{nueva:'Recorrido'}});
  await act(async()=>r.unmount());
 }
});
