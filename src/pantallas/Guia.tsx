import React,{useEffect,useRef,useState} from 'react';
import {BackHandler,ScrollView,Text,View} from 'react-native';
import {router} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useStore} from '../store';
import {Banner,Btn,Card,Hint,Item,Row,useTheme} from '../ui';
import {FONT} from '../theme';
import {Icon} from '../icons';
import {LugarGuia,lugarInicialGuia,TEMAS_GUIA} from '../guia';
import {guardarLugarGuia,leerLugarGuia} from '../progresoGuia';
import {EjemploGuia,InsigniaGuia} from './AnimacionGuia';

export default function Guia(){
 const st=useStore(),t=useTheme(),ins=useSafeAreaInsets(),guardia=(st.responsable||st.me)?.id||'';
 const [lugar,setLugar]=useState<LugarGuia>(lugarInicialGuia),[abierto,setAbierto]=useState(false),[cargando,setCargando]=useState(true),[error,setError]=useState(''),[pausa,setPausa]=useState(false);
 const [intento,setIntento]=useState(0);
 const vigente=useRef(guardia);vigente.current=guardia;
 const version=useRef(0),scroll=useRef<ScrollView>(null);
 useEffect(()=>{
  const n=++version.current;setCargando(true);setAbierto(false);setError('');
  void leerLugarGuia(guardia).then(v=>{if(n===version.current)setLugar(v);},()=>{if(n===version.current){setLugar(lugarInicialGuia());setError('No se pudo recuperar la última consulta. Podés recorrer la guía y volver a intentar.');}}).finally(()=>{if(n===version.current)setCargando(false);});
  return()=>{version.current++;};
 },[guardia,intento]);
 useEffect(()=>{scroll.current?.scrollTo({y:0,animated:false});},[lugar.tema,lugar.paso,abierto]);
 useEffect(()=>{
  if(!abierto)return;
  const sub=BackHandler.addEventListener('hardwareBackPress',()=>{setAbierto(false);return true;});return()=>sub.remove();
 },[abierto]);
 const tema=TEMAS_GUIA.find(x=>x.id===lugar.tema)||TEMAS_GUIA[0],indice=TEMAS_GUIA.indexOf(tema),paso=tema.pasos[lugar.paso];
 const ir=(v:LugarGuia)=>{
  const n=++version.current,propietario=guardia;setLugar(v);setAbierto(true);if(!abierto)setPausa(false);
  void guardarLugarGuia(propietario,v).then(()=>{if(n===version.current&&vigente.current===propietario)setError('');},()=>{if(n===version.current&&vigente.current===propietario)setError('No se pudo recordar este paso. Podés seguir leyendo y reintentar el guardado.');});
 };
 const siguiente=()=>{
  if(lugar.paso<tema.pasos.length-1)ir({...lugar,paso:lugar.paso+1});
  else if(indice<TEMAS_GUIA.length-1)ir({tema:TEMAS_GUIA[indice+1].id,paso:0});
  else setAbierto(false);
 };
 const volver=()=>{if(abierto)setAbierto(false);else if(router.canGoBack())router.back();else router.replace('/');};
 return <View style={{flex:1,backgroundColor:t.bg,paddingTop:ins.top}}>
  <View style={{flexDirection:'row',alignItems:'center',gap:12,padding:14,borderBottomWidth:1,borderColor:t.line}}>
   <Btn icon="back" accessibilityLabel={abierto?'Volver a los temas':'Volver a Inicio'} onPress={volver}/>
   <View style={{flex:1,gap:3}}><Text accessibilityRole="header" style={{color:t.text,fontFamily:FONT.dispBold,fontSize:25}}>Guía de Securia</Text><Text style={{color:t.muted,fontFamily:FONT.body,fontSize:12}}>Consultala cuando la necesites</Text></View>
  </View>
  <ScrollView ref={scroll} style={{flex:1}} contentContainerStyle={{padding:16,gap:18,paddingBottom:abierto?16:106+ins.bottom}}>
   {error?<><Banner kind="warn">{error}</Banner><Btn label={abierto?'Reintentar guardado':'Reintentar lectura'} onPress={()=>abierto?ir(lugar):setIntento(v=>v+1)}/></>:null}
   {!abierto?<>
    <View style={{gap:14,paddingVertical:8}}><InsigniaGuia size={76}/><Text accessibilityRole="header" style={{color:t.text,fontFamily:FONT.dispBold,fontSize:32,lineHeight:38}}>Conocé cada función,{"\n"}paso a paso.</Text><Text style={{color:t.text2,fontFamily:FONT.body,fontSize:15,lineHeight:23}}>Elegí un tema y mirá las demostraciones con subtítulos. Se reproducen solas y están disponibles sin conexión.</Text></View>
    <Btn label={cargando?'Cargando última consulta…':lugar.tema===TEMAS_GUIA[0].id&&lugar.paso===0?'Comenzar guía':'Continuar donde dejé'} icon="guia" disabled={cargando} variant="primary" onPress={()=>ir(lugar)}/>
    <Text accessibilityRole="header" style={{fontFamily:FONT.bodySemi,fontSize:16,color:t.text}}>¿Qué querés aprender a usar?</Text>
    <Card>{TEMAS_GUIA.map((x,i)=><Item key={x.id} last={i===TEMAS_GUIA.length-1} lead={<Icon name={x.icono} color={t.accentText} size={24}/>} title={x.titulo} subs={[x.descripcion,x.pasos.length+' pasos']} right={<Icon name="siguiente" color={t.muted} size={18}/>} onPress={()=>{if(!cargando)ir({tema:x.id,paso:0});}}/>)}</Card>
   </>:<>
    <Row><Icon name={tema.icono} size={22} color={t.accentText}/><Text accessibilityRole="header" style={{flex:1,fontFamily:FONT.bodySemi,fontSize:17,color:t.text}}>{tema.titulo}</Text><Text accessibilityLiveRegion="polite" style={{fontFamily:FONT.body,fontSize:12,color:t.muted}}>{'Paso '+(lugar.paso+1)+' de '+tema.pasos.length}</Text></Row>
    <View style={{flexDirection:'row',gap:6}}>{tema.pasos.map((_,i)=><View key={i} style={{height:4,borderRadius:4,flex:1,backgroundColor:i<=lugar.paso?t.accent:t.line}}/>)}</View>
    <Text accessibilityRole="header" style={{color:t.text,fontFamily:FONT.dispBold,fontSize:29,lineHeight:34}}>{paso.titulo}</Text>
    <EjemploGuia key={lugar.tema+'/'+lugar.paso} paso={paso} pausa={pausa} alternarPausa={()=>setPausa(v=>!v)}
      avanzar={lugar.paso<tema.pasos.length-1?siguiente:undefined}/>
    <Text style={{color:t.text2,fontFamily:FONT.body,fontSize:16,lineHeight:25}}>{paso.texto}</Text>
    {paso.consejo?<Card pad><Row style={{alignItems:'flex-start'}}><Icon name="bell" color={t.accentText} size={19}/><Text style={{flex:1,color:t.text2,fontFamily:FONT.body,fontSize:14,lineHeight:22}}>{paso.consejo}</Text></Row></Card>:null}
    {lugar.paso>0?<Btn label="Ver tema desde el principio" variant="ghost" onPress={()=>ir({...lugar,paso:0})}/>:null}
    <Hint>Podés consultar otro tema en cualquier momento con el botón Volver.</Hint>
   </>}
  </ScrollView>
  {abierto?<View style={{padding:14,paddingBottom:14+ins.bottom,gap:8,borderTopWidth:1,borderColor:t.line,backgroundColor:t.surface}}>
   <Row><Btn label="Anterior" disabled={lugar.paso===0} style={{flex:1}} onPress={()=>ir({...lugar,paso:lugar.paso-1})}/><Btn label={lugar.paso<tema.pasos.length-1?'Siguiente':indice<TEMAS_GUIA.length-1?'Siguiente tema':'Volver a los temas'} variant="primary" style={{flex:1}} onPress={siguiente}/></Row>
  </View>:null}
 </View>;
}
