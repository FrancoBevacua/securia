import React,{useState,useEffect} from 'react';
import {View,Text,ActivityIndicator} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useStore} from '../store';
import {Card,Stack,Input,Btn,Hint,Eyebrow,Banner,Row,Tag,Sheet,useTheme} from '../ui';
import {FONT} from '../theme';
import {Icon} from '../icons';
import RevisarSincronizacion from './RevisarSincronizacion';
import HistorialRecuperacion from './HistorialRecuperacion';

export default function ConfigurarNube(){
 const st=useStore();const [ocupado,setOcupado]=useState(false);const [error,setError]=useState('');
 const t=useTheme();
 const guardando=ocupado||st.nube.guardando;
 const problema=error||st.nube.error;
 useEffect(()=>{if(!st.nube.pendiente&&!st.nube.error)setError('');},[st.nube.pendiente,st.nube.error]);
 return <Card pad><Stack gap={18}><Row><View style={{width:42,height:42,borderRadius:14,backgroundColor:t.accentSoft,alignItems:'center',justifyContent:'center'}}><Icon name="share" color={t.accent} size={21}/></View><View style={{flex:1}}><Eyebrow>Sincronización</Eyebrow><Hint>Consultá el estado de los datos compartidos.</Hint></View></Row>
  {st.nube.vinculada ? <>
   <Row><Tag kind={problema?'warn':guardando?'info':st.nube.pendiente?'warn':'ok'} label={guardando?'Sincronizando':problema?'Requiere atención':st.nube.pendiente?'Cambios pendientes':st.nube.ultima?'Al día':'Conectado'}/></Row>
   <Hint>{st.nube.pendiente?'Tus cambios están guardados en este teléfono y esperan confirmación de la nube.':st.nube.ultima?'Última sincronización: '+new Date(st.nube.ultima).toLocaleString():'La información se consulta al iniciar sesión.'}</Hint>
   <Btn label={guardando?'Sincronizando…':'Sincronizar ahora'} icon="share" variant="primary" disabled={guardando} onPress={async()=>{setOcupado(true);setError('');try{await st.reintentarNube();}catch(e:any){setError(e.message);}finally{setOcupado(false);}}} />
  </> : <>
   <Hint>La conexión corporativa se realiza automáticamente al iniciar sesión. Cree su cuenta con DNI y PIN. El rol de administrador se asigna desde la base de datos, sin impedir el registro ni el ingreso.</Hint>
  </>}
  {problema ? <Banner kind="warn">{problema}</Banner>:null}
  <RevisarSincronizacion habilitado={st.nube.pendiente&&!st.nube.reautenticar}/>
  {st.nube.vinculada?<HistorialRecuperacion/>:null}
 </Stack></Card>;
}
export function EstadoSincronizacion(){
 const st=useStore();const t=useTheme();const ins=useSafeAreaInsets();const [error,setError]=useState('');const [pin,setPin]=useState('');const [renovando,setRenovando]=useState(false);
 const [detalle,setDetalle]=useState(false);
 useEffect(()=>{if(!st.me)setDetalle(false);},[st.me]);
 useEffect(()=>{if(!st.nube.pendiente&&!st.nube.error&&!st.errorGuardado)setError('');},[st.nube.pendiente,st.nube.error,st.errorGuardado]);
 const mostrarAviso=!!st.me&&!!(st.errorGuardado||(st.nube.vinculada&&(st.nube.guardando||st.nube.pendiente||st.nube.error||error)));
 const problema=st.errorGuardado||st.nube.error||error;
 const reintentar=async()=>{setError('');try{await st.reintentarNube();}catch(e:any){setError(e.message);}};
 return <>
  {mostrarAviso?<View accessibilityLiveRegion="polite" style={{paddingHorizontal:16,paddingTop:ins.top+8,paddingBottom:10,backgroundColor:problema?t.warnSoft:t.surface,borderBottomWidth:1,borderBottomColor:t.line}}>
   <Row>{st.nube.guardando?<ActivityIndicator color={t.accent}/>:<Icon name={problema?'alerta':'clock'} color={problema?t.warn:t.accent} size={20}/>}
    <Text numberOfLines={2} style={{flex:1,fontFamily:FONT.bodySemi,fontSize:13,color:problema?t.warn:t.text}}>{st.errorGuardado?'No se pudo guardar':st.nube.guardando?'Sincronizando…':st.nube.reautenticar?'Renová tu sesión':problema?'Sincronización pendiente':'Guardado en el teléfono'}</Text>
    <Btn label="Ver" accessibilityLabel="Ver estado de sincronización" size="xs" onPress={()=>setDetalle(true)}/>
   </Row>
  </View>:null}
  <Sheet visible={detalle} title="Estado de sincronización" onClose={()=>{setDetalle(false);setPin('');}}>
   {problema?<Banner kind="warn">{problema}</Banner>:<Hint>{st.nube.guardando?'Enviando los cambios a la nube…':'Los cambios están guardados en el teléfono y se enviarán al recuperar la conexión.'}</Hint>}
   {st.nube.reautenticar?<Stack gap={12}>
    <Input label="Su PIN para renovar la sesión" value={pin} onChangeText={setPin} secureTextEntry keyboardType="number-pad" maxLength={6}/>
    <Btn label={renovando?'Verificando…':'Renovar sesión'} variant="primary" disabled={renovando} onPress={async()=>{setRenovando(true);setError('');try{await st.ingresarNube(st.me!.dni!,pin);setPin('');setDetalle(false);}catch(e:any){setError(e.message);}finally{setRenovando(false);}}}/>
   </Stack>:<Btn label={st.nube.guardando?'Sincronizando…':'Reintentar'} variant="primary" disabled={st.nube.guardando} onPress={reintentar}/>}
   <RevisarSincronizacion habilitado={detalle&&st.nube.pendiente&&!st.nube.reautenticar}/>
  </Sheet>
 </>;
}
