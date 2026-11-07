import {Estado,dmy} from './model.ts';
import {categoriaAsiento} from './reporte.ts';
export type GrupoEvidencia={titulo:string;fecha:string;hora:string;sector:string;fotos:string[]};
export const LIMITE_DESCRIPCION_EVIDENCIA=100;
export const permiteEvidencia=(categoria:string)=>['Novedad','Externos','Apertura','Cierre'].includes(categoria);
export function descripcionEvidencia(texto:string=''):string {
 const breve=texto.replace(/\s+/g,' ').trim();
 return breve.length>LIMITE_DESCRIPCION_EVIDENCIA?breve.slice(0,LIMITE_DESCRIPCION_EVIDENCIA-1).trimEnd()+'…':breve;
}
export function agruparEvidencias(S:Estado,uris:string[]):GrupoEvidencia[]{
 const permitidas=new Set(uris),usadas=new Set<string>(),grupos:GrupoEvidencia[]=[];
 for(const n of S.novedades){
  if(n.deleted)continue;
  const fotos=[...new Set(n.fotos||[])].filter(f=>permitidas.has(f));if(!fotos.length)continue;
  fotos.forEach(f=>usadas.add(f));
  const ronda=S.rounds.find(r=>r.id===n.origenId),actividad=S.punches.find(p=>p.id===n.turnoId);
  const sector=n.sector||n.datos?.lugar||n.datos?.acceso||S.posts.find(p=>p.id===n.datos?.puestoId)?.nombre||ronda?.puesto||actividad?.puesto||'';
  const descripcion=descripcionEvidencia(n.descripcionEvidencia);
  grupos.push({titulo:`${n.hora} ${categoriaAsiento(n)}${descripcion?' — '+descripcion:''}`,fecha:dmy(n.fecha),hora:n.hora,sector:sector||'Sector no informado',fotos});
 }
 const sinAsignar=uris.filter(f=>!usadas.has(f));
 if(sinAsignar.length)grupos.push({titulo:'Evidencia adjunta anterior sin novedad asociada',fecha:'No informada',hora:'No informada',sector:'No informado',fotos:sinAsignar});
 return grupos;
}
