import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { File, Directory, Paths } from 'expo-file-system';
import { Estado, Vigilador, estadoVacio } from './model';
import { leerBytes, bytesBase64 } from './media';
import { exportarVerificadores, verificarPIN } from './cuentas';
import { NUBE_URL, NUBE_PUBLICA } from './nubeConfig';
import { SobreNube } from './colaNube';
import {abrirCache,sellarCache,abrirJSON,sellarJSON} from './cacheCifrada';
import {ColaRegistros} from './colaRegistros';
import {configurarAdjuntos} from './adjuntosNube';
import {CODIGO_CORPORATIVO} from './provisionCorporativa';
import {reconciliarNube,DiferenciaNube} from './reconciliarNube';
import {mismoEstado} from './colaNube';
import {almacenLocal} from './almacenLocal';
import {solicitarNube} from './transporteNube';

const K_DISPOSITIVO = 'guardia.nube.dispositivo';
const K_VINCULO = 'guardia.nube.vinculado';
const K_LLAVE = 'guardia.nube.cache.llave';
const K_COLA = 'guardia.nube.cola.v1';
const K_SESION = 'guardia.nube.sesion.v2';
const K_COPIA = 'guardia.nube.confirmada.v2';
const leerSeguro = (k: string) => Platform.OS === 'web' ? Promise.resolve(localStorage.getItem(k)) : SecureStore.getItemAsync(k);
const guardarSeguro = (k: string, v: string) => Platform.OS === 'web' ? Promise.resolve(localStorage.setItem(k,v)) : SecureStore.setItemAsync(k,v);
const aleatorio = async () => Array.from(await Crypto.getRandomBytesAsync(32)).map(b=>b.toString(16).padStart(2,'0')).join('');
type Respuesta = { ok: boolean; error?: string; codigo?: string; token?: string; guardia?: string; estado?: Estado; revision?: number; catalogo?: Partial<Estado>; vinculado?: boolean };
type Pendiente = SobreNube;
export type EstadoNube = { vinculada: boolean; guardando: boolean; pendiente: boolean; error: string; ultima: string; reautenticar?: boolean };
let estadoNube: EstadoNube = { vinculada:false, guardando:false, pendiente:false, error:'', ultima:'' };
let dispositivo = '', token = '', actor = '', revision = 0;
let sesionGuardadaEn=0;
let telefonoActual='';
/** Identificador público derivado; nunca exponer la capacidad secreta del dispositivo. */
export const telefonoId=()=>telefonoActual;
async function identificarTelefono(){telefonoActual=dispositivo?await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,dispositivo):'';}
let baseConfirmada:Estado|undefined;
export const estadoConfirmado=()=>sync?.estado()||baseConfirmada;
let sync:ColaRegistros|undefined;
let syncActor='';
async function colaActual(){
 if(sync&&syncActor===actor)return sync;
 if(!actor)throw Error('Ingrese con su DNI y PIN.');
 const propietario=await almacenLocal.getItem('sync.v2/propietario');
 if(propietario&&propietario!==actor&&(await almacenLocal.claves('sync.v2/'+encodeURIComponent(propietario)+'/cola/')).length)throw Error('Hay pendientes de otra cuenta. Ingrese con esa cuenta para sincronizarlos.');
 const io={
  leer:async(k:string)=>{const s=await almacenLocal.getItem(k);return s?abrirJSON<any>(s,await claveLocal()):null;},
  escribir:async(k:string,v:any)=>almacenLocal.setItem(k,await sellarJSON(v,await claveLocal())),
  quitar:(k:string)=>almacenLocal.removeItem(k),claves:(p:string)=>almacenLocal.claves(p)
 };
 sync=new ColaRegistros(actor,io,{consultar:cursor=>rpc({accion:'consultar',cursor},'guardia_sync'),preparar:prepararFila,enviar:(lote,filas)=>rpc({accion:'guardar',lote,filas},'guardia_sync')});
 syncActor=actor;await sync.iniciar();await almacenLocal.setItem('sync.v2/propietario',actor);
 configurarAdjuntos(datos=>rpc(datos,'guardia_sync'));
 return sync;
}
async function prepararFila(valor:any):Promise<any>{
 if(typeof valor==='string'&&/^(data:|file:|content:|blob:)/.test(valor)){
  if(valor.startsWith('file:')){
   const anterior=await almacenLocal.getItem('sync.v2/'+encodeURIComponent(actor)+'/archivo/'+encodeURIComponent(valor));
   if(anterior)return abrirJSON<string>(anterior,await claveLocal());
  }
  let data=valor;
  if(!data.startsWith('data:')){
   const mime=/\.pdf(?:\?|$)/i.test(data)?'application/pdf':/\.png(?:\?|$)/i.test(data)?'image/png':/\.jpe?g(?:\?|$)/i.test(data)?'image/jpeg':'application/octet-stream';
   data='data:'+mime+';base64,'+bytesBase64(await leerBytes(data));
  }
  const hash=await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,data),partes=Math.ceil(data.length/131072);
  let r:any;
  for(let numero=0;numero<partes;numero++){
   r=await rpc({accion:'adjunto',hash,numero,partes,longitud:data.length,contenido:data.slice(numero*131072,(numero+1)*131072)},'guardia_sync');
   if(r.completo)break;
  }
  if(!r?.completo||!r.ref)throw Error('La nube no confirmó el adjunto. Se conserva la copia local.');
  return r.ref;
 }
 if(Array.isArray(valor)){const r=[];for(const x of valor)r.push(await prepararFila(x));return r;}
 if(valor&&typeof valor==='object'){const r:any={};for(const[k,v]of Object.entries(valor))r[k]=await prepararFila(v);return r;}
 return valor;
}
let llave: Promise<Crypto.AESEncryptionKey> | undefined;
const oyentes = new Set<(e: EstadoNube)=>void>();
let revisionesAbiertas=0;
export const revisionEnCurso=()=>revisionesAbiertas>0;
export function pausarRevision(){revisionesAbiertas++;let activo=true;return()=>{if(activo){activo=false;revisionesAbiertas--;}};}
export const verEstadoNube = () => estadoNube;
export const escucharNube = (f: (e: EstadoNube)=>void) => { oyentes.add(f); return () => { oyentes.delete(f); }; };
const avisar = (e: Partial<EstadoNube>) => {
 if(Object.entries(e).every(([k,v])=>estadoNube[k as keyof EstadoNube]===v))return;
 estadoNube={...estadoNube,...e};oyentes.forEach(f=>f(estadoNube));
};
export async function iniciarNube() {
  dispositivo = await leerSeguro(K_DISPOSITIVO) || '';
  await identificarTelefono();
  const vinculada = await leerSeguro(K_VINCULO) === '1';
  if (vinculada && !dispositivo) throw new Error('No está disponible la clave de este teléfono. Se necesita volver a vincularlo.');
  avisar({vinculada,pendiente:!!await almacenLocal.getItem(K_COLA)});
  return vinculada;
}
/** El token se guarda en el almacén seguro; el historial permanece cifrado. Nunca se guarda el PIN. */
async function conservarSesion() {
  const ahora=Date.now();
  await guardarSeguro(K_SESION, JSON.stringify({token, actor,vence:ahora+30*24*60*60*1000}));
  sesionGuardadaEn=ahora;
}
async function conservarConfirmada(estado: Estado, rev: number) {
  await almacenLocal.setItem(K_COPIA, await sellarCache({estado, revision:rev, guardia:actor, numero:0}, await claveLocal()));
}
export async function restaurarSesionNube() {
  const crudo = await leerSeguro(K_SESION);
  if (!crudo) return null;
  const sesion = JSON.parse(crudo);
  if (!/^[a-f0-9]{64}$/.test(sesion.token || '') || !sesion.actor || sesion.vence<Date.now()) return null;
  token = sesion.token; actor = sesion.actor;
  sesionGuardadaEn=sesion.vence-30*24*60*60*1000;
  const nueva=await colaActual();
  if(await almacenLocal.getItem('sync.v2/'+encodeURIComponent(actor)+'/importado')){
   avisar({pendiente:nueva.pendiente});return {estado:nueva.estado(),guardia:actor,base:nueva.estado()};
  }
  const pendiente = await leerCola();
  const copiaCruda = await almacenLocal.getItem(K_COPIA);
  const copia = copiaCruda ? await abrirCache(copiaCruda, await claveLocal()) : null;
  if (pendiente && pendiente.guardia !== actor) throw Error('La copia pendiente pertenece a otra cuenta. Ingrese con esa cuenta para sincronizarla.');
  const local = pendiente || (copia?.guardia === actor ? copia : null);
  if (local) {
    revision = local.revision;
    baseConfirmada = pendiente ? pendiente.base||(copia?.guardia===actor?copia.estado:undefined) : copia?.estado;
    // Mostrar la copia cifrada de inmediato. La red se valida después de montar la app.
    await nueva.importar(local.estado,baseConfirmada||(!pendiente?local.estado:undefined));
    avisar({pendiente:nueva.pendiente});
    return {estado:nueva.estado(),guardia:actor,base:baseConfirmada};
  }
  try {
    const r = await rpc({accion:'consultar'},'guardia_rpc',8000);
    return await adoptar({...r, token, guardia:actor});
  } catch (e:any) {
    // Sólo una falla de conexión permite continuar con la copia local.
    if (!e.sinConexion || !local) {
      if (e.codigo === 'sesion' || e.codigo === 'revocado') {
        await guardarSeguro(K_SESION, ''); token=''; actor=''; return null;
      }
      throw e;
    }
    throw e;
  }
}
export async function conectarTelefono(){
 if(!dispositivo){dispositivo=await aleatorio();await guardarSeguro(K_DISPOSITIVO,dispositivo);}
 await identificarTelefono();
 await rpc({accion:'conectar',codigo:CODIGO_CORPORATIVO});
 await guardarSeguro(K_VINCULO,'1');avisar({vinculada:true});
}
/** Se ejecuta sólo al aplicar el reinicio de cuentas autorizado, antes de iniciar la nube. */
export async function reiniciarVinculoLocal(){
 await almacenLocal.removeItem(K_COLA);
  for(const k of [K_DISPOSITIVO,K_VINCULO,K_LLAVE,K_SESION]) {
  if(Platform.OS==='web')localStorage.removeItem(k);else await SecureStore.deleteItemAsync(k);
 }
 dispositivo='';token='';actor='';revision=0;llave=undefined;
 avisar({vinculada:false,pendiente:false,guardando:false,error:'',ultima:'',reautenticar:false});
}
async function claveLocal() {
  if (!llave) llave=(async()=>{
    const existente=await leerSeguro(K_LLAVE);
    if (existente) return Crypto.AESEncryptionKey.import(existente,'hex');
    if (await almacenLocal.getItem(K_COLA)) throw new Error('No se puede abrir la cola cifrada de este teléfono. No se reemplazaron sus datos.');
    const k=await Crypto.AESEncryptionKey.generate(Crypto.AESKeySize.AES256);
    await guardarSeguro(K_LLAVE,await k.encoded('hex')); return k;
  })().catch(()=>{llave=undefined;throw Error('No se pudo acceder a la clave de la copia cifrada. Se conservaron sus datos. No desinstale la aplicación.');});
  return llave;
}
async function guardarCola(p: Pendiente) {
  await almacenLocal.setItem(K_COLA,await sellarCache(p,await claveLocal()));
}
async function leerCola(): Promise<Pendiente | null> {
  const crudo=await almacenLocal.getItem(K_COLA); if (!crudo) return null;
  return abrirCache(crudo,await claveLocal());
}
async function rpc(datos: Record<string, any>,endpoint='guardia_rpc',espera=20000): Promise<any> {
    const {respuesta:r,datos:j}=await solicitarNube(NUBE_URL+'/rest/v1/rpc/'+endpoint,{method:'POST',headers:{apikey:NUBE_PUBLICA,'Content-Type':'application/json'},
      body:JSON.stringify({p_request:{...datos,dispositivo,token}})},espera);
    if (!r.ok || !j.ok) {
      const error:any=new Error(j.error || (j.code==='P0001' ? j.message : '') || (j.code ? 'La nube no pudo completar la operación ('+j.code+'). Sus cambios pendientes permanecen cifrados en el teléfono.' : 'No se pudo conectar con la nube. Sus cambios pendientes permanecen cifrados en el teléfono.'));
      error.codigo=j.codigo || j.code; if(error.codigo==='sesion')avisar({reautenticar:true}); throw error;
    }
    if(datos.accion==='consultar'&&token&&actor&&Date.now()-sesionGuardadaEn>=60*60*1000)await conservarSesion();
    return j;
}
/** Compatibilidad para el alta inicial de cuentas. La cola operativa usa prepararFila. */
export async function prepararEstadoNube(e: Estado): Promise<Estado> {
  const cache = new Map<string,string>();
  const convertir=async(v:any):Promise<any>=>{
    if (typeof v==='string' && /^(file:|content:|blob:)/.test(v)) {
      if (cache.has(v)) return cache.get(v);
      const mime=/\.pdf(?:\?|$)/i.test(v)?'application/pdf':/\.(jpe?g|png|webp)(?:\?|$)/i.test(v)?'image/'+(/\.png/i.test(v)?'png':/\.webp/i.test(v)?'webp':'jpeg'):'application/octet-stream';
      const data='data:'+mime+';base64,'+bytesBase64(await leerBytes(v)); cache.set(v,data);return data;
    }
    if (Array.isArray(v)) {const r=[];for(const x of v)r.push(await convertir(x));return r;}
    if(v && typeof v==='object'){const r:any={};for(const [k,x] of Object.entries(v))r[k]=await convertir(x);return r;}
    return v;
  };
  return convertir(e);
}
export async function catalogoNube(): Promise<Estado> {
  const r=await rpc({accion:'catalogo'}); return {...estadoVacio(),...r.catalogo};
}
async function adoptar(r: Respuesta) {
  if(!r.estado || !r.token || !r.guardia || !r.revision) throw new Error('La nube devolvió una sesión incompleta.');
  token=r.token;actor=r.guardia;revision=r.revision;
  baseConfirmada=r.estado;
  avisar({reautenticar:false});
  let pendiente=await leerCola();
  if (pendiente && pendiente.guardia!==actor) throw new Error('El guardia anterior tiene cambios sin sincronizar. Debe ingresar con su cuenta y reintentarlos.');
  if(!await almacenLocal.getItem('sync.v2/'+encodeURIComponent(actor)+'/importado'))await conservarConfirmada(r.estado,r.revision);
  await conservarSesion();
  if (pendiente) {
    if(pendiente.guardia!==actor) {throw new Error('El guardia anterior tiene cambios sin sincronizar. Debe ingresar con su cuenta y reintentarlos.');}
    else {
      r.estado=pendiente.estado;
      avisar({pendiente:true,error:''});
    }
  } else avisar({error:'',pendiente:false});
  const nueva=await colaActual();
  await nueva.importar(r.estado!,pendiente?.base||(!pendiente?r.estado:undefined));
  avisar({pendiente:nueva.pendiente});
  return {estado:nueva.estado(),guardia:actor,base:estadoNube.pendiente?pendiente?.base:estadoConfirmado()};
}
export async function ingresarNube(dni:string,pin:string,administracion=false){
  if(actor&&token){
    const cola=await colaActual();
    const cuenta=cola.estado().guards.find(g=>g.id===actor);
    if(cuenta?.dni!==dni&&(cola.pendiente||await leerCola())){
      await reintentarNube();
      if(verEstadoNube().pendiente||await leerCola())throw Error('Sincronice los cambios de la cuenta anterior antes de ingresar.');
    }
  }
  const r=await rpc({accion:'ingresar',dni,pin,administracion});
  const cuenta=r.estado?.guards?.find((g:Vigilador)=>g.id===r.guardia&&!g.deleted);
  if(!cuenta||cuenta.corporativo||(cuenta.rol==='admin')!==administracion)
    throw Error('La cuenta no corresponde al tipo de acceso seleccionado.');
  return adoptar(r);
}
  export async function ingresarCorporativoNube(pin:string){
    if(!/^\d{6}$/.test(pin))throw Error('Ingrese el PIN de seis números del corporativo.');
    // Antes del cambio de cuenta se confirman los pendientes de la sesión anterior.
    if(actor&&token){
      const q=await colaActual();
      if(q.pendiente||await leerCola()){
        try{await reintentarNube();}catch(e:any){
          const anterior=q.estado().guards.find(g=>g.id===actor);
          if(e.codigo!=='sesion'||!anterior?.dni||anterior.corporativo)throw e;
          await ingresarNube(anterior.dni,pin);await reintentarNube();
        }
        if(verEstadoNube().pendiente)throw Error('Espere a que terminen de sincronizarse los registros de la sesión anterior.');
      }
    }
    return adoptar(await rpc({accion:'ingresar',pin},'guardia_corporativo_rpc'));
  }
