import React,{useState} from 'react';
import {View,Text} from 'react-native';
import {useStore} from '../store';
import {FONT} from '../theme';
import {Card,Btn,Hint,Item,Banner,Stack,Pantalla,useTheme} from '../ui';
import {Avatar} from './Gate';
import {guardiasDelCorporativo,nombreGuardia,puestoCorporativo} from '../corporativo';
import {nombresPuestosGuardia} from '../puestosGuardia';

export function ElegirResponsable({onDone}:{onDone?:()=>void}){
 const st=useStore(),[id,setId]=useState(st.responsable?.id||''),[error,setError]=useState(''),[guardando,setGuardando]=useState(false);
 const guardias=guardiasDelCorporativo(st.S,st.me).sort((a,b)=>nombreGuardia(a).localeCompare(nombreGuardia(b),'es'));
 return <Stack>
  {guardias.length ? <>
  <Hint>Elegí quién queda a cargo del puesto. Su nombre aparecerá en Inicio y como firma inicial de los nuevos registros.</Hint>
  <Card>{guardias.map((g,i)=><Item key={g.id} title={nombreGuardia(g)} lead={<Avatar g={g}/>} subs={[nombresPuestosGuardia(st.S,g)]} right={id===g.id?<Btn icon="check" accessibilityLabel="Guardia seleccionado" size="xs"/>:undefined} last={i===guardias.length-1} onPress={()=>setId(g.id)}/>)}</Card>
  </> : <Banner kind="info">Todavía no hay vigiladores asignados a este puesto. Pedile al administrador que revise las asignaciones del equipo.</Banner>}
  {error?<Banner kind="warn">{error}</Banner>:null}
  <Btn label={guardando?'Guardando…':'Confirmar guardia'} variant="primary" disabled={guardando||!guardias.some(g=>g.id===id)} onPress={async()=>{setGuardando(true);setError('');try{await st.seleccionarResponsable(id);onDone?.();}catch(e:any){setError(e.message);}finally{setGuardando(false);}}}/>
 </Stack>;
}
export default function GuardiaACargo(){
 const t=useTheme(),st=useStore(),puesto=puestoCorporativo(st.S,st.me);
 const [errorSalida,setErrorSalida]=useState('');
 return <Pantalla top>
  <View style={{gap:6}}><Text accessibilityRole="header" style={{color:t.text,fontFamily:FONT.dispBold,fontSize:32}}>¿Quién queda a cargo?</Text>
   <Hint>{puesto ? 'Corporativo · '+puesto.nombre : 'Corporativo'}</Hint>
  </View>
  <ElegirResponsable/>
  <Btn label="Cerrar sesión" variant="ghost" onPress={()=>{void st.salir().catch(e=>setErrorSalida(e.message));}}/>
  {errorSalida?<Banner kind="warn">{errorSalida}</Banner>:null}
 </Pantalla>;
}
