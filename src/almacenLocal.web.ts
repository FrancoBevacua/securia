import AsyncStorage from '@react-native-async-storage/async-storage';
// La web mantiene su adaptador; SQLite nativo no entra en el bundle del navegador.
export const almacenLocal = {...AsyncStorage,claves:async(prefijo:string)=>(await AsyncStorage.getAllKeys()).filter(k=>k.startsWith(prefijo)),compactar:async()=>{}};
