require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module'),React=require('react');
const {create,act}=require('react-test-renderer');global.IS_REACT_ACT_ENVIRONMENT=true;
const {estadoVacio}=require('../src/model.ts'),servicio=require('../src/servicio.ts');
const guardia={id:'a',nombre:'Ana',apellido:'Prueba'},S=estadoVacio();S.guards=[guardia];S.accesses=[{id:'e',nombre:'Puertas E2 y E2 Bis'}];
let guardados=[],avisos=[];
const store={S,me:guardia,esAdmin:true,put:(col,obj)=>guardados.push({col,obj}),putVarios:c=>guardados.push(...c),confirmarGuardado:async()=>{},
 byId:(col,id)=>S[col].find(x=>x.id===id),list:col=>S[col].filter(x=>!x.deleted),setSite:()=>{}};
const load=Module._load;
Module._load=function(n,...a){
 if(n==='react-native')return{View:'View',Text:'Text',Image:'Image',Pressable:'Pressable',Platform:{OS:'android'}};
 if(n==='expo-clipboard')return{setStringAsync:async()=>{}};
 if(n==='../store')return{useStore:()=>store};
 if(n==='../servicio')return{...servicio,turnoAbierto:()=>({id:'turno'}),motivoSoloLectura:()=>''};
 if(n==='../ui')return{useTheme:()=>({}),useToast:()=>s=>avisos.push(s),...Object.fromEntries(
  ['Sheet','Input','Field','Chipbar','Chip','Row','Btn','Selector','Seg','Hint','Banner','Confirmar','Pantalla','Cabecera','Card','Tag','Item','Empty','Stack','Toggle','Eyebrow']
   .map(x=>[x,p=>React.createElement(x,p,p.children,p.footer)]))};
 if(n==='./SelectorFirma')return p=>React.createElement('Selector',p);
 if(n==='./BloqueAcceso')return p=>React.createElement('AccesoExterno',p);
 if(['./Rondas','./ServicioActual','./BloqueAcceso','./Dictado','./RedaccionIA','./SelectorFirma'].includes(n))return()=>null;
 return load.call(this,n,...a);
};
const {EditorNovedad}=require('../src/pantallas/EditorAsiento.tsx');
const Accesos=require('../src/pantallas/Accesos.tsx').default;
const input=(r,label)=>r.root.findAllByType('Input').find(i=>i.props.label===label);
const check=r=>r.root.findAllByType('Pressable').find(i=>i.props.accessibilityRole==='checkbox');
const save=r=>r.root.findAllByType('Btn').find(i=>i.props.label==='Guardar');

test('el guardia del paseo registra el cierre ejecutado por otro guardia sin cambiar su firma',async()=>{
 guardados=[];S.guards=[guardia,{id:'playa',nombre:'Bruno',apellido:'Playa'}];store.responsable=guardia;S.accesses=[{id:'porton',nombre:'Portón Oroño'}];let r;
 try{
  await act(async()=>{r=create(React.createElement(EditorNovedad,{abierto:true,novedad:null,fecha:'2026-11-07',categoriaInicial:'Apertura/Cierre',onClose:()=>{}}));});
  await act(async()=>r.root.findAllByType('Seg').find(s=>s.props.valor==='apertura').props.onChange('cierre'));
  await act(async()=>r.root.findAllByType('Selector').find(s=>s.props.label==='Acceso del catálogo').props.onChange('Portón Oroño'));
  await act(async()=>r.root.findAllByType('Selector').find(s=>s.props.label==='Guardia que realizó el cierre (opcional)').props.onChange('playa'));
  assert.equal(r.root.findAllByType('Selector').find(s=>s.props.label==='Guardia que registra la novedad').props.valor,guardia.id);
  await act(async()=>save(r).props.onPress());const n=guardados.find(x=>x.col==='novedades').obj;assert.equal(n.guardId,guardia.id);assert.equal(n.datos.realizadoPorId,'playa');assert.match(n.texto,/Realizó el cierre: Gs Playa, Bruno/);
 }finally{if(r)await act(async()=>r.unmount());S.guards=[guardia];S.accesses=[{id:'e',nombre:'Puertas E2 y E2 Bis'}];delete store.responsable;}
});

