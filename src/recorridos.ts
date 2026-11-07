import {Estado,Ronda,Vigilador,isoDate,hhmm} from './model';
import {gsName} from './text';

export function textoRondaGeneral(r:Ronda,S:Estado,fin=false){
 const g=S.guards.find(g=>g.id===r.guardId);
 return `${r.puesto} ${fin?'finaliza':'inicia'} ronda de control. ${r.novedades?.trim()||'Sin novedades'}. Guardia: ${gsName(g,S.site)}.`.replace(/\.{2,}/g,'.');
}
export function registrarRondaGeneral(S:Estado,actor:Vigilador,telefonoId:string,
 datos:{id:string;guardId:string;puestoId:string;novedades:string;fotos:string[]},activa?:Ronda,momento=new Date()){
 const guardia=S.guards.find(g=>g.id===datos.guardId&&!g.deleted);
 const puesto=S.posts.find(p=>p.id===datos.puestoId&&!p.deleted);
 if(!guardia)throw Error('Seleccione el guardia que hizo el recorrido.');
 if(!puesto)throw Error('Seleccione el puesto del recorrido.');
 if(activa&&((activa.createdBy||activa.guardId)!==actor.id||(telefonoId&&activa.dispositivoId!==telefonoId)))throw Error('Este recorrido pertenece a otro teléfono o a otra cuenta.');
 const fecha=isoDate(momento),hora=hhmm(momento);
 const r:Ronda={...activa,id:activa?.id||datos.id,updatedAt:momento.getTime(),tplId:'',tipoRecorrido:'general',nombre:'Recorrido · '+puesto.nombre,
  createdBy:actor.id,dispositivoId:telefonoId,guardId:guardia.id,puestoId:puesto.id,puesto:puesto.nombre,novedades:datos.novedades.trim()||'Sin novedades',
  fotos:datos.fotos,alLibro:true,fecha:activa?.fecha||fecha,inicio:activa?.inicio||hora,fin:activa?hora:'',fechaFin:activa?fecha:undefined,createdAt:activa?.createdAt||momento.getTime(),puntos:[]};
 const categoria=activa?'Fin de ronda':'Inicio de ronda';
 return [{col:'rounds' as const,obj:r},{col:'novedades' as const,obj:{id:`ronda-${activa?'fin':'inicio'}:${r.id}`,fecha,hora,guardId:r.guardId,
  categoria,sector:r.puesto,texto:textoRondaGeneral(r,S,!!activa),fotos:r.fotos,origenTipo:'recorrido',origenId:r.id}}];
}
