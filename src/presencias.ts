import {Estado,Acceso,Persona,accNormal,addDays,hhmm,isoDate,personasReales} from './model';
import {categoriaAsiento} from './reporte';
import {esAdministrador,fechaValida,horaValida} from './servicio';
import {normalIdentidad} from './identidad';

export const normalPresencia=normalIdentidad;
export const MAX_PRESENCIA_MS=8*60*60*1000;
export function ingresoVigente(fecha:string,hora:string,ahora=new Date()):boolean{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(fecha)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora))return false;
 const ingreso=new Date(fecha+'T'+hora+':00').getTime(),edad=ahora.getTime()-ingreso;
 return Number.isFinite(ingreso)&&edad>=0&&edad<=MAX_PRESENCIA_MS;
}
export type PersonalPresente=Persona&{fecha:string;hora:string;registroId:string};
export type GrupoPresente={id:string;empresa:string;sector:string;tarea:string;estado:'confirmado'|'espera';personas:PersonalPresente[];fecha:string;hora:string;registros:string[];accesos:Acceso[]};
type Evento={id:string;fecha:string;hora:string;mov:'in'|'out'|'conf';acc:Acceso;tipo:string};

/** Proyección de los movimientos sincronizados y locales. Las fichas no prueban presencia. */
export function externosEnPredio(S:Estado,ahora=new Date()):GrupoPresente[]{
 const limite=isoDate(ahora)+'T'+hhmm(ahora),eventos:Evento[]=[];
 const visitas=S.visits.filter(v=>!v.deleted),idsVisitas=new Set(S.visits.map(v=>v.id));
 for(const v of visitas){
  const acc=accNormal(v.acc,v);
  eventos.push({id:v.id,fecha:v.fecha,hora:v.horaIn,mov:'in',acc,tipo:v.tipo});
  if(v.horaOut){
   const salida=S.novedades.find(n=>!n.deleted&&(n.id===v.novOut||n.visitId===v.id&&n.mov==='out'));
   eventos.push({id:v.id,fecha:salida?.fecha||(v.horaOut<v.horaIn?addDays(v.fecha,1):v.fecha),hora:v.horaOut,mov:'out',acc,tipo:v.tipo});
  }
 }
 for(const n of S.novedades){
  if(n.deleted||!n.acc||n.visitId&&idsVisitas.has(n.visitId)||categoriaAsiento(n)!=='EXTERNO')continue;
  const mov=n.mov||(n.datos?.movimiento==='egreso'?'out':n.datos?.movimiento==='ingreso'?'in':/se retira|egresa|egreso/i.test(n.texto)?'out':/ingresa|ingreso/i.test(n.texto)?'in':undefined);
  if(mov)eventos.push({id:n.id,fecha:n.fecha,hora:n.hora,mov,acc:accNormal(n.acc),tipo:n.datos?.tipoExterno||'Externo'});
 }
 eventos.sort((a,b)=>(a.fecha+'T'+a.hora).localeCompare(b.fecha+'T'+b.hora)||(a.mov==='out'?1:0)-(b.mov==='out'?1:0)||a.id.localeCompare(b.id));
 const documentosPorNombre=new Map<string,Set<string>>();
 for(const e of eventos){
  if(e.fecha+'T'+e.hora>limite)continue;
  for(const p of personasReales(e.acc)){
   const dni=p.dni.replace(/\D/g,'');if(!dni)continue;
   const key=normalPresencia(e.acc.empresa)+'|'+normalPresencia(p.nombre);
   const documentos=documentosPorNombre.get(key)||new Set<string>();documentos.add(dni);documentosPorNombre.set(key,documentos);
  }
 }
 const personaKey=(p:Persona,empresa:string)=>{
  const dni=p.dni.replace(/\D/g,'');if(dni)return dni;
  const nombre=normalPresencia(p.nombre),documentos=documentosPorNombre.get(empresa+'|'+nombre);
  return documentos?.size===1?[...documentos][0]:nombre;
 };
 const presentes=new Map<string,{evento:Evento;persona?:Persona}>();
 for(const e of eventos){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(e.fecha)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(e.hora)||e.fecha+'T'+e.hora>limite)continue;
  const empresa=normalPresencia(e.acc.empresa),personas=personasReales(e.acc).sort((a,b)=>Number(!!b.dni)-Number(!!a.dni));
  const claves=personas.length?personas.map(p=>empresa+'|'+personaKey(p,empresa)):[empresa+'|sin-personal'];
  if(e.mov==='out'||e.acc.autoriz==='retiro'){
   if(!personas.length){for(const [key,p] of presentes)if(normalPresencia(p.evento.acc.empresa)===empresa)presentes.delete(key);}
   else claves.forEach(k=>presentes.delete(k));
  }else if(e.mov==='conf'){
   claves.forEach(k=>{const p=presentes.get(k);if(p)presentes.set(k,{...p,evento:{...p.evento,acc:e.acc}});});
  }else {
   const unicas=new Set<string>();
   claves.forEach((key,i)=>{if(!unicas.has(key)){unicas.add(key);presentes.set(key,{evento:e,persona:personas[i]});}});
  }
 }
 const grupos=new Map<string,GrupoPresente>();
 for(const {evento:e,persona} of presentes.values()){
  // La caducidad afecta sólo a la vista de presentes; no inventa un egreso ni borra el libro.
  if(!ingresoVigente(e.fecha,e.hora,ahora))continue;
  const estado=e.acc.autoriz==='espera'?'espera':'confirmado';
  const id=[e.acc.empresa,e.acc.lugar,e.acc.tarea,estado].map(normalPresencia).join('|');
  let g=grupos.get(id);
  if(!g){g={id,empresa:e.acc.empresa||'Razón social no informada',sector:e.acc.lugar||'Sector no informado',tarea:e.acc.tarea||'Tarea no informada',estado,personas:[],fecha:e.fecha,hora:e.hora,registros:[],accesos:[]};grupos.set(id,g);}
  if(persona)g.personas.push({...persona,fecha:e.fecha,hora:e.hora,registroId:e.id});
  if(!g.registros.includes(e.id)){g.registros.push(e.id);g.accesos.push(e.acc);}
  if(e.fecha+'T'+e.hora<g.fecha+'T'+g.hora){g.fecha=e.fecha;g.hora=e.hora;}
 }
 return [...grupos.values()].sort((a,b)=>a.sector.localeCompare(b.sector,'es')||a.empresa.localeCompare(b.empresa,'es'));
}

