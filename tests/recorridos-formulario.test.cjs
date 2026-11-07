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

for(const estado of ['abiertos','cerrados'])test('recorrido de locales '+estado+' se agrega directamente al libro con observaciones opcionales',async()=>{
 cambios=[];let r;await act(async()=>{r=create(React.createElement(EditorNovedad,props));});
 assert.ok(!r.root.findAllByType('Input').some(i=>/local|celular|teléfono/i.test(i.props.label||'')));
 assert.ok(!r.root.findAllByType('Btn').some(i=>/WhatsApp|Agregar local/.test(i.props.label||'')));
 await act(async()=>r.root.findAllByType('Seg').find(s=>s.props.valor==='abiertos').props.onChange(estado));
 assert.equal(r.root.findAllByType('Field').find(f=>f.props.label==='Vista previa del recorrido').findByType('Text').props.children,'Se realiza recorrido para control de locales '+estado+'. Sin novedades.');
 await act(async()=>guardar(r).props.onPress());
 assert.deepEqual(cambios.map(c=>c.col),['novedades']);assert.equal(cambios[0].obj.categoria,'Recorrido');assert.equal(cambios[0].obj.datos.controlLocales,estado);
 const n=cambios[0].obj;
 await act(async()=>r.update(React.createElement(EditorNovedad,{...props,novedad:n})));
 await act(async()=>input(r,'Observaciones (si las hubiera)').props.onChangeText('Local 5 fuera de horario.'));
 assert.equal(r.root.findAllByType('Field').find(f=>f.props.label==='Vista previa del recorrido').findByType('Text').props.children,'Se realiza recorrido para control de locales '+estado+'. Local 5 fuera de horario.');
 await act(async()=>guardar(r).props.onPress());assert.equal(cambios.at(-1).obj.id,n.id);assert.doesNotMatch(cambios.at(-1).obj.texto,/Sin novedades/);
 await act(async()=>r.unmount());
});

test('un fallo de disco conserva la observación y el mismo ID para reintentar el recorrido',async()=>{
 cambios=[];cerrados=0;let r;await act(async()=>{r=create(React.createElement(EditorNovedad,props));});
 await act(async()=>input(r,'Observaciones (si las hubiera)').props.onChangeText('Local 3 cerrado'));
 fallar=true;await act(async()=>guardar(r).props.onPress());assert.equal(cerrados,0);
 assert.equal(input(r,'Observaciones (si las hubiera)').props.value,'Local 3 cerrado');
 fallar=false;await act(async()=>guardar(r).props.onPress());assert.equal(cambios[0].obj.id,cambios[1].obj.id);assert.equal(cerrados,1);
 await act(async()=>r.unmount());
});
