import React from 'react';
import {Pressable,Text,View} from 'react-native';
import {router} from 'expo-router';
import {FONT} from '../theme';
import {useTheme} from '../ui';
import {Icon} from '../icons';
import {InsigniaGuia} from './AnimacionGuia';

export default function AccesoGuia(){
 const t=useTheme();
 return <Pressable accessibilityRole="button" accessibilityLabel="Abrir guía animada de Securia" onPress={()=>router.push('/guia')} style={({pressed})=>({padding:16,borderRadius:18,borderWidth:1,borderColor:t.accentLine,backgroundColor:t.accentSoft,opacity:pressed?.8:1})}>
  <View style={{flexDirection:'row',gap:14,alignItems:'center'}}><InsigniaGuia/><View style={{flex:1,gap:5}}>
   <Text style={{fontFamily:FONT.bodySemi,fontSize:11,color:t.accentText,letterSpacing:1}}>GUÍA ANIMADA</Text>
   <Text style={{fontFamily:FONT.dispBold,fontSize:24,lineHeight:28,color:t.text}}>Aprendé a usar Securia</Text>
   <Text style={{fontFamily:FONT.body,fontSize:13,lineHeight:19,color:t.text2}}>Conocé las funciones paso a paso, cuando lo necesites.</Text>
  </View><Icon name="siguiente" color={t.accentText} size={19}/></View>
 </Pressable>;
}
