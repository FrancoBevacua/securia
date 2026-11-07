import { Estado, addDays } from './model';
import { fechaValida, horaValida } from './servicio';

const nombreNormal = (s: string) => String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
/** El libro prevalece sobre la sesión del teléfono cuando documenta un egreso. */
export function guardiaEnServicio(S: Estado, guardId: string, fecha: string, hora: string): boolean {
  if (!fechaValida(fecha) || !horaValida(hora)) return false;
  const instante = fecha+'T'+hora;
  const g = S.guards.find(g=>g.id===guardId&&!g.deleted);
  if (!g) return false;
  const nombre = nombreNormal((g.apellido||'')+(g.nombre||''));
  const movimientos = S.novedades.filter(n=>!n.deleted && ['ingreso','egreso'].includes(n.categoria.toLowerCase()) && n.datos?.tipoPersona!=='adicional' &&
    nombre && nombreNormal((n.datos?.apellido||'')+(n.datos?.nombre||''))===nombre && n.fecha+'T'+n.hora<=instante)
    .sort((a,b)=>(b.fecha+'T'+b.hora).localeCompare(a.fecha+'T'+a.hora));
  const sesiones=S.punches.filter(p=>!p.deleted&&(p.responsableId||p.guardId)===guardId&&fechaValida(p.fecha)&&horaValida(p.in)&&p.fecha+'T'+p.in<=instante);
  if (movimientos.length) {
    const ultimo=movimientos[0];
    const momento=ultimo.fecha+'T'+ultimo.hora;
    // El egreso de ayer no invalida el ingreso de una nueva actividad de hoy.
    const nuevas=sesiones.filter(p=>p.fecha+'T'+p.in>momento);
    if(nuevas.length)return nuevas.some(p=>{
      const inicio=p.fecha+'T'+p.in;
      const fin=p.out?(p.fechaOut||(p.out<p.in?addDays(p.fecha,1):p.fecha))+'T'+p.out:null;
      return fin?instante<fin:Date.parse(instante)-Date.parse(inicio)<=24*60*60*1000;
    });
    // Un ingreso sin egreso no acredita servicio indefinidamente.
    return ultimo.categoria.toLowerCase()==='ingreso' && Date.parse(instante)-Date.parse(ultimo.fecha+'T'+ultimo.hora)<=24*60*60*1000;
  }
  return sesiones.some(p=>{
    if(p.deleted || (p.responsableId||p.guardId)!==guardId || !fechaValida(p.fecha)||!horaValida(p.in))return false;
    const inicio=p.fecha+'T'+p.in;
    const fin=p.out ? (p.fechaOut || (p.out<p.in ? addDays(p.fecha,1) : p.fecha))+'T'+p.out : null;
    return inicio<=instante && (fin ? instante<fin : Date.parse(instante)-Date.parse(inicio)<=24*60*60*1000);
  });
}
export function validarGuardiaEnServicio(S: Estado, guardId: string, fecha: string, hora: string) {
  if (!guardiaEnServicio(S,guardId,fecha,hora)) {
    const g=S.guards.find(g=>g.id===guardId);
    throw Error((g?[g.apellido,g.nombre].join(' '):'El guardia')+' no tiene servicio acreditado el '+fecha+' a las '+hora+'. Revise sus ingresos y egresos antes de emitir el informe.');
  }
}