export async function vincularCuentaNube(dni: string,pin: string,nombre: string,nacimiento: string) {return adoptar(await rpc({accion:'vincular_cuenta',dni,pin,nombre,nacimiento}));}
export async function registrarNube(perfil: Vigilador, pin: string) {
 if(await leerCola())throw Error('El guardia anterior tiene cambios pendientes. Debe ingresar y sincronizarlos antes de registrar otra cuenta.');
 const seguro=(await prepararEstadoNube({...estadoVacio(),guards:[perfil]})).guards[0];
 try{return await adoptar(await rpc({accion:'registrar',perfil:seguro,dni:perfil.dni,pin}));}
 catch(e:any){if(e.codigo==='cuenta_existe')return ingresarNube(perfil.dni!,pin);throw e;}
}
export async function vincularNube(codigo: string,e: Estado,g: Vigilador,pin:string) {
  if(!await verificarPIN(g.id,pin))throw new Error('El PIN actual no coincide.');
  if(!dispositivo){dispositivo=await aleatorio();await guardarSeguro(K_DISPOSITIVO,dispositivo);}
    await identificarTelefono();
  const seguro=await prepararEstadoNube(e);
  const r=await rpc({accion:'vincular',codigo,estado:seguro,guardia:g.id,credenciales:await exportarVerificadores(e.guards)});
  const sesion=r.vinculado?await ingresarNube(g.dni!,pin):await adoptar(r);
  if(r.vinculado){await guardarEnNube(seguro);sesion.estado=seguro;}
  await guardarSeguro(K_VINCULO,'1');avisar({vinculada:true});
  await AsyncStorage.removeItem('consigna.estado.v1');await AsyncStorage.removeItem('consigna.sesion.v1');
  // Sólo las copias internas de adjuntos ya confirmadas en la nube; nunca la galería original.
  if(Platform.OS!=='web')for(const nombre of ['fotos','adjuntos']){
    const dir=new Directory(Paths.document,nombre);
    if(dir.uri.startsWith(Paths.document.uri) && dir.exists)try{dir.delete();}catch{avisar({error:'La nube está vinculada, pero no se pudieron retirar algunas copias locales anteriores.'});}
  }
  
  return sesion;
}
let trabajos=0;
let preparaciones:Promise<any>=Promise.resolve();
async function sincronizando(f:()=>Promise<void>,_autorrecuperar=true){
 trabajos++;avisar({guardando:true,error:''});
 const antes=sync?.resguardados||0;
 try{await f();avisar({pendiente:!!sync?.pendiente,ultima:new Date().toISOString(),error:(sync?.resguardados||0)>antes?'Se respaldaron diferencias entre versiones. Puede consultarlas en Historial de recuperación.':''});}
 catch(e:any){avisar({error:e.message,pendiente:!!sync?.pendiente});throw e;}
 finally{trabajos--;avisar({guardando:trabajos>0});}
}
async function completarSync(){
 const q=await colaActual();await q.sincronizar();baseConfirmada=q.estado();
 if(!q.pendiente&&await almacenLocal.getItem('sync.v2/limpieza')!==actor){
  // Sólo después de los recibos durables. La nube conserva el original migrado.
  await almacenLocal.removeItem(K_COLA);await almacenLocal.removeItem(K_COPIA);
  await almacenLocal.setItem('sync.v2/limpieza',actor);
 }
 // Retirar únicamente archivos con recibo; nunca carpetas completas o fotos de un editor abierto.
 if(Platform.OS!=='web')for(const uri of q.archivosConfirmados){
  if(uri.startsWith(new Directory(Paths.document,'fotos').uri)||uri.startsWith(new Directory(Paths.document,'adjuntos').uri)){
   try{const f=new File(uri);if(f.exists)f.delete();q.archivosConfirmados.delete(uri);}catch{}
  }
 }
}
export async function guardarEnNube(e:Estado,base=estadoConfirmado()):Promise<void>{
 await guardarLocal(e,undefined,base);await reintentarNube();
}
export async function guardarLocal(e:Estado,alSincronizar?:(e:Estado)=>void,base=estadoConfirmado(),anterior?:Estado):Promise<void>{
 if(!token||!actor)throw Error('Inicie sesión antes de guardar.');
 const q=await colaActual();await q.guardar(e,base,anterior);avisar({pendiente:q.pendiente});
 if(q.pendiente)void reintentarNube().then(()=>{if(sync===q)alSincronizar?.(q.estado());}).catch(()=>{});
}
let sincronizacion:Promise<void>|undefined;
export function reintentarNube():Promise<void>{
 return sincronizacion??=sincronizando(completarSync).finally(()=>{sincronizacion=undefined;});
}
export type RevisionDiferencias={pendiente:SobreNube;remoto:Estado;revision:number;diferencias:DiferenciaNube[]};
export type Recuperacion={id:string;creado:string;incorporados:number;resguardados:number};
export type ResultadoRecuperacion=Recuperacion&{estado:Estado;revision:number};
export async function recuperarSincronizacion():Promise<ResultadoRecuperacion|null>{
 const q=await colaActual(),antes=q.resguardados;
 await reintentarNube();
 return {id:'sync-v2',creado:new Date().toISOString(),incorporados:0,resguardados:q.resguardados-antes,estado:q.estado(),revision};
}
export const listarRecuperaciones=async(desde=0):Promise<Recuperacion[]> =>
  (await rpc({accion:'listar',desde},'guardia_recuperacion')).respaldos;
