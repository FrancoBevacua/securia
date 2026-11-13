import {Ronda,dmy} from './model';

export function textoRondaNocturna(r:Ronda,firma:string):string{
 const fechaHora=(fecha:string,hora:string)=>fecha===r.fecha?hora:dmy(fecha)+' '+hora;
 const puntos=r.puntos.filter(p=>p.hora).map(p=>{
  const titulo=`• ${fechaHora(p.fecha||r.fecha,p.hora)} · ${p.n} · ${p.estado==='nov'?'Con novedad':'Sin novedad'}`;
  const obs=p.obs?.trim();
  return obs?titulo+'\n  '+(p.estado==='nov'?'Novedad: ':'Observación: ')+obs.replace(/\r?\n/g,'\n  '):titulo;
 });
 const horarios=['Inicio de la recorrida: '+fechaHora(r.fecha,r.inicio),'Fin de la recorrida: '+(r.fin?fechaHora(r.fechaFin||r.fecha,r.fin):'En curso')];
 return [
  ['RONDA NOCTURNA · '+r.nombre,dmy(r.fecha),firma].filter(Boolean).join('\n'),
  puntos.length?puntos.join('\n\n'):'Sin puntos marcados.',
  horarios.join('\n'),
 ].join('\n\n');
}
export function segundosRonda(r:Pick<Ronda,'inicioAt'|'fecha'|'inicio'>,ahora=Date.now()):number{
 const inicio=r.inicioAt||new Date(r.fecha+'T'+r.inicio+':00').getTime();
 return Number.isFinite(inicio)?Math.max(0,Math.floor((ahora-inicio)/1000)):0;
}
export function formatoCronometro(segundos:number):string{
 const n=Math.max(0,Math.floor(segundos));return [Math.floor(n/3600),Math.floor(n/60)%60,n%60].map(v=>String(v).padStart(2,'0')).join(':');
}
