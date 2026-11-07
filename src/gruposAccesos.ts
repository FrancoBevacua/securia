import {AccesoCat,GrupoAccesos} from './model';
const normal=(s:string)=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function grupoDeAcceso(a:Pick<AccesoCat,'nombre'|'tipo'>):GrupoAccesos{
 const n=normal(a.nombre);
 // Estos accesos pueden contener "puerta" o "E8" sin ser salidas de emergencia.
 if(/\b(pecera|reja|ventanal)\b|\bbar\s*cup\b|\bmc\s*donald/.test(n))return 'otros';
 if(/\bporton(?:es)?\b|\borono\b|\bombu\b|\b(?:batlle|battle)\b|\bpeatonal\b/.test(n)||a.tipo==='porton')return 'portones';
 if(/\bemergencias?\b|\be(?:1|2|8)\b/.test(n)||a.tipo==='emergencia')return 'emergencias';
 return 'otros';
}
/** La selección histórica conserva sus nombres, incluso si se retiró un acceso del catálogo. */
export function accesosDelGrupo(catalogo:AccesoCat[],grupo:GrupoAccesos,elegidos:string[]=[]):string[]{
 const nombres=new Map<string,string>();
 for(const nombre of [...elegidos,...catalogo.filter(a=>!a.deleted&&grupoDeAcceso(a)===grupo).map(a=>a.nombre)]){
  const key=normal(nombre);if(key&&!nombres.has(key))nombres.set(key,nombre.trim());
 }
 return [...nombres.values()].sort((a,b)=>a.localeCompare(b,'es'));
}
