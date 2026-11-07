import { AccesoLog, PuertaPrecintos, TipoAccesoFisico, ConfiguracionPorton, uid,soloDigitos,armarPrecinto } from './model';

export function nuevasPuertas(tipo:TipoAccesoFisico='emergencia',configuracion:ConfiguracionPorton='ingreso',prefijo=''):PuertaPrecintos[]{
 if(tipo==='otro')return [];
 return [{id:uid(),nombre:tipo==='porton'?'Portón':'Puerta 1',precintos:[inicioPrecinto(prefijo)]}];
}

/** Reúne los números de registros anteriores sin conservar la división en hojas. */
export function precintosPorton(puertas:PuertaPrecintos[],prefijo=''):PuertaPrecintos[]{
 const numeros=puertas.flatMap(p=>p.sinPrecinto?[]:p.precintos);
 return [{id:puertas[0]?.id||uid(),nombre:'Portón',precintos:numeros.length?numeros:[inicioPrecinto(prefijo)]}];
}

export function completarPuertas(puertas:PuertaPrecintos[],prefijo='',sinPrecinto=false):PuertaPrecintos[]{
 if(sinPrecinto)return [];
 if(!puertas.length)throw Error('Agregue una puerta u hoja, o marque «No aplica precinto».');
 return puertas.map(p=>{
  if(!p.nombre.trim())throw Error('Indique el nombre de cada puerta u hoja.');
  if(p.sinPrecinto)return {...p,nombre:p.nombre.trim(),precintos:[]};
  if(!p.precintos.length)throw Error('Agregue el precinto o marque «No aplica precinto» en esta puerta.');
  const precintos=p.precintos.map(n=>{
   if(sinCompletarPrecinto(n,prefijo)||!(/^[0-9]{7}$/.test(n)||(/^[0-9]{3}$/.test(n)&&inicioPrecinto(prefijo))))throw Error('Complete los tres últimos números del precinto (siete en total) o marque «No aplica precinto».');
   return armarPrecinto(prefijo,n);
  });
  return {...p,nombre:p.nombre.trim(),precintos};
 });
}

export const inicioPrecinto=(prefijo:string)=>{const n=soloDigitos(prefijo).slice(0,4);return n.length===4?n:'';};
/** El prefijo escrito todavía no es un número completo ni se guarda como precinto. */
export const sinCompletarPrecinto=(valor:string,prefijo:string)=>!!inicioPrecinto(prefijo)&&valor===inicioPrecinto(prefijo);

export const puertasDeAcceso = (r?: Pick<AccesoLog,'puertas'|'p1'|'p2'> | null): PuertaPrecintos[] =>
  r?.puertas?.length ? r.puertas.map(p=>({...p,precintos:[...p.precintos]})) : [{id:'principal',nombre:'Puerta 1',precintos:[r?.p1||'',r?.p2||''].filter(Boolean)}];
export const todosPrecintos = (r: Pick<AccesoLog,'puertas'|'p1'|'p2'|'sinPrecinto'>) => r.sinPrecinto?[]:r.puertas?.length ? r.puertas.flatMap(p=>p.sinPrecinto?[]:p.precintos).filter(Boolean) : [r.p1,r.p2].filter(Boolean);

export function parsearPrecintos(texto: string): PuertaPrecintos[] {
 let datos: any;
 try { datos=JSON.parse(texto.trim().replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'')); }
 catch { throw Error('No se pudo interpretar la lectura. Pruebe con una foto más nítida o cargue los números manualmente.'); }
 if(!Array.isArray(datos?.puertas)||!datos.puertas.length||datos.puertas.length>20)throw Error('No se reconocieron puertas con precintos completos para este acceso.');
 return datos.puertas.map((p:any)=>{
  if(typeof p?.nombre!=='string'||!p.nombre.trim()||!Array.isArray(p.precintos)||!p.precintos.length||p.precintos.length>20||p.precintos.some((n:any)=>typeof n!=='string'||!/^\d{7}$/.test(n)))throw Error('Hay un nombre o número incompleto. Repita la foto o cargue el dato manualmente.');
  return {id:uid(),nombre:p.nombre.trim().slice(0,120),precintos:[...p.precintos]};
 });
}
