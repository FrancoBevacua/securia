require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {estadoVacio,accVacio}=require('../src/model.ts');
const {externosEnPredio,guardiasEnServicio,colorSector}=require('../src/presencias.ts');
const {contextoOperativo}=require('../src/contextoOperativo.ts');
const {pedidoChat,fuentesChat}=require('../src/chatbot.ts');
const {filtrarLibro,agruparLibro,opcionesGsLibro}=require('../src/filtrosLibro.ts');
const {sugerenciasTexto}=require('../src/autocompletado.ts');
const {nuevasPuertas,completarPuertas}=require('../src/precintos.ts');
const ahora=new Date(2026,9,27,10,0);
const acc=(empresa='Limpieza SA',personas=[{nombre:'Persona Uno',dni:'30123456'}])=>({...accVacio(),empresa,personas,tarea:'Limpieza',lugar:'Escalera al techo'});
const nov=(id,movimiento,a=acc(),extra={})=>({id,categoria:'Externo',fecha:'2026-10-27',hora:'08:00',texto:movimiento==='egreso'?'Se retira personal.':'Ingresa personal.',acc:a,datos:{movimiento},...extra});

test('el servicio y su hora provienen sólo del libro, excluyendo admin, corporativo y egresos',()=>{
 const S=estadoVacio();S.guards=[{id:'g',apellido:'Prueba',nombre:'Ana',puestoId:'otro'},
  {id:'admin',apellido:'Usuario',nombre:'Administrador',rol:'admin'},
  {id:'corp',apellido:'Cuenta',nombre:'Corporativa',corporativo:true}];
 S.posts=[{id:'p',nombre:'Paseo'},{id:'otro',nombre:'Playa'}];
 S.punches=[{id:'relevo-tardio',guardId:'corp',responsableId:'g',fecha:'2026-10-27',in:'09:00',out:''}];
 const ingreso=(g,hora='06:00')=>({id:g.id,categoria:'Ingreso',fecha:'2026-10-27',hora,guardId:'admin',datos:{apellido:g.apellido,nombre:g.nombre,puestoId:'p',turno:'Mañana'}});
 S.novedades=S.guards.map(g=>ingreso(g));
 assert.deepEqual(guardiasEnServicio(S,ahora),[{id:'g',nombre:'Prueba, Ana',puesto:'Paseo',fecha:'2026-10-27',ingreso:'06:00',turno:'Mañana'}]);
 S.novedades.push({...ingreso(S.guards[0],'08:00'),id:'egreso',categoria:'Egreso'});
 assert.equal(guardiasEnServicio(S,ahora).length,0);
 S.novedades.push({...ingreso(S.guards[0],'09:30'),id:'reingreso'});
 assert.equal(guardiasEnServicio(S,ahora)[0].ingreso,'09:30');
 S.novedades.push({...ingreso(S.guards[0],'09:30'),id:'empate',categoria:'Egreso'});
 assert.equal(guardiasEnServicio(S,ahora).length,0);
 S.novedades.at(-1).deleted=true;
 S.novedades.push({...ingreso(S.guards[0],'11:00'),id:'futuro',categoria:'Egreso'});
 assert.equal(guardiasEnServicio(S,ahora)[0].ingreso,'09:30');
 assert.equal(guardiasEnServicio(S,new Date(2026,9,29,10,0)).length,0);
});

