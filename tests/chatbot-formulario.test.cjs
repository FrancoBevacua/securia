require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module'),React=require('react');
const {create,act}=require('react-test-renderer');global.IS_REACT_ACT_ENVIRONMENT=true;
const {estadoVacio}=require('../src/model.ts'),ai=require('../src/ai.ts');
const S=estadoVacio();S.posts=[{id:'p',nombre:'Playa'}];S.directives=[{id:'d',nombre:'Controlar precintos',novedades:'Dar aviso de cualquier daño a CCTV.',puestoId:'p',activa:true}];
const st={S,esAdmin:true,me:{id:'guardia',puestoId:'p',nombre:'Ana',apellido:'Prueba'},put:()=>{throw Error('El chat no debe guardar asientos automáticamente');}};
let resolver,rechazar,pedidos=[],guardados=[],documentos=[],altura=800;const eventosTeclado={};const load=Module._load;
Module._load=function(n,...a){
 if(n==='react-native')return{View:'View',Text:'Text',TextInput:'TextInput',Pressable:'Pressable',Modal:'Modal',ScrollView:'ScrollView',KeyboardAvoidingView:'KeyboardAvoidingView',ActivityIndicator:'ActivityIndicator',Platform:{OS:'android'},useWindowDimensions:()=>({width:360,height:altura}),Keyboard:{dismiss:()=>{},addListener:(nombre,fn)=>{eventosTeclado[nombre]=fn;return{remove:()=>{delete eventosTeclado[nombre];}};}}};
 if(n==='react-native-keyboard-controller')return{KeyboardAvoidingView:'KeyboardAvoidingView',KeyboardEvents:{addListener:(nombre,fn)=>{eventosTeclado[nombre]=fn;return{remove:()=>delete eventosTeclado[nombre]};}}};
 if(n==='react-native-safe-area-context')return{SafeAreaProvider:p=>React.createElement('SafeAreaProvider',p,p.children),SafeAreaView:p=>React.createElement('SafeAreaView',p,p.children),useSafeAreaInsets:()=>({top:24,bottom:48})};if(n==='expo-router')return{router:{push:()=>{}}};if(n==='expo-clipboard')return{setStringAsync:async()=>{}};
 if(n==='../store')return{useStore:()=>st};if(n==='../icons')return{Icon:'Icon'};
 if(n==='../documentosChat')return{leerDocumentosChat:async()=>documentos,guardarDocumentosChat:async(g,ds)=>{guardados.push({guardia:g,docs:ds});documentos=ds;}};
 if(n==='../lectura')return{elegirDocumento:async()=>({clase:'texto',nombre:'Directivas.pdf',texto:'Para un precinto dañado, informe a CCTV y deje constancia de la revisión.'})};
 if(n==='../ai')return{...ai,leerConfigIA:async()=>({proveedor:'openai',apiKey:'ficticia'}),pedirIA:async(...args)=>{pedidos.push(args);return new Promise((ok,no)=>{resolver=ok;rechazar=no;});}};
 if(n==='../ui')return{useTheme:()=>({}),...Object.fromEntries(['Btn','Input','Row','Card','Hint','Banner','Seg','Selector'].map(x=>[x,p=>React.createElement(x,p,p.children)]))};
 if(n==='./EditorAsiento')return{EditorNovedad:p=>React.createElement('EditorNovedad',p)};
 if(n==='./Informes')return{nuevoInforme:()=>({id:'',fecha:'2026-10-24',fotos:[]}),Asistente:p=>React.createElement('AsistenteInforme',p)};
 return load.call(this,n,...a);
};
const Chat=require('../src/pantallas/ChatbotFlotante.tsx').default;
const btn=(r,label)=>r.root.findAllByType('Btn').find(b=>b.props.label===label||b.props.accessibilityLabel===label),input=(r,label)=>label==='Mensaje'?r.root.findByType('TextInput'):r.root.findAllByType('Input').find(b=>b.props.label===label);
const abrir=r=>r.root.findAllByType('Pressable').find(x=>x.props.accessibilityLabel==='Abrir asistente Securia').props.onPress();
test('botón flotante abre el chat, conserva errores y sólo prepara una novedad después de revisarla',async()=>{
 let r;await act(async()=>{r=create(React.createElement(Chat));});assert.equal(pedidos.length,0);
 await act(async()=>abrir(r));assert.equal(r.root.findByType('Modal').props.visible,true);
 assert.equal(r.root.findAllByType('Seg').length,0);
 await act(async()=>input(r,'Mensaje').props.onChangeText('Precinto dañado; se avisó al CCTV.'));
 let p;await act(async()=>{p=btn(r,'Enviar').props.onPress();});await act(async()=>{rechazar(Error('Sin conexión'));await p;});assert.equal(input(r,'Mensaje').props.value,'Precinto dañado; se avisó al CCTV.');
 await act(async()=>{p=btn(r,'Enviar').props.onPress();});await act(async()=>{resolver('Se constató un precinto dañado y se informó al CCTV.');await p;});
 assert.equal(r.root.findByType('EditorNovedad').props.abierto,false);assert.match(pedidos.at(-1)[0],/PLANTILLA DISPONIBLE/);assert.match(pedidos.at(-1)[0],/Controlar precintos/);
 await act(async()=>btn(r,'Revisar novedad').props.onPress());assert.equal(r.root.findByType('Modal').props.visible,false);assert.equal(r.root.findByType('EditorNovedad').props.abierto,true);assert.match(r.root.findByType('EditorNovedad').props.textoInicial,/constató/);await act(async()=>r.unmount());
});
test('cancelar descarta respuestas tardías y un PDF de texto se lee localmente antes de guardarlo',async()=>{
 let r;const cantidad=pedidos.length;await act(async()=>{r=create(React.createElement(Chat));});await act(async()=>abrir(r));await act(async()=>input(r,'Mensaje').props.onChangeText('¿Qué hago con un precinto?'));
 let p;await act(async()=>{p=btn(r,'Enviar').props.onPress();});const signal=pedidos.at(-1)[4].signal;await act(async()=>btn(r,'Cancelar').props.onPress());assert.equal(signal.aborted,true);
 await act(async()=>{resolver('ESTA RESPUESTA DEBE DESCARTARSE');await p;});assert.ok(!r.root.findAllByType('Text').some(x=>x.props.children==='ESTA RESPUESTA DEBE DESCARTARSE'));
 await act(async()=>btn(r,'Directivas y PDFs').props.onPress());await act(async()=>btn(r,'Agregar PDF de directivas').props.onPress());assert.equal(pedidos.length,cantidad+1);assert.match(input(r,'Texto para revisar').props.value,/CCTV/);
 await act(async()=>r.root.findAllByType('Selector').find(s=>s.props.label==='Alcance del documento').props.onChange(''));await act(async()=>btn(r,'Guardar fuente revisada').props.onPress());assert.equal(guardados.at(-1).guardia,'guardia');assert.equal(guardados.at(-1).docs[0].puestoId,'');await act(async()=>r.unmount());
});
test('un informe generado en el chat abre el asistente de 16 puntos sin guardarlo',async()=>{
 let r;await act(async()=>{r=create(React.createElement(Chat));});await act(async()=>abrir(r));await act(async()=>input(r,'Mensaje').props.onChangeText('Prepará un informe: se detectó una luminaria apagada.'));
 let p;await act(async()=>{p=btn(r,'Enviar').props.onPress();});await act(async()=>{resolver(Array.from({length:16},(_,i)=>'_'+(i+1)+'. *Punto:*_\nContenido '+(i+1)).join('\n\n'));await p;});
 assert.equal(r.root.findAllByType('AsistenteInforme').length,0);await act(async()=>btn(r,'Revisar informe').props.onPress());const draft=r.root.findByType('AsistenteInforme').props.informe;assert.equal(draft.f6,'Contenido 6');assert.equal(draft.hora,'');assert.equal(draft.firmaId,'');assert.equal(draft.id,'');await act(async()=>r.unmount());
});


