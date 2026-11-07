import React,{useEffect,useState} from 'react';
import {Image as RNImage,ImageProps,ActivityIndicator,View,Text} from 'react-native';
import {resolverAdjunto} from './adjuntosNube';

export function Image(props:ImageProps){
 const source=props.source;
 const uri=source&&!Array.isArray(source)&&typeof source==='object'?source.uri:undefined;
 const [resuelto,setResuelto]=useState<{uri:string;valor:string}|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{
  if(!uri?.startsWith('vige://'))return;
  let activo=true;setError('');
  resolverAdjunto(uri).then(valor=>{if(activo)setResuelto({uri,valor});},()=>{if(activo)setError('Sin conexión. Toque para reintentar.');});
  return()=>{activo=false;};
 },[uri]);
 if(uri?.startsWith('vige://')&&resuelto?.uri!==uri)return <View style={[props.style,{alignItems:'center',justifyContent:'center'}]}>{error?<Text onPress={()=>{setError('');resolverAdjunto(uri).then(valor=>setResuelto({uri,valor}),()=>setError('Evidencia no disponible.'));}} style={{fontSize:11,color:'#9ca3af'}}>{error}</Text>:<ActivityIndicator/>}</View>;
 return <RNImage {...props} source={resuelto&&resuelto.uri===uri?{...(source as object),uri:resuelto.valor}:source}/>;
}
