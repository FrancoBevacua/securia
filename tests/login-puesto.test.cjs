require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module'),React=require('react');
const {create,act}=require('react-test-renderer');global.IS_REACT_ACT_ENVIRONMENT=true;
const {estadoVacio}=require('../src/model.ts');let ingresos=[],fallar=false;
const st={S:estadoVacio(),me:null,ingresarCorporativo:async pin=>{if(fallar)throw Error('PIN incorrecto.');ingresos.push(pin);}};
const load=Module._load;Module._load=function(n,...a){
 if(n==='react-native')return{View:'View',Text:'Text',Pressable:'Pressable',ActivityIndicator:'ActivityIndicator'};
 if(n==='react-native-safe-area-context')return{useSafeAreaInsets:()=>({top:0,bottom:0})};
 if(n==='../store')return{useStore:()=>st};if(n==='../icons')return{Icon:()=>null};
 if(n==='../Marca')return{MarcaVigelium:()=>null};
 if(n==='../ui')return{useTheme:()=>({}),...Object.fromEntries(['Card','Btn','Input','Pantalla','Hint','Banner'].map(x=>[x,p=>React.createElement(x,p,p.children)]))};
 return load.call(this,n,...a);
};
const Gate=require('../src/pantallas/Gate.tsx').default;
const entrar=r=>r.root.findAllByType('Btn').find(b=>b.props.label==='Entrar');
const digitar=async(r,pin)=>{for(const n of pin)await act(async()=>r.root.findAllByType('Pressable').find(p=>p.props.accessibilityLabel==='Número '+n).props.onPress());};
test('el acceso sólo pide el PIN del corporativo y exige exactamente seis números',async()=>{
 let r;await act(async()=>{r=create(React.createElement(Gate));});assert.equal(r.root.findAllByType('Input').length,0);assert.equal(entrar(r).props.disabled,true);
 await digitar(r,'63820');await act(async()=>entrar(r).props.onPress());assert.equal(ingresos.length,0);
 await digitar(r,'1');assert.equal(entrar(r).props.disabled,false);await act(async()=>entrar(r).props.onPress());assert.deepEqual(ingresos,['638201']);
 assert.equal(entrar(r).props.disabled,true);assert.ok(!r.root.findAllByType('Btn').some(b=>/Registrarme|DNI/.test(b.props.label||'')));await act(async()=>r.unmount());
});
test('un PIN rechazado se borra de la pantalla y puede corregirse con retroceso',async()=>{
 let r;await act(async()=>{r=create(React.createElement(Gate));});await digitar(r,'638200');await act(async()=>r.root.findAllByType('Pressable').find(p=>p.props.accessibilityLabel==='Borrar último número').props.onPress());await digitar(r,'1');
 fallar=true;await act(async()=>entrar(r).props.onPress());assert.equal(r.root.findByType('Banner').props.children,'PIN incorrecto.');assert.equal(entrar(r).props.disabled,true);fallar=false;await act(async()=>r.unmount());
});
