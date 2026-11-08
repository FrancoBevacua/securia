import React,{useCallback,useEffect,useRef,useState} from 'react';
import {AccessibilityInfo,Animated,AppState,Image,Text,View} from 'react-native';
import {useFocusEffect} from 'expo-router';
import {Icon} from '../icons';
import {FONT} from '../theme';
import {useTheme} from '../ui';
import {PasoGuia} from '../guia';
import {CAPTURAS_GUIA} from '../guiaCapturas';

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

export function EjemploGuia({paso,pausa}:{paso:PasoGuia;pausa:boolean}){
  const t=useTheme(),{valor}=useMovimientoGuia(pausa);
  const source=CAPTURAS_GUIA[paso.captura];
  const dimensions=Image.resolveAssetSource?.(source);
  const ratio=dimensions ? dimensions.width/dimensions.height : 0.6;
  return <View pointerEvents="none" style={{borderRadius:18,borderWidth:1,borderColor:t.lineStrong,backgroundColor:t.surface2,padding:8,gap:8}}>
    <View style={{borderRadius:12,overflow:'hidden'}}>
      <Image source={source} accessible accessibilityLabel={'Captura de Securia. '+paso.titulo}
        resizeMode="contain" style={{width:'100%',aspectRatio:ratio}}/>
      <Animated.View accessible={false} style={{position:'absolute',top:0,left:0,right:0,height:3,
        backgroundColor:t.accent,opacity:valor.interpolate({inputRange:[0,1],outputRange:[.3,1]})}}/>
    </View>
    <Text style={{color:t.muted,fontFamily:FONT.body,fontSize:12,textAlign:'center'}}>Captura de Securia · datos de demostración</Text>
  </View>;
}
