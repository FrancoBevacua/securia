import {Estado,dmy} from './model';
import {horaCorte,ventanaParaEntrega,entradasDeVentana,textoInformeDia,cierrePorDefecto} from './informedia';
export type ConfigEnvio={nombre:string;numero:string;hora:string;zona:string;habilitado:boolean;consentimiento:boolean};
export const CONFIG_ENVIO:ConfigEnvio={nombre:'',numero:'',hora:'18:00',zona:'America/Argentina/Buenos_Aires',habilitado:false,consentimiento:false};
export const saludoReporte=(hora:string)=>hora<'12:00'?'Buenos días':hora<'20:00'?'Buenas tardes':'Buenas noches';
export function prepararReporteProgramado(S:Estado,fecha:string,c:ConfigEnvio){
  const corte=horaCorte(S),v=ventanaParaEntrega(fecha,corte,24),parcial=c.hora<corte;
  const entradas=entradasDeVentana(S,v).filter(e=>e.fecha<fecha||e.hora<c.hora);
  const guardado=S.infdias.find(x=>!x.deleted&&x.fecha===v.fecha&&x.desde===corte&&(x.duracion??24)===24);
  const fotos=[...new Set([...entradas.filter(e=>e.origen==='novedad').flatMap(e=>S.novedades.find(n=>n.id===e.ids[0])?.fotos||[]),...(guardado?.fotos||[])])];
  const cierre=parcial?'Avance del libro hasta las '+c.hora+'. El período finaliza a las '+corte+'.':guardado?.cierre||cierrePorDefecto(S,v);
  const texto=textoInformeDia(entradas,{site:S.site.cliente,fecha:v.fecha,cierre,fotos:fotos.length,ventana:v});
  const alcance=parcial?'Avance hasta las '+c.hora+'; el período finaliza a las '+corte+'.':'Período finalizado a las '+corte+'.';
  const parametros=[saludoReporte(c.hora),c.nombre,S.site.cliente||'el puesto',dmy(fecha),alcance];
  return {texto,fotos,parametros,parcial,nombre:'Securia - Reporte '+fecha+'.pdf',
    mensaje:parametros[0]+', '+c.nombre+'. Adjunto el reporte del servicio de '+parametros[2]+', correspondiente al '+parametros[3]+'. '+alcance+' Enviado automáticamente desde Securia.'};
}
