import {procesarTrabajo} from './procesar.ts';
// Autenticación propia del cron; la clave nunca se incluye en la aplicación móvil.
Deno.serve(async(req:Request)=>{
 const secreto=Deno.env.get('REPORT_CRON_SECRET')||'';
 if(req.method!=='POST'||!secreto||req.headers.get('Authorization')!=='Bearer '+secreto)return new Response('Unauthorized',{status:401});
 const meta={token:Deno.env.get('WHATSAPP_TOKEN')||'',phoneId:Deno.env.get('WHATSAPP_PHONE_ID')||'',
   version:Deno.env.get('WHATSAPP_GRAPH_VERSION')||'',plantilla:Deno.env.get('WHATSAPP_TEMPLATE')||'',idioma:Deno.env.get('WHATSAPP_LANGUAGE')||'es_AR'};
 if(!meta.token||!/^\d+$/.test(meta.phoneId)||!/^v\d+\.\d+$/.test(meta.version)||!meta.plantilla)return new Response('Integración pendiente',{status:503});
 const url=Deno.env.get('SUPABASE_URL')!,key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
 const rpc=async(p_request:any)=>{
   const response=await fetch(url+'/rest/v1/rpc/guardia_whatsapp_trabajo',{method:'POST',
     headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({p_request}),signal:AbortSignal.timeout(30000)});
   if(!response.ok)throw Error('No se pudo actualizar el estado del reporte.');
   return response.json();
 };
 try{const job=await rpc({accion:'reservar'});if(job)await procesarTrabajo(job,meta,rpc);return Response.json({ok:true,procesado:!!job});}
 catch{return new Response('No se pudo procesar el reporte',{status:500});}
});