test('Ingresos/Egresos reúne los tres tipos y conserva sus datos y categorías de libro',async()=>{
 guardados=[];let r;await act(async()=>{r=create(React.createElement(EditorNovedad,{abierto:true,novedad:null,fecha:'2026-10-24',onClose:()=>{}}));});
 assert.ok(!r.root.findAllByType('Chip').some(c=>c.props.label==='Externos'));
 const grupo=()=>r.root.findAllByType('Chip').find(c=>c.props.label==='Ingresos/Egresos');await act(async()=>grupo().props.onPress());
 const tipo=()=>r.root.findAllByType('Selector').find(s=>s.props.label==='Tipo de ingreso o egreso');assert.deepEqual(tipo().props.opciones.map(o=>o.v),['vigilador','adicional','externo']);
 await act(async()=>tipo().props.onChange('externo'));assert.equal(grupo().props.on,true);
 await act(async()=>r.root.findAllByType('Chip').find(c=>c.props.label==='Novedad').props.onPress());await act(async()=>grupo().props.onPress());assert.equal(tipo().props.valor,'externo');assert.equal(r.root.findAllByType('AccesoExterno').length,1);
 await act(async()=>r.root.findByType('AccesoExterno').props.onChange({...require('../src/model.ts').accVacio(),empresa:'Empresa Prueba',personas:[{nombre:'Persona Prueba',dni:'36010660'}]}));
 await act(async()=>save(r).props.onPress());assert.equal(guardados.at(-1).obj.categoria,'Externo');assert.equal(guardados.at(-1).obj.acc.empresa,'Empresa Prueba');
 await act(async()=>tipo().props.onChange('adicional'));await act(async()=>input(r,'Apellido').props.onChangeText('Prueba'));await act(async()=>input(r,'Nombre').props.onChangeText('Ana'));await act(async()=>save(r).props.onPress());assert.equal(guardados.at(-1).obj.categoria,'Adicional');assert.equal(guardados.at(-1).obj.origenTipo,'policial');
 await act(async()=>tipo().props.onChange('vigilador'));await act(async()=>r.root.findAllByType('Seg').find(s=>s.props.valor==='ingreso').props.onChange('egreso'));await act(async()=>save(r).props.onPress());assert.equal(guardados.at(-1).obj.categoria,'Egreso');await act(async()=>r.unmount());
});

test('el libro selecciona varios accesos, guarda la lista y la recupera al editar',async()=>{
 S.accesses=[{id:'a1',nombre:'Oroño'},{id:'a2',nombre:'Ombú'},{id:'a3',nombre:'E2'}];guardados=[];let r;
 await act(async()=>{r=create(React.createElement(EditorNovedad,{abierto:true,novedad:null,fecha:'2026-09-28',onClose:()=>{}}));});
 const chip=label=>r.root.findAllByType('Chip').find(c=>c.props.label===label);
 await act(async()=>chip('Apertura/Cierre').props.onPress());
 await act(async()=>r.root.findAllByType('Seg').find(s=>s.props.valor==='uno').props.onChange('varios'));
 await act(async()=>save(r).props.onPress());assert.equal(guardados.length,0);
 await act(async()=>chip('Oroño').props.onPress());await act(async()=>chip('Ombú').props.onPress());
 assert.equal(input(r,'Descripción del registro').props.value,'Se procede a la apertura de los portones de playa:\n- Oroño\n- Ombú');
 await act(async()=>chip('Ombú').props.onPress());assert.doesNotMatch(input(r,'Descripción del registro').props.value,/Ombú/);
 await act(async()=>chip('Ombú').props.onPress());await act(async()=>save(r).props.onPress());
 assert.deepEqual(guardados.map(x=>x.col),['novedades']);const n=guardados[0].obj;
 assert.deepEqual(n.datos.accesos,['Oroño','Ombú']);
 S.accesses=S.accesses.filter(a=>a.nombre!=='Ombú');
 await act(async()=>r.update(React.createElement(EditorNovedad,{abierto:true,novedad:n,fecha:n.fecha,onClose:()=>{}})));
 assert.equal(chip('Ombú').props.on,true);
 await act(async()=>r.root.findAllByType('Seg').find(s=>s.props.valor==='apertura').props.onChange('cierre'));assert.match(input(r,'Descripción del registro').props.value,/Se procede al cierre de los portones de playa/);
 await act(async()=>r.root.findAllByType('Selector').find(s=>s.props.label==='Grupo de accesos').props.onChange('emergencias'));
 assert.deepEqual(r.root.findAllByType('Chip').filter(c=>c.props.on).map(c=>c.props.label).filter(x=>['Oroño','Ombú'].includes(x)),[]);
 await act(async()=>chip('E2').props.onPress());assert.match(input(r,'Descripción del registro').props.value,/puertas de emergencias/);
 await act(async()=>r.unmount());S.accesses=[{id:'e',nombre:'Puertas E2 y E2 Bis'}];
});

