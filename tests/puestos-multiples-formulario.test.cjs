require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module'),React=require('react');
const {create,act}=require('react-test-renderer');global.IS_REACT_ACT_ENVIRONMENT=true;
const {estadoVacio}=require('../src/model.ts');
const {asegurarPuestosCobertura}=require('../src/puestosGuardia.ts');
const {aplicarCambios}=require('../src/mutaciones.ts');
const S=estadoVacio();S.posts=[{id:'p',nombre:'Paseo'}];asegurarPuestosCobertura(S);
S.guards=[{id:'admin',rol:'admin',nombre:'Admin',apellido:'Prueba'}];
const st={S,esAdmin:true,me:S.guards[0],confirmarGuardado:async()=>{},list:c=>st.S[c].filter(x=>!x.deleted),put:(col,obj)=>{st.S=aplicarCambios(st.S,[{col,obj}],st.me);return st.S[col].find(g=>g.id===obj.id);}};
const original=Module._load;
Module._load=function(n,...a){
 if(n==='react-native')return{View:'View',Text:'Text'};if(n==='expo-router')return{router:{back:()=>{},push:()=>{}}};
 if(n==='../store')return{useStore:()=>st};if(n==='../nube')return{};
 if(n==='./Gate')return{Avatar:()=>null};if(n==='./Credencial')return()=>null;
 if(n==='../ui')return{useTheme:()=>({}),useToast:()=>()=>{},...Object.fromEntries(['Pantalla','SubCabecera','Card','Btn','Tag','Item','Stack','Row','Input','Selector','Sheet','Hint','Metric','Confirmar','Eyebrow','Banner','Toggle'].map(x=>[x,p=>React.createElement(x,p,p.children,p.footer)]))};
 return original.call(this,n,...a);
};
const {EditorVigilador}=require('../src/pantallas/Equipo.tsx');
const btn=r=>r.root.findAllByType('Btn').find(b=>b.props.label==='Guardar');
const toggle=(r,n)=>r.root.findAllByType('Toggle').find(t=>t.props.label===n);
test('se crea con tres puestos, se vuelve a abrir y se quita el principal sin perder los otros',async()=>{
 let r;await act(async()=>{r=create(React.createElement(EditorVigilador,{abierto:true,vigilador:null,onClose:()=>{}}));});
 await act(async()=>r.root.findAllByType('Input').find(x=>x.props.label==='Apellido').props.onChangeText('Prueba'));
 await act(async()=>r.root.findAllByType('Input').find(x=>x.props.label==='Nombre').props.onChangeText('Bruno'));
 for(const nombre of ['Paseo','Bicicletero','Franquero'])await act(async()=>toggle(r,nombre).props.onChange(true));
 await act(async()=>btn(r).props.onPress());let g=st.S.guards.find(g=>g.nombre==='Bruno');assert.equal(g.puestoIds.length,3);assert.equal(g.puestoId,'p');
 await act(async()=>r.update(React.createElement(EditorVigilador,{abierto:true,vigilador:g,onClose:()=>{}})));
 assert.equal(toggle(r,'Bicicletero').props.value,true);assert.equal(toggle(r,'Franquero').props.value,true);
 await act(async()=>toggle(r,'Paseo').props.onChange(false));await act(async()=>btn(r).props.onPress());
 g=st.S.guards.find(x=>x.id===g.id);assert.equal(g.puestoIds.length,2);assert.equal(g.puestoId,'securia:puesto:bicicletero');
 assert.equal(g.franjaId,'securia:puesto:bicicletero:turno:0');await act(async()=>r.unmount());
});
test('un perfil antiguo se abre con su puesto y editar otros datos conserva las asignaciones',async()=>{
 const g={id:'antiguo',apellido:'Apellido',nombre:'Nombre',puestoId:'p',rol:'vigilador'};st.S.guards.push(g);
 let r;await act(async()=>{r=create(React.createElement(EditorVigilador,{abierto:true,vigilador:g,onClose:()=>{}}));});
 assert.equal(toggle(r,'Paseo').props.value,true);await act(async()=>btn(r).props.onPress());
 assert.deepEqual(st.S.guards.find(x=>x.id==='antiguo').puestoIds,['p']);await act(async()=>r.unmount());
});
test('el alta rápida de un firmante también permite asignar varios puestos',async()=>{
 const SelectorFirma=require('../src/pantallas/SelectorFirma.tsx').default;let firmado,r;
 await act(async()=>{r=create(React.createElement(SelectorFirma,{valor:'',onChange:id=>{firmado=id;}}));});
 await act(async()=>r.root.findByType('Selector').props.onChange('__nuevo__'));
 for(const [label,valor] of [['Apellido','Cobertura'],['Nombre','Carla']])await act(async()=>r.root.findAllByType('Input').find(x=>x.props.label===label).props.onChangeText(valor));
 for(const nombre of ['Paseo','Bicicletero','Franquero'])await act(async()=>toggle(r,nombre).props.onChange(true));
 await act(async()=>r.root.findAllByType('Btn').find(b=>b.props.label==='Agregar vigilador').props.onPress());
 const g=st.S.guards.find(x=>x.id===firmado);assert.equal(g.puestoIds.length,3);assert.equal(g.puestoId,'p');assert.equal(g.cuenta,false);
 await act(async()=>r.unmount());
});
