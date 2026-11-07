import {EntradaDia} from './informedia';

export const FILTROS_LIBRO = [
 {v:'INGRESO',t:'Ingresos'},{v:'EGRESO',t:'Egresos'},{v:'EXTERNO',t:'Externos'},
 {v:'ADICIONAL',t:'Adicionales'},{v:'APERTURA',t:'Aperturas'},{v:'CIERRE',t:'Cierres'},
 {v:'RECORRIDO',t:'Recorridos'},{v:'DESCANSO',t:'Descansos'},{v:'NOVEDAD',t:'Novedades'},
];
const normal=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');
export function filtrarLibro(entradas:EntradaDia[],categorias:string[],busqueda:string):EntradaDia[]{
 const terminos=normal(busqueda).trim().split(/\s+/).filter(Boolean);
 return entradas.filter(e=>{
  const categoria=e.categoria||'NOVEDAD';
  const grupo=/RONDA|RECORRIDO/.test(categoria)?'RECORRIDO':categoria;
  const texto=normal([e.fecha,e.hora,e.categoria,e.firma,e.texto,...e.items||[]].join(' '));
  return (!categorias.length||categorias.includes(grupo))&&terminos.every(p=>texto.includes(p));
 });
}
