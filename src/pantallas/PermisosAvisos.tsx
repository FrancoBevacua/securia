import React,{useCallback,useState} from 'react';
import {AppState,Platform} from 'react-native';
import {router,useFocusEffect} from 'expo-router';
import {ANTICIPO_MIN,abrirAjustesAvisos,avisosProgramados,escucharProgramacion,estadoPermisosAvisos,perfilAvisos,programarAvisoDePrueba} from '../avisos';
import {etiquetaFranja,franjaPorId,nombrePuesto} from '../logic';
import {useStore} from '../store';
import {Banner,Btn,Card,Eyebrow,Hint,Item,Pantalla,SubCabecera,Toggle,useToast} from '../ui';

const fechaAviso=(hora:number)=>new Date(hora).toLocaleString('es-AR',{
  weekday:'short',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false,
});

export default function PermisosAvisos(){
  const {S,me,responsable,avisos,setAvisos}=useStore();
  const toast=useToast();
  const [permisos,setPermisos]=useState<Awaited<ReturnType<typeof estadoPermisosAvisos>>>();
  const [programados,setProgramados]=useState<Awaited<ReturnType<typeof avisosProgramados>>>();
  const [errorAgenda,setErrorAgenda]=useState(false);
  const [horaPrueba,setHoraPrueba]=useState(0);
  const [probando,setProbando]=useState(false);
  const perfil=perfilAvisos(S,responsable,me);
  const puesto=nombrePuesto(S,perfil?.puestoId)||'Sin puesto asignado';
  const turno=etiquetaFranja(franjaPorId(S,perfil?.franjaId))||'Todos los turnos';
  const comprobar=async(pedir=false)=>{
    try{const p=await estadoPermisosAvisos(pedir);setPermisos(p);return p;}
    catch{toast('No se pudo consultar el permiso de notificaciones.');}
  };
  const actualizarAgenda=useCallback(async()=>{
    try{setProgramados(await avisosProgramados());setErrorAgenda(false);}
    catch{setProgramados(undefined);setErrorAgenda(true);}
  },[]);
  useFocusEffect(useCallback(()=>{
    if(Platform.OS==='web')return;
    const actualizar=()=>{
      void estadoPermisosAvisos().then(setPermisos,()=>setPermisos(undefined));
      void actualizarAgenda();
    };
    actualizar();
    const sub=AppState.addEventListener('change',estado=>{if(estado==='active')actualizar();});
    const salir=escucharProgramacion(()=>void actualizarAgenda());
    return()=>{sub.remove();salir();};
  },[actualizarAgenda]));
  const abrir=(tipo:'app'|'canal'|'exactas')=>abrirAjustesAvisos(tipo).catch(()=>toast('No se pudo abrir la configuración del teléfono.'));
  const probar=async()=>{
    setProbando(true);setHoraPrueba(0);
    try{setHoraPrueba(await programarAvisoDePrueba());}
    catch{toast('No se pudo programar el aviso de prueba.');}
    finally{setProbando(false);}
  };

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
      {permisos?.permitido&&permisos.canal?<Btn label={probando?'Programando…':'Probar aviso en 1 minuto'}
        icon="bell" disabled={probando} onPress={probar}/>:null}
      {horaPrueba>Date.now()?<Hint>{`Prueba programada para ${fechaAviso(horaPrueba)}. Bloqueá la pantalla para verificar si llega.`}</Hint>:null}
      {avisos&&perfil?<>
        <Eyebrow>Próximos avisos</Eyebrow>
        <Hint>{puesto+' · '+turno}</Hint>
        {errorAgenda?<Banner kind="warn">No se pudo completar la programación de los avisos.</Banner>:
          programados?.length?<Card>{programados.slice(0,16).map((a,i)=><Item key={a.id} title={fechaAviso(a.hora)}
            subs={[a.texto]} last={i===Math.min(programados.length,16)-1}/>)}</Card>:
          programados?<Hint>Este teléfono no tiene avisos de directivas programados.</Hint>:null}
        <Btn label="Actualizar lista" variant="ghost" onPress={actualizarAgenda}/>
      </>:null}
    </>}
  </Pantalla>;
}