export const leerRecuperacion=async(id:string):Promise<{telefono:Estado;nube:Estado}> =>
  (await rpc({accion:'leer',id},'guardia_recuperacion')).respaldo;
export async function reiniciarSesionRecuperada(){
  await preparaciones;await sync?.esperar();
  if(sync?.pendiente||await leerCola())throw Error('Hay cambios nuevos pendientes. Recupere o sincronice esos datos antes de volver a ingresar.');
  try{await rpc({accion:'reiniciar_sesion'},'guardia_recuperacion');}
  catch(e:any){if(e.codigo!=='sesion')throw e;}
  // Conservar clave, vínculo, caché y respaldos. Sólo retirar la sesión de acceso.
  await guardarSeguro(K_SESION,'');token='';actor='';revision=0;baseConfirmada=undefined;
  avisar({error:'',pendiente:false,reautenticar:false});
}
export async function revisarDiferenciasNube():Promise<RevisionDiferencias|null>{
  const pendiente=await leerCola();if(!pendiente)return null;
  if(pendiente.guardia!==actor)throw Error('Ingrese con la cuenta que tiene cambios pendientes.');
  const r=await rpc({accion:'consultar'}),diferencias:DiferenciaNube[]=[];
  reconciliarNube(pendiente.estado,r.estado!,pendiente.base,d=>{diferencias.push(d);return d.remoto;});
  return {pendiente,remoto:r.estado!,revision:r.revision!,diferencias};
}
export async function resolverDiferenciasNube(revision:RevisionDiferencias,opciones:('local'|'remoto')[]){
  if(opciones.length!==revision.diferencias.length||opciones.some(v=>!['local','remoto'].includes(v)))throw Error('Elija una versión para cada diferencia.');
  const r=await rpc({accion:'consultar'});
  if(r.revision!==revision.revision||!mismoEstado(r.estado!,revision.remoto))throw Error('La nube recibió cambios. Vuelva a revisar las diferencias.');
  let i=0;const combinado=reconciliarNube(revision.pendiente.estado,revision.remoto,revision.pendiente.base,d=>d[opciones[i++]]);
  // Respaldo cifrado antes de aplicar una elección explícita. No se pierde la versión descartada.
  await almacenLocal.setItem('guardia.nube.recuperacion.v1',await sellarCache(revision.pendiente,await claveLocal()));
  await almacenLocal.setItem('guardia.nube.recuperacion.remota.v1',await sellarCache({estado:revision.remoto,guardia:actor,revision:revision.revision,numero:revision.pendiente.numero},await claveLocal()));
  await (await colaActual()).guardar(combinado,revision.remoto);
  await reintentarNube();
  return estadoConfirmado()!;
}
export async function consultarNube(){await reintentarNube();return {estado:(await colaActual()).estado(),guardia:actor};}
export async function cerrarSesionNube(){
 await sync?.esperar();if(sync?.pendiente||await leerCola())throw Error('Sincronice los pendientes antes de cerrar sesión.');
 await rpc({accion:'salir'});await guardarSeguro(K_SESION,'');token='';actor='';revision=0;baseConfirmada=undefined;sync=undefined;syncActor='';
 configurarAdjuntos(()=>Promise.reject(Error('Ingrese para consultar la evidencia.')));
}
export const listarResguardos=async()=> (await rpc({accion:'resguardos'},'guardia_sync')).resguardos as {id:string;creado:string;motivo:string;col:string;registro:string;dato:any}[];
export async function cambiarPinNube(actual: string,nuevo: string) {await rpc({accion:'cambiar_pin',actual,nuevo});}
export async function guardarPinCorporativoNube(puestoId:string,nuevo:string,crear:boolean){
  await rpc({accion:crear?'crear_pin_corporativo':'cambiar_pin_corporativo',puestoId,nuevo},'guardia_corporativo_rpc');
}
export const consultarEnvioProgramado=()=>rpc({accion:'consultar'},'guardia_whatsapp_config');
export const guardarEnvioProgramado=(config:import('./envioProgramado').ConfigEnvio)=>rpc({accion:'guardar',config},'guardia_whatsapp_config');
export const borrarTemporalNube = (uri:string) => {if(Platform.OS!=='web' && uri.startsWith('file:'))try{const f=new File(uri);if(f.exists)f.delete();}catch{}};
