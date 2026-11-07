import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import {Platform} from 'react-native';
import {almacenLocal} from './almacenLocal';
import {sellarJSON,abrirJSON} from './cacheCifrada';
import {DocumentoChat,validarDocumentoChat} from './chatbot';

const K='securia.asistente.llave';
let llave:Promise<Crypto.AESEncryptionKey>|undefined;
function clave(){
 if(!llave)llave=(async()=>{
  const existente=Platform.OS==='web'?localStorage.getItem(K):await SecureStore.getItemAsync(K);
  if(existente)return Crypto.AESEncryptionKey.import(existente,'hex');
  // No reemplazar una clave perdida sobre documentos existentes.
  if((await almacenLocal.claves('securia.asistente.documentos/')).length)throw Error('No se puede abrir la biblioteca cifrada. Se conservan los documentos existentes.');
  const k=await Crypto.AESEncryptionKey.generate(Crypto.AESKeySize.AES256),hex=await k.encoded('hex');
  if(Platform.OS==='web')localStorage.setItem(K,hex);else await SecureStore.setItemAsync(K,hex);
  return k;
 })().catch(e=>{llave=undefined;throw e;});
 return llave;
}
function ruta(guardia:string){if(!guardia)throw Error('Inicie sesión para guardar documentos.');return 'securia.asistente.documentos/'+encodeURIComponent(guardia);}
export async function leerDocumentosChat(guardia:string):Promise<DocumentoChat[]>{
 const s=await almacenLocal.getItem(ruta(guardia));if(!s)return [];
 const datos=await abrirJSON<{guardia:string;documentos:DocumentoChat[]}>(s,await clave());
 if(datos.guardia!==guardia||!Array.isArray(datos.documentos))throw Error('Biblioteca de directivas inválida.');
 datos.documentos.forEach(validarDocumentoChat);return datos.documentos;
}
export async function guardarDocumentosChat(guardia:string,documentos:DocumentoChat[]){
 if(documentos.length>12)throw Error('Puede conservar hasta 12 documentos. Quite uno anterior para agregar otro.');
 documentos.forEach(validarDocumentoChat);
 await almacenLocal.setItem(ruta(guardia),await sellarJSON({guardia,documentos},await clave()));
}
