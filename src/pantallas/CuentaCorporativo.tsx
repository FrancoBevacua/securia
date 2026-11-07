import React,{useState} from 'react';
import {Text} from 'react-native';
import {router} from 'expo-router';
import {useStore} from '../store';
import {FONT} from '../theme';
import {cambiarPinNube} from '../nube';
import {pinCorporativoValido,nombreGuardia} from '../corporativo';
import {Pantalla,SubCabecera,Card,Hint,Btn,Sheet,Input,Banner,Eyebrow,useTheme} from '../ui';
import {ElegirResponsable} from './GuardiaACargo';

export default function CuentaCorporativo(){
 const st=useStore(),t=useTheme(),[pinAbierto,setPinAbierto]=useState(false),[elegir,setElegir]=useState(false),[actual,setActual]=useState(''),[nuevo,setNuevo]=useState(''),[confirmar,setConfirmar]=useState(''),[error,setError]=useState(''),[guardando,setGuardando]=useState(false);
 return <Pantalla top>
  <SubCabecera titulo="Guardia Paseo" sub="Cuenta administradora del corporativo" onBack={()=>router.back()}/>
  <Card pad style={{gap:12}}><Eyebrow>Acceso al corporativo</Eyebrow><Hint>PIN de seis números</Hint><Text style={{fontFamily:FONT.mono,fontSize:24,color:t.text}}>••••••</Text><Btn label="Cambiar PIN" onPress={()=>{setActual('');setNuevo('');setConfirmar('');setError('');setPinAbierto(true);}}/></Card>
  <Card pad style={{gap:12}}><Eyebrow>Guardia a cargo</Eyebrow><Text style={{fontFamily:FONT.bodySemi,fontSize:19,color:t.text}}>{nombreGuardia(st.responsable)||'Seleccione un guardia'}</Text><Btn label="Cambiar responsable" onPress={()=>setElegir(true)}/><Btn label="Ver equipo y datos personales" onPress={()=>router.push('/equipo')}/></Card>
  <Btn label="Cerrar sesión" variant="ghost" onPress={async()=>{try{await st.salir();}catch(e:any){setError(e.message);}}}/>
  {!pinAbierto&&error?<Banner kind="warn">{error}</Banner>:null}
  <Sheet visible={elegir} title="¿Quién queda a cargo?" onClose={()=>setElegir(false)}><ElegirResponsable onDone={()=>setElegir(false)}/></Sheet>
  <Sheet visible={pinAbierto} title="Cambiar PIN del corporativo" onClose={()=>{if(!guardando)setPinAbierto(false);}} footer={<Btn label={guardando?'Guardando…':'Guardar PIN'} disabled={guardando} variant="primary" onPress={async()=>{
   setError('');if(!pinCorporativoValido(actual)||!pinCorporativoValido(nuevo)){setError('El PIN actual y el nuevo deben tener seis números.');return;}if(nuevo!==confirmar){setError('La confirmación no coincide con el nuevo PIN.');return;}
   setGuardando(true);try{await cambiarPinNube(actual,nuevo);setActual('');setNuevo('');setConfirmar('');setPinAbierto(false);}catch(e:any){setError(e.message);}finally{setGuardando(false);}
  }}/>}>
   <Input label="PIN actual" value={actual} onChangeText={v=>setActual(v.replace(/\D/g,'').slice(0,6))} maxLength={6} keyboardType="number-pad" secureTextEntry/>
   <Input label="Nuevo PIN de seis números" value={nuevo} onChangeText={v=>setNuevo(v.replace(/\D/g,'').slice(0,6))} maxLength={6} keyboardType="number-pad" secureTextEntry/>
   <Input label="Repetir nuevo PIN" value={confirmar} onChangeText={v=>setConfirmar(v.replace(/\D/g,'').slice(0,6))} maxLength={6} keyboardType="number-pad" secureTextEntry/>
   {error?<Banner kind="warn">{error}</Banner>:null}
  </Sheet>
 </Pantalla>;
}
