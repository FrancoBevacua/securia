import React, { useEffect, useState } from 'react';
import { AppState, Platform, Text, View } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FONT } from '../theme';
import { Banner, Btn, useTheme, useToast } from '../ui';

type EstadoRed = 'PERMITIDA' | 'PUBLICA' | 'SIN_VERIFICAR';
const nativo = Platform.OS === 'android' ? requireOptionalNativeModule<{
  estado(): EstadoRed;
  abrirAjustes(): Promise<void>;
  addListener(evento: 'cambioRed', listener: () => void): { remove(): void };
}>('SecuriaRed') : null;

export default function AvisoRed() {
  const t = useTheme();
  const toast = useToast();
  const { top } = useSafeAreaInsets();
  const [estado, setEstado] = useState(() => nativo?.estado());
  useEffect(() => {
    if (!nativo) return;
    const actualizar = () => setEstado(nativo.estado());
    const red = nativo.addListener('cambioRed', actualizar);
    const app = AppState.addEventListener('change', s => { if (s === 'active') actualizar(); });
    actualizar();
    return () => { red.remove(); app.remove(); };
  }, []);
  if (!nativo || !estado || estado === 'PERMITIDA') return null;

  const mensaje = estado === 'PUBLICA'
    ? 'Por motivos de seguridad, Securia no permite el uso de redes Wi‑Fi públicas o sin protección.'
    : 'Securia no pudo verificar la seguridad de esta red Wi‑Fi. Las funciones en línea están suspendidas.';
  return (
    <View accessibilityLiveRegion="polite" style={{ backgroundColor: t.bg, paddingTop: top + 6, paddingHorizontal: 14 }}>
      <Banner kind="warn">
        <Text style={{ color: t.warn, fontFamily: FONT.bodySemi, fontSize: 13, lineHeight: 19 }}>{mensaje}</Text>
        <Text style={{ color: t.text2, fontFamily: FONT.body, fontSize: 12, lineHeight: 18, marginVertical: 3 }}>
          Para continuar en línea, conéctese a una red privada de confianza o utilice los datos móviles.
        </Text>
        <Btn label="Cambiar conexión" size="sm" onPress={() => {
          void nativo.abrirAjustes().catch(() => toast('Abra los ajustes de red del dispositivo para cambiar de conexión.'));
        }} />
      </Banner>
    </View>
  );
}