test('respuestas extensas y teclado conservan el compositor fuera del área desplazable',async()=>{
 let r;await act(async()=>{r=create(React.createElement(Chat));});await act(async()=>abrir(r));
 await act(async()=>input(r,'Mensaje').props.onChangeText('Consulta de prueba'));
 let p;await act(async()=>{p=btn(r,'Enviar').props.onPress();});
 assert.equal(r.root.findByType('Modal').props.presentationStyle,'fullScreen');
 assert.equal(r.root.findByType('Modal').props.transparent,undefined);
 assert.ok(r.root.findAllByType('View').some(x=>x.props.accessibilityLabel==='Securia está generando una respuesta'));
 assert.equal(r.root.findAllByType('View').find(x=>x.props.accessibilityLabel==='Escribir al asistente').props.style.flexShrink,0);
 assert.equal(input(r,'Mensaje').props.editable,true);assert.ok(btn(r,'Cancelar'));
 await act(async()=>{resolver('Respuesta extensa. '.repeat(1500));await p;});
 const conversacion=()=>r.root.findAllByType('ScrollView').find(x=>x.props.accessibilityLabel==='Conversación con Securia');
 const compositor=()=>r.root.findAllByType('View').find(x=>x.props.accessibilityLabel==='Escribir al asistente');
 assert.equal(conversacion().findAllByType('Input').length,0);assert.equal(conversacion().props.style.minHeight,0);
 assert.equal(compositor().props.style.flexShrink,0);assert.equal(input(r,'Mensaje').props.style.height,64);assert.equal(input(r,'Mensaje').props.style.textAlignVertical,'center');assert.equal(input(r,'Mensaje').props.style.includeFontPadding,false);assert.equal(r.root.findByType('KeyboardAvoidingView').props.behavior,'padding');assert.equal(r.root.findByType('KeyboardAvoidingView').props.automaticOffset,true);
 await act(async()=>{altura=320;eventosTeclado.keyboardDidShow();});
 assert.equal(input(r,'Mensaje').props.style.height,64);assert.ok(btn(r,'Enviar'));assert.ok(conversacion());
 await act(async()=>{altura=800;eventosTeclado.keyboardDidHide();});
 assert.equal(input(r,'Mensaje').props.style.height,64);await act(async()=>r.unmount());
});

