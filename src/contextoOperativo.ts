import {Estado,isoDate,hhmm,addDays} from './model';
import {categoriaAsiento} from './reporte';
import {textoAlogLibro} from './text';
import {externosEnPredio,guardiasEnServicio,normalPresencia} from './presencias';
import {guardiaEnServicio} from './controlesServicio';
import type {FuenteChat} from './chatbot';
import {esConsultaAccesos} from './asistenteAccesos';
import {grupoDeAcceso} from './gruposAccesos';

const palabras=(s:string)=>normalPresencia(s).split(/[^a-z0-9]+/).filter(p=>p.length>2&&!['que','los','las','del','una','por','para','con','como','estan','esta','hay','hoy','todos'].includes(p));
type Candidato=FuenteChat&{grupo:string;fecha?:string;prioridad?:number};

/** Proyecciones explícitas: nunca serializar el estado ni las cuentas completas a la IA. */
export function contextoOperativo(S:Estado,pregunta:string,ahora=new Date()){
 const fuentes:Candidato[]=[],hoy=isoDate(ahora),hora=hhmm(ahora),q=normalPresencia(pregunta);
 const fechaISO=[...q.matchAll(/\b\d{4}-\d{2}-\d{2}\b/g)].at(-1)?.[0],fechaDMY=[...q.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g)].at(-1);
 const fechaConsulta=fechaISO||(fechaDMY?fechaDMY[3]+'-'+fechaDMY[2].padStart(2,'0')+'-'+fechaDMY[1].padStart(2,'0'):undefined)||(/ayer/.test(q)?addDays(hoy,-1):/hoy|ahora|momento|actual/.test(q)?hoy:undefined);
 const consultaAccesos=esConsultaAccesos(pregunta),fechaAccesos=fechaConsulta||hoy;
 const operacionAccesos=/apertur/.test(q)&&!/cierr/.test(q)?'apertura':/cierr/.test(q)&&!/apertur/.test(q)?'cierre':undefined;
 const vivos=<T extends {deleted?:boolean}>(rs:T[])=>rs.filter(r=>!r.deleted);
 const guardia=(id?:string)=>{const g=S.guards.find(g=>g.id===id);return g?[g.apellido,g.nombre].filter(Boolean).join(', '):'No informado';};
 const puesto=(id?:string)=>S.posts.find(p=>p.id===id)?.nombre||'No informado';
 const agregar=(grupo:string,nombre:string,datos:unknown,fecha?:string,prioridad=0)=>{
  const texto=typeof datos==='string'?datos:JSON.stringify(datos);
  // Se indexa el contenido entero, incluidos los 16 puntos y los informes extensos.
  for(let i=0,n=1;i<texto.length;i+=1600,n++)fuentes.push({id:'O'+(fuentes.length+1),nombre:nombre+(texto.length>1800?' · fragmento '+n:''),texto:texto.slice(i,i+1800),grupo,fecha,prioridad});
 };
 const presentes=externosEnPredio(S,ahora),servicio=guardiasEnServicio(S,ahora);
 const consultaActual=/ahora|momento|hoy|trabaj|servicio|presente|predio|actual/.test(q);
 agregar('resumen','Resumen operativo al '+hoy+' '+hora,{
  fecha:hoy,hora,zonaHoraria:Intl.DateTimeFormat().resolvedOptions().timeZone,
  objetivo:{cliente:S.site.cliente,nombre:S.site.nombre,region:S.site.region,horaCorte:S.site.corteInforme},
  alcance:'Datos locales y sincronizados disponibles para esta sesión. No es detección física en tiempo real. Una ausencia de registro no prueba una ausencia de personas.',
  guardiasEnServicio:servicio.length,equiposExternosConfirmados:presentes.filter(g=>g.estado==='confirmado').length,
  personasExternasConfirmadas:presentes.filter(g=>g.estado==='confirmado').reduce((n,g)=>n+g.personas.length,0),equiposEnEspera:presentes.filter(g=>g.estado==='espera').length,
  registrosPorColeccion:Object.fromEntries(['novedades','alogs','visits','reports','rounds','recorridos','punches','shifts'].map(c=>[c,vivos(S[c as keyof Estado] as {deleted?:boolean}[]).length])),
 },hoy,10000);
 const jornada=vivos(S.guards).filter(g=>g.nombre||g.apellido).filter(g=>{
  const nombre=normalPresencia((g.apellido||'')+' '+(g.nombre||''));
  return guardiaEnServicio(S,g.id,hoy,'00:00')||servicio.some(s=>s.id===g.id)||
   S.punches.some(p=>!p.deleted&&p.guardId===g.id&&p.fecha===hoy&&p.in<=hora)||
   S.novedades.some(n=>!n.deleted&&n.fecha===hoy&&n.hora<=hora&&categoriaAsiento(n)==='INGRESO'&&normalPresencia((n.datos?.apellido||'')+' '+(n.datos?.nombre||''))===nombre);
 }).map(g=>({nombre:guardia(g.id),estado:servicio.some(s=>s.id===g.id)?'En servicio ahora':'Prestó servicio hoy; no figura en servicio ahora'}));
 agregar('jornada','Guardias con servicio registrado hoy · '+hoy,{fecha:hoy,total:jornada.length,guardias:jornada,alcance:'Incluye actividades de hoy y servicios que cruzaron medianoche. La programación de turnos se consulta por separado.'},hoy,consultaActual&&/guardia|vigilador|servicio/.test(q)?450:0);
 const diarios=new Map<string,{novedades:Record<string,number>;accesos:{aperturas:number;cierres:number};visitasConIngreso:number;informesSeguridad:number}>();
 const diario=(fecha:string)=>{let r=diarios.get(fecha);if(!r){r={novedades:{},accesos:{aperturas:0,cierres:0},visitasConIngreso:0,informesSeguridad:0};diarios.set(fecha,r);}return r;};
 for(const n of vivos(S.novedades)){const r=diario(n.fecha),cat=categoriaAsiento(n);r.novedades[cat]=(r.novedades[cat]||0)+1;}
 for(const a of vivos(S.alogs)){const r=diario(a.fecha);r.accesos[a.tipo==='apertura'?'aperturas':'cierres']++;}
 for(const v of vivos(S.visits))diario(v.fecha).visitasConIngreso++;
 for(const r of vivos(S.reports))diario(r.fecha).informesSeguridad++;
 for(const [fecha,totales] of diarios)agregar('totales','Totales completos del día '+fecha,{fecha,...totales,alcance:'Conteos de todos los registros no eliminados de esa fecha, por colección. Visitas y novedades vinculadas representan el mismo ingreso y no deben sumarse entre sí.'},fecha,/cuant|total|cantidad/.test(q)?200:0);
 for(const g of servicio)agregar('servicio','Guardia en servicio: '+g.nombre,g,hoy,consultaActual?500:0);
 for(const g of presentes)agregar('presentes','Externo '+(g.estado==='espera'?'en espera: ':'con ingreso vigente: ')+g.empresa,{
  razonSocial:g.empresa,sector:g.sector,tarea:g.tarea,estado:g.estado,fechaIngreso:g.fecha,horaIngreso:g.hora,
  personal:g.personas.map(p=>({nombre:p.nombre,fechaIngreso:p.fecha,horaIngreso:p.hora})),
  advertencia:g.fecha<hoy?'Ingreso de un día anterior sin egreso posterior registrado; verificar permanencia.':undefined,
 },g.fecha,consultaActual?500:0);
 for(const n of vivos(S.novedades))agregar('novedades','Libro · '+categoriaAsiento(n)+' · '+n.fecha+' '+n.hora,{
  fecha:n.fecha,hora:n.hora,categoria:categoriaAsiento(n),texto:n.texto,firma:guardia(n.guardId),sector:n.sector,
  movimiento:n.mov||n.datos?.movimiento,persona:n.datos?.apellido?[n.datos.apellido,n.datos.nombre].filter(Boolean).join(', '):undefined,
  puesto:n.datos?.puestoId?puesto(n.datos.puestoId):undefined,turno:n.datos?.turno,
  externo:n.acc?{empresa:n.acc.empresa,sector:n.acc.lugar,tarea:n.acc.tarea,personal:n.acc.personas.map(p=>({nombre:p.nombre})),autorizacion:n.acc.autoriz}:undefined,
 },n.fecha);
 if(consultaAccesos){const registros=vivos(S.alogs).filter(a=>a.fecha===fechaAccesos&&(!operacionAccesos||a.tipo===operacionAccesos));agregar('accesos-resumen','Alcance del informe de accesos · '+fechaAccesos,{fecha:fechaAccesos,fechaIndicada:!!fechaConsulta,operacion:operacionAccesos||'aperturas y cierres',registros:registros.length,aperturas:registros.filter(a=>a.tipo==='apertura').length,cierres:registros.filter(a=>a.tipo==='cierre').length,alcance:fechaConsulta?'Registros disponibles de la fecha solicitada.':'Sin fecha indicada: se priorizan los registros de hoy. Confirmar otra fecha si corresponde.'},fechaAccesos,2000);}
 for(const a of vivos(S.alogs))agregar('accesos','Acceso: '+a.acceso+' · '+a.fecha+' '+a.hora,{
  fecha:a.fecha,hora:a.hora,operacion:a.tipo,acceso:a.acceso,grupo:a.grupoAccesos||grupoDeAcceso({nombre:a.acceso,tipo:a.tipoAcceso||''}),accesosIncluidos:a.accesos,
  precintos:a.puertas?.length?a.puertas.map(p=>({acceso:p.nombre,numeros:p.precintos,sinPrecinto:!!p.sinPrecinto})):[a.p1,a.p2].filter(Boolean),sinPrecinto:!!a.sinPrecinto,
  observaciones:a.nota,motivo:a.incluirMotivo===false?undefined:a.motivo,registro:textoAlogLibro(a),guardia:a.gs||guardia(a.guardId),
 },a.fecha,consultaAccesos&&a.fecha===fechaAccesos&&(!operacionAccesos||a.tipo===operacionAccesos)?1000:0);
 for(const v of vivos(S.visits))agregar('visitas','Visita: '+(v.acc?.empresa||v.nombre)+' · '+v.fecha,{fecha:v.fecha,ingreso:v.horaIn,egreso:v.horaOut||'Sin egreso registrado',tipo:v.tipo,empresa:v.acc?.empresa,sector:v.acc?.lugar,tarea:v.acc?.tarea,personal:v.acc?.personas.map(p=>({nombre:p.nombre})),autorizacion:v.acc?.autoriz},v.fecha);
 for(const p of vivos(S.punches))agregar('actividad','Actividad de '+guardia(p.guardId)+' · '+p.fecha,{guardia:guardia(p.guardId),fecha:p.fecha,ingreso:p.in,egreso:p.out,fechaEgreso:p.fechaOut,puesto:p.puesto||puesto(p.puestoId)},p.fecha);
 for(const s of vivos(S.shifts))agregar('turnos','Turno programado: '+guardia(s.guardId)+' · '+s.fecha,{guardia:guardia(s.guardId),fecha:s.fecha,tipo:s.tipo,entrada:s.entrada,salida:s.salida,aclaracion:'Programación; no acredita ingreso ni presencia.'},s.fecha);
 for(const g of vivos(S.guards))agregar('equipo','Equipo: '+guardia(g.id),{nombre:guardia(g.id),puesto:puesto(g.puestoId),franja:S.franjas.find(f=>!f.deleted&&f.id===g.franjaId)?.nombre});
 for(const r of vivos(S.reports))agregar('informes','Informe de seguridad · '+r.fecha+' '+r.hora,{fecha:r.fecha,hora:r.hora,sector:r.sector,firma:guardia(r.firmaId||r.createdBy),puntos:Object.fromEntries(Array.from({length:16},(_,i)=>['f'+(i+1),r[`f${i+1}`]||'']))},r.fecha);
 for(const r of vivos(S.infdias))agregar('informes','Informe general · '+r.fecha,{fecha:r.fecha,desde:r.desde,hasta:r.hasta,fechaHasta:r.fechaHasta,texto:r.texto},r.fecha);
 for(const r of vivos(S.rounds))agregar('recorridos','Ronda: '+r.nombre+' · '+r.fecha,{fecha:r.fecha,guardia:guardia(r.guardId),puesto:r.puesto||puesto(r.puestoId),inicio:r.inicio,fin:r.fin,fechaFin:r.fechaFin,novedades:r.novedades,puntos:r.puntos},r.fecha);
 for(const r of vivos(S.recorridos))agregar('recorridos','Control de locales · '+r.fecha+' '+r.hora,{fecha:r.fecha,hora:r.hora,tipo:r.tipo,guardia:guardia(r.guardId),controles:r.controles,observaciones:r.observaciones},r.fecha);
 for(const d of vivos(S.dlogs))agregar('directivas','Cumplimiento de directiva · '+d.fecha,{fecha:d.fecha,directiva:S.directives.find(x=>x.id===d.directiveId)?.nombre,guardia:guardia(d.guardId),estado:d.estado,horaReal:d.horaReal,novedades:d.novedades},d.fecha);
 for(const p of vivos(S.posts))agregar('catalogo','Puesto: '+p.nombre,{nombre:p.nombre,descripcion:p.descripcion});
 for(const a of vivos(S.accesses))agregar('catalogo','Catálogo de acceso: '+a.nombre,{nombre:a.nombre,tipo:a.tipo,hoja:a.configuracionPorton,precintos:a.precintos,sinPrecinto:a.sinPrecinto});
 for(const e of vivos(S.externals||[]))agregar('catalogo','Ficha externa: '+e.empresa,{empresa:e.empresa,tareaHabitual:e.tarea,sectorHabitual:e.lugar,personal:e.personas.map(p=>({nombre:p.nombre})),aclaracion:'Ficha de historial; no acredita presencia actual.'});
 for(const f of vivos(S.franjas))agregar('catalogo','Horario: '+f.nombre,{puesto:puesto(f.puestoId),nombre:f.nombre,entrada:f.entrada,salida:f.salida});
 for(const l of vivos(S.locales))agregar('catalogo','Local: '+l.nombre,{nombre:l.nombre,apertura:l.apertura,cierre:l.cierre});
 for(const c of vivos(S.contacts))agregar('contactos','Contacto de servicio: '+c.nombre,{nombre:c.nombre,rol:c.rol,telefono:c.tel});
 for(const r of vivos(S.rtemplates))agregar('catalogo','Plantilla de ronda: '+r.nombre,{nombre:r.nombre,puntos:r.puntos});
 for(const e of vivos(S.envios))agregar('envios','Aviso de recorrido: '+e.recorridoId,{recorrido:e.recorridoId,destino:e.destino,texto:e.texto,estado:e.estado,enviadoAt:e.enviadoAt});
 const claves=[...new Set(palabras(pregunta))];
 const grupos=new Set<string>();
 if(/guardia|vigilador|dotacion|servicio/.test(q))['servicio','actividad','turnos','equipo'].forEach(g=>grupos.add(g));
 if(/extern|contrat|proveedor|predio|trabaj|personal|empresa/.test(q))['presentes','visitas'].forEach(g=>grupos.add(g));
 if(/acceso|porton|precinto|apertura|cierre|puerta/.test(q))grupos.add('accesos');
 if(/novedad|libro|ocurri|suced/.test(q))grupos.add('novedades');
 if(/informe|incidente/.test(q))grupos.add('informes');
 if(/ronda|recorrid|locales/.test(q))grupos.add('recorridos');
 const score=(f:Candidato)=>{
  const nombre=normalPresencia(f.nombre),texto=normalPresencia(f.texto);
  return (f.prioridad||0)+(grupos.has(f.grupo)?30:0)+claves.reduce((n,p)=>n+(nombre.includes(p)?8:0)+(texto.includes(p)?2:0),0)+(fechaConsulta&&f.fecha===fechaConsulta?40:0);
 };
 const ordenadas=fuentes.map((f,i)=>({f,i,p:score(f)})).sort((a,b)=>b.p-a.p||(b.f.fecha||'').localeCompare(a.f.fecha||'')||a.i-b.i);
 const elegidas:FuenteChat[]=[];let largo=0;
 for(const {f} of ordenadas){if(largo+f.texto.length>24000||elegidas.length>=40)continue;const {id,nombre,texto}=f;elegidas.push({id,nombre,texto});largo+=texto.length;}
 const idsIncluidos=new Set(elegidas.map(f=>f.id));
 const detalleActualCompleto=fuentes.filter(f=>['servicio','presentes','jornada'].includes(f.grupo)).every(f=>idsIncluidos.has(f.id));
 return {fuentes:elegidas,cobertura:{fragmentosDisponibles:fuentes.length,fragmentosIncluidos:elegidas.length,seleccionParcial:elegidas.length<fuentes.length,detalleActualCompleto,...(consultaAccesos?{fechaAccesos,detalleAccesosCompleto:fuentes.filter(f=>f.grupo==='accesos'&&f.prioridad===1000).every(f=>idsIncluidos.has(f.id))}:{}),fechaConsulta:hoy,horaConsulta:hora,descripcion:'Índice del contenido completo disponible en la sesión; se adjuntan las fuentes pertinentes. Los totales del resumen se calculan sobre todos los registros, incluso si sólo se adjunta parte del detalle.'}};
}
