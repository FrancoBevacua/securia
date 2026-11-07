require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module'),React=require('react');
const {create,act}=require('react-test-renderer');global.IS_REACT_ACT_ENVIRONMENT=true;
let peticiones=0,aceptados=[],cerrados=0,resolver;
const load=Module._load;
Module._load=function(n,...a){
 if(n==='../ui')return Object.fromEntries(['Btn','Sheet','Hint','Banner','Row'].map(x=>[x,p=>React.createElement(x,p,p.children,p.footer)]));
 if(n==='./PuertasAcceso')return p=>React.createElement('Puertas',p);
 if(n==='../lectura')return{elegirFotoDocumento:async()=>({clase:'imagen',imagen:{mime:'image/jpeg',base64:'ficticio'}})};
 if(n==='../ai')return{leerConfigIA:async()=>({proveedor:'openai',apiKey:'ficticia'}),fichaProveedor:()=>({t:'GPT (OpenAI)',vision:true}),pedirIA:async()=>{peticiones++;return new Promise(ok=>{resolver=ok;});}};
 return load.call(this,n,...a);
};
const LeerPrecintos=require('../src/pantallas/LeerPrecintos.tsx').default;
const boton=(r,label)=>r.root.findAllByType('Btn').find(x=>x.props.label===label);
test('no envía sin acción, requiere revisión y descarta una respuesta después de cerrar',async()=>{
 let r;const props={visible:true,acceso:'Emergencia E2',onAceptar:p=>aceptados.push(p),onClose:()=>cerrados++};
 await act(async()=>{r=create(React.createElement(LeerPrecintos,props));});assert.equal(peticiones,0);
 let p;await act(async()=>{p=boton(r,'Tomar foto y leer').props.onPress();});assert.equal(peticiones,1);assert.equal(aceptados.length,0);
 await act(async()=>{resolver('{"puertas":[{"nombre":"Puerta 1","precintos":["0123456"]}]}');await p;});assert.equal(aceptados.length,0);
 await act(async()=>boton(r,'Usar precintos revisados').props.onPress());assert.equal(aceptados[0][0].precintos[0],'0123456');assert.equal(cerrados,1);
 await act(async()=>r.update(React.createElement(LeerPrecintos,{...props,visible:false})));
 await act(async()=>r.update(React.createElement(LeerPrecintos,props)));
 await act(async()=>{p=boton(r,'Tomar foto y leer').props.onPress();});await act(async()=>r.root.findByType('Sheet').props.onClose());
 await act(async()=>{resolver('{"puertas":[{"nombre":"Puerta 2","precintos":["7654321"]}]}');await p;});assert.equal(r.root.findAllByType('Puertas').length,0);assert.equal(aceptados.length,1);
 await act(async()=>r.unmount());
});
