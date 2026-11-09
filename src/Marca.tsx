import React from 'react';
import {View,Text} from 'react-native';
import Svg,{Path,Rect} from 'react-native-svg';
import {FONT} from './theme';
import marca from './marcaSecuria.json';
export const NOMBRE_APP='Securia';
export const LEMA_APP='Cada novedad, bajo control.';
export function LogoSecuria({size=48}:{size?:number}){
  return <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityLabel="Logo de Securia">
    <Rect width={64} height={64} rx={14} fill={marca.fondo}/>
    <Path d={marca.monograma} fill={marca.trazo}/>
    <Path d={marca.registro} fill={marca.acento}/>
  </Svg>;
}
export function MarcaSecuria({color='#102C49',compacta=false}:{color?:string;compacta?:boolean}){
  return <View style={{flexDirection:'row',alignItems:'center',gap:11}}>
    <LogoSecuria size={compacta?32:60}/>
    <View style={{flex:1,minWidth:0}}>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{fontFamily:FONT.bodyBold,fontSize:compacta?22:36,lineHeight:compacta?30:44,letterSpacing:1,color}}>SECURIA</Text>
      {!compacta?<Text style={{fontFamily:FONT.bodyMed,fontSize:13,color}}>{LEMA_APP}</Text>:null}
    </View>
  </View>;
}
