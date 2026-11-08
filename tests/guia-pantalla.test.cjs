require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module'),React=require('react');
const {create,act}=require('react-test-renderer');global.IS_REACT_ACT_ENVIRONMENT=true;
const memoria=new Map(),rutas=[];let volverAndroid,fallar=false;
const st={me:{id:'corporativo'},responsable:{id:'ana'},put:()=>assert.fail('La guía no crea registros'),putVarios:()=>assert.fail('La guía no modifica el servicio')};
const load=Module._load;
Module._load=function(n,...a){
 if(n==='react-native')return{View:'View',Text:'Text',Pressable:'Pressable',ScrollView:'ScrollView',BackHandler:{addEventListener:(nombre,fn)=>{volverAndroid=fn;return{remove:()=>{volverAndroid=undefined;}};}}};
 if(n==='react-native-safe-area-context')return{useSafeAreaInsets:()=>({top:24,bottom:48})};
 if(n==='expo-router')return{router:{canGoBack:()=>true,back:()=>rutas.push('back'),replace:r=>rutas.push(r),push:r=>rutas.push(r)}};
 if(n==='@react-native-async-storage/async-storage')return{getItem:async k=>memoria.get(k)||null,setItem:async(k,v)=>{if(fallar)throw Error('Disco de prueba');memoria.set(k,v);}};
 if(n==='../store')return{useStore:()=>st};if(n==='../icons')return{Icon:'Icon'};
 if(n==='./AnimacionGuia')return{InsigniaGuia:'InsigniaGuia',EjemploGuia:'EjemploGuia'};
 if(n==='../ui')return{useTheme:()=>({}),...Object.fromEntries(['Banner','Btn','Card','Hint','Item','Row'].map(x=>[x,p=>React.createElement(x,p,p.children)]))};
 return load.call(this,n,...a);
};
const Guia=require('../src/pantallas/Guia.tsx').default,Acceso=require('../src/pantallas/AccesoGuia.tsx').default;
const {TEMAS_GUIA,claveGuia}=require('../src/guia.ts');
const boton=(r,label)=>r.root.findAllByType('Btn').find(x=>x.props.label===label);

test('el acceso de Inicio abre una guía libre y recuerda la consulta al volver a entrar',async()=>{
 let acceso,r;await act(async()=>{acceso=create(React.createElement(Acceso));r=create(React.createElement(Guia));});
 await act(async()=>acceso.root.findByType('Pressable').props.onPress());assert.deepEqual(rutas,['/guia']);
 assert.equal(r.root.findAllByType('Item').length,TEMAS_GUIA.length);
 await act(async()=>r.root.findAllByType('Item').find(x=>x.props.title==='Accesos y precintos').props.onPress());
 assert.equal(r.root.findByType('EjemploGuia').props.paso.titulo,'Entrá a Accesos');
 assert.equal(boton(r,'Anterior').props.disabled,true);
 await act(async()=>boton(r,'Siguiente').props.onPress());
 assert.equal(r.root.findByType('EjemploGuia').props.paso.titulo,'Identificá el acceso');
 await act(async()=>boton(r,'Pausar animación').props.onPress());assert.equal(r.root.findByType('EjemploGuia').props.pausa,true);
 await act(async()=>{assert.equal(volverAndroid(),true);});assert.equal(r.root.findAllByType('Item').length,TEMAS_GUIA.length);
 await act(async()=>r.unmount());await act(async()=>{r=create(React.createElement(Guia));});
 await act(async()=>boton(r,'Continuar donde dejé').props.onPress());assert.equal(r.root.findByType('EjemploGuia').props.paso.titulo,'Identificá el acceso');
 await act(async()=>r.unmount());await act(async()=>acceso.unmount());
});

test('se puede leer toda la guía aunque falle el guardado, sin ejercicios ni escrituras operativas',async()=>{
 let r;await act(async()=>{r=create(React.createElement(Guia));});fallar=true;
 await act(async()=>boton(r,'Continuar donde dejé').props.onPress());
 assert.ok(r.root.findAllByType('Banner').some(x=>String(x.props.children).includes('No se pudo recordar')));
 for(const tema of TEMAS_GUIA){
  await act(async()=>r.root.findAllByType('Btn').find(x=>x.props.icon==='back').props.onPress());
  await act(async()=>r.root.findAllByType('Item').find(x=>x.props.title===tema.titulo).props.onPress());
  for(let i=1;i<tema.pasos.length;i++)await act(async()=>boton(r,'Siguiente').props.onPress());
  assert.equal(r.root.findByType('EjemploGuia').props.paso,tema.pasos.at(-1));
  assert.ok(boton(r,tema.id===TEMAS_GUIA.at(-1).id?'Volver a los temas':'Siguiente tema'));
 }
 fallar=false;await act(async()=>boton(r,'Reintentar guardado').props.onPress());assert.equal(r.root.findAllByType('Banner').length,0);
 assert.deepEqual(JSON.parse(memoria.get(claveGuia('ana'))),{tema:'mas',paso:3});
 st.responsable={id:'bruno'};await act(async()=>r.update(React.createElement(Guia)));
 assert.ok(boton(r,'Comenzar guía'));assert.equal(r.root.findAllByType('Item').length,TEMAS_GUIA.length);
 await act(async()=>boton(r,'Comenzar guía').props.onPress());
 assert.equal(r.root.findByType('EjemploGuia').props.paso.titulo,'Confirmá quién está a cargo');
 assert.deepEqual(JSON.parse(memoria.get(claveGuia('ana'))),{tema:'mas',paso:3});
 await act(async()=>r.unmount());
});
