import {Estado,Vigilador,Col} from './model';
import {cerrarServicio,esAdministrador,iniciarServicio,turnoAbierto} from './servicio';

export const pinCorporativoValido=(pin:string)=>/^[0-9]{6}$/.test(pin);
export const nombreGuardia=(g?:Pick<Vigilador,'apellido'|'nombre'>|null)=>g?[g.nombre,g.apellido].filter(Boolean).join(' '):'';
export const puedeQuedarACargo=(g:Vigilador)=>!g.deleted&&!g.corporativo&&!esAdministrador(g);
export function guardiaResponsable(S:Estado,cuenta:Vigilador|null,telefonoId?:string):Vigilador|null{
 if(!cuenta)return null;
 if(!cuenta.corporativo)return cuenta;
 const id=turnoAbierto(S,cuenta.id,telefonoId)?.responsableId;
 return S.guards.find(g=>g.id===id&&puedeQuedarACargo(g))||null;
}
/** El actor autenticado es el corporativo; la firma identifica al guardia a cargo. */
export function cambiarResponsable(S:Estado,cuenta:Vigilador,id:string,telefonoId:string,momento=new Date()):{col:Col;obj:any}[]{
 if(!cuenta.corporativo)throw Error('Seleccione al responsable desde la cuenta del corporativo.');
 const guardia=S.guards.find(g=>g.id===id&&puedeQuedarACargo(g));
 if(!guardia)throw Error('Seleccione un guardia del equipo.');
 const abierto=turnoAbierto(S,cuenta.id,telefonoId);
 if(abierto?.responsableId===id)return [];
 const cierre=abierto?cerrarServicio(S,cuenta,'Relevo del guardia a cargo',momento,telefonoId):[];
 const intermedio={...S,punches:S.punches.map(p=>p.id===abierto?.id?{...p,out:'cerrado'}:p)};
 const ingreso=iniciarServicio(intermedio,cuenta,momento,true,telefonoId).map(c=>c.col==='punches'?{...c,obj:{...c.obj,responsableId:id}}:c);
 return [...cierre,...ingreso];
}