test('enviar no oculta el teclado ni deshabilita el campo y conserva el siguiente borrador',async()=>{
 let r;await act(async()=>{r=create(React.createElement(Chat));});await act(async()=>abrir(r));
 await act(async()=>eventosTeclado.keyboardDidShow());
 const marco=()=>r.root.findByType('SafeAreaView').props.edges;
 const pie=()=>r.root.findAllByType('View').find(v=>v.props.accessibilityLabel==='Escribir al asistente').props.style;
 await act(async()=>input(r,'Mensaje').props.onChangeText('Primera consulta'));
 const antes=JSON.stringify(pie());let p;await act(async()=>{p=btn(r,'Enviar').props.onPress();});
 assert.equal(input(r,'Mensaje').props.editable,true);assert.equal(JSON.stringify(pie()),antes);assert.deepEqual(marco(),['top','left','right']);assert.equal(btn(r,'Cancelar').props.style.width,104);
 await act(async()=>input(r,'Mensaje').props.onChangeText('Siguiente consulta'));
 await act(async()=>{resolver('## Respuesta\n\n**Dato:** verifique el sector. [O1]');await p;});
 assert.equal(input(r,'Mensaje').props.value,'Siguiente consulta');assert.equal(JSON.stringify(pie()),antes);
 await act(async()=>eventosTeclado.keyboardDidHide());assert.deepEqual(marco(),['top','bottom','left','right']);
 await act(async()=>r.unmount());
});

test('un pedido explícito agrega una novedad al libro y un fallo de disco reintenta el mismo registro',async()=>{
 const originalPut=st.put;st.responsable={id:'personal',nombre:'Ana',apellido:'Prueba'};st.telefonoId='tel';S.guards=[st.me,st.responsable];S.punches=[{id:'turno',guardId:st.me.id,responsableId:'personal',dispositivoId:'tel',fecha:require('../src/model.ts').isoDate(),in:'00:00',out:''}];
 const {aplicarCambios}=require('../src/mutaciones.ts');let intentos=0;
 st.put=(col,obj)=>{const nuevo=aplicarCambios(S,[{col,obj}],st.me,false,'tel');Object.assign(S,nuevo);};
 st.confirmarGuardado=async()=>{if(++intentos===1)throw Error('Fallo de disco de prueba');};
 let r;try{
  await act(async()=>{r=create(React.createElement(Chat));});await act(async()=>abrir(r));await act(async()=>input(r,'Mensaje').props.onChangeText('Agregá esta novedad al libro: se verificó el sector.'));
  let p;await act(async()=>{p=btn(r,'Enviar').props.onPress();});await act(async()=>{resolver('Novedad preparada.\n```securia-novedad\n{"categoria":"Novedad","texto":"Se verificó el sector. [O1]"}\n```');await p;});
  assert.equal(S.novedades.length,1);const id=S.novedades[0].id;assert.equal(S.novedades[0].guardId,'personal');assert.equal(S.novedades[0].createdBy,st.me.id);assert.doesNotMatch(S.novedades[0].texto,/\[O1\]/);assert.ok(btn(r,'Reintentar guardado'));
  await act(async()=>btn(r,'Reintentar guardado').props.onPress());assert.equal(S.novedades.length,1);assert.equal(S.novedades[0].id,id);assert.ok(btn(r,'Ver en el libro'));
 }finally{if(r)await act(async()=>r.unmount());st.put=originalPut;delete st.confirmarGuardado;delete st.responsable;S.novedades=[];S.punches=[];}
});
