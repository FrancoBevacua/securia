require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module'),React=require('react');
const {create,act}=require('react-test-renderer');global.IS_REACT_ACT_ENVIRONMENT=true;
const {estadoVacio}=require('../src/model.ts');const {detalleDiferencia,registrosRecuperados,fotosDelDato}=require('../src/detalleSincronizacion.ts');
const S=estadoVacio();S.guards=[{id:'id-guardia-a',nombre:'Ana',apellido:'Prueba'},{id:'id-guardia-b',nombre:'Bruno',apellido:'Ejemplo'}];
S.punches=[{id:'id-turno',guardId:'id-guardia-a',fecha:'2026-09-19',in:'07:00'}];
const revision={pendiente:{estado:S},remoto:S,diferencias:[{ruta:['punches','id-turno','guardId'],local:'id-guardia-a',remoto:'id-guardia-b'}]};
let pausas=0,aplicadas=[],cerradas=0,recuperar;
const store={me:S.guards[0],S,errorGuardado:'',nube:{vinculada:true,pendiente:true,guardando:false,error:'Conflicto'},
 resolverDiferencias:async(r,op)=>{aplicadas=op;},recuperarSincronizacion:async()=>recuperar(),reiniciarSesionRecuperada:async()=>{}};
const load=Module._load;
Module._load=function(n,...a){
 if(n==='react-native')return {Text:'Text',View:'View',Image:'Image',ActivityIndicator:'ActivityIndicator',Platform:{OS:'android'}};
 if(n==='react-native-safe-area-context')return{useSafeAreaInsets:()=>({top:0})};
 if(n==='../store')return{useStore:()=>store};
 if(n==='../nube')return{revisarDiferenciasNube:async()=>revision,pausarRevision:()=>{pausas++;return()=>{pausas--;cerradas++;}}};
 if(n==='../icons')return{Icon:()=>null};
 if(n==='./HistorialRecuperacion')return()=>null;
 if(n==='../ui')return{useTheme:()=>({}),...Object.fromEntries(['Btn','Sheet','Stack','Card','Hint','Banner','Seg','Row','Input','Eyebrow','Tag'].map(x=>[x,p=>React.createElement(x,p,p.children)]))};
 return load.call(this,n,...a);
};
const {EstadoSincronizacion}=require('../src/pantallas/Nube.tsx');
const boton=(r,label)=>r.root.findAllByType('Btn').find(x=>x.props.label===label);
const panel=r=>r.root.findAllByType('Sheet').find(x=>x.props.title==='Recuperar sincronización');
test('la recuperación por registros permanece visible durante el envío y finaliza sin reiniciar la sesión',async()=>{
 let liberar;recuperar=()=>new Promise(resolve=>liberar=resolve);let r;
 await act(async()=>{r=create(React.createElement(EstadoSincronizacion));});
 await act(async()=>boton(r,'Ver').props.onPress());await act(async()=>boton(r,'Recuperar sincronización').props.onPress());
 let proceso;await act(async()=>{proceso=boton(r,'Reintentar pendientes').props.onPress();});
 store.nube.guardando=true;await act(async()=>r.update(React.createElement(EstadoSincronizacion)));assert.equal(panel(r).props.visible,true);
 await act(async()=>{liberar({incorporados:1,resguardados:0});await proceso;});
 store.nube.guardando=false;store.nube.pendiente=false;store.nube.error='';await act(async()=>r.update(React.createElement(EstadoSincronizacion)));
 assert.equal(panel(r).props.visible,true);assert.ok(boton(r,'Listo'));assert.equal(boton(r,'Volver a ingresar al corporativo'),undefined);
 await act(async()=>boton(r,'Listo').props.onPress());assert.equal(panel(r).props.visible,false);await act(async()=>r.unmount());
});
test('un fallo conserva la ventana y sólo una confirmación completa muestra finalización',async()=>{
 store.nube.pendiente=true;store.nube.error='Conflicto';recuperar=async()=>{throw Error('Sin conexión. Cola conservada.');};let r;
 await act(async()=>{r=create(React.createElement(EstadoSincronizacion));});await act(async()=>boton(r,'Ver').props.onPress());await act(async()=>boton(r,'Recuperar sincronización').props.onPress());
 await act(async()=>boton(r,'Reintentar pendientes').props.onPress());assert.equal(panel(r).props.visible,true);assert.equal(boton(r,'Listo'),undefined);
 assert.ok(r.root.findAllByType('Banner').some(x=>String(x.props.children).includes('Cola conservada')));
 recuperar=async()=>({incorporados:1,resguardados:2});await act(async()=>boton(r,'Reintentar pendientes').props.onPress());assert.ok(boton(r,'Listo'));await act(async()=>r.unmount());
});
test('muestra nombres, fecha, texto y fotos sin JSON ni identificadores internos',()=>{
 const d=detalleDiferencia(revision.diferencias[0],S,S);assert.match(d.titulo,/Actividad.*2026-09-19/);assert.match(d.local,/Ana/);assert.match(d.remoto,/Bruno/);assert.doesNotMatch(JSON.stringify(d),/id-guardia/);
 const t=structuredClone(S);t.novedades=[{id:'id-nov',fecha:'2026-09-19',hora:'19:05',guardId:'id-guardia-a',turnoId:'id-turno',texto:'Portón revisado',fotos:['data:image/jpeg;base64,prueba']}];
 const filas=registrosRecuperados(t,S);assert.equal(filas.length,1);const detalle=detalleDiferencia(filas[0],t,S);
 assert.match(detalle.local,/Portón revisado/);assert.match(detalle.local,/Ana/);assert.doesNotMatch(detalle.local,/id-nov|id-turno|id-guardia|base64/);assert.equal(fotosDelDato(filas[0].local).length,1);
});
