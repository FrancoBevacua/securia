require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module'),React=require('react');
const {create,act}=require('react-test-renderer');global.IS_REACT_ACT_ENVIRONMENT=true;
const eventos={},app=new Set();let permiso=async()=>({granted:true}),inicios=0,abortos=0;
const voz={isRecognitionAvailable:()=>true,requestPermissionsAsync:()=>permiso(),start:o=>{assert.equal(o.lang,'es-AR');inicios++;},stop:()=>{},abort:()=>{abortos++;}};
const cargar=Module._load;
Module._load=function(n,...a){
 if(n==='react-native')return{AppState:{addEventListener:(_,fn)=>{app.add(fn);return{remove:()=>app.delete(fn)};}}};
 if(n==='expo-speech-recognition')return{ExpoSpeechRecognitionModule:voz,useSpeechRecognitionEvent:(nombre,fn)=>{eventos[nombre]=fn;}};
 if(n==='../ui')return{Btn:p=>React.createElement('Btn',p)};
 return cargar.call(this,n,...a);
};
const Dictado=require('../src/pantallas/DictadoChat.tsx').default;
const boton=r=>r.root.findByType('Btn');
test('el permiso no se cancela con su diálogo y la voz entrega sólo un borrador al finalizar',async()=>{
 let r,liberar;permiso=()=>new Promise(ok=>liberar=ok);const textos=[],estados=[];
 await act(()=>{r=create(React.createElement(Dictado,{enabled:true,onTexto:v=>textos.push(v),onEstado:(...v)=>estados.push(v)}));});
 await act(()=>boton(r).props.onPress());
 await act(()=>{for(const fn of app)fn('background');liberar({granted:true});});
 assert.equal(inicios,1);assert.equal(boton(r).props.accessibilityLabel,'Terminar dictado');
 await act(()=>eventos.result({isFinal:false,results:[{transcript:'Revisar'}]}));assert.deepEqual(textos,[]);
 await act(()=>{eventos.result({isFinal:true,results:[{transcript:'Revisar portón.'}]});eventos.end();});
 assert.deepEqual(textos,['Revisar portón.']);assert.equal(estados.at(-1)[0],false);
 await act(()=>r.unmount());
});
test('cerrar el chat cancela un permiso pendiente y descarta resultados tardíos',async()=>{
 let r,liberar;permiso=()=>new Promise(ok=>liberar=ok);
 const props={enabled:true,onTexto:()=>assert.fail('No agregar voz tardía'),onEstado:()=>{}};
 await act(()=>{r=create(React.createElement(Dictado,props));});await act(()=>boton(r).props.onPress());
 const antes=inicios;await act(()=>{r.update(React.createElement(Dictado,{...props,enabled:false}));});
 await act(()=>liberar({granted:true}));assert.equal(inicios,antes);
 await act(()=>{eventos.result({isFinal:true,results:[{transcript:'Tardío'}]});eventos.end();});
 await act(()=>r.unmount());
});
test('permiso denegado y fallo de reconocimiento permiten volver a intentar',async()=>{
 let r;const estados=[];permiso=async()=>({granted:false});
 await act(()=>{r=create(React.createElement(Dictado,{enabled:true,onTexto:()=>assert.fail('Sin transcripción'),onEstado:(...v)=>estados.push(v)}));});
 await act(()=>boton(r).props.onPress());assert.match(estados.at(-1)[1],/Permití/);assert.equal(boton(r).props.disabled,false);
 permiso=async()=>({granted:true});await act(()=>boton(r).props.onPress());
 await act(()=>eventos.error({error:'network'}));assert.equal(boton(r).props.disabled,false);assert.ok(abortos>0);
 await act(()=>eventos.end());assert.equal(estados.at(-1)[0],false);await act(()=>r.unmount());
});
test('cambiar a la biblioteca durante el dictado libera el botón de enviar',async()=>{
 let r;const estados=[];permiso=async()=>({granted:true});
 await act(()=>{r=create(React.createElement(Dictado,{enabled:true,onTexto:()=>assert.fail('Descartado'),onEstado:(...v)=>estados.push(v)}));});
 await act(()=>boton(r).props.onPress());assert.equal(estados.at(-1)[0],true);
 await act(()=>r.unmount());assert.deepEqual(estados.at(-1),[false,'']);
 await act(()=>eventos.end());assert.deepEqual(estados.at(-1),[false,'']);
});
