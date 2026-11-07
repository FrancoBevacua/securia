import React from 'react';
import {View,Text} from 'react-native';
import Svg,{Path} from 'react-native-svg';
import {FONT} from './theme';
export const NOMBRE_APP='Securia';
export const LEMA_APP='Cada novedad, bajo control.';
export function LogoVigelium({size=48}:{size?:number}){
  return <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityLabel="Logo de Securia">
    <Path d="M32 7 53 15v16c0 12-12 21-21 26-9-5-21-14-21-26V15Z" fill="#0B183C" stroke="#F43C58" strokeWidth="5" strokeLinejoin="round"/>
    <Path d="m22 31 7 7 14-16" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </Svg>;
}
export function MarcaVigelium({color='#102C49',compacta=false}:{color?:string;compacta?:boolean}){
  return <View style={{flexDirection:'row',alignItems:'center',gap:11}}>
    <LogoVigelium size={compacta?32:60}/>
    <View style={{flex:1,minWidth:0}}>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{fontFamily:FONT.bodyBold,fontSize:compacta?22:36,lineHeight:compacta?30:44,letterSpacing:1,color}}>SECURIA</Text>
      {!compacta?<Text style={{fontFamily:FONT.bodyMed,fontSize:13,color}}>{LEMA_APP}</Text>:null}
    </View>
  </View>;
}
