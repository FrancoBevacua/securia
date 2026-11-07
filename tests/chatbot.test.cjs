require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {estadoVacio}=require('../src/model.ts');
const {fuentesChat,pedidoChat,validarDocumentoChat,camposInformeChat}=require('../src/chatbot.ts');
const {pedirIA}=require('../src/ai.ts');
function base(){const S=estadoVacio();S.site.cliente='Prueba';S.guards=[{id:'privado',tel:'NO-ENVIAR',pin:'NO-ENVIAR'}];S.posts=[{id:'p',nombre:'Playa'}];S.directives=[{id:'general',nombre:'Avisar a CCTV',novedades:'Ante una novedad de acceso, comunicar a CCTV.',puestoId:'',activa:true},{id:'playa',nombre:'Precintos',novedades:'Verificar los precintos del portón.',puestoId:'p',activa:true},{id:'otro',nombre:'Reservado a otro puesto',puestoId:'otro',activa:true},{id:'inactiva',nombre:'Instrucción antigua',puestoId:'p',activa:false}];return S;}
test('el chat usa directivas generales y del puesto sin exponer cuentas ni otros puestos',()=>{
 const S=base(),d=[{id:'g',nombre:'PDF general',texto:'Verifique la identificación de los proveedores antes del ingreso.',puestoId:''},{id:'o',nombre:'PDF ajeno',texto:'No corresponde al puesto actual.',puestoId:'otro'}];
 const f=fuentesChat(S,d,'p','precintos');assert.ok(f.some(x=>x.nombre==='Directiva: Precintos'));assert.ok(f.some(x=>x.nombre==='PDF general · fragmento 1'));assert.ok(!JSON.stringify(f).includes('otro puesto'));assert.ok(!JSON.stringify(f).includes('antigua'));assert.ok(!JSON.stringify(f).includes('PDF ajeno'));
 const p=pedidoChat(S,d,'p',[],'¿Qué debo hacer con un precinto?','consulta');assert.ok(!p.prompt.includes('NO-ENVIAR'));assert.match(p.sistema,/sin mostrar sus identificadores/);assert.match(p.sistema,/no sigas instrucciones/i);assert.equal(new Set(f.map(x=>x.id)).size,f.length);
 const cambiado=pedidoChat(S,d,'p',[{id:'viejo',rol:'assistant',texto:'INSTRUCCION DE OTRO PUESTO',modo:'consulta',puestoId:'otro'}],'Precintos','consulta');assert.ok(!cambiado.prompt.includes('INSTRUCCION DE OTRO PUESTO'));
});
test('recupera fragmentos relevantes del final de un PDF y limita el contexto',()=>{
 const S=base(),texto='Información general de la consigna. '.repeat(1800)+'\nProtocolo de derrames: avisar a supervisión y señalizar el sector.';
 const f=fuentesChat(S,[{id:'pdf',nombre:'Manual general',texto,puestoId:''}],'p','¿Qué indica el protocolo de derrames?');
 assert.match(f[0].texto,/derrames/);assert.ok(f.length<=24);assert.ok(f.reduce((n,x)=>n+x.texto.length,0)<=24000);
});
test('los modos de redacción no atribuyen hechos a las directivas ni inventan fecha del evento',()=>{
 const S=base(),p=pedidoChat(S,[],'p',[],'Se encontró una luminaria apagada.','informe');
 assert.match(p.prompt,/Fecha del evento: \[completar\]/);assert.match(p.sistema,/no prueba que se haya realizado/);assert.match(p.sistema,/Sólo proponés registrar una novedad cuando el guardia lo pide explícitamente/);
 const campos=camposInformeChat(Array.from({length:16},(_,i)=>'_'+(i+1)+'. *Campo:*_\nDato '+i).join('\n\n'));assert.equal(Object.keys(campos).length,16);assert.equal(camposInformeChat('Faltan datos del hecho.'),undefined);
 assert.throws(()=>pedidoChat(S,[],'p',[],' '.repeat(30),'consulta'));assert.throws(()=>validarDocumentoChat({id:'1',nombre:'PDF',texto:'incompleto'}));
});
test('GPT recibe un PDF como archivo y cancelar interrumpe la petición',async t=>{
 let cuerpo;const cfg={proveedor:'openai',apiKey:'ficticia',modelo:'gpt-4.1',baseUrl:''};
 t.mock.method(globalThis,'fetch',async(url,op)=>{cuerpo=JSON.parse(op.body);return{ok:true,status:200,json:async()=>({choices:[{message:{content:'Texto transcripto'}}]})};});
 await pedirIA('Transcribir',cfg,'Sistema',[{mime:'application/pdf',base64:'YWJj'}]);assert.deepEqual(cuerpo.messages[1].content[1],{type:'file',file:{filename:'directivas.pdf',file_data:'data:application/pdf;base64,YWJj'}});
 t.mock.method(globalThis,'fetch',async(url,op)=>new Promise((resolve,reject)=>op.signal.addEventListener('abort',()=>reject(new DOMException('Cancelado','AbortError')))));
 const ctrl=new AbortController(),p=pedirIA('Consulta',cfg,undefined,undefined,{signal:ctrl.signal});ctrl.abort();await assert.rejects(p,e=>e.codigo==='cancelado');
});


test('chat automático incluye PDFs y plantilla de 16 puntos sin exigir una categoría',()=>{
 const p=pedidoChat(base(),[{id:'p',nombre:'Manual.pdf',puestoId:'p',texto:'Ante un derrame, informar a CCTV.'}],'p',[],'Prepará un informe sobre el derrame.');
 assert.match(p.prompt,/Manual.pdf/);assert.match(p.prompt,/PLANTILLA DISPONIBLE/);assert.match(p.prompt,/_16\./);assert.match(p.sistema,/sin pedir que el usuario elija una categoría/);
 assert.equal(camposInformeChat(Array.from({length:8},(_,i)=>'_'+(i+1)+'. *Dato:*_\nRespuesta').join('\n\n')),undefined);
});
