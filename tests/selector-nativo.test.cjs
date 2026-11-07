require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module'),React=require('react');
const {create,act}=require('react-test-renderer');global.IS_REACT_ACT_ENVIRONMENT=true;
const load=Module._load;let opciones;
Module._load=function(n,...args){
 if(n==='react-native')return{View:'View',Text:'Text',Pressable:'Pressable',Modal:'Modal',Platform:{OS:'android'}};
 if(n==='@react-native-community/datetimepicker')return{__esModule:true,default:()=>null,DateTimePickerAndroid:{open:p=>opciones=p}};
 if(n==='./icons')return{Icon:()=>null};
 return load.call(this,n,...args);
};
const Control=require('../src/FechaHoraControl.tsx').default;
test('reloj Android usa 24 horas, cancelar preserva el valor y aceptar guarda HH:MM',async()=>{
 const valores=[];let r;
 await act(async()=>{r=create(React.createElement(Control,{tipo:'hora',value:'19:05',tema:{},onChangeText:v=>valores.push(v)}));});
 await act(async()=>r.root.findByType('Pressable').props.onPress());
 assert.equal(opciones.display,'clock');assert.equal(opciones.is24Hour,true);
 opciones.onChange({type:'dismissed'},new Date(2026,8,19,20,30));assert.deepEqual(valores,[]);
 opciones.onChange({type:'set'},new Date(2026,8,19,20,30));assert.deepEqual(valores,['20:30']);
 await act(async()=>r.unmount());
});
