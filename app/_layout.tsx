import React, { useEffect, useRef, useState } from 'react';
import { View, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import {
  IBMPlexSans_400Regular, IBMPlexSans_500Medium, IBMPlexSans_600SemiBold, IBMPlexSans_700Bold,
} from '@expo-google-fonts/ibm-plex-sans';
import { IBMPlexMono_400Regular, IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import { SairaCondensed_600SemiBold, SairaCondensed_700Bold } from '@expo-google-fonts/saira-condensed';

import { AppState } from 'react-native';
import { StoreProvider, useStore } from '../src/store';
import { prepararAvisos, estadoPermisosAvisos, reprogramarAvisos } from '../src/avisos';
import { ThemeProvider, ToastHost, useTheme, Banner, Btn } from '../src/ui';
import Gate from '../src/pantallas/Gate';
import Presentacion, { AZUL_PRESENTACION } from '../src/pantallas/Presentacion';
import Barrera from '../src/Barrera';
import { EstadoSincronizacion } from '../src/pantallas/Nube';
import ChatbotFlotante from '../src/pantallas/ChatbotFlotante';
import GuardiaACargo from '../src/pantallas/GuardiaACargo';

SplashScreen.preventAutoHideAsync().catch(() => {});

/* La presentación se mantiene un mínimo de tiempo para que no sea un destello. */
const MINIMO_PRESENTACION = 700;

function ProgramarAvisos(){
  const {listo,me,responsable,S,avisos,errorInicio}=useStore();
  const pedido=useRef(false);
  const puestoId=responsable?.puestoId||me?.puestoId;
  const franjaId=responsable?.franjaId||me?.franjaId;
  useEffect(()=>{prepararAvisos();},[]);
  useEffect(()=>{
    if(!listo||errorInicio||Platform.OS==='web')return;
    let version=0;
    const correr=async()=>{
      const actual=++version;
      const vigente=()=>actual===version;
      const perfil=responsable?{...responsable,puestoId:puestoId||'',franjaId:franjaId||''}:null;
      try{
        const pedir=!!perfil&&avisos&&!pedido.current;
        pedido.current ||= pedir;
        const permisos=perfil&&avisos?await estadoPermisosAvisos(pedir):null;
        if(!vigente())return;
        await reprogramarAvisos(S,perfil,!!(permisos?.permitido&&permisos.canal),permisos?.exactas,vigente);
      }catch(e){console.warn('No se pudieron programar los avisos de directivas', e);}
    };
    void correr();
    const sub=AppState.addEventListener('change',e=>{if(e==='active')void correr();});
    const foco=Platform.OS==='android'?AppState.addEventListener('focus',()=>void correr()):undefined;
    const timer=setInterval(()=>{if(AppState.currentState==='active')void correr();},60*60*1000);
    return()=>{version++;sub.remove();foco?.remove();clearInterval(timer);};
  },[listo,errorInicio,responsable?.id,puestoId,franjaId,avisos,S.directives,S.dlogs,S.franjas]);
  return null;
}

function Raiz() {
  const { listo, me, responsable, errorInicio, reintentarInicio, esAdmin } = useStore();
  const t = useTheme();
  const [tiempoCumplido, setTiempoCumplido] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setTiempoCumplido(true), MINIMO_PRESENTACION);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => { SplashScreen.hideAsync().catch(() => {}); }, []);

  if (!listo || !tiempoCumplido) return <Presentacion />;
  if(errorInicio)return <View style={{flex:1,justifyContent:'center',padding:24,gap:16,backgroundColor:t.bg}}><Banner kind="warn">{errorInicio}</Banner><Btn label="Reintentar inicio" onPress={reintentarInicio}/></View>;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      <ProgramarAvisos/>
      <EstadoSincronizacion />
      {me ? (esAdmin||responsable)?<Stack key={me.id} screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: t.bg } }}>
        <Stack.Protected guard={esAdmin}>
          <Stack.Screen name="admin"/><Stack.Screen name="ajustes"/><Stack.Screen name="admdirectivas"/>
          <Stack.Screen name="puestos"/><Stack.Screen name="importar"/><Stack.Screen name="cuenta-corporativo"/>
        </Stack.Protected>
      </Stack>:<GuardiaACargo/>:<Gate/>}
      {me&&responsable?<ChatbotFlotante key={me.id}/>:null}
    </View>
  );
}

function ConTema() {
  const { tema, paleta } = useStore();
  return (
    <ThemeProvider modo={tema} paleta={paleta}>
      <ToastHost>
        <Raiz />
      </ToastHost>
    </ThemeProvider>
  );
}

export default function Layout() {
  const [limiteFuentes,setLimiteFuentes]=useState(false);
  useEffect(()=>{SplashScreen.hideAsync().catch(()=>{});const timer=setTimeout(()=>setLimiteFuentes(true),2500);return()=>clearTimeout(timer);},[]);
  const [fuentesListas, errorFuentes] = useFonts({
    IBMPlexSans_400Regular, IBMPlexSans_500Medium, IBMPlexSans_600SemiBold, IBMPlexSans_700Bold,
    IBMPlexMono_400Regular, IBMPlexMono_500Medium,
    SairaCondensed_600SemiBold, SairaCondensed_700Bold,
  });

  /* Si las tipografías fallan seguimos con las del sistema: quedarse esperando
     para siempre en una pantalla vacía es peor que perder la tipografía. */
  if (!fuentesListas && !errorFuentes && !limiteFuentes) {
    return (
      <View style={{ flex: 1, backgroundColor: AZUL_PRESENTACION }}>
        <Presentacion />
      </View>
    );
  }

  return (
    <Barrera>
      <SafeAreaProvider>
        <KeyboardProvider>
        <StoreProvider>
          <ConTema />
        </StoreProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </Barrera>
  );
}
