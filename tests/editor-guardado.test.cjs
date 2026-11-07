require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module'),React=require('react');
const {create,act}=require('react-test-renderer');global.IS_REACT_ACT_ENVIRONMENT=true;
const {estadoVacio}=require('../src/model.ts'),servicio=require('../src/servicio.ts');
const guardia={id:'a',nombre:'Ana',apellido:'Prueba'},S=estadoVacio();S.guards=[guardia];S.accesses=[{id:'p',nombre:'Portón Oroño'},{id:'e',nombre:'Puertas E2 y E2 Bis'}];
let confirmar=async()=>{},cerrados=0;const guardados=[],avisos=[];
const store={S,me:guardia,put:(c,r)=>guardados.push(r),confirmarGuardado:()=>confirmar(),byId:()=>undefined,list:()=>[]};
const load=Module._load;
Module._load=function(n,...a){
 if(n==='react-native')return{View:'View',Text:'Text',Image:'Image',Pressable:'Pressable',Platform:{OS:'android'}};
 if(n==='../store')return{useStore:()=>store};
 if(n==='../servicio')return{...servicio,turnoAbierto:()=>({id:'turno'}),motivoSoloLectura:()=>''};
 if(n==='../ui')return{useTheme:()=>({}),useToast:()=>s=>avisos.push(s),...Object.fromEntries(['Sheet','Input','Field','Chipbar','Chip','Row','Btn','Selector','Seg','Hint','Banner','Confirmar'].map(x=>[x,p=>React.createElement(x,p,p.children,p.footer)]))};
 if(['./Rondas','./ServicioActual','./BloqueAcceso','./Dictado','./RedaccionIA','./SelectorFirma'].includes(n))return()=>null;
 return load.call(this,n,...a);
};
const {EditorNovedad}=require('../src/pantallas/EditorAsiento.tsx');
const boton=r=>r.root.findAllByType('Btn').find(b=>['Guardar','Guardando…'].includes(b.props.label));

