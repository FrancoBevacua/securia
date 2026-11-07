import {Estado,Vigilador} from './model';
import {normalIdentidad} from './identidad';
import {PUESTOS_COBERTURA} from './seed';

export function idsPuestosGuardia(g:Pick<Vigilador,'puestoId'|'puestoIds'>):string[]{
 return [...new Set([g.puestoId,...(Array.isArray(g.puestoIds)?g.puestoIds:[])].filter((id):id is string=>typeof id==='string'&&!!id.trim()).map(id=>id.trim()))];
}
export function nombresPuestosGuardia(S:Estado,g:Pick<Vigilador,'puestoId'|'puestoIds'>):string{
 return idsPuestosGuardia(g).map(id=>S.posts.find(p=>p.id===id&&!p.deleted)?.nombre).filter(Boolean).join(' · ');
}
export function validarPuestosGuardia(S:Estado,ids:unknown):string[]{
 if(!Array.isArray(ids)||ids.some(id=>typeof id!=='string'||!id.trim()))throw Error('Seleccione puestos válidos para el vigilador.');
 const unicos=[...new Set(ids as string[])];
 if(unicos.some(id=>!S.posts.some(p=>p.id===id&&!p.deleted)))throw Error('Uno de los puestos seleccionados ya no está disponible.');
 return unicos;
}
/** Sólo para instalaciones locales: la nube incorpora los mismos puestos mediante migración. */
export function asegurarPuestosCobertura(S:Estado,instante=Date.now()):void{
 for(const base of PUESTOS_COBERTURA){
  if(S.posts.some(p=>normalIdentidad(p.nombre)===normalIdentidad(base.n)))continue;
  const id='securia:puesto:'+normalIdentidad(base.n),orden=Math.max(-1,...S.posts.map(p=>p.orden||0))+1;
  S.posts.push({id,nombre:base.n,descripcion:base.d,orden,updatedAt:instante});
  base.turnos.forEach((f,i)=>S.franjas.push({id:id+':turno:'+i,puestoId:id,nombre:f.nombre,entrada:f.entrada,salida:f.salida,orden:i,updatedAt:instante}));
 }
}
