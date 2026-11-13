import { Novedad, Vigilador, Site, Acceso, accNormal, SeleccionAccesos } from './model';
import { textoIngresoAcceso, textoEgresoAcceso, fraseAperturaCierre } from './text';

export const TITULO_REPORTE = 'LIBERTAD ROSARIO: REPORTE DIARIO';
export const CATEGORIAS_REPORTE = ['Novedad', 'Ingresos/Egresos', 'Descanso', 'Recorrido', 'Apertura/Cierre'];
export const apellidoNombre = (apellido:string, nombre:string) => [apellido.trim(),nombre.trim()].filter(Boolean).join(', ');
export type DatosAsiento = SeleccionAccesos & { tipoRecorrido?:'locales'|'playa'|'nocturna'; controlLocales?:'abiertos'|'cerrados'; operacionAcceso?:'apertura'|'cierre'; realizadoPorId?:string; realizadoPor?:string; guardiaDescansoId?:string; descansa?:string; requiereCobertura?:boolean; cubreId?:string; cubre?:string; finDescanso?:string; fechaFinDescanso?:string; tipoPersona?:'vigilador'|'adicional'|'externo'; apellido?:string; nombre?:string; movimiento?:'ingreso'|'egreso'; puestoId?:string; turno?:string; lugar?:string; observaciones?:string; acceso?:string; tipoExterno?:string; motivo?:string; incluirMotivo?:boolean };
export function categoriaAsiento(n: Pick<Novedad,'categoria'|'texto'|'origenTipo'|'visitId'|'mov'>): string {
  const c=(n.categoria||'').toLowerCase();
  if(c==='descanso')return 'DESCANSO';
  if(c==='inicio de ronda'||c==='fin de ronda')return c.toUpperCase();
  if(n.visitId || ['externo','externos'].includes(c))return 'EXTERNO';
  if(c.includes('adicional')||n.origenTipo==='policial')return 'ADICIONAL';
  if(c.includes('recorrido')||n.origenTipo==='recorrido')return 'RECORRIDO';
  if(c.includes('apertura'))return 'APERTURA';
  if(c.includes('cierre'))return 'CIERRE';
  if(['ingreso','egreso'].includes(c))return c.toUpperCase();
  if(c==='relevo' || n.origenTipo==='guardia')return /egreso|se retira|egresa/i.test(n.texto)?'EGRESO':'INGRESO';
  return 'NOVEDAD';
}
export function redactarAsiento(categoria:string,d:DatosAsiento,acc:Acceso=accNormal(),puesto='') {
 if(categoria==='Apertura/Cierre')categoria=d.operacionAcceso==='cierre'?'Cierre':'Apertura';
 if(categoria==='Ingresos/Egresos')categoria='Ingreso/Egreso';
 if(categoria==='Ingreso/Egreso'&&d.tipoPersona==='externo')categoria='Externos';
 if(categoria==='Ingreso/Egreso'&&d.tipoPersona==='adicional')categoria='Adicional';
 const persona=apellidoNombre(d.apellido||'',d.nombre||'');const ingreso=d.movimiento!=='egreso';
 if(categoria==='Descanso')return d.descansa&&puesto?'Descanso de Gs '+d.descansa+' en el puesto '+puesto+'. '+(d.requiereCobertura?'Cubre Gs '+(d.cubre||'[seleccionar]')+'. ':'Sin cobertura requerida. ')+(d.finDescanso?'Fin: '+(d.fechaFinDescanso?d.fechaFinDescanso+' ':'')+d.finDescanso+'.':'En curso.') : '';
 if(['Ingreso/Egreso','Adicional'].includes(categoria)&&(!d.apellido?.trim()||!d.nombre?.trim()||(ingreso&&!d.turno?.trim())))return '';
 if(categoria==='Ingreso/Egreso'&&ingreso&&!puesto)return '';
 if(['Apertura','Cierre'].includes(categoria)&&(d.grupoAccesos?!d.accesos?.some(a=>a.trim()):!d.acceso?.trim()))return '';
 if(categoria==='Ingreso/Egreso')return ingreso?'Ingresa Gs '+persona+' al puesto '+puesto+'. Turno: '+d.turno+'.':'Se retira el Gs '+persona+'.';
 if(categoria==='Adicional')return (ingreso?'Ingresa adicional policial ':'Se retira adicional policial ')+persona+(ingreso?'. Turno: '+d.turno:'')+'.';
 if(categoria==='Externos')return ingreso?textoIngresoAcceso(acc,d.tipoExterno||'Visita'):textoEgresoAcceso(acc,d.tipoExterno||'Visita',null,acc.obs);
 if(categoria==='Recorrido'&&d.tipoRecorrido==='locales')return 'Se realiza recorrido para control de locales '+(d.controlLocales||'abiertos')+'. '+(d.observaciones?.trim()||'Sin novedades')+(/[.!?]$/.test(d.observaciones?.trim()||'')?'':'.');
 if(categoria==='Recorrido'){const lugar=d.lugar?.trim()||'el paseo';return 'Se realiza recorrido '+(lugar.startsWith('el ')?'del '+lugar.slice(3):'de '+lugar)+'. '+(d.observaciones?.trim()||'Sin novedades.');}
 if(categoria==='Apertura'||categoria==='Cierre'){
  return fraseAperturaCierre(categoria==='Apertura'?'apertura':'cierre',d.acceso||'',d)+(d.realizadoPor?.trim()?(d.grupoAccesos?'\n\n':' ')+(categoria==='Apertura'?'Realizó la apertura: ':'Realizó el cierre: ')+d.realizadoPor.trim().replace(/[.]+$/,'')+'.':'')+(d.observaciones?.trim()?(d.grupoAccesos?'\n\n':' ')+d.observaciones.trim():'');
 }
 return d.observaciones?.trim()||'';
}
export function numeroSupervisor(v:string){const n=v.replace(/[^0-9]/g,'');if(!/^[1-9][0-9]{7,14}$/.test(n))throw new Error('Ingrese el número del supervisor con código de país.');return n;}
export const nombreArchivoReporte=(fecha:string)=>'LIBERTAD ROSARIO - REPORTE DIARIO '+fecha+'.pdf';
