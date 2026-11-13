export const ACCIONES_RAPIDAS=[
 {id:'accesos',titulo:'Accesos',icono:'accesos',ruta:'/accesos'},
 {id:'ingresos',titulo:'Ingresos / egresos',icono:'equipo',ruta:'/ingresos'},
 {id:'recorridos',titulo:'Recorridos',icono:'ronda',ruta:'/recorridos'},
 {id:'libro',titulo:'Libro',icono:'libro',ruta:'/informedia'},
 {id:'informes',titulo:'Informes',icono:'informes',ruta:'/informes'},
 {id:'directivas',titulo:'Directivas',icono:'directivas',ruta:'/directivas'},
];
export const RAPIDAS_INICIALES=['accesos','ingresos','recorridos'];
export function normalizarAccesosRapidos(v:unknown):string[]{return Array.isArray(v)?[...new Set(v.filter(id=>ACCIONES_RAPIDAS.some(a=>a.id===id)))]:[...RAPIDAS_INICIALES];}