export function guardiasEnServicio(S:Estado,ahora=new Date()){
 const instante=isoDate(ahora)+'T'+hhmm(ahora);
 const ultimos=new Map<string,Estado['novedades'][number]>();
 // Una sola pasada por el libro. La firma identifica al autor, no al ingresante.
 for(const n of S.novedades){
  const categoria=categoriaAsiento(n);
  if(n.deleted||!['INGRESO','EGRESO'].includes(categoria)||
    (n.datos?.tipoPersona&&n.datos.tipoPersona!=='vigilador')||!fechaValida(n.fecha)||!horaValida(n.hora)||n.fecha+'T'+n.hora>instante)continue;
  const nombre=normalPresencia((n.datos?.apellido||'')+' '+(n.datos?.nombre||''));
  if(!nombre)continue;
  const anterior=ultimos.get(nombre),momento=n.fecha+'T'+n.hora,previo=anterior?anterior.fecha+'T'+anterior.hora:'';
  // A igual minuto el egreso prevalece: nunca afirmar presencia ambigua.
  if(!anterior||momento>previo||(momento===previo&&categoria==='EGRESO'))ultimos.set(nombre,n);
 }
 const puestos=new Map(S.posts.filter(p=>!p.deleted).map(p=>[p.id,p.nombre]));
 return S.guards.filter(g=>!g.deleted&&!g.corporativo&&!esAdministrador(g)).flatMap(g=>{
  const n=ultimos.get(normalPresencia((g.apellido||'')+' '+(g.nombre||'')));
  if(!n||categoriaAsiento(n)!=='INGRESO'||ahora.getTime()-new Date(n.fecha+'T'+n.hora).getTime()>24*60*60*1000)return [];
  return [{id:g.id,nombre:[g.apellido,g.nombre].filter(Boolean).join(', '),puesto:puestos.get(n.datos?.puestoId||'')||'Puesto no informado',fecha:n.fecha,ingreso:n.hora,turno:n.datos?.turno||''}];
 });
}

/** Colores de alto contraste sobre fondo oscuro, estables al cambiar los presentes. */
export function colorSector(sector:string):string{
 const n=normalPresencia(sector);
 if(/escalera.*techo|techo.*escalera/.test(n))return '#B42335';
 const colores=['#224FA3','#096B5B','#7452A5','#8B5015','#346470','#8E3971'];
 let hash=0;for(const c of n)hash=(hash*31+c.charCodeAt(0))>>>0;
 return colores[hash%colores.length];
}
