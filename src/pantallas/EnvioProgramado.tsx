import React,{useEffect,useState} from 'react';
import {Text} from 'react-native';
import {useStore} from '../store';
import {consultarEnvioProgramado,guardarEnvioProgramado} from '../nube';
import {CONFIG_ENVIO,ConfigEnvio,prepararReporteProgramado} from '../envioProgramado';
import {isoDate} from '../model';
import {Card,Stack,Eyebrow,Input,Toggle,Btn,Hint,Banner,Tag,useTheme} from '../ui';
export default function EnvioProgramado(){
 const st=useStore(),t=useTheme(),[c,setC]=useState<ConfigEnvio>(CONFIG_ENVIO),[listo,setListo]=useState(false);
 const [ocupado,setOcupado]=useState(false),[cargado,setCargado]=useState(false),[error,setError]=useState(''),[guardado,setGuardado]=useState(false),[ultimo,setUltimo]=useState<any>(null);
 const recibir=(r:any)=>{setC(r.config);setListo(r.listo);setUltimo(r.ultimo);setCargado(true);};
 const cargar=async()=>{setOcupado(true);setError('');try{recibir(await consultarEnvioProgramado());}catch(e:any){setError(e.message);}finally{setOcupado(false);}};
 useEffect(()=>{void cargar();},[]);
 const cambiar=(p:Partial<ConfigEnvio>)=>{setC(v=>({...v,...p}));setGuardado(false);};
 const mensaje=prepararReporteProgramado(st.S,isoDate(),{...c,nombre:c.nombre||'[Supervisor]'}).mensaje;
 return <Card pad><Stack gap={14}>
  <Eyebrow>Reporte automático por WhatsApp</Eyebrow>
  <Tag kind={listo&&c.habilitado?'ok':'warn'} label={!listo?'Pendiente de conectar con Meta':c.habilitado?'Programado':'Desactivado'}/>
  <Hint>Se envía desde el servidor, incluso con el teléfono apagado. Incluye los datos sincronizados hasta el horario elegido.</Hint>
  {!listo?<Banner kind="info">Para activar los envíos falta conectar el número de WhatsApp Business Platform y aprobar la plantilla del mensaje en Meta.</Banner>:null}
  <Input label="Nombre del supervisor" value={c.nombre} editable={st.esAdmin&&!ocupado} onChangeText={nombre=>cambiar({nombre})}/>
  <Input label="WhatsApp del supervisor" value={c.numero} editable={st.esAdmin&&!ocupado} keyboardType="phone-pad" placeholder="549…" onChangeText={numero=>cambiar({numero:numero.replace(/[^0-9]/g,'')})}/>
  <Input tipo="hora" label="Hora de envío" value={c.hora} editable={st.esAdmin&&!ocupado} onChangeText={hora=>cambiar({hora})}/>
  <Hint>Zona horaria: Argentina (Buenos Aires).</Hint>
  {c.hora<'19:00'?<Hint>Antes del corte del libro se envía un avance; el PDF indica hasta qué hora contiene novedades.</Hint>:null}
  {st.esAdmin?<><Toggle label="Programar envío diario" value={c.habilitado} onChange={habilitado=>cambiar({habilitado})}/>
    <Toggle label="El supervisor acepta recibir los reportes" value={c.consentimiento} onChange={consentimiento=>cambiar({consentimiento})}/></>:<Hint>Administración configura el envío para todo el servicio.</Hint>}
  <Hint>Vista previa del mensaje</Hint><Text style={{color:t.text,lineHeight:22}}>{mensaje}</Text>
  {error?<Banner kind="warn">{error}</Banner>:null}
  {guardado?<Banner kind="info">{listo?'Configuración guardada en el servidor.':'Configuración guardada. Los envíos quedan pendientes de conectar Meta.'}</Banner>:null}
  {ultimo?<Hint>{'Último intento: '+ultimo.fecha+' · '+(({aceptado:'aceptado por Meta',incierto:'requiere revisar la entrega',fallido:'falló',preparando:'preparando PDF',enviando:'enviando'} as Record<string,string>)[ultimo.estado]||ultimo.estado)+(ultimo.detalle?' · '+ultimo.detalle:'')}</Hint>:null}
  {st.esAdmin&&cargado?<Btn label={ocupado?'Guardando…':'Guardar programación'} variant="primary" disabled={ocupado} onPress={async()=>{
    setOcupado(true);setError('');try{recibir(await guardarEnvioProgramado(c));setGuardado(true);}catch(e:any){setError(e.message);}finally{setOcupado(false);}
  }}/>:null}
  {!cargado?<Btn label="Reintentar conexión" disabled={ocupado} onPress={cargar}/>:null}
 </Stack></Card>;
}
