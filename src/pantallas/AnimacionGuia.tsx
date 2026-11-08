import React,{useCallback,useEffect,useRef,useState} from 'react';
import {AccessibilityInfo,Animated,AppState,Text,View} from 'react-native';
import {useFocusEffect} from 'expo-router';
import {Icon} from '../icons';
import {FONT} from '../theme';
import {useTheme} from '../ui';
import {PasoGuia} from '../guia';

/** Sólo se anima mientras la pantalla está visible y el teléfono lo permite. */
export function useMovimientoGuia(pausa=false){
 const valor=useRef(new Animated.Value(0)).current;
 const [reducido,setReducido]=useState(true),[enFoco,setEnFoco]=useState(false),[activa,setActiva]=useState(AppState.currentState==='active');
 useFocusEffect(useCallback(()=>{setEnFoco(true);return()=>setEnFoco(false);},[]));
 useEffect(()=>{
  let vivo=true;
  void AccessibilityInfo.isReduceMotionEnabled().then(v=>{if(vivo)setReducido(v);}).catch(()=>{});
  const movimiento=AccessibilityInfo.addEventListener('reduceMotionChanged',setReducido);
  const estado=AppState.addEventListener('change',s=>setActiva(s==='active'));
  return()=>{vivo=false;movimiento.remove();estado.remove();};
 },[]);
 useEffect(()=>{
  valor.setValue(0);
  if(reducido||!enFoco||!activa||pausa){valor.setValue(1);return;}
  const animacion=Animated.loop(Animated.sequence([
   Animated.timing(valor,{toValue:1,duration:1000,useNativeDriver:true}),
   Animated.timing(valor,{toValue:0,duration:1000,useNativeDriver:true}),
  ]));
  animacion.start();return()=>{animacion.stop();valor.stopAnimation();};
 },[valor,reducido,enFoco,activa,pausa]);
 return {valor,reducido};
}

export function InsigniaGuia({size=58}:{size?:number}){
 const t=useTheme(),{valor}=useMovimientoGuia();
 return <View accessible={false} importantForAccessibility="no-hide-descendants" style={{width:size,height:size,alignItems:'center',justifyContent:'center'}}>
  <Animated.View style={{position:'absolute',width:size,height:size,borderRadius:size/3,backgroundColor:t.accentSoft,borderWidth:1,borderColor:t.accentLine,transform:[{rotate:valor.interpolate({inputRange:[0,1],outputRange:['-7deg','7deg']})},{scale:valor.interpolate({inputRange:[0,1],outputRange:[.96,1.04]})}]}}/>
  <Icon name="guia" size={size*.55} color={t.accentText}/>
 </View>;
}

export function EjemploGuia({paso,icono,pausa}:{paso:PasoGuia;icono:string;pausa:boolean}){
 const t=useTheme(),{valor}=useMovimientoGuia(pausa);
 return <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" style={{borderRadius:24,borderWidth:1,borderColor:t.lineStrong,backgroundColor:t.surface2,padding:12,gap:13}}>
  <View style={{width:42,height:4,borderRadius:4,backgroundColor:t.lineStrong,alignSelf:'center'}}/>
  <View style={{backgroundColor:t.surface,borderRadius:16,padding:16,gap:18}}>
   <View style={{flexDirection:'row',alignItems:'center',gap:10}}><Icon name={icono} size={22} color={t.accentText}/><Text style={{fontFamily:FONT.bodySemi,fontSize:15,color:t.text,flex:1}}>{paso.vista}</Text><Text style={{fontFamily:FONT.body,fontSize:10,color:t.muted}}>EJEMPLO</Text></View>
   {paso.filas.map((fila,i)=><View key={i} style={{gap:7}}><Text style={{fontFamily:FONT.body,fontSize:13,lineHeight:19,color:t.text2}}>{fila}</Text><View style={{height:3,borderRadius:2,width:i===1?'62%':'85%',backgroundColor:t.line}}/></View>)}
   <View style={{minHeight:52,paddingVertical:12,paddingHorizontal:16,borderRadius:12,backgroundColor:t.accentSoft,borderWidth:1,borderColor:t.accentLine,justifyContent:'center'}}>
    <Text style={{fontFamily:FONT.bodySemi,fontSize:14,lineHeight:20,color:t.accentText,paddingRight:36}}>{paso.accion}</Text>
    <Animated.View style={{position:'absolute',right:14,width:28,height:28,borderRadius:28,borderWidth:2,borderColor:t.accentText,opacity:valor.interpolate({inputRange:[0,1],outputRange:[.25,.8]}),transform:[{scale:valor.interpolate({inputRange:[0,1],outputRange:[.7,1.3]})}]}}/>
    <Animated.View style={{position:'absolute',right:9,opacity:valor.interpolate({inputRange:[0,.4,1],outputRange:[0,1,1]}),transform:[{translateY:valor.interpolate({inputRange:[0,1],outputRange:[24,4]})},{translateX:valor.interpolate({inputRange:[0,1],outputRange:[12,0]})}]}}><Icon name="tocar" color={t.accentText} size={29}/></Animated.View>
   </View>
  </View>
  <Text style={{color:t.muted,fontFamily:FONT.body,fontSize:11,textAlign:'center'}}>Vista ilustrada de Securia</Text>
 </View>;
}
