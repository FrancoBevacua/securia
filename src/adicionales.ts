import {Novedad} from './model';
import {categoriaAsiento} from './reporte';
import {normalIdentidad} from './identidad';

/** El historial se reconstruye del libro y conserva los movimientos originales. */
export function historialAdicionales(registros:Novedad[]){
 const personas=new Map<string,{id:string;apellido:string;nombre:string;turno:string;fecha:string;hora:string}>();
 const vistos=new Set<string>();
 for(const n of registros.filter(n=>!n.deleted&&categoriaAsiento(n)==='ADICIONAL').sort((a,b)=>(b.fecha+b.hora).localeCompare(a.fecha+a.hora))){
  const d=n.datos;if(!d?.apellido?.trim()||!d.nombre?.trim())continue;
  const id=[d.apellido,d.nombre].map(normalIdentidad).join('|');
  const anterior=personas.get(id);
  if(!vistos.has(id)){vistos.add(id);personas.set(id,{id,apellido:d.apellido.trim(),nombre:d.nombre.trim(),turno:d.turno||'',fecha:n.fecha,hora:n.hora});}
  else if(anterior&&!anterior.turno&&d.turno)anterior.turno=d.turno;
 }
 return [...personas.values()];
}
