import React,{useState} from 'react';
import {Text} from 'react-native';
import {router} from 'expo-router';
import {useStore} from '../store';
import {FONT} from '../theme';
import {cambiarPinCorporativoNube} from '../nube';
import {pinCorporativoValido} from '../corporativo';
import {Pantalla,SubCabecera,Card,Hint,Btn,Sheet,Input,Banner,Eyebrow,useTheme} from '../ui';

export default function CuentaCorporativo(){
 const st=useStore(),t=useTheme(),[pinAbierto,setPinAbierto]=useState(false),[nuevo,setNuevo]=useState(''),[confirmar,setConfirmar]=useState(''),[error,setError]=useState(''),[guardando,setGuardando]=useState(false);
 if(!st.esAdmin)return null;
 return <Pantalla top>
  <SubCabecera titulo="Guardia Paseo" sub="Cuenta operativa del corporativo" onBack={()=>router.back()}/>
  <Card pad style={{gap:12}}><Eyebrow>Acceso al corporativo</Eyebrow><Hint>PIN de seis números</Hint><Text style={{fontFamily:FONT.mono,fontSize:24,color:t.text}}>••••••</Text><Btn label="Cambiar PIN" onPress={()=>{setNuevo('');setConfirmar('');setError('');setPinAbierto(true);}}/></Card>
  {!pinAbierto&&error?<Banner kind="warn">{error}</Banner>:null}
  <Sheet visible={pinAbierto} title="Cambiar PIN del corporativo" onClose={()=>{if(!guardando)setPinAbierto(false);}} footer={<Btn label={guardando?'Guardando…':'Guardar PIN'} disabled={guardando} variant="primary" onPress={async()=>{
   setError('');if(!pinCorporativoValido(nuevo)){setError('El PIN debe tener seis números.');return;}if(nuevo!==confirmar){setError('La confirmación no coincide con el nuevo PIN.');return;}
   setGuardando(true);try{await cambiarPinCorporativoNube(nuevo);setNuevo('');setConfirmar('');setPinAbierto(false);}catch(e:any){setError(e.message);}finally{setGuardando(false);}
  }}/>}>
   <Input label="Nuevo PIN de seis números" value={nuevo} onChangeText={v=>setNuevo(v.replace(/\D/g,'').slice(0,6))} maxLength={6} keyboardType="number-pad" secureTextEntry/>
   <Input label="Repetir nuevo PIN" value={confirmar} onChangeText={v=>setConfirmar(v.replace(/\D/g,'').slice(0,6))} maxLength={6} keyboardType="number-pad" secureTextEntry/>
   {error?<Banner kind="warn">{error}</Banner>:null}
  </Sheet>
 </Pantalla>;
}
