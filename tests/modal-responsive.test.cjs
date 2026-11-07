require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module'),React=require('react');
const {create,act}=require('react-test-renderer');global.IS_REACT_ACT_ENVIRONMENT=true;
const load=Module._load;let alto=640,inferior=48;
Module._load=function(n,...args){
 if(n==='react-native')return {View:'View',Text:'Text',TextInput:'TextInput',Pressable:'Pressable',ScrollView:'ScrollView',Modal:'Modal',Platform:{OS:'android'},StyleSheet:{create:x=>x},useWindowDimensions:()=>({height:alto,width:320}),useColorScheme:()=> 'dark'};
 if(n==='react-native-safe-area-context')return {useSafeAreaInsets:()=>({top:24,bottom:inferior})};
 if(n==='react-native-keyboard-controller')return {KeyboardAwareScrollView:'KeyboardAwareScrollView'};
 if(n==='./icons')return {Icon:()=>null};if(n==='./FechaHoraControl')return ()=>null;
 return load.call(this,n,...args);
};
const {Sheet,Chipbar}=require('../src/ui.tsx');
test('la última opción conserva área segura inferior aunque el modal no tenga footer y se adapta a altura reducida',async()=>{
 let r;await act(async()=>{r=create(React.createElement(Sheet,{visible:true,title:'Tipo de ingreso o egreso',onClose:()=>{}},React.createElement('Text',null,'Externos')));});
 let scroll=r.root.findByType('KeyboardAwareScrollView');assert.ok(scroll.props.contentContainerStyle.paddingBottom>=inferior+16);assert.equal(r.root.findByType('Modal').props.navigationBarTranslucent,true);
 assert.ok(r.root.findAllByType('View').some(v=>v.props.style?.maxHeight===600));
 alto=320;inferior=0;await act(async()=>r.update(React.createElement(Sheet,{visible:true,title:'Tipos',onClose:()=>{}},'Externos')));
 scroll=r.root.findByType('KeyboardAwareScrollView');assert.ok(scroll.props.contentContainerStyle.paddingBottom>=48);assert.ok(r.root.findAllByType('View').some(v=>v.props.style?.maxHeight===280));await act(async()=>r.unmount());
});
test('las categorías se acomodan al ancho sin una tira horizontal oculta',async()=>{
 let r;await act(async()=>{r=create(React.createElement(Chipbar,null,'Categorías'));});assert.equal(r.root.findByType('View').props.style.flexWrap,'wrap');assert.equal(r.root.findAllByType('ScrollView').length,0);await act(async()=>r.unmount());
});
