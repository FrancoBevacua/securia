export const normalizarNombre=(v:string)=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLowerCase();
export function horariosPuesto(puesto:string,adicional=false):{v:string;t:string}[]{
 const turnos:Record<string,string[]>={
  paseo:['Mañana|06:00-14:00','Tarde|14:00-23:00'],
  'rondin nocturno':['Noche|23:00-07:00'],
  'playa 1':['Mañana|10:00-22:00','Noche|23:00-07:00'],
  'playa 2 motero':['Mañana|05:00-14:00','Tarde|14:00-22:00'],
  'playa 3':['Tarde|14:00-23:00'],
 };
 return (adicional?['Mañana|09:00-16:00']:turnos[normalizarNombre(puesto)]||[]).map(s=>{const [n,v]=s.split('|');return {v,t:`${n} (${v})`};});
}