test('el mapa deduplica visita/libro, excluye retirados y futuros y separa espera de confirmados',()=>{
 const S=estadoVacio();S.visits=[{id:'v',fecha:'2026-10-27',horaIn:'08:00',horaOut:'',acc:acc(),tipo:'Contratista',novIn:'v-in'}];
 S.novedades=[nov('v-in','ingreso',acc(),{visitId:'v',mov:'in'}),nov('futuro','ingreso',acc('Futuro'),{hora:'11:00'}),nov('espera','ingreso',{...acc('Pendiente'),autoriz:'espera'}),nov('retirado','ingreso',{...acc('Retirado'),autoriz:'retiro'})];
 const grupos=externosEnPredio(S,ahora);assert.equal(grupos.length,2);assert.equal(grupos.find(g=>g.empresa==='Limpieza SA').personas.length,1);assert.equal(grupos.find(g=>g.empresa==='Pendiente').estado,'espera');
 S.visits[0].deleted=true;assert.ok(!externosEnPredio(S,ahora).some(g=>g.empresa==='Limpieza SA'));
});
test('egreso parcial conserva al resto del equipo y una reentrada posterior vuelve a figurar',()=>{
 const S=estadoVacio(),p1={nombre:'Persona Uno',dni:'30123456'},p2={nombre:'Persona Dos',dni:'31123456'};
 S.novedades=[nov('in','ingreso',acc('Empresa',[p1,p2])),nov('out','egreso',acc('Empresa',[p1]),{hora:'09:00'})];
 let grupos=externosEnPredio(S,ahora);assert.deepEqual(grupos[0].personas.map(p=>p.nombre),['Persona Dos']);
 S.novedades.push(nov('reingreso','ingreso',acc('Empresa',[p1]),{hora:'09:30'}));grupos=externosEnPredio(S,ahora);assert.equal(grupos[0].personas.length,2);
 S.novedades.push(nov('todos-fuera','egreso',acc('Empresa',[]),{hora:'09:45'}));assert.equal(externosEnPredio(S,ahora).length,0);
});
test('una salida de madrugada usa la fecha real del libro y un catálogo no acredita presencia',()=>{
 const S=estadoVacio();S.visits=[{id:'v',fecha:'2026-10-26',horaIn:'23:00',horaOut:'01:00',acc:acc(),tipo:'Proveedor',novOut:'out'}];
 S.novedades=[nov('out','egreso',acc(),{fecha:'2026-10-27',hora:'01:00',visitId:'v',mov:'out'})];
 S.externals=[{id:'f',empresa:'Ficha sin ingreso',personas:[]}];
 assert.equal(externosEnPredio(S,new Date(2026,9,27,0,30)).length,1);assert.equal(externosEnPredio(S,ahora).length,0);
 assert.equal(colorSector('Escalera al techo'),'#B42335');assert.equal(colorSector('ESCALERA AL TECHO'),'#B42335');assert.equal(colorSector('Playa'),colorSector('Playa'));
});
test('el asistente reúne servicio, registros, accesos e informes y excluye credenciales y datos de cuenta',()=>{
 const S=estadoVacio();S.guards=[{id:'g',nombre:'Ana',apellido:'Prueba',puestoId:'p',pin:'SECRETO-PIN',email:'SECRETO-EMAIL',dni:'SECRETO-DNI',tel:'SECRETO-TEL',foto:'SECRETO-FOTO'}];
 S.posts=[{id:'p',nombre:'Playa'}];S.punches=[{id:'punch',guardId:'g',fecha:'2026-10-26',in:'23:00',out:'',puestoId:'p'}];
 S.novedades=[{id:'entrada',categoria:'Ingreso',fecha:'2026-10-26',hora:'23:00',datos:{apellido:'Prueba',nombre:'Ana',puestoId:'p'}},nov('externo','ingreso'),{id:'nota',categoria:'Novedad',fecha:'2026-10-27',hora:'09:00',texto:'Luminaria fundida en Playa',guardId:'g'}];
 S.alogs=[{id:'a',fecha:'2026-10-27',hora:'09:00',tipo:'apertura',acceso:'Portón Ombú',guardId:'g',p1:'1234567',p2:'',nota:''}];
 S.reports=[{id:'r',fecha:'2026-10-27',hora:'09:10',f6:'Se informó luminaria apagada',f16:'Final de informe completo'}];
 S.shifts=[{id:'programado',guardId:'g',fecha:'2026-10-27',tipo:'turno',entrada:'23:00',salida:'07:00'}];
 assert.equal(guardiasEnServicio(S,ahora)[0].nombre,'Prueba, Ana');
 const p=pedidoChat(S,[],'p',[],'¿Qué guardias están en servicio hoy y qué externos trabajan?','consulta',ahora);
 assert.match(p.prompt,/Prueba, Ana/);assert.match(p.prompt,/Limpieza SA/);assert.match(p.prompt,/Portón Ombú/);assert.match(p.prompt,/Final de informe completo/);assert.doesNotMatch(p.prompt,/SECRETO-/);
 assert.ok(p.fuentes.some(f=>f.id.startsWith('O')));assert.match(p.sistema,/turnos programados/);assert.equal(new Set(p.fuentes.map(f=>f.id)).size,p.fuentes.length);
 S.novedades.push({id:'egreso',categoria:'Egreso',fecha:'2026-10-27',hora:'09:30',datos:{apellido:'Prueba',nombre:'Ana'}});assert.equal(guardiasEnServicio(S,ahora).length,0);
});
test('recupera datos del final de informes y directivas extensos sin recortar el índice al inicio',()=>{
 const S=estadoVacio();S.reports=[{id:'r',fecha:'2026-10-26',hora:'18:00',f6:'Contenido general. '.repeat(5000)+' EXCEPCION-DERRAME señalizada.'}];
 S.directives=[{id:'d',nombre:'Consigna',activa:true,puestoId:'',novedades:'Procedimientos de servicio. '.repeat(2000)+' El uniforme completo se utiliza durante todo el servicio.'}];
 assert.ok(contextoOperativo(S,'EXCEPCION-DERRAME',ahora).fuentes.some(f=>/EXCEPCION-DERRAME/.test(f.texto)));
 assert.ok(fuentesChat(S,[],'','uniforme completo').some(f=>/uniforme completo/.test(f.texto)));
 const c=contextoOperativo(S,'informe',ahora);assert.equal(c.cobertura.seleccionParcial,true);assert.ok(c.fuentes.reduce((n,f)=>n+f.texto.length,0)<=24000);
});
test('filtros combinan categorías y términos con acentos sin modificar las entradas originales',()=>{
 const entradas=[{clave:'1',categoria:'INGRESO',texto:'Ingresa Gs Pérez',firma:'Ana',fecha:'2026-10-27',hora:'08:00'},{clave:'2',categoria:'EXTERNO',texto:'Limpieza Pérez',fecha:'2026-10-27',hora:'08:30'},{clave:'3',categoria:'FIN DE RONDA',texto:'Playa',fecha:'2026-10-27',hora:'09:00'}],copia=JSON.stringify(entradas);
 assert.deepEqual(filtrarLibro(entradas,['INGRESO','EXTERNO'],'perez').map(e=>e.clave),['1','2']);assert.equal(filtrarLibro(entradas,['RECORRIDO'],'').length,1);assert.equal(filtrarLibro(entradas,[],'ana 08:00').length,1);assert.equal(JSON.stringify(entradas),copia);
});
test('el Libro marca los relevos por día en orden y filtra Gs por identidad',()=>{
 const entrada=(clave,guardId,fecha='2026-10-26')=>({clave,fecha,guardId,firma:'Gs Pérez, Ana',categoria:'NOVEDAD',texto:'Revisión'});
 const entradas=[entrada('1','a'),entrada('2','a'),entrada('3','b'),entrada('4','a'),entrada('5','a','2026-10-27')];
 assert.deepEqual(agruparLibro(entradas).map(d=>d.bloques.map(b=>b.entradas.map(e=>e.clave))),[[['1','2'],['3'],['4']],[['5']]]);
 assert.equal(opcionesGsLibro(entradas).length,2);
 assert.deepEqual(filtrarLibro(entradas,['NOVEDAD'],'revision','guardia:b').map(e=>e.clave),['3']);
});
test('autocompletado aprende sólo del historial válido, ordena por frecuencia y no propone el valor actual',()=>{
 const ns=[{id:'1',categoria:'Apertura',fecha:'2026-10-25',hora:'08:00',datos:{incluirMotivo:true,motivo:'Para el ingreso del personal de limpieza'}},{id:'2',categoria:'Cierre',fecha:'2026-10-26',hora:'09:00',datos:{motivo:'Para el ingreso del personal de limpieza'}},{id:'3',categoria:'Apertura',fecha:'2026-10-27',hora:'09:00',deleted:true,datos:{motivo:'Para algo borrado'}},{id:'4',categoria:'Novedad',fecha:'2026-10-27',hora:'09:00',datos:{motivo:'Para algo ajeno'}}];
 assert.deepEqual(sugerenciasTexto(ns,'para el in','motivo'),['Para el ingreso del personal de limpieza']);assert.deepEqual(sugerenciasTexto(ns,'p','motivo'),[]);assert.deepEqual(sugerenciasTexto(ns,'Para el ingreso del personal de limpieza','motivo'),[]);
});
test('los portones nuevos usan un precinto sin distinguir hojas',()=>{
 for(const cf of ['ingreso','egreso']){const ps=nuevasPuertas('porton',cf,'0123');assert.equal(ps.length,1);assert.equal(ps[0].nombre,'Portón');ps[0].precintos=['0123456'];assert.deepEqual(completarPuertas(ps,'0123')[0].precintos,['0123456']);}
});
test('un relevo del corporativo no acredita un ingreso ausente del libro',()=>{
 const S=estadoVacio();S.guards=[{id:'g',nombre:'Ana',apellido:'Prueba'}];
 S.novedades=[{id:'salida-anterior',categoria:'Egreso',fecha:'2026-10-26',hora:'19:00',datos:{nombre:'Ana',apellido:'Prueba'}}];
 S.punches=[{id:'actual',guardId:'g',fecha:'2026-10-27',in:'07:00',out:''}];assert.equal(guardiasEnServicio(S,ahora).length,0);
 S.novedades.push({id:'ingreso-actual',categoria:'Ingreso',fecha:'2026-10-27',hora:'06:00',datos:{nombre:'Ana',apellido:'Prueba'}});assert.equal(guardiasEnServicio(S,ahora)[0].ingreso,'06:00');
 S.novedades.push({id:'salida-actual',categoria:'Egreso',fecha:'2026-10-27',hora:'09:00',datos:{nombre:'Ana',apellido:'Prueba'}});assert.equal(guardiasEnServicio(S,ahora).length,0);
});
test('los totales consideran las 500 novedades aunque el contexto sólo adjunte una selección',()=>{
 const S=estadoVacio();S.novedades=Array.from({length:500},(_,i)=>({id:'n'+i,categoria:i%2?'Ingreso':'Egreso',fecha:'2026-10-26',hora:'08:00',texto:'Movimiento '+i}));
 const c=contextoOperativo(S,'¿Cuántos ingresos y egresos hubo el 26/10/2026?',ahora);
 const totales=JSON.parse(c.fuentes.find(f=>f.nombre==='Totales completos del día 2026-10-26').texto);assert.equal(totales.novedades.INGRESO,250);assert.equal(totales.novedades.EGRESO,250);assert.equal(c.cobertura.seleccionParcial,true);
});
