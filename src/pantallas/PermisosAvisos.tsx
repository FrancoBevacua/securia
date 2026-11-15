import React,{useEffect,useState} from 'react';
import {AppState,Platform} from 'react-native';
import {router} from 'expo-router';
import {ANTICIPO_MIN,abrirAjustesAvisos,estadoPermisosAvisos} from '../avisos';
import {useStore} from '../store';
import {Banner,Btn,Card,Pantalla,SubCabecera,Toggle,useToast} from '../ui';

export default function PermisosAvisos(){
  const {avisos,setAvisos}=useStore();
  const toast=useToast();
  const [permisos,setPermisos]=useState<Awaited<ReturnType<typeof estadoPermisosAvisos>>>();
  const comprobar=async(pedir=false)=>{
    try{const p=await estadoPermisosAvisos(pedir);setPermisos(p);return p;}
    catch{toast('No se pudo consultar el permiso de notificaciones.');}
  };
  useEffect(()=>{
    if(Platform.OS==='web')return;
    void comprobar();
    const sub=AppState.addEventListener('change',estado=>{if(estado==='active')void comprobar();});
    return()=>sub.remove();
  },[]);
  const abrir=(tipo:'app'|'canal'|'exactas')=>abrirAjustesAvisos(tipo).catch(()=>toast('No se pudo abrir la configuración del teléfono.'));

  return <Pantalla top>
    <SubCabecera titulo="Avisos de directivas" onBack={()=>router.back()}/>
    {Platform.OS==='web'?<Banner kind="info">Los recordatorios se programan en la app instalada en el teléfono.</Banner>:<>
      <Card pad><Toggle label="Recordatorios de directivas" value={avisos} sub={`Un aviso ${ANTICIPO_MIN} minutos antes y otro a la hora de cada tarea.`}
        onChange={async v=>{if(v)await comprobar(true);setAvisos(v);}}/></Card>
      {avisos&&permisos&&!permisos.permitido?<><Banner kind="warn">El teléfono tiene bloqueadas las notificaciones de Securia.</Banner>
        <Btn label="Permitir notificaciones" onPress={async()=>{const p=await comprobar(true);if(p?.permitido)setAvisos(true);else if(p)await abrir('app');}}/></>:null}
      {avisos&&permisos?.permitido&&!permisos.canal?<><Banner kind="warn">El canal Directivas del turno está desactivado.</Banner>
        <Btn label="Habilitar el canal" onPress={()=>abrir('canal')}/></>:null}
      {avisos&&permisos?.permitido&&permisos.canal&&!permisos.exactas?<><Banner kind="warn">Android puede demorar los avisos. Para recibirlos a horario, habilitá Alarmas y recordatorios para Securia.</Banner>
        <Btn label="Habilitar alarmas y recordatorios" variant="primary" onPress={()=>abrir('exactas')}/></>:null}
      {avisos&&permisos?.permitido&&permisos.canal&&permisos.exactas?
        <Banner kind="info">Los permisos para los avisos de directivas están habilitados.</Banner>:null}
    </>}
  </Pantalla>;
}
