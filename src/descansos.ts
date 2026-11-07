import { Estado, addDays } from './model';
import { DatosAsiento } from './reporte';
import { fechaValida, horaValida } from './servicio';

export function validarDescanso(S: Estado, d: DatosAsiento, fecha: string, hora: string) {
  if(!S.guards.some(g=>g.id===d.guardiaDescansoId&&!g.deleted))throw Error('Seleccione quién toma el descanso.');
  if(!S.posts.some(p=>p.id===d.puestoId&&!p.deleted))throw Error('Seleccione el puesto del descanso.');
  if(!fechaValida(fecha)||!horaValida(hora))throw Error('Indique el inicio del descanso.');
  if(d.requiereCobertura && (!S.guards.some(g=>g.id===d.cubreId&&!g.deleted)||d.cubreId===d.guardiaDescansoId))throw Error('Seleccione otro guardia para cubrir el puesto.');
  if(d.finDescanso){
    const fechaFin=d.fechaFinDescanso || (d.finDescanso<hora ? addDays(fecha,1) : fecha);
    const duracion=Date.parse(fechaFin+'T'+d.finDescanso)-Date.parse(fecha+'T'+hora);
    if(!fechaValida(fechaFin)||!horaValida(d.finDescanso)||duracion<=0||duracion>12*60*60*1000)throw Error('El fin debe ser posterior al inicio y el descanso no puede superar 12 horas.');
  }
}
export function datosDescanso(S: Estado, d: DatosAsiento): DatosAsiento {
  const nombre=(id?:string)=>{const g=S.guards.find(g=>g.id===id);return g?[g.apellido,g.nombre].join(', '):'';};
  return {...d,descansa:nombre(d.guardiaDescansoId),cubre:d.requiereCobertura?nombre(d.cubreId):''};
}
