require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module'),React=require('react');
const {create,act}=require('react-test-renderer');global.IS_REACT_ACT_ENVIRONMENT=true;
const {estadoVacio}=require('../src/model.ts'),S=estadoVacio(),servicio=require('../src/servicio.ts');S.site.precintoPrefijo='1234';S.guards=[{id:'a',apellido:'Prueba',nombre:'Ana'}];S.accesses=[{id:'e2',nombre:'Puerta E2'}];
let cambios=[],avisos=[];const store={S,me:S.guards[0],list:c=>S[c],byId:(c,id)=>S[c].find(x=>x.id===id),putVarios:cs=>{cambios.push(...cs);for(const c of cs)S[c.col].push(c.obj);},setSite:obj=>Object.assign(S.site,obj)};
const load=Module._load;Module._load=function(n,...a){
 if(n==='react-native')return{View:'View',Text:'Text',Pressable:'Pressable',Image:'Image'};if(n==='expo-clipboard')return{setStringAsync:async()=>{}};if(n==='../store')return{useStore:()=>store};
 if(n==='../servicio')return{...servicio,turnoAbierto:()=>({id:'turno'}),motivoSoloLectura:()=>''};if(n==='./LeerPrecintos'||n==='./ServicioActual')return()=>null;if(n==='./SelectorFirma')return p=>React.createElement('Firma',p);
 if(n==='../ui')return{useTheme:()=>({}),useToast:()=>s=>avisos.push(s),...Object.fromEntries(['Pantalla','Cabecera','Sheet','Btn','Card','Row','Stack','Input','Hint','Banner','Seg','Field','Selector','Chipbar','Chip','Tag','Item','Empty','Confirmar','Eyebrow','Toggle'].map(x=>[x,p=>React.createElement(x,p,p.children,p.footer)]))};
 return load.call(this,n,...a);
};
const Accesos=require('../src/pantallas/Accesos.tsx').default;
const input=(r,label)=>r.root.findAllByType('Input').find(i=>i.props.label===label),btn=(r,label)=>r.root.findAllByType('Btn').find(i=>i.props.label===label);
test('escribe el prefijo real, precarga nuevas filas y recuerda el prefijo de un número completo al reabrir',async()=>{
 let r;await act(async()=>{r=create(React.createElement(Accesos));});await act(async()=>r.root.findByType('Cabecera').props.derecha.props.onPress());
 assert.equal(input(r,'Precinto 1').props.value,'1234');assert.equal(input(r,'Precinto 1').props.placeholder,undefined);
 await act(async()=>btn(r,'Agregar precinto').props.onPress());assert.equal(input(r,'Precinto 2').props.value,'1234');
 await act(async()=>input(r,'Nombre del acceso').props.onChangeText('Puerta E2'));await act(async()=>r.root.findByType('Firma').props.onChange('a'));
 await act(async()=>btn(r,'Agregar a la lista').props.onPress());assert.equal(cambios.length,0);assert.match(avisos.at(-1),/tres últimos/);
 await act(async()=>input(r,'Precinto 1').props.onChangeText('9876001'));await act(async()=>input(r,'Precinto 2').props.onChangeText('9876002'));
 await act(async()=>btn(r,'Agregar a la lista').props.onPress());assert.equal(S.site.precintoPrefijo,'1234');assert.equal(S.alogs[0].puertas[0].precintos[0],'9876001');
 await act(async()=>r.root.findByType('Cabecera').props.derecha.props.onPress());assert.equal(input(r,'Precinto 1').props.value,'9876');
 await act(async()=>btn(r,'Agregar puerta').props.onPress());assert.equal(r.root.findAllByType('Input').filter(i=>i.props.label==='Precinto 1')[1].props.value,'9876');await act(async()=>r.unmount());
});
