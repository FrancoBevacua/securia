import {Estado,Vigilador,Col} from './model';
import {cerrarServicio,esAdministrador,iniciarServicio,turnoAbierto} from './servicio';
import {idsPuestosGuardia} from './puestosGuardia';

export const pinCorporativoValido=(pin:string)=>/^[0-9]{6}$/.test(pin);
export const nombreGuardia=(g?:Pick<Vigilador,'apellido'|'nombre'>|null)=>g?[g.nombre,g.apellido].filter(Boolean).join(' '):'';
export const cuentasCorporativas=(S:Estado)=>S.guards.filter(g=>!g.deleted&&g.corporativo&&g.cuenta);

export function puestoCorporativo(S:Estado,cuenta?:Vigilador|null){
 const puestoId=cuenta?.corporativo&&S.guards.find(g=>g.id===cuenta.id&&!g.deleted&&g.corporativo)?.puestoId;
 return S.posts.find(p=>!!puestoId&&p.id===puestoId&&!p.deleted);
}

export function guardiasDelCorporativo(S:Estado,cuenta?:Vigilador|null){
 const puesto=puestoCorporativo(S,cuenta);
 if(!puesto)return [];
 return S.guards.filter(g=>!g.deleted&&!g.corporativo&&!esAdministrador(g)&&idsPuestosGuardia(g).includes(puesto.id));
}

export function guardiaResponsable(S:Estado,cuenta:Vigilador|null,telefonoId?:string):Vigilador|null{
 if(!cuenta)return null;
 if(!cuenta.corporativo)return cuenta;
 const turno=turnoAbierto(S,cuenta.id,telefonoId),puesto=puestoCorporativo(S,cuenta);
 if(!puesto||turno?.puestoId!==puesto.id)return null;
 const guardia=guardiasDelCorporativo(S,cuenta).find(g=>g.id===turno.responsableId);
 if(!guardia)return null;
 const franjaId=S.franjas.some(f=>!f.deleted&&f.id===guardia.franjaId&&f.puestoId===puesto.id)
  ? guardia.franjaId : turno.franjaId||'';
 return {...guardia,puestoId:puesto.id,puesto:puesto.nombre,franjaId};
}
/** El actor autenticado es el corporativo; la firma identifica al guardia a cargo. */
export function cambiarResponsable(S:Estado,cuenta:Vigilador,id:string,telefonoId:string,momento=new Date()):{col:Col;obj:any}[]{
 if(!cuenta.corporativo)throw Error('Seleccione al responsable desde la cuenta del corporativo.');
 const puesto=puestoCorporativo(S,cuenta);
 if(!puesto||!guardiasDelCorporativo(S,cuenta).some(g=>g.id===id))throw Error('Seleccione un guardia asignado al puesto.');
 const abierto=turnoAbierto(S,cuenta.id,telefonoId);
 if(abierto?.responsableId===id&&abierto.puestoId===puesto.id)return [];
 const cierre=abierto?cerrarServicio(S,cuenta,'Relevo del guardia a cargo',momento,telefonoId):[];
 const intermedio={...S,punches:S.punches.map(p=>p.id===abierto?.id?{...p,out:'cerrado'}:p)};
 const ingreso=iniciarServicio(intermedio,{...cuenta,puestoId:puesto.id},momento,true,telefonoId).map(c=>c.col==='punches'?{...c,obj:{...c.obj,responsableId:id}}:c);
 return [...cierre,...ingreso];
}
