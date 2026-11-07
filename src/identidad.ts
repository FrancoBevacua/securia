/** Clave de comparación para nombres y empresas escritos con distinto formato. */
export const normalIdentidad=(s:string)=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLocaleLowerCase('es');
