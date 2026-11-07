require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module');
const archivos=new Map(),compartidos=[];let disponible=true;
const load=Module._load;
Module._load=function(n,...args){
 if(n==='expo-file-system')return {Paths:{cache:'file://cache/'},File:class{
  constructor(base,nombre){this.uri=base+nombre;}get exists(){return archivos.has(this.uri);}delete(){archivos.delete(this.uri);}create(){archivos.set(this.uri,new Uint8Array());}write(bytes){archivos.set(this.uri,bytes);}
 }};
 if(n==='expo-sharing')return {isAvailableAsync:async()=>disponible,shareAsync:async(uri,opciones)=>compartidos.push({uri,opciones})};
 if(n==='./media')return {leerBytes:async()=>new Uint8Array(),prepararFoto:async()=>({})};
 if(n==='react-native-share')throw Error('No abrir conversaciones de WhatsApp por número');
 return load.call(this,n,...args);
};
const {pdfInformeDia}=require('../src/pdf.ts'),{estadoVacio}=require('../src/model.ts');
test('compartir con supervisor adjunta el PDF real al selector con MIME y permiso nativo de archivo',async()=>{
 const S=estadoVacio(),r={fecha:'2026-10-27',corte:'19:00',cierre:'',fotos:[],texto:'LIBRO DE NOVEDADES\n\nSe realiza un control.'};
 assert.equal(await pdfInformeDia(r,S,'Guardia de prueba','5493411234567'),'compartido');
 assert.equal(compartidos.length,1);assert.equal(compartidos[0].opciones.mimeType,'application/pdf');assert.match(compartidos[0].opciones.dialogTitle,/elija WhatsApp y el supervisor/);
 assert.match(Buffer.from(archivos.get(compartidos[0].uri)).toString('latin1'),/^%PDF-/);assert.match(compartidos[0].uri,/\.pdf$/);
 disponible=false;assert.equal(await pdfInformeDia(r,S,'Guardia de prueba',''),'guardado');assert.equal(compartidos.length,1);
});
