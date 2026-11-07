type RPC=(datos:Record<string,any>)=>Promise<any>;
let llamada:RPC|undefined;
const cache=new Map<string,string>(),enCurso=new Map<string,Promise<string>>();
let tamano=0;
export function configurarAdjuntos(rpc:RPC){llamada=rpc;cache.clear();tamano=0;}
/** Sólo las imágenes visibles/exportadas se descargan. Límite de 8 MB en memoria. */
export async function resolverAdjunto(uri:string):Promise<string>{
 if(!uri.startsWith('vige://'))return uri;
 if(cache.has(uri)){const v=cache.get(uri)!;cache.delete(uri);cache.set(uri,v);return v;}
 if(enCurso.has(uri))return enCurso.get(uri)!;
 const p=(async()=>{
  if(!llamada)throw Error('Inicie sesión para consultar la evidencia.');
  const r=await llamada({accion:'foto',ref:uri});
  if(typeof r.foto!=='string'||!r.foto.startsWith('data:'))throw Error('No se pudo leer el adjunto de la nube.');
  if(r.foto.length<=8*1024*1024){
   while(tamano+r.foto.length>8*1024*1024&&cache.size){const k=cache.keys().next().value!;tamano-=cache.get(k)!.length;cache.delete(k);}
   cache.set(uri,r.foto);tamano+=r.foto.length;
  }
  return r.foto as string;
 })().finally(()=>enCurso.delete(uri));
 enCurso.set(uri,p);return p;
}
