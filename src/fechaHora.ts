export type TipoFechaHora='fecha'|'hora';
export type FormatoFecha='iso'|'dmy';
const dos=(n:number)=>String(n).padStart(2,'0');
export function fechaDelControl(value:string,tipo:TipoFechaHora,formato:FormatoFecha='iso',ahora=new Date()):Date{
  const d=new Date(ahora);
  if(tipo==='hora'){
    if(/^([01]\d|2[0-3]):[0-5]\d$/.test(value))d.setHours(+value.slice(0,2),+value.slice(3),0,0);
  }else{
    const p=formato==='dmy'?value.split('/').reverse():value.split('-');
    if(p.length===3&&p.every(x=>/^\d+$/.test(x))){
      const [a,m,dia]=p.map(Number),v=new Date(a,m-1,dia,12);
      if(a>=1900&&a<=2100&&v.getFullYear()===a&&v.getMonth()===m-1&&v.getDate()===dia)return v;
    }
  }
  return d;
}
export function valorDelControl(d:Date,tipo:TipoFechaHora,formato:FormatoFecha='iso'){
  if(tipo==='hora')return dos(d.getHours())+':'+dos(d.getMinutes());
  const p=[String(d.getFullYear()),dos(d.getMonth()+1),dos(d.getDate())];
  return formato==='dmy'?p.reverse().join('/'):p.join('-');
}
