require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module'),React=require('react');
const {create,act}=require('react-test-renderer');global.IS_REACT_ACT_ENVIRONMENT=true;
const {estadoVacio,accVacio,isoDate,hhmm}=require('../src/model.ts');
const {aplicarCambios}=require('../src/mutaciones.ts');
const {externosEnPredio}=require('../src/presencias.ts');
const st={S:estadoVacio(),me:{id:'g',nombre:'Ana',apellido:'Prueba',rol:'vigilador'},confirmarGuardado:async()=>{}};
st.S.guards=[st.me];st.S.punches=[{id:'turno',guardId:'g',fecha:isoDate(),in:'00:00',out:''}];
st.putVarios=cambios=>{st.S=aplicarCambios(st.S,cambios,st.me);};
st.list=col=>st.S[col].filter(x=>!x.deleted);
const load=Module._load;
Module._load=function(n,...a){
 if(n==='react-native')return{View:'View',Text:'Text',Pressable:'Pressable',useWindowDimensions:()=>({width:360,height:800,fontScale:1}),AppState:{addEventListener:()=>({remove:()=>{}})}};
 if(n==='expo-router')return{router:{push:()=>{},back:()=>{}}};if(n==='expo-clipboard')return{};
 if(n==='../store')return{useStore:()=>st};if(n==='../icons')return{Icon:'Icon'};
 if(n==='../ui')return{useTheme:()=>({}),useToast:()=>()=>{},...Object.fromEntries(['Pantalla','SubCabecera','Card','Input','Btn','Row','Hint','Tag','Sheet','Empty','Eyebrow','Item','Stack','Seg','Chip','Chipbar','Field','Banner','Confirmar'].map(x=>[x,p=>React.createElement(x,p,p.children,p.footer)]))};
 if(n==='./BloqueAcceso')return{__esModule:true,default:p=>React.createElement('BloqueAcceso',p)};
 if(n==='./EditorAsiento')return{EditorNovedad:p=>React.createElement('EditorNovedad',p)};
 return load.call(this,n,...a);
};
const Predio=require('../src/pantallas/Predio.tsx').default;
const btn=(r,label)=>r.root.findAllByType('Btn').find(x=>x.props.label===label);
const campo=(r,label)=>r.root.findAllByType('Input').find(x=>x.props.label===label);
const refrescar=async r=>act(async()=>r.update(React.createElement(Predio)));

test('desde el predio se crea, consulta, edita y elimina una visita junto con su asiento',async()=>{
 let r;await act(async()=>{r=create(React.createElement(Predio));});
 await act(async()=>btn(r,'Agregar personal al predio').props.onPress());
 assert.ok(r.root.findAllByType('Sheet').some(s=>s.props.title==='Registrar ingreso'&&s.props.visible));
 await act(async()=>r.root.findByType('BloqueAcceso').props.onChange({...accVacio(),empresa:'Servicios',tarea:'Limpieza',lugar:'Playa',personas:[{nombre:'Persona de prueba',dni:'30123456'}]}));
 await act(async()=>campo(r,'Hora de ingreso').props.onChangeText(hhmm()));
 await act(async()=>btn(r,'Guardar').props.onPress());await refrescar(r);
 assert.equal(externosEnPredio(st.S)[0].personas.length,1);
 await act(async()=>r.root.findAllByType('Pressable').find(p=>p.props.accessibilityLabel?.startsWith('Servicios. Sector:')).props.onPress());
 await act(async()=>btn(r,'Editar o eliminar registro').props.onPress());
 assert.ok(r.root.findAllByType('Sheet').some(s=>s.props.title==='Editar registro'&&s.props.visible));
 const a=r.root.findByType('BloqueAcceso').props.valor;
 await act(async()=>r.root.findByType('BloqueAcceso').props.onChange({...a,lugar:'Depósito',personas:[{nombre:'Nombre corregido',dni:'30123456'},{nombre:'Persona nueva',dni:'31123456'}]}));
 await act(async()=>btn(r,'Guardar').props.onPress());await refrescar(r);
 assert.equal(externosEnPredio(st.S)[0].sector,'Depósito');assert.equal(externosEnPredio(st.S)[0].personas.length,2);
 assert.equal(st.S.novedades.length,1);
 await act(async()=>r.root.findAllByType('Pressable').find(p=>p.props.accessibilityLabel?.startsWith('Servicios. Sector:')).props.onPress());
 await act(async()=>btn(r,'Editar o eliminar registro').props.onPress());
 await act(async()=>r.root.findAllByType('Btn').find(b=>b.props.icon==='trash').props.onPress());
 await act(async()=>r.root.findByType('Confirmar').props.onOk());await refrescar(r);
 assert.equal(externosEnPredio(st.S).length,0);assert.ok(st.S.visits[0].deleted);assert.ok(st.S.novedades[0].deleted);
 await act(async()=>r.unmount());
});

test('las presencias cargadas desde el libro abren su editor correspondiente',async()=>{
 st.S.novedades.push({id:'libro',fecha:isoDate(),hora:hhmm(),guardId:'g',categoria:'Externo',datos:{movimiento:'ingreso'},texto:'Ingresa personal.',acc:{...accVacio(),empresa:'Empresa del libro',lugar:'Playa',personas:[{nombre:'Otra persona',dni:'32123456'}]}});
 let r;await act(async()=>{r=create(React.createElement(Predio));});
 await act(async()=>r.root.findAllByType('Pressable').find(p=>p.props.accessibilityLabel?.startsWith('Empresa del libro. Sector:')).props.onPress());
 await act(async()=>btn(r,'Editar o eliminar registro').props.onPress());
 assert.equal(r.root.findByType('EditorNovedad').props.abierto,true);assert.equal(r.root.findByType('EditorNovedad').props.novedad.id,'libro');
 await act(async()=>r.unmount());
});

test('un error de disco permite reintentar el alta sin duplicar visita ni asiento',async()=>{
 const visitasAntes=st.S.visits.length,novedadesAntes=st.S.novedades.length;
 let r;await act(async()=>{r=create(React.createElement(Predio));});
 await act(async()=>btn(r,'Agregar personal al predio').props.onPress());
 await act(async()=>r.root.findByType('BloqueAcceso').props.onChange({...accVacio(),empresa:'Reintento',personas:[{nombre:'Persona',dni:'33123456'}]}));
 st.confirmarGuardado=async()=>{throw Error('Disco no disponible');};
 await act(async()=>btn(r,'Guardar').props.onPress());
 assert.ok(r.root.findAllByType('Sheet').some(s=>s.props.title==='Registrar ingreso'&&s.props.visible));
 const id=st.S.visits.at(-1).id,novIn=st.S.visits.at(-1).novIn;
 st.confirmarGuardado=async()=>{};
 await act(async()=>btn(r,'Guardar').props.onPress());
 assert.equal(st.S.visits.length,visitasAntes+1);assert.equal(st.S.novedades.length,novedadesAntes+1);
 assert.equal(st.S.visits.at(-1).id,id);assert.equal(st.S.visits.at(-1).novIn,novIn);
 await act(async()=>r.unmount());
});
