/* Pantalla de presentación: la marca sobre azul profundo mientras arranca la app.
   Reemplaza el destello en blanco que dejaba el arranque anterior. */
import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing, StatusBar } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { FONT } from '../theme';
import {LogoVigelium,LEMA_APP} from '../Marca';

export const AZUL_PRESENTACION = '#06142D';
const ROJO = '#D42D41';

export function EscudoMarca({ size = 96 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M4.6 4.6a1.5 1.5 0 0 1 1.5-1.5h11.8a1.5 1.5 0 0 1 1.5 1.5V12c0 4.6-4.4 7.6-7.4 9.1C9 19.6 4.6 16.6 4.6 12Z"
        fill={ROJO}
      />
      <Path
        d="m8.4 12 2.5 2.7 4.7-5"
        stroke={AZUL_PRESENTACION}
        strokeWidth={2.1}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

export default function Presentacion({ sub }: { sub?: string }) {
  const op = useRef(new Animated.Value(0)).current;
  const sube = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    const animacion = Animated.parallel([
      Animated.timing(op, { toValue: 1, duration: 460, useNativeDriver: true }),
      Animated.timing(sube, {
        toValue: 0, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
    ]);
    animacion.start();
    return () => animacion.stop();
  }, []);

  return (
    <View style={{
      flex: 1, backgroundColor: AZUL_PRESENTACION,
      alignItems: 'center', justifyContent: 'center', padding: 32,
    }}>
      <StatusBar barStyle="light-content" backgroundColor={AZUL_PRESENTACION} />
      <Animated.View style={{ width:'100%',maxWidth:360,alignItems: 'center', opacity: op, transform: [{ translateY: sube }] }}>
        <LogoVigelium size={104} />
        <Text style={{
          fontFamily: 'SairaCondensed_700Bold', fontSize: 48, lineHeight: 66,textAlign:'center',width:'100%',includeFontPadding:true,
          color: '#FFFFFF', marginTop: 22, letterSpacing: 1,
        }}>
          SECUR<Text style={{color: '#FF7585'}}>IA</Text>
        </Text>
        <Text style={{
          fontFamily: FONT.bodyMed, fontSize: 11.5, letterSpacing: 2,
          color: '#8FA6C4', marginTop: 2,textAlign:'center',width:'100%',lineHeight:20,flexWrap:'wrap',
        }}>
          {LEMA_APP}
        </Text>
      </Animated.View>

      <View style={{ position: 'absolute', bottom: 42, left: 24, right: 24, gap: 5 }}>
        {sub ? <Text style={{color: '#8FA6C4', textAlign:'center'}}>{sub}</Text> : null}
        <Text style={{fontSize:12, color:'#B8C9DF', textAlign:'center'}}>Desarrollada por Franco Daniel Bevacua</Text>
        <Text style={{fontSize:10, color:'#8FA6C4', textAlign:'center'}}>© 2026 Franco Daniel Bevacua. Todos los derechos reservados.</Text>
      </View>
    </View>
  );
}
