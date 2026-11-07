require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript'),React=require('react');
const {create,act}=require('react-test-renderer');global.IS_REACT_ACT_ENVIRONMENT=true;
const file=path.resolve(__dirname,'../admin/src/NewEntryForm.jsx'),m=new Module(file,module);m.filename=file;const requireOriginal=m.require.bind(m);m.require=n=>n==='react'?React:requireOriginal(n);m.paths=Module._nodeModulePaths(path.dirname(file));
m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
const Form=m.exports.default,guards=[{id:'corp',nombre:'Guardia Paseo',corporativo:true},{id:'g',nombre:'Ana',apellido:'Prueba'},{id:'baja',nombre:'Baja',deleted:true}];
const submit=r=>r.root.findByType('form').props.onSubmit({preventDefault(){}});
test('el formulario conserva borrador e identificador al fallar y al actualizar la revisión',async()=>{
 let r,saves=[],refresh=0;const props={guards,onSave:v=>saves.push(v),onRefresh:()=>refresh++};
 await act(async()=>{r=create(React.createElement(Form,props));});
 assert.deepEqual(r.root.findAllByType('option').filter(x=>['g','corp','baja'].includes(x.props.value)).map(x=>x.props.value),['g']);
 await act(async()=>r.root.findByType('textarea').props.onChange({target:{value:'  Se verifica el portón.  '}}));
 await act(async()=>submit(r));assert.equal(saves.length,0);
 await act(async()=>r.root.findAllByType('select').find(x=>x.props.value==='').props.onChange({target:{value:'g'}}));
 await act(async()=>submit(r));assert.equal(saves[0].datos.texto,'Se verifica el portón.');assert.equal(saves[0].datos.guardId,'g');assert.match(saves[0].id,/^[0-9a-f-]{36}$/);
 await act(async()=>r.update(React.createElement(Form,{...props,error:'Hay cambios recientes.'})));
 assert.equal(r.root.findByType('textarea').props.value,'  Se verifica el portón.  ');
 await act(async()=>r.root.findAllByType('button').find(b=>b.props.children==='Actualizar vista').props.onClick());assert.equal(refresh,1);
 await act(async()=>submit(r));assert.equal(saves[1].id,saves[0].id);assert.deepEqual(saves[1].datos,saves[0].datos);
 await act(async()=>r.update(React.createElement(Form,{...props,busy:true})));await act(async()=>submit(r));assert.equal(saves.length,2);
 await act(async()=>r.unmount());
});

test('la API web exige sesión y origen y reenvía la creación con la sesión del servidor',async()=>{
 const {default:handler,seal}=await import('../admin/api/admin.mjs');
 const prev={...process.env},oldFetch=global.fetch;const calls=[];
 Object.assign(process.env,{SUPABASE_URL:'https://ejemplo.invalid',SUPABASE_PUBLIC_KEY:'publica-ficticia',CORPORATE_CODE:'vinculo-ficticio',SESSION_SECRET:'secreto-ficticio-de-prueba-con-mas-de-32-caracteres'});
 global.fetch=async(url,opts)=>{calls.push(JSON.parse(opts.body).p_request);return{ok:true,json:async()=>({ok:true,revision:9})};};
 function response(){return{statusCode:200,setHeader(){},status(s){this.statusCode=s;return this;},json(j){this.body=j;return this;}};}
 const token=seal({dispositivo:'a'.repeat(64),token:'token-servidor',exp:Date.now()+100000},process.env.SESSION_SECRET);
 const body={accion:'crear_asiento',id:crypto.randomUUID(),revision:8,token:'intento-de-suplantacion',dispositivo:'otro',datos:{fecha:'2026-11-06',hora:'12:34',categoria:'NOVEDAD',guardId:'g',texto:'Descripción'}};
 try{
  let res=response();await handler({method:'POST',headers:{origin:'https://panel.test',host:'panel.test'},body},res);assert.equal(res.statusCode,401);assert.equal(calls.length,0);
  res=response();await handler({method:'POST',headers:{origin:'https://externo.test',host:'panel.test',cookie:'vigelium_admin='+token},body},res);assert.equal(res.statusCode,403);assert.equal(calls.length,0);
  res=response();await handler({method:'POST',headers:{origin:'https://panel.test',host:'panel.test',cookie:'vigelium_admin='+token},body},res);assert.equal(res.statusCode,200);assert.equal(calls.length,1);assert.equal(calls[0].accion,'crear_asiento');assert.equal(calls[0].token,'token-servidor');assert.equal(calls[0].dispositivo,'a'.repeat(64));assert.deepEqual(calls[0].datos,body.datos);
 }finally{global.fetch=oldFetch;for(const k of ['SUPABASE_URL','SUPABASE_PUBLIC_KEY','CORPORATE_CODE','SESSION_SECRET']){if(prev[k]===undefined)delete process.env[k];else process.env[k]=prev[k];}}
});
