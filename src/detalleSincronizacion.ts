import {COLS,Estado} from './model';
import {DiferenciaNube} from './reconciliarNube';

export const etiquetas:Record<string,string>={
 externals:'Ficha de externo',puertas:'Puertas',precintos:'Precintos',guardiaDescansoId:'Guardia de descanso',cubreId:'Guardia de cobertura',finDescanso:'Fin del descanso',
 novedades:'Novedad',alogs:'Acceso',punches:'Actividad del guardia',infdias:'Libro de novedades',reports:'Informe',guards:'Guardia',site:'Configuración',rounds:'Ronda',recorridos:'Recorrido',locales:'Local',posts:'Puesto',franjas:'Horario',accesses:'Acceso',contacts:'Contacto',visits:'Visita',directives:'Directiva',dlogs:'Cumplimiento',rtemplates:'Plantilla de ronda',shifts:'Horario asignado',envios:'Envío',
 texto:'Descripción',cierre:'Cierre',fecha:'Fecha',hora:'Hora',nombre:'Nombre',apellido:'Apellido',guardId:'Guardia',createdBy:'Registrado por',turnoId:'Actividad',puestoId:'Puesto',franjaId:'Horario',tplId:'Recorrido',in:'Inicio',out:'Fin',inicio:'Inicio',fin:'Fin',fechaOut:'Fecha de cierre',startedAt:'Inicio registrado',closedAt:'Cierre registrado',lockedAt:'Cerrado para edición',nota:'Nota',obs:'Observaciones',categoria:'Categoría',tipo:'Tipo',estado:'Estado',acceso:'Acceso',p1:'Precinto 1',p2:'Precinto 2',motivo:'Motivo',deleted:'Eliminado',cuenta:'Cuenta',rol:'Rol',dni:'DNI',tel:'Teléfono',email:'Correo',fotos:'Fotos',foto:'Foto',adjuntos:'Adjuntos',puntos:'Puntos',datos:'Detalle',acc:'Ingreso',vehiculo:'Vehículo',personas:'Personas',cliente:'Cliente',region:'Región',alLibro:'Añadir al libro',entrada:'Entrada',salida:'Salida',descripcion:'Descripción',legajo:'Legajo',fechaNac:'Fecha de nacimiento',francos:'Francos',horaIn:'Entrada',horaOut:'Salida',trascendente:'De trascendencia'
};
const esReferencia=(k:string)=>/Id$/.test(k)||['createdBy','novIn','novOut','novConf'].includes(k);
const buscar=(id:string,estados:Estado[])=>estados.flatMap(e=>COLS.flatMap(c=>(e as any)[c]||[])).find(r=>r.id===id);
const breve=(r:any)=>[r.apellido,r.nombre||r.acceso||r.categoria,r.fecha,r.hora||r.in||r.inicio,r.out||r.fin].filter(Boolean).join(' · ');
export function textoDato(v:any,k:string,estados:Estado[],nivel=0):string{
 if(v===undefined||v===null||v==='')return 'Sin dato';
 if(typeof v==='boolean')return v?'Sí':'No';
 if(typeof v==='number'&&/At$/.test(k))return new Date(v).toLocaleString('es-AR');
 if(typeof v==='string'){
  if(/^(data:|file:|content:|blob:)/.test(v))return /pdf/.test(v)?'Documento adjunto':'Imagen adjunta';
  if(esReferencia(k)){const r=buscar(v,estados);return r?breve(r)||'Registro relacionado':'Registro anterior';}
  if(/^\d{4}-\d{2}-\d{2}$/.test(v))return v.split('-').reverse().join('/');
  return v;
 }
 if(nivel>4)return 'Detalle adjunto';
 if(Array.isArray(v))return v.length?v.map(x=>textoDato(x,k,estados,nivel+1)).join('\n'):'Sin elementos';
 if(typeof v==='object')return Object.entries(v).filter(([key])=>!['id','updatedAt','pin','autoKey'].includes(key))
   .map(([key,val])=>`${etiquetas[key]||'Detalle'}: ${textoDato(val,key,estados,nivel+1)}`).join('\n')||'Registro sin descripción';
 return String(v);
}
export function detalleDiferencia(d:DiferenciaNube,local:Estado,remoto:Estado){
 const [col,id]=d.ruta,k=d.ruta.length>2?d.ruta[d.ruta.length-1]:col;
 const fila=(local as any)[col]?.find?.((r:any)=>r.id===id)||(remoto as any)[col]?.find?.((r:any)=>r.id===id);
 const guardia=fila?.guardId?buscar(fila.guardId,[local,remoto]):null;
 return {titulo:[etiquetas[col]||'Registro',fila&&breve(fila),guardia&&[guardia.apellido,guardia.nombre].filter(Boolean).join(' '),d.ruta.length>2?etiquetas[k]||'Detalle':null].filter(Boolean).join(' · '),
  local:textoDato(d.local,k,[local,remoto]),remoto:textoDato(d.remoto,k,[remoto,local])};
}
export function fotosDelDato(v:any):string[]{
 const resultado=new Set<string>();
 const visitar=(x:any)=>{if(typeof x==='string'&&/^data:image\//.test(x))resultado.add(x);else if(Array.isArray(x))x.forEach(visitar);else if(x&&typeof x==='object')Object.values(x).forEach(visitar);};
 visitar(v);return [...resultado];
}
export function registrosRecuperados(telefono:Estado,nube:Estado):DiferenciaNube[]{
 const salida:DiferenciaNube[]=[];
 const limpio=(x:any):any=>Array.isArray(x)?x.map(limpio):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).filter(([k])=>k!=='updatedAt').sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,limpio(v)])):x;
 for(const col of COLS)for(const fila of telefono[col]){const otro=(nube[col] as any[]).find(x=>x.id===fila.id);if(JSON.stringify(limpio(fila))!==JSON.stringify(limpio(otro)))salida.push({ruta:[col,fila.id],local:fila,remoto:otro});}
 if(JSON.stringify(limpio(telefono.site))!==JSON.stringify(limpio(nube.site)))salida.push({ruta:['site'],local:telefono.site,remoto:nube.site});
 return salida;
}
