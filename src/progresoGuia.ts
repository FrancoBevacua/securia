import AsyncStorage from '@react-native-async-storage/async-storage';
import {claveGuia,LugarGuia,lugarInicialGuia,normalizarLugarGuia} from './guia';

const escrituras=new Map<string,Promise<void>>();
export async function leerLugarGuia(guardia:string):Promise<LugarGuia>{
 if(!guardia)return lugarInicialGuia();
 // Una lectura posterior a una escritura espera su confirmación local.
 await escrituras.get(claveGuia(guardia))?.catch(()=>{});
 const raw=await AsyncStorage.getItem(claveGuia(guardia));
 return raw?normalizarLugarGuia(JSON.parse(raw)):lugarInicialGuia();
}
export async function guardarLugarGuia(guardia:string,lugar:LugarGuia):Promise<void>{
 if(!guardia)return;
 const clave=claveGuia(guardia),valor=JSON.stringify(normalizarLugarGuia(lugar));
 const escritura=(escrituras.get(clave)||Promise.resolve()).catch(()=>{}).then(()=>AsyncStorage.setItem(clave,valor));
 escrituras.set(clave,escritura);
 try{await escritura;}finally{if(escrituras.get(clave)===escritura)escrituras.delete(clave);}
}