test('fotos sólo en Novedad, Externos, Apertura y Cierre; la descripción opcional se guarda aparte',async()=>{
 let r;confirmar=async()=>{};
 await act(async()=>{r=create(React.createElement(EditorNovedad,{abierto:true,novedad:null,fecha:'2026-09-29',onClose:()=>{}}));});
 const campo=label=>r.root.findAllByType('Input').find(i=>i.props.label===label);
 for(const c of ['Ingresos/Egresos','Recorrido','Externos','Apertura/Cierre','Novedad']){
  await act(async()=>r.root.findAllByType('Chip').find(x=>x.props.label===(c==='Externos'?'Ingresos/Egresos':c)).props.onPress());
  if(c==='Externos')await act(async()=>r.root.findAllByType('Selector').find(s=>s.props.label==='Tipo de ingreso o egreso').props.onChange('externo'));
  assert.equal(!!campo('Descripción breve de las fotos (opcional)'),['Novedad','Externos','Apertura/Cierre'].includes(c));
  assert.equal(r.root.findAllByType('Btn').some(x=>x.props.label==='Adjuntar imágenes'),['Novedad','Externos','Apertura/Cierre'].includes(c));
 }
 await act(async()=>campo('Descripción del registro').props.onChangeText('Registro largo del hecho'));
 await act(async()=>campo('Descripción breve de las fotos (opcional)').props.onChangeText('   Precinto roto   '));
 await act(async()=>boton(r).props.onPress());
 assert.equal(guardados.at(-1).descripcionEvidencia,'Precinto roto');assert.equal(guardados.at(-1).texto,'Registro largo del hecho');
 guardados.length=0;avisos.length=0;cerrados=0;await act(async()=>r.unmount());
});
test('espera el disco, conserva el formulario si falla y reintenta con el mismo ID',async()=>{
 let r,resolve,reject;confirmar=()=>new Promise((ok,no)=>{resolve=ok;reject=no;});
 await act(async()=>{r=create(React.createElement(EditorNovedad,{abierto:true,novedad:null,fecha:'2026-09-14',onClose:()=>cerrados++}));});
 await act(async()=>{r.root.findAllByType('Input').find(i=>i.props.label==='Descripción del registro').props.onChangeText('Novedad importante');});
 let p;await act(async()=>{p=boton(r).props.onPress();});assert.equal(cerrados,0);assert.equal(avisos.length,0);assert.equal(boton(r).props.disabled,true);
 await act(async()=>{reject(Error('SQLITE_FULL'));await p;});assert.equal(cerrados,0);assert.equal(avisos.length,0);assert.match(String(r.root.findByType('Banner').props.children),/SQLITE_FULL/);
 await act(async()=>{p=boton(r).props.onPress();});await act(async()=>{resolve();await p;});
 assert.equal(guardados.length,2);assert.equal(guardados[0].id,guardados[1].id);assert.equal(cerrados,1);assert.equal(avisos.length,1);await act(async()=>r.unmount());
});
test('al cargar un informe anterior no asigna la hora actual a una fecha equivocada',async()=>{
 let r;await act(async()=>{r=create(React.createElement(EditorNovedad,{abierto:true,novedad:null,fecha:'2000-01-01',corte:'19:00',duracion:12,onClose:()=>{}}));});
 const campo=label=>r.root.findAllByType('Input').find(i=>i.props.label===label);
 const hoy=require('../src/model.ts').isoDate();
 assert.equal(campo('Fecha').props.value,hoy);assert.match(campo('Horario').props.value,/^\d{2}:\d{2}$/);
 await act(async()=>campo('Fecha').props.onChangeText('2026-09-19'));
 await act(async()=>campo('Horario').props.onChangeText('19:05'));assert.equal(campo('Fecha').props.value,'2026-09-19');
 await act(async()=>campo('Horario').props.onChangeText('06:30'));assert.equal(campo('Fecha').props.value,'2026-09-19');
 await act(async()=>campo('Descripción del registro').props.onChangeText('Borrador a las 19'));
 await act(async()=>r.update(React.createElement(EditorNovedad,{abierto:true,novedad:null,fecha:'2026-09-20',corte:'19:00',duracion:24,onClose:()=>{}})));
 assert.equal(campo('Descripción del registro').props.value,'Borrador a las 19');assert.equal(campo('Fecha').props.value,'2026-09-19');
 await act(async()=>r.unmount());
});
test('Apertura/Cierre comparte el formulario y conserva la operación al guardar y editar',async()=>{
 let r;confirmar=async()=>{};
 await act(async()=>{r=create(React.createElement(EditorNovedad,{abierto:true,novedad:null,fecha:'2026-10-25',onClose:()=>{}}));});
 const campo=label=>r.root.findAllByType('Input').find(i=>i.props.label===label);
 assert.ok(!r.root.findAllByType('Chip').some(c=>['Apertura','Cierre'].includes(c.props.label)));
 await act(async()=>r.root.findAllByType('Chip').find(c=>c.props.label==='Apertura/Cierre').props.onPress());
 await act(async()=>campo('Nombre del acceso').props.onChangeText('Puertas E2 y E2 Bis'));
 assert.ok(!r.root.findAllByType('Input').some(i=>/Motivo/.test(i.props.label||'')));
 await act(async()=>r.root.findAllByType('Pressable').find(p=>p.props.accessibilityRole==='checkbox'&&p.props.accessibilityLabel==='Agregar motivo').props.onPress());
 await act(async()=>campo('Motivo de la apertura').props.onChangeText('Para el ingreso del personal de limpieza'));
 assert.match(campo('Descripción del registro').props.value,/personal de limpieza/);
 await act(async()=>r.root.findAllByType('Seg').find(s=>s.props.valor==='apertura').props.onChange('cierre'));
 assert.match(campo('Descripción del registro').props.value,/Se procede al cierre/);
 await act(async()=>boton(r).props.onPress());
 const n=guardados.at(-1);assert.equal(n.categoria,'Cierre');assert.equal(n.datos.incluirMotivo,true);assert.equal(n.datos.motivo,'Para el ingreso del personal de limpieza');
 await act(async()=>r.update(React.createElement(EditorNovedad,{abierto:true,novedad:n,fecha:n.fecha,onClose:()=>{}})));
 assert.equal(r.root.findAllByType('Seg').find(s=>s.props.valor==='cierre').props.valor,'cierre');
 assert.equal(campo('Motivo del cierre').props.value,'Para el ingreso del personal de limpieza');
 await act(async()=>r.unmount());
});
