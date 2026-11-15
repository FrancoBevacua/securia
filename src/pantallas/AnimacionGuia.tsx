import React,{useCallback,useEffect,useEffectEvent,useRef,useState} from 'react';
import {AccessibilityInfo,Animated,AppState,Image,Text,useWindowDimensions,View} from 'react-native';
import {useFocusEffect} from 'expo-router';
import {Icon} from '../icons';
import {FONT} from '../theme';
import {Btn,Row,useTheme} from '../ui';
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
 return {valor,reproduciendo:enFoco&&activa&&!pausa};
}

export function InsigniaGuia({size=58}:{size?:number}){
 const t=useTheme(),{valor}=useMovimientoGuia();
 return <View accessible={false} importantForAccessibility="no-hide-descendants" style={{width:size,height:size,alignItems:'center',justifyContent:'center'}}>
  <Animated.View style={{position:'absolute',width:size,height:size,borderRadius:size/3,backgroundColor:t.accentSoft,borderWidth:1,borderColor:t.accentLine,transform:[{rotate:valor.interpolate({inputRange:[0,1],outputRange:['-7deg','7deg']})},{scale:valor.interpolate({inputRange:[0,1],outputRange:[.96,1.04]})}]}}/>
  <Icon name="guia" size={size*.55} color={t.accentText}/>
 </View>;
}

export function EjemploGuia({paso,pausa,avanzar,alternarPausa}:{paso:PasoGuia;pausa:boolean;avanzar?:()=>void;alternarPausa:()=>void}){
  const t=useTheme(),{valor,reproduciendo}=useMovimientoGuia(pausa);
  const ventana=useWindowDimensions();
  const [anchoDisponible,setAnchoDisponible]=useState(0);
  const [error,setError]=useState(false);
  const [indice,setIndice]=useState(0);
  const terminado=indice===paso.toques.length;
  const [accion,x,y]=paso.toques[Math.min(indice,paso.toques.length-1)];
  const siguiente=useEffectEvent(()=>avanzar?.());
  useEffect(()=>{
    if(!reproduciendo||error)return;
    const espera=terminado?2500:Math.max(2600,Math.ceil(paso.texto.length*40/paso.toques.length));
    const timer=setTimeout(()=>{if(terminado)siguiente();else setIndice(i=>i+1);},espera);
    return()=>clearTimeout(timer);
  },[reproduciendo,terminado,error,indice,paso]);
  const source=CAPTURAS_GUIA[paso.captura];
  const dimensiones=Image.resolveAssetSource?.(source) ?? source;
  const proporcion=dimensiones?.width && dimensiones.height ? dimensiones.width/dimensiones.height : 0.6;
  const anchoMaximo=Math.min(anchoDisponible || ventana.width-50,ventana.width);
  const altoMaximo=ventana.height*0.6;
  // Android aplica las medidas originales del PNG si falta una dimensión explícita.
  const ancho=Math.max(1,Math.min(anchoMaximo,altoMaximo*proporcion));
  const alto=ancho/proporcion;
  const tam=36;
  return <View style={{borderRadius:18,borderWidth:1,borderColor:t.lineStrong,backgroundColor:t.surface2,padding:8,gap:10}}>
    {!error?<Row style={{minHeight:42,paddingHorizontal:4}}>
      <View style={{flex:1,gap:5}}>
        <View style={{flexDirection:'row',gap:4}}>{paso.toques.map((_,i)=><View key={i} style={{flex:1,height:3,borderRadius:2,backgroundColor:i<=indice?t.accent:t.line}}/>)}</View>
        <Text accessibilityLiveRegion="polite" style={{color:t.text,fontFamily:FONT.bodySemi,fontSize:15}}>
          {terminado?'Fin de la demostración':accion}
        </Text>
      </View>
      {terminado?<Btn label="Repetir" size="sm" variant="ghost" onPress={()=>{setIndice(0);if(pausa)alternarPausa();}}/>:null}
      <Btn icon={pausa?'play':'pausa'} accessibilityLabel={pausa?'Reanudar demostración':'Pausar demostración'} variant="ghost" onPress={alternarPausa}/>
    </Row>:null}
    <View onLayout={e=>setAnchoDisponible(e.nativeEvent.layout.width)} style={{alignItems:'center',gap:6}}>
      {error?<Text accessibilityLiveRegion="polite" style={{color:t.text2,fontFamily:FONT.body,textAlign:'center'}}>
        No se pudo mostrar esta captura.
      </Text>:<View style={{width:ancho,height:alto,overflow:'hidden',borderRadius:10}}>
        <Image source={source} accessible accessibilityLabel={'Captura de Securia. '+paso.titulo}
          resizeMode="contain" onError={()=>setError(true)} style={{width:ancho,height:alto}}/>
        {terminado?null:<View key={indice} pointerEvents="none" importantForAccessibility="no-hide-descendants"
          style={{position:'absolute',left:ancho*x/100-tam/2,top:alto*y/100-tam/2,
            width:tam,height:tam,alignItems:'center',justifyContent:'center'}}>
          <Animated.View pointerEvents="none" style={{position:'absolute',width:tam,height:tam,borderRadius:tam/2,
            borderWidth:2,borderColor:'#fff',backgroundColor:'#F43F5E',
            opacity:valor.interpolate({inputRange:[0,1],outputRange:[.85,.32]}),
            transform:[{scale:valor.interpolate({inputRange:[0,1],outputRange:[.62,1.48]})}]}}/>
          <View pointerEvents="none" style={{width:17,height:17,borderRadius:9,borderWidth:2,borderColor:'#fff',backgroundColor:'#BE123C'}}/>
        </View>}
      </View>}
    </View>
  </View>;
}
