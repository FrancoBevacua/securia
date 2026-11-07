import React,{useState} from 'react';
import {useStore} from '../store';
import {Btn,Sheet,Hint,Banner} from '../ui';
import HistorialRecuperacion from './HistorialRecuperacion';

export default function RevisarSincronizacion({habilitado=true}:{habilitado?:boolean}){
 const st=useStore(),[abierto,setAbierto]=useState(false),[ocupado,setOcupado]=useState(false),[error,setError]=useState(''),[terminado,setTerminado]=useState(false);
 return <>
  {habilitado?<Btn label="Recuperar sincronización" variant="ghost" onPress={()=>{setAbierto(true);setTerminado(false);setError('');}}/>:null}
  <Sheet visible={abierto} title="Recuperar sincronización" onClose={()=>{if(!ocupado)setAbierto(false);}}>
   {terminado?<Banner kind="info">Los pendientes fueron confirmados. Las diferencias que requieren revisión están respaldadas en el historial de recuperación.</Banner>:<Hint>Se reintentarán los registros pendientes. Una diferencia de un turno cerrado se guardará como respaldo y los demás registros seguirán sincronizándose.</Hint>}
   {error?<Banner kind="warn">{error}</Banner>:null}
   {!terminado?<Btn label={ocupado?'Sincronizando…':'Reintentar pendientes'} variant="primary" disabled={ocupado||st.nube.guardando||st.nube.reautenticar} onPress={async()=>{
    setOcupado(true);setError('');try{await st.recuperarSincronizacion();setTerminado(true);}catch(e:any){setError(e.message);}finally{setOcupado(false);}
   }}/>:<Btn label="Listo" variant="primary" onPress={()=>setAbierto(false)}/>}
   <HistorialRecuperacion/>
  </Sheet>
 </>;
}
