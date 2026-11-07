import {COLS,Estado,estadoVacio} from './model';

export type FilaSync={col:string;id:string;valor:any;hash?:string};
export type CambioSync=FilaSync&{version:string;base?:any;baseHash?:string;parcial?:boolean};
export type AcuseSync=FilaSync&{estado:'confirmado'|'resguardado';respaldo?:string};
export type DiscoSync={leer:(k:string)=>Promise<any>;escribir:(k:string,v:any)=>Promise<void>;quitar:(k:string)=>Promise<void>;claves:(p:string)=>Promise<string[]>};
export type RedSync={
 consultar:(cursor:number)=>Promise<{filas:FilaSync[];cursor:number;mas:boolean}>;
 preparar:(valor:any)=>Promise<any>;
 enviar:(lote:string,filas:CambioSync[])=>Promise<{acuses:AcuseSync[]}>;
};
const iguales=(a:any,b:any):boolean=>{
 if(a===b)return true;
 if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;
 if(Array.isArray(a)!==Array.isArray(b))return false;
 const ks=Object.keys(a).filter(k=>k!=='updatedAt'),bs=Object.keys(b).filter(k=>k!=='updatedAt');
 return ks.length===bs.length&&ks.every(k=>Object.prototype.hasOwnProperty.call(b,k)&&iguales(a[k],b[k]));
};
export const filasEstado=(e:Estado):FilaSync[]=>[{col:'site',id:'site',valor:e.site},...COLS.flatMap(col=>(e[col] as any[]).map(valor=>({col,id:valor.id,valor})))];
const idFila=(f:FilaSync)=>encodeURIComponent(f.col)+'/'+encodeURIComponent(f.id);
const nuevaVersion=()=>Date.now().toString(16)+'-'+Math.random().toString(16).slice(2);
const archivos=(v:any):string[]=>typeof v==='string'&&v.startsWith('file:')?[v]:v&&typeof v==='object'?Object.values(v).flatMap(archivos):[];
const referencias=(antes:any,despues:any):[string,string][]=>{
 if(typeof antes==='string'&&antes.startsWith('file:')&&typeof despues==='string'&&despues.startsWith('vige://'))return [[antes,despues]];
 return antes&&despues&&typeof antes==='object'&&typeof despues==='object'?Object.keys(antes).flatMap(k=>referencias(antes[k],despues[k])):[];
};

