import {Linking, Platform} from 'react-native';
import {requireOptionalNativeModule} from 'expo';
import * as Notifications from 'expo-notifications';
import {Estado, Vigilador, addDays, isoDate, parseISO, toMin} from './model';
import {directivasDeHoy, franjaPorId} from './logic';

export const ANTICIPO_MIN = 10;
const CANAL = 'directivas';
const PREFIJO = 'securia.directivas.';
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

function planificarAvisos(S:Estado,me:Vigilador,ahora=new Date()){
  const fechas=new Map<number,Aviso[]>();
  const hechos=new Set(S.dlogs.filter(l=>!l.deleted).map(l=>l.fecha+'/'+l.directiveId));
  const desde=isoDate(ahora);
  for(let dia=0;dia<(android?7:2);dia++){
    const fecha=addDays(desde,dia);
    for(const d of directivasDeHoy(S,me,fecha)){
      const min=toMin(d.hora);
      if(min<0||hechos.has(fecha+'/'+d.id))continue;
      const cuando=parseISO(fecha);
      cuando.setHours(Math.floor(min/60),min%60,0,0);
      for(const anticipo of [ANTICIPO_MIN,0]){
        const hora=cuando.getTime()-anticipo*60000;
        if(hora<=ahora.getTime())continue;
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
  return [...fechas.entries()].sort(([a],[b])=>a-b).slice(0,android?400:60);
}

let programacion:Promise<number>=Promise.resolve(0);

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
    const plan=activo&&me?planificarAvisos(S,me):[];
    const deseados=new Set(plan.map(([hora])=>PREFIJO+hora));
    const fr=me?franjaPorId(S,me.franjaId):undefined;
    const subtitle=fr?.alias||fr?.nombre;
    for(const a of propios){
      if(!vigente())return 0;
      if(!deseados.has(a.identifier))await Notifications.cancelScheduledNotificationAsync(a.identifier);
    }
    for(const [hora,grupo] of plan){
      if(!vigente())return 0;
      const identifier=PREFIJO+hora;
      const title=grupo.length===1?grupo[0].titulo:'Directivas del turno';
      const body=grupo.length===1?grupo[0].texto:grupo.map(a=>a.titulo+' · '+a.texto).join('\n');
      const prev=guardados.get(identifier)?.content;
      if(prev?.title===title&&prev.body===body&&(prev.subtitle||undefined)===subtitle&&prev.data?.exactas===exactas)continue;
      await Notifications.scheduleNotificationAsync({
        identifier,
        content:{title,body,subtitle,sound:'default',data:{exactas}},
        trigger:{type:Notifications.SchedulableTriggerInputTypes.DATE,date:hora,channelId:android?CANAL:undefined},
      });
    }
    return deseados.size;
  });
  return programacion;
}
