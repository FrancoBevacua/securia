import {EntradaDia} from './informedia';

export const FILTROS_LIBRO = [
 {v:'INGRESO',t:'Ingresos'},{v:'EGRESO',t:'Egresos'},{v:'EXTERNO',t:'Externos'},
 {v:'ADICIONAL',t:'Adicionales'},{v:'APERTURA',t:'Aperturas'},{v:'CIERRE',t:'Cierres'},
 {v:'RECORRIDO',t:'Recorridos'},{v:'DESCANSO',t:'Descansos'},{v:'NOVEDAD',t:'Novedades'},
];
const normal=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');
const claveGs=(entrada:EntradaDia)=>entrada.guardId?'guardia:'+entrada.guardId:entrada.firma?'firma:'+entrada.firma:'sin-gs';
const nombreGs=(entrada:EntradaDia)=>entrada.firma||'Gs sin identificar';

export function opcionesGsLibro(entradas:EntradaDia[]){
 const opciones=new Map(entradas.map(e=>[claveGs(e),nombreGs(e)]));
 return [...opciones].map(([v,t])=>({v,t})).sort((a,b)=>a.t.localeCompare(b.t,'es'));
}

export function agruparLibro(entradas:EntradaDia[]){
 const dias:{fecha:string;bloques:{clave:string;gs:string;firma:string;entradas:EntradaDia[]}[]}[]=[];
 for(const e of entradas){
  let dia=dias.at(-1);
  if(!dia||dia.fecha!==e.fecha){dia={fecha:e.fecha,bloques:[]};dias.push(dia);}
  const gs=claveGs(e);
  let bloque=dia.bloques.at(-1);
  if(!bloque||bloque.gs!==gs){bloque={clave:e.clave,gs,firma:nombreGs(e),entradas:[]};dia.bloques.push(bloque);}
  bloque.entradas.push(e);
 }
 return dias;
}

export function filtrarLibro(entradas:EntradaDia[],categorias:string[],busqueda:string,gs=''):EntradaDia[]{
 const terminos=normal(busqueda).trim().split(/\s+/).filter(Boolean);
 return entradas.filter(e=>{
  const categoria=e.categoria||'NOVEDAD';
  const grupo=/RONDA|RECORRIDO/.test(categoria)?'RECORRIDO':categoria;
  const texto=normal([e.fecha,e.hora,e.categoria,e.firma,e.texto,...e.items||[]].join(' '));
  return (!gs||claveGs(e)===gs)&&(!categorias.length||categorias.includes(grupo))&&terminos.every(p=>texto.includes(p));
 });
}