/** Diario por fila. Un recibo sólo retira la versión exacta enviada. */
export class ColaRegistros {
 private disco:Promise<any>=Promise.resolve();
 private red:Promise<any>|undefined;
 private prefijo:string;
 private cache=new Map<string,FilaSync>();
 private pendientes=new Map<string,CambioSync>();
 private cursor=0;
 resguardados=0;
 archivosConfirmados=new Set<string>();
 constructor(private actor:string,private io:DiscoSync,private net:RedSync){this.prefijo='sync.v2/'+encodeURIComponent(actor)+'/';}
 private serial<T>(f:()=>Promise<T>):Promise<T>{const p=this.disco.catch(()=>{}).then(f);this.disco=p;return p;}
 get pendiente(){return this.pendientes.size>0;}
 async iniciar(){
  this.cursor=(await this.io.leer(this.prefijo+'cursor'))||0;
  for(const k of await this.io.claves(this.prefijo+'cache/')){const f=await this.io.leer(k);if(f)this.cache.set(idFila(f),f);}
  for(const k of await this.io.claves(this.prefijo+'cola/')){const f=await this.io.leer(k);if(f)this.pendientes.set(idFila(f),f);}
 }
 estado():Estado{
  const e=estadoVacio(),filas=new Map(this.cache);
  this.pendientes.forEach((f,k)=>filas.set(k,f));
  filas.forEach(f=>{if(f.col==='site')e.site=f.valor;else if(COLS.includes(f.col as any))(e as any)[f.col].push(f.valor);});
  e.updatedAt=Date.now();return e;
 }
 async guardar(e:Estado,base?:Estado){
  return this.serial(async()=>{
   const bases=new Map(base?filasEstado(base).map(f=>[idFila(f),f.valor]):[]);
   for(const fila of filasEstado(e)){
    const k=idFila(fila),pendiente=this.pendientes.get(k),confirmada=this.cache.get(k);
    // No convertir una modificación remota en pendiente ni reenviar filas sin cambios.
    if(iguales(fila.valor,pendiente?.valor??confirmada?.valor??bases.get(k)))continue;
    const cambio:CambioSync={...fila,version:nuevaVersion()};
    if(pendiente){cambio.base=pendiente.base;cambio.baseHash=pendiente.baseHash;}
    else if(bases.has(k)){cambio.base=bases.get(k);if(confirmada&&iguales(confirmada.valor,cambio.base))cambio.baseHash=confirmada.hash;}
    else if(confirmada){cambio.baseHash=confirmada.hash;cambio.base=confirmada.valor;}
    await this.io.escribir(this.prefijo+'cola/'+k,cambio);this.pendientes.set(k,cambio);
   }
  });
 }
 async importar(e:Estado,base?:Estado){
  if(await this.io.leer(this.prefijo+'importado'))return;
  // No fabricar una base para cambios pendientes antiguos sin versión confirmada.
  if(base)await this.serial(async()=>{
   for(const fila of filasEstado(base)){const k=idFila(fila);if(this.cache.has(k))continue;await this.io.escribir(this.prefijo+'cache/'+k,fila);this.cache.set(k,fila);}
  });
  await this.guardar(e,base);
  await this.io.escribir(this.prefijo+'importado',true);
 }
 private async recibir(){
  let mas=true;
  while(mas){
   const p=await this.net.consultar(this.cursor);
   if(!Number.isSafeInteger(p.cursor)||p.cursor<this.cursor||(!p.filas.length&&p.mas))throw Error('Cursor de sincronización inválido');
   await this.serial(async()=>{
    for(const f of p.filas){
     const k=idFila(f);await this.io.escribir(this.prefijo+'cache/'+k,f);this.cache.set(k,f);
    }
    // Después de las filas. Repetir una página tras un cierre inesperado es seguro.
    await this.io.escribir(this.prefijo+'cursor',p.cursor);this.cursor=p.cursor;
   });
   mas=p.mas;
  }
 }
 async sincronizar(){
  if(this.red)return this.red;
  this.red=this.ejecutar().finally(()=>{this.red=undefined;});return this.red;
 }
 private async ejecutar(){
  await this.disco;
  await this.recibir();
  while(this.pendientes.size){
   let paquete=await this.io.leer(this.prefijo+'envio') as {lote:string;filas:CambioSync[]}|null;
   if(!paquete){
    // Turnos primero; las notas y el cierre se validan en la misma transacción.
    const prioridad=(f:CambioSync)=>f.col==='punches'?0:f.col==='guards'?1:2;
    const pendientes=[...this.pendientes.values()];
    const cerrado=pendientes.find(f=>f.col==='punches'&&(f.valor.out||f.valor.closedAt));
    // Completar una actividad antes de abrir la siguiente en el mismo teléfono.
    const todas=pendientes.filter(f=>!cerrado||(f.col==='punches'?f.id===cerrado.id:!f.valor.turnoId||f.valor.turnoId===cerrado.id)).sort((a,b)=>prioridad(a)-prioridad(b));
    const filas:CambioSync[]=[];let bytes=0;
    for(const f of todas){
     if(filas.length>=250)break;
     let original=f.valor,parcial=false;
     if(f.col==='punches'&&(original.out||original.closedAt)&&todas.some(n=>n.valor.turnoId===f.id)){
      const previo=this.cache.get(idFila(f))?.valor;
      // Un turno con cientos de notas se transmite abierto, luego se cierra.
      // Su versión final permanece en el diario hasta enviar todas las notas.
      if(previo&&!previo.out&&!previo.closedAt)continue;
      if(!previo){
       original={...original,out:''};delete original.closedAt;delete original.fechaOut;delete original.cierre;parcial=true;
      }
     }
     const valor=await this.net.preparar(original),base=f.base===undefined?undefined:await this.net.preparar(f.base);
     const listo={...f,valor,base,parcial};
     const size=JSON.stringify(listo).length;
     if(filas.length&&bytes+size>1400000)break;
     if(size>1400000)throw Error('Un registro supera el tamaño del lote. Los datos se conservan.');
     filas.push(listo);bytes+=size;
    }
    paquete={lote:nuevaVersion(),filas};await this.io.escribir(this.prefijo+'envio',paquete);
   }
   const r=await this.net.enviar(paquete.lote,paquete.filas);
   if(!Array.isArray(r.acuses)||r.acuses.length!==paquete.filas.length||paquete.filas.some(f=>!r.acuses.some(a=>a.col===f.col&&a.id===f.id&&['confirmado','resguardado'].includes(a.estado))))throw Error('La nube no confirmó todas las filas. Se conserva el lote.');
   await this.serial(async()=>{
    for(const acuse of r.acuses){
     const k=idFila(acuse),enviado=paquete!.filas.find(f=>idFila(f)===k)!;
     if(acuse.estado==='resguardado'){
      await this.io.escribir(this.prefijo+'resguardo/'+acuse.respaldo,{...enviado,...acuse});
      this.resguardados++;
     }
     if(acuse.valor){
      const f:FilaSync={col:acuse.col,id:acuse.id,valor:acuse.valor,hash:acuse.hash};
      await this.io.escribir(this.prefijo+'cache/'+k,f);this.cache.set(k,f);
     }else{await this.io.quitar(this.prefijo+'cache/'+k);this.cache.delete(k);}
     const actual=this.pendientes.get(k);
     if(actual?.version===enviado.version&&(!enviado.parcial||acuse.estado==='resguardado')){
      // El editor puede seguir abierto con una URI vieja después de un recibo.
      for(const [uri,ref] of referencias(actual.valor,enviado.valor))await this.io.escribir(this.prefijo+'archivo/'+encodeURIComponent(uri),ref);
      archivos(actual.valor).forEach(u=>this.archivosConfirmados.add(u));await this.io.quitar(this.prefijo+'cola/'+k);this.pendientes.delete(k);
     }
     else if(actual){
      // La edición realizada durante el envío se compara con su recibo.
      const nuevo={...actual,base:acuse.valor,baseHash:acuse.hash};
      await this.io.escribir(this.prefijo+'cola/'+k,nuevo);this.pendientes.set(k,nuevo);
     }
    }
    await this.io.quitar(this.prefijo+'envio');
   });
  }
  await this.recibir();
 }
 async esperar(){await this.disco;await this.red;}
}
