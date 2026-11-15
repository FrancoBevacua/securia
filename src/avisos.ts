import {Linking, Platform} from 'react-native';
import {requireOptionalNativeModule} from 'expo';
import * as Notifications from 'expo-notifications';
import {Estado, Vigilador, addDays, isoDate, parseISO, toMin} from './model';
import {directivasDeHoy, franjaPorId} from './logic';
import {horaValida} from './servicio';

export const ANTICIPO_MIN = 10;
const CANAL = 'directivas';
const PREFIJO = 'securia.directivas.';
const PRUEBA = 'securia.aviso-prueba';
const MARGEN_ENTREGA_MS = 20*60*1000;
const android = Platform.OS === 'android';
const nativo = android ? requireOptionalNativeModule<{
  puedeProgramarExactas():Promise<boolean>;
  canalHabilitado(canal:string):Promise<boolean>;
  abrirAjustesAvisos(exactas:boolean,canal:string):Promise<void>;
}>('SecuriaAvisos') : null;

let handlerListo = false;
export function prepararAvisos() {
  if (handlerListo || Platform.OS === 'web') return;
  handlerListo = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function permisoAvisos(pedir=false):Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (android) {
    await Notifications.setNotificationChannelAsync(CANAL, {
      name: 'Directivas del turno',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
    });
  }
  let permiso = await Notifications.getPermissionsAsync();
  if (pedir && !permiso.granted && permiso.canAskAgain) {
    permiso = await Notifications.requestPermissionsAsync();
  }
  return permiso.granted || permiso.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

export async function estadoPermisosAvisos(pedir=false) {
  const permitido=await permisoAvisos(pedir);
  const canal=nativo?await nativo.canalHabilitado(CANAL):true;
  const exactas=nativo?await nativo.puedeProgramarExactas():true;
  return {permitido,canal,exactas};
}

export async function abrirAjustesAvisos(tipo:'app'|'canal'|'exactas'){
  if(nativo&&tipo!=='app')await nativo.abrirAjustesAvisos(tipo==='exactas',CANAL);
  else await Linking.openSettings();
}

type Aviso={titulo:string;texto:string};

export function perfilAvisos(S:Estado,responsable:Vigilador|null,cuenta:Vigilador|null){
  if(!responsable)return null;
  const franja=franjaPorId(S,responsable.franjaId);
  const puestoId=responsable.puestoId||franja?.puestoId||cuenta?.puestoId||'';
  const turnos=S.franjas.filter(f=>!f.deleted&&f.puestoId===puestoId);
  // Un turno de otro puesto nunca debe excluir las tareas del puesto actual.
  const franjaId=turnos.find(f=>f.id===responsable.franjaId)?.id||
    turnos.find(f=>f.id===cuenta?.franjaId)?.id||(turnos.length===1?turnos[0].id:'');
  return {...responsable,puestoId,franjaId};
}

function planificarAvisos(S:Estado,me:Vigilador,ahora:number){
  const fechas=new Map<number,Aviso[]>();
  const hechos=new Set(S.dlogs.filter(l=>!l.deleted).map(l=>l.fecha+'/'+l.directiveId));
  const desde=isoDate(new Date(ahora));
  for(let dia=-1;dia<(android?7:2);dia++){
    const fecha=addDays(desde,dia);
    for(const d of directivasDeHoy(S,me,fecha)){
      if(!horaValida(d.hora)||hechos.has(fecha+'/'+d.id))continue;
      const min=toMin(d.hora);
      const cuando=parseISO(fecha);
      cuando.setHours(Math.floor(min/60),min%60,0,0);
      for(const anticipo of [ANTICIPO_MIN,0]){
        const hora=cuando.getTime()-anticipo*60000;
        if(hora<=ahora-MARGEN_ENTREGA_MS)continue;
        const aviso={
          titulo:(anticipo?'En '+anticipo+' minutos':'Ahora')+' · '+d.hora,
          texto:d.nombre+(d.novedades?'\n'+d.novedades:''),
        };
        const grupo=fechas.get(hora)||[];
        grupo.push(aviso);
        fechas.set(hora,grupo);
      }
    }
  }
  return [...fechas.entries()].sort(([a],[b])=>a-b);
}

let programacion:Promise<number>=Promise.resolve(0);
let restaurado=false;
const observadores=new Set<()=>void>();

export function escucharProgramacion(observador:()=>void){
  observadores.add(observador);
  return ()=>{observadores.delete(observador);};
}

export function reprogramarAvisos(
  S:Estado,me:Vigilador|null,activo:boolean,exactas=true,vigente=()=>true,
):Promise<number>{
  if(Platform.OS==='web')return Promise.resolve(0);
  // El sistema conserva la programación aunque se cierre la aplicación.
  // Serializar las actualizaciones evita que el relevo deje avisos del perfil anterior.
  programacion=programacion.catch(()=>0).then(async()=>{
    if(!vigente())return 0;
    const anteriores=await Notifications.getAllScheduledNotificationsAsync();
    if(!vigente())return 0;
    const propios=anteriores.filter(a=>a.identifier.startsWith(PREFIJO)||a.content.data?.directivaId);
    const guardados=new Map(propios.map(a=>[a.identifier,a]));
    const ahora=Date.now();
    const plan=activo&&me?planificarAvisos(S,me,ahora):[];
    const atrasados=plan.filter(([hora])=>hora<=ahora);
    const futuros=plan.filter(([hora])=>hora>ahora).slice(0,(android?400:60)-atrasados.length);
    const deseados=new Set(futuros.map(([hora])=>PREFIJO+hora));
    const fr=me?franjaPorId(S,me.franjaId):undefined;
    const subtitle=fr?.alias||fr?.nombre;
    const volverARegistrar=android&&!restaurado;
    const contenido=(grupo:Aviso[])=>({
      title:grupo.length===1?grupo[0].titulo:'Directivas del turno',
      body:grupo.length===1?grupo[0].texto:grupo.map(a=>a.titulo+' · '+a.texto).join('\n'),
    });
    const coincide=(hora:number,grupo:Aviso[])=>{
      const prev=guardados.get(PREFIJO+hora)?.content;
      const {title,body}=contenido(grupo);
      return prev?.title===title&&prev.body===body&&(prev.subtitle||undefined)===subtitle;
    };
    // Android puede entregar un aviso después de su hora si el equipo estaba en reposo.
    for(const [hora,grupo] of atrasados)if(coincide(hora,grupo))deseados.add(PREFIJO+hora);
    for(const a of propios){
      if(!vigente())return 0;
      if(!deseados.has(a.identifier))await Notifications.cancelScheduledNotificationAsync(a.identifier);
    }
    for(const [hora,grupo] of futuros){
      if(!vigente())return 0;
      const identifier=PREFIJO+hora;
      if(!volverARegistrar&&coincide(hora,grupo)&&guardados.get(identifier)?.content.data?.exactas===exactas)continue;
      await Notifications.scheduleNotificationAsync({
        identifier,
        content:{...contenido(grupo),subtitle,sound:'default',data:{exactas}},
        trigger:{type:Notifications.SchedulableTriggerInputTypes.DATE,date:hora,channelId:android?CANAL:undefined},
      });
    }
    if(futuros.length&&vigente())restaurado=true;
    return futuros.length;
  });
  const publicar=()=>observadores.forEach(f=>f());
  void programacion.then(publicar,publicar);
  return programacion;
}

export async function avisosProgramados(){
  await programacion;
  const ahora=Date.now();
  return (await Notifications.getAllScheduledNotificationsAsync())
    .filter(a=>a.identifier.startsWith(PREFIJO))
    .map(a=>({id:a.identifier,hora:Number(a.identifier.slice(PREFIJO.length)),texto:a.content.body||''}))
    .filter(a=>Number.isFinite(a.hora)&&a.hora>ahora)
    .sort((a,b)=>a.hora-b.hora);
}

export async function programarAvisoDePrueba(){
  const hora=Date.now()+60_000;
  await Notifications.scheduleNotificationAsync({
    identifier:PRUEBA,
    content:{title:'Prueba de Securia',body:'El teléfono recibió el aviso de prueba.',sound:'default'},
    trigger:{type:Notifications.SchedulableTriggerInputTypes.DATE,date:hora,channelId:android?CANAL:undefined},
  });
  return hora;
}