test('el alta de acceso y vigilador pide Aceptar sin estilo de eliminación',async()=>{
 for(const categoria of ['Apertura/Cierre','Ingresos/Egresos']){
  guardados=[];let r;await act(async()=>{r=create(React.createElement(EditorNovedad,{abierto:true,novedad:null,fecha:'2026-09-28',onClose:()=>{}}));});
  await act(async()=>r.root.findAllByType('Chip').find(c=>c.props.label===categoria).props.onPress());
  if(categoria==='Apertura/Cierre')await act(async()=>input(r,'Nombre del acceso').props.onChangeText('Portón nuevo'));
  else {
   await act(async()=>r.root.findAllByType('Seg').find(s=>s.props.valor==='ingreso').props.onChange('egreso'));
   await act(async()=>input(r,'Apellido').props.onChangeText('Nuevo'));await act(async()=>input(r,'Nombre').props.onChangeText('Juan'));
  }
  await act(async()=>save(r).props.onPress());
  const alta=r.root.findAllByType('Confirmar').find(c=>c.props.visible);
  assert.equal(alta.props.etiqueta,'Aceptar');assert.equal(alta.props.variante,'primary');
  await act(async()=>alta.props.onCancel());assert.deepEqual(guardados.map(x=>x.col),['novedades']);
  await act(async()=>r.unmount());
 }
});

test('Accesos filtra el catálogo, empieza con un precinto y conserva los grupos históricos',async()=>{
 S.accesses=[
  {id:'p',nombre:'Portón Ombú',tipo:'porton',precintos:2},
  {id:'e1',nombre:'Puerta E1',tipo:'emergencia',precintos:2},
  {id:'v',nombre:'Ventanal',tipo:'otro',precintos:0},
 ];
 S.alogs=[];guardados=[];let r;
 await act(async()=>{r=create(React.createElement(Accesos));});
 await act(async()=>r.root.findByType('Cabecera').props.derecha.props.onPress());
 const selector=label=>r.root.findAllByType('Selector').find(s=>s.props.label===label);
 assert.ok(!r.root.findAllByType('Seg').some(s=>s.props.opciones.some(o=>o.v==='varios')));
 assert.deepEqual(selector('Acceso del catálogo').props.opciones.map(o=>o.v),['','Portón Ombú']);
 await act(async()=>selector('Categoría del catálogo').props.onChange('emergencias'));
 assert.deepEqual(selector('Acceso del catálogo').props.opciones.map(o=>o.v),['','Puerta E1']);
 await act(async()=>selector('Acceso del catálogo').props.onChange('Puerta E1'));
 assert.equal(r.root.findAllByType('Input').filter(i=>/^Precinto/.test(i.props.label||'')).length,1);
 await act(async()=>input(r,'Precinto 1').props.onChangeText('1234567'));
 await act(async()=>selector('Vigilador').props.onChange(guardia.id));
 await act(async()=>r.root.findAllByType('Btn').find(b=>b.props.label==='Agregar a la lista').props.onPress());
 assert.deepEqual(guardados.map(x=>x.col),['alogs']);
 const registro=guardados[0].obj;
 assert.equal(registro.acceso,'Puerta E1');assert.equal(registro.p1,'1234567');assert.equal(registro.p2,'');
 S.alogs=[{...registro,acceso:'Puertas de emergencias',grupoAccesos:'emergencias',accesos:['Puerta E1','Puerta E2'],p1:'',puertas:[]}];
 await act(async()=>r.update(React.createElement(Accesos)));
 await act(async()=>r.root.findAllByType('Item').find(i=>i.props.title==='Puertas de emergencias').props.onPress());
 assert.match(input(r,'Mensaje automático').props.value,/- Puerta E1\n- Puerta E2/);
 await act(async()=>r.unmount());S.accesses=[{id:'e',nombre:'Puertas E2 y E2 Bis'}];
});

test('el egreso externo muestra el bloque breve y guarda la observación como novedad',async()=>{
 guardados=[];let r;
 await act(async()=>{r=create(React.createElement(EditorNovedad,{abierto:true,novedad:null,fecha:'2026-11-07',categoriaInicial:'Externos',movimientoInicial:'egreso',onClose:()=>{}}));});
 const bloque=r.root.findByType('AccesoExterno');
 assert.equal(bloque.props.egreso,true);
 assert.equal(input(r,'Descripción del registro'),undefined);
 assert.ok(!r.root.findAllByType('Selector').some(s=>s.props.label==='Tipo de externo'));
 await act(async()=>bloque.props.onChange({...bloque.props.valor,empresa:'Empresa de prueba',obs:'Se retira por recepción',tarea:'Limpieza'}));
 await act(async()=>save(r).props.onPress());
 const novedad=guardados.at(-1).obj;
 assert.equal(novedad.datos.movimiento,'egreso');
 assert.equal(novedad.acc.tarea,'');
 assert.equal(novedad.texto,'Egresa personal de la firma Empresa de prueba. Se retira por recepción.');
 await act(async()=>r.unmount());
});

