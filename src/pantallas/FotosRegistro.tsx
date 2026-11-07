import React, { useState } from 'react';
import { View } from 'react-native';
import {Image} from '../Imagen';
import * as ImagePicker from 'expo-image-picker';
import { useStore } from '../store';
import { Btn, Row, Hint, useToast } from '../ui';

export default function FotosRegistro({fotos,onChange,disabled=false,onBusyChange}:{fotos:string[];onChange:(fotos:string[])=>void;disabled?:boolean;onBusyChange?:(busy:boolean)=>void}) {
  const st=useStore(),toast=useToast();
  const [cargando,setCargando]=useState(false);
  const agregar=async(camara:boolean)=>{
    setCargando(true);onBusyChange?.(true);
    try {
      const permiso=camara?await ImagePicker.requestCameraPermissionsAsync():await ImagePicker.requestMediaLibraryPermissionsAsync();
      if(!permiso.granted){toast('Hace falta permiso para acceder a la '+(camara?'cámara':'galería'));return;}
      const resultado=camara?await ImagePicker.launchCameraAsync({quality:0.7}):await ImagePicker.launchImageLibraryAsync({mediaTypes:'images',quality:0.7,allowsMultipleSelection:true});
      if(resultado.canceled)return;
      const nuevas=[];
      for(const asset of resultado.assets)nuevas.push(await st.guardarFoto(asset.uri));
      onChange([...fotos,...nuevas]);
    }catch{toast('No se pudieron adjuntar las imágenes.');}
    finally{setCargando(false);onBusyChange?.(false);}
  };
  return <>
    <Hint>{cargando?'Adjuntando imágenes…':fotos.length?fotos.length+' imágenes adjuntas':'Evidencia fotográfica (opcional)'}</Hint>
    <View style={{flexDirection:'row',flexWrap:'wrap',marginHorizontal:-2}}>{fotos.map((uri,i)=><View key={i} style={{width:'25%',paddingHorizontal:2,marginBottom:4}}>
      <Image source={{uri}} style={{width:'100%',aspectRatio:1,borderRadius:8}}/>
      <Btn label="Quitar" size="xs" disabled={disabled||cargando} onPress={()=>onChange(fotos.filter((_,k)=>k!==i))}/>
    </View>)}</View>
    <Row><Btn label="Sacar foto" variant="ghost" disabled={disabled||cargando} onPress={()=>agregar(true)}/>
      <Btn label="Adjuntar imágenes" variant="ghost" disabled={disabled||cargando} onPress={()=>agregar(false)}/></Row>
  </>;
}
