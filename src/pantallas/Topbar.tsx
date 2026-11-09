import React from 'react';
import {View,Pressable} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {router} from 'expo-router';
import {useStore} from '../store';
import {useTheme} from '../ui';
import {Avatar} from './Gate';
import {MarcaSecuria} from '../Marca';
import {Icon} from '../icons';

export default function Topbar(){
 const st=useStore(),t=useTheme(),ins=useSafeAreaInsets();
 if(!st.me)return null;
 return <View style={{paddingTop:ins.top+8,paddingBottom:8,minHeight:60+ins.top,flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:16,backgroundColor:t.bg}}>
  <View style={{flex:1}}><MarcaSecuria compacta color={t.text}/></View>
  <Pressable accessibilityRole="button" accessibilityLabel="Abrir recordatorios" onPress={()=>router.push('/recordatorios')} style={{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'}}><Icon name="bell" size={22} color={t.text2}/></Pressable>
  <Pressable accessibilityRole="button" accessibilityLabel="Abrir cuenta del corporativo" onPress={()=>router.push('/perfil')} style={{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'}}><Avatar g={st.responsable||st.me} size={32}/></Pressable>
 </View>;
}