test('Accesos no pide motivo y permite guardar otro acceso sin números de precinto',async()=>{
 guardados=[];avisos=[];S.alogs=[];S.accesses=[{id:'v',nombre:'Ventanal'}];let r;
 await act(async()=>{r=create(React.createElement(Accesos));});
 await act(async()=>r.root.findByType('Cabecera').props.derecha.props.onPress());
 await act(async()=>input(r,'Nombre del acceso').props.onChangeText('Ventanal'));
 await act(async()=>r.root.findAllByType('Selector').find(s=>s.props.label==='Vigilador').props.onChange(guardia.id));
 await act(async()=>r.root.findAllByType('Selector').find(s=>s.props.label==='Tipo de acceso').props.onChange('otro'));
 assert.ok(!r.root.findAllByType('Input').some(i=>/Motivo|Precinto/.test(i.props.label||'')));
 await act(async()=>r.root.findAllByType('Btn').find(b=>b.props.label==='Agregar a la lista').props.onPress());
 const registro=guardados.find(x=>x.col==='alogs').obj;
 assert.equal(registro.sinPrecinto,true);assert.deepEqual(registro.puertas,[]);assert.equal(registro.p1,'');assert.equal(registro.p2,'');assert.equal(registro.incluirMotivo,false);
 S.alogs=[registro];await act(async()=>r.update(React.createElement(Accesos)));
 await act(async()=>r.root.findAllByType('Item').find(i=>i.props.title==='Ventanal').props.onPress());
 const editor=r.root.findAllByType('Sheet').find(s=>s.props.title==='Editar registro');
 assert.equal(editor.findAllByType('Toggle').find(t=>t.props.label==='No aplica precinto').props.value,true);
 await act(async()=>r.unmount());
});

test('portón permite agregar precintos sin elegir hojas y los conserva en el informe',async()=>{
 guardados=[];S.alogs=[];S.accesses=[{id:'p',nombre:'Portón Oroño'}];let r;
 await act(async()=>{r=create(React.createElement(Accesos));});
 await act(async()=>r.root.findByType('Cabecera').props.derecha.props.onPress());
 await act(async()=>input(r,'Nombre del acceso').props.onChangeText('Portón Oroño'));
 await act(async()=>r.root.findAllByType('Selector').find(s=>s.props.label==='Vigilador').props.onChange(guardia.id));
 await act(async()=>r.root.findAllByType('Selector').find(s=>s.props.label==='Tipo de acceso').props.onChange('porton'));
 assert.ok(!r.root.findAllByType('Selector').some(s=>s.props.label==='Hojas del portón'));
 for(let i=0;i<3;i++)await act(async()=>r.root.findAllByType('Btn').find(b=>b.props.label==='Agregar precinto').props.onPress());
 const inputs=r.root.findAllByType('Input').filter(i=>/^Precinto/.test(i.props.label||''));assert.equal(inputs.length,4);
 for(let i=0;i<4;i++)await act(async()=>r.root.findAllByType('Input').filter(i=>/^Precinto/.test(i.props.label||''))[i].props.onChangeText('123456'+i));
 await act(async()=>r.root.findAllByType('Btn').find(b=>b.props.label==='Agregar a la lista').props.onPress());
 const registro=guardados.find(x=>x.col==='alogs').obj;assert.equal(registro.tipoAcceso,'porton');assert.equal(registro.configuracionPorton,undefined);assert.deepEqual(registro.puertas.map(p=>p.precintos.length),[4]);
 const {textoInformeAccesos}=require('../src/text.ts');const salida=textoInformeAccesos([registro],registro.fecha,{tipo:'ambos',orden:'carga'},S.site);assert.doesNotMatch(salida,/Hoja de ingreso|Hoja de egreso/);assert.match(salida,/1234563/);
 await act(async()=>r.unmount());
});

test('historial policial recupera datos y turno sin ofrecer un selector de puesto',async()=>{
 guardados=[];S.novedades=[{id:'policial',categoria:'Adicional',fecha:'2026-10-24',hora:'09:00',datos:{apellido:'Pérez',nombre:'Ana',turno:'09:00-16:00',tipoPersona:'adicional'}}];let r;
 await act(async()=>{r=create(React.createElement(EditorNovedad,{abierto:true,novedad:null,fecha:'2026-10-25',categoriaInicial:'Adicional',onClose:()=>{}}));});
 assert.ok(!r.root.findAllByType('Selector').some(s=>s.props.label==='Puesto'));
 await act(async()=>r.root.findAllByType('Btn').find(b=>b.props.label==='Elegir adicional del historial').props.onPress());
 await act(async()=>r.root.findAllByType('Item').find(i=>i.props.title==='Pérez, Ana').props.onPress());
 assert.equal(input(r,'Apellido').props.value,'Pérez');assert.equal(input(r,'Turno').props.value,'09:00-16:00');
 await act(async()=>save(r).props.onPress());assert.equal(guardados.at(-1).obj.categoria,'Adicional');assert.equal(guardados.at(-1).obj.datos.tipoPersona,'adicional');
 await act(async()=>r.unmount());S.novedades=[];
});
