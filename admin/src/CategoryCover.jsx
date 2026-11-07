import React from 'react';

const colores={NOVEDAD:['#A51D38','#E73B50'],INGRESO:['#126143','#229A6E'],EGRESO:['#475579','#6D7FA9'],EXTERNO:['#795300','#BC8500'],ADICIONAL:['#102C78','#274DA9'],RECORRIDO:['#29459D','#6284D7'],DESCANSO:['#624099','#9260C8'],APERTURA:['#1A677B','#328D9C'],CIERRE:['#344363','#60739A']};
export default function CategoryCover({categoria}){
 const c=colores[categoria]||colores.RECORRIDO;
 return <div className="category-cover" role="img" aria-label={'Categoría '+categoria} style={{backgroundImage:`linear-gradient(125deg,${c[0]},${c[1]})`}}>
  <svg viewBox="0 0 64 64" aria-hidden="true"><path d="M12 10h40v22c0 11-12 20-20 24-8-4-20-13-20-24Z" fill="none" stroke="currentColor" strokeWidth="2"/><path d="m23 31 7 7 13-15" fill="none" stroke="currentColor" strokeWidth="3"/></svg>
  <span>{categoria}</span><span className="cover-mark" aria-hidden="true">S</span>
 </div>;
}
