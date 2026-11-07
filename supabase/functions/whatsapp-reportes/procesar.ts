import {agruparEvidencias} from '../_shared/evidencias.ts';
import {prepararReporteProgramado} from '../_shared/envioProgramado.ts';
import {construirPDFDia} from '../_shared/pdfplantilla.ts';

export type MetaConfig={token:string;phoneId:string;version:string;plantilla:string;idioma:string};
/** Una aceptación de Meta no confirma entrega. Un resultado incierto nunca se reenvía automáticamente. */
export async function procesarTrabajo(job:any,meta:MetaConfig,rpc:(datos:any)=>Promise<any>,request:typeof fetch=fetch){
 let enviando=false;
 const marcar=(estado:string,extra:any={})=>rpc({accion:'marcar',id:job.id,estado,...extra});
 try{
   const reporte=prepararReporteProgramado(job.estado,job.fecha,job.config);
   const fotos=[];
   for(const ref of reporte.fotos){
     const uri=ref.startsWith('vige://')?(await rpc({accion:'foto',id:job.id,ref})).foto:ref;
     if(!/^data:image\/jpeg;base64,/.test(uri))throw Error('Hay evidencia sin sincronizar o con formato no compatible. No se envió el reporte.');
     fotos.push(Uint8Array.from(atob(uri.split(',')[1]),(c:string)=>c.charCodeAt(0)));
   }
   const bytes=construirPDFDia(reporte.texto,fotos,agruparEvidencias(job.estado,reporte.fotos).map(g=>({...g,fotos:g.fotos.map(uri=>fotos[reporte.fotos.indexOf(uri)])})));
   const base='https://graph.facebook.com/'+meta.version+'/'+meta.phoneId;
   const headers={Authorization:'Bearer '+meta.token};
   const form=new FormData();form.append('messaging_product','whatsapp');form.append('type','application/pdf');
   form.append('file',new Blob([new Uint8Array(bytes)],{type:'application/pdf'}),reporte.nombre);
   const upload=await request(base+'/media',{method:'POST',headers,body:form,signal:AbortSignal.timeout(45000)});
   const media=await upload.json();
   if(!upload.ok||!media.id)throw Error('Meta rechazó el PDF (código '+(media.error?.code||upload.status)+').');
   await marcar('enviando');enviando=true;
   const res=await request(base+'/messages',{method:'POST',headers:{...headers,'Content-Type':'application/json'},
     signal:AbortSignal.timeout(45000),body:JSON.stringify({messaging_product:'whatsapp',to:job.config.numero,type:'template',
       template:{name:meta.plantilla,language:{code:meta.idioma},components:[
         {type:'header',parameters:[{type:'document',document:{id:media.id,filename:reporte.nombre}}]},
         {type:'body',parameters:reporte.parametros.map(text=>({type:'text',text}))}
       ]}})});
   const respuesta=await res.json();
   if(!res.ok){await marcar('fallido',{detalle:'Meta rechazó el mensaje (código '+(respuesta.error?.code||res.status)+').'});return;}
   if(!respuesta.messages?.[0]?.id)throw Error('Meta no confirmó el identificador del mensaje.');
   await marcar('aceptado',{mensaje_id:respuesta.messages[0].id});
 }catch(e:any){
   await marcar(enviando?'incierto':'fallido',{detalle:enviando?'Revise la entrega en Meta antes de reintentar para evitar duplicados.':e.message||'No se pudo preparar el PDF.'});
 }
}
