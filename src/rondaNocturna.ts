import {Ronda} from './model';
export function segundosRonda(r:Pick<Ronda,'inicioAt'|'fecha'|'inicio'>,ahora=Date.now()):number{
 const inicio=r.inicioAt||new Date(r.fecha+'T'+r.inicio+':00').getTime();
 return Number.isFinite(inicio)?Math.max(0,Math.floor((ahora-inicio)/1000)):0;
}
export function formatoCronometro(segundos:number):string{
 const n=Math.max(0,Math.floor(segundos));return [Math.floor(n/3600),Math.floor(n/60)%60,n%60].map(v=>String(v).padStart(2,'0')).join(':');
}
