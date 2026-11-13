import {Acceso,Visita,Novedad,Col,accNormal,hhmm,isoDate,toMin,uid} from './model';
import {textoIngresoAcceso,textoEgresoAcceso,textoConfirmAcceso} from './text';

/** Prepara visita y libro para persistirlos juntos. */
export function cambiosVisita(visita:Visita,movimientos:('in'|'out'|'conf')[],actor:string,ahora=new Date(),previas:Novedad[]=[],firmante?:string,egreso?:Pick<Acceso,'empresa'|'obs'>):{col:Col;obj:any}[]{
 let v={...visita};const cambios:{col:Col;obj:any}[]=[],a=accNormal(v.acc,v);
 for(const mov of movimientos){
  const key=mov==='in'?'novIn':mov==='out'?'novOut':'novConf',id=v[key]||uid();
  let minutos=toMin(v.horaOut)-toMin(v.horaIn);if(minutos<0)minutos+=1440;
  const previa=previas.find(n=>n.id===id);
  const salida=mov==='out'?(egreso||(previa?.datos?.movimiento==='egreso'?previa.acc:undefined)):undefined;
  const acc=salida?{...a,empresa:salida.empresa.trim(),obs:salida.obs.trim()}:a;
  const texto=mov==='in'?textoIngresoAcceso(a,v.tipo):mov==='out'?textoEgresoAcceso(acc,v.tipo,v.horaOut?minutos:null,salida?.obs):textoConfirmAcceso(a,v.tipo);
  cambios.push({col:'novedades',obj:{id,deleted:false,fecha:mov==='in'?v.fecha:previa?.fecha||isoDate(ahora),hora:mov==='in'?v.horaIn:mov==='out'?v.horaOut||hhmm(ahora):hhmm(ahora),guardId:previa?.guardId||firmante||v.guardId||actor,categoria:'Acceso',visitId:v.id,mov,texto,acc,...(salida?{datos:{movimiento:'egreso'}}:{})}});
  v={...v,[key]:id};
 }
 return [...cambios,{col:'visits',obj:v}];
}
