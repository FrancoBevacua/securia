import React, {useEffect, useRef, useState} from 'react';
import {AppState} from 'react-native';
import {ExpoSpeechRecognitionModule as voz, useSpeechRecognitionEvent} from 'expo-speech-recognition';
import {Btn} from '../ui';

/** El dictado sólo completa el borrador; el usuario siempre decide cuándo enviarlo. */
export default function DictadoChat({enabled,onTexto,onEstado}: {
 enabled:boolean;onTexto:(texto:string)=>void;onEstado:(activo:boolean,mensaje:string)=>void;
}){
 const [fase,setFase]=useState<'listo'|'permiso'|'escuchando'|'terminando'>('listo');
 const activo=useRef(false),version=useRef(0),texto=useRef(''),parcial=useRef('');
 const props=useRef({enabled,onTexto,onEstado});props.current={enabled,onTexto,onEstado};
 const cambiar=(f:typeof fase,mensaje:string)=>{setFase(f);props.current.onEstado(f!=='listo',mensaje);};
 const cancelar=()=>{version.current++;if(activo.current){activo.current=false;voz.abort();}texto.current='';parcial.current='';};
 useSpeechRecognitionEvent('result',e=>{
  if(!activo.current||!props.current.enabled)return;
  const resultado=e.results[0]?.transcript||'';
  if(e.isFinal){texto.current=[texto.current,resultado].filter(Boolean).join(' ');parcial.current='';}
  else parcial.current=resultado;
  props.current.onEstado(true,[texto.current,parcial.current].filter(Boolean).join(' ')||'Escuchando…');
 });
 useSpeechRecognitionEvent('end',()=>{
  if(!activo.current)return;
  activo.current=false;
  const dictado=[texto.current,parcial.current].filter(Boolean).join(' ').trim();
  if(props.current.enabled&&dictado)props.current.onTexto(dictado);
  cambiar('listo',dictado?'Revisá el texto antes de enviarlo.':'No se detectó voz. Podés volver a dictar.');
 });
 useSpeechRecognitionEvent('error',e=>{
  if(!activo.current)return;
  cancelar();
  cambiar('listo',e.error==='not-allowed'?'Permití el micrófono para dictar.':e.error==='no-speech'?'No se detectó voz. Volvé a intentarlo.':'No se pudo completar el dictado. Podés reintentar o escribir tu consulta.');
 });
 useEffect(()=>{
  if(!enabled){cancelar();cambiar('listo','');}
 },[enabled]);
 useEffect(()=>{
  const sub=AppState.addEventListener('change',s=>{if(s==='background'&&activo.current){cancelar();cambiar('listo','');}});
  return()=>{sub.remove();cancelar();props.current.onEstado(false,'');};
 },[]);
 const iniciar=async()=>{
  if(!enabled||fase!=='listo')return;
  const intento=++version.current;
  cambiar('permiso','Preparando micrófono…');
  try{
   if(!voz.isRecognitionAvailable())throw Error('Este dispositivo no tiene reconocimiento de voz disponible.');
   const permiso=await voz.requestPermissionsAsync();
   if(intento!==version.current||!props.current.enabled)return;
   if(!permiso.granted)throw Error('Permití el micrófono y el reconocimiento de voz para dictar.');
   texto.current='';parcial.current='';activo.current=true;
   voz.start({lang:'es-AR',interimResults:true,continuous:false});
   cambiar('escuchando','Escuchando… Tocá el micrófono para terminar.');
  }catch(e:any){if(intento===version.current){cancelar();cambiar('listo',e.message||'No se pudo abrir el micrófono.');}}
 };
 return <Btn icon={fase==='escuchando'?'pausa':'microfono'} accessibilityLabel={fase==='escuchando'?'Terminar dictado':'Dictar mensaje'}
  size="sm" variant={fase==='escuchando'?'primary':'ghost'} style={{width:44,minWidth:44,height:44}}
  disabled={!enabled||fase==='permiso'||fase==='terminando'} onPress={()=>{
   if(fase==='escuchando'){
    try{cambiar('terminando','Terminando dictado…');voz.stop();}
    catch{cancelar();cambiar('listo','No se pudo terminar el dictado. Volvé a intentarlo.');}
   }else void iniciar();
  }}/>;
}
