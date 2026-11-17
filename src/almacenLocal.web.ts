import AsyncStorage from '@react-native-async-storage/async-storage';
// La web mantiene su adaptador; SQLite nativo no entra en el bundle del navegador.
export const almacenLocal = {...AsyncStorage,
 getItems:async(claves:string[])=>(await AsyncStorage.multiGet(claves)).map(([,v])=>v),
 setItems:async(filas:[string,string][])=>AsyncStorage.multiSet(filas),
 claves:async(prefijo:string)=>(await AsyncStorage.getAllKeys()).filter(k=>k.startsWith(prefijo)),compactar:async()=>{}};
