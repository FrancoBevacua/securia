import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { FONT } from '../theme';
import { Input, useTheme } from '../ui';
import SugerenciasTexto from './SugerenciasTexto';

export default function MotivoAcceso({ activo, valor, tipo, onToggle, onChange, sugerencias=[] }: {
  activo: boolean;
  valor: string;
  tipo: 'apertura' | 'cierre';
  onToggle: (activo: boolean) => void;
  onChange: (valor: string) => void;
  sugerencias?: string[];
}) {
  const t = useTheme();
  return <View style={{ gap: 12 }}>
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: activo }}
      accessibilityLabel="Agregar motivo" accessibilityHint="Muestra un campo para explicar la apertura o el cierre."
      onPress={() => onToggle(!activo)} style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52,
        padding: 14, borderRadius: 14, borderWidth: 1,
        backgroundColor: activo ? t.accentSoft : t.surface2,
        borderColor: activo ? t.accentLine : t.line, opacity: pressed ? 0.8 : 1,
      })}>
      <View accessible={false} style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 2,
        borderColor: activo ? t.accent : t.lineStrong, backgroundColor: activo ? t.accent : t.surface,
        alignItems: 'center', justifyContent: 'center' }}>
        {activo ? <Text style={{ color: t.accentInk, fontSize: 17, fontWeight: '700' }}>✓</Text> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: FONT.bodyMed, fontSize: 15, color: t.text }}>Agregar motivo</Text>
        <Text style={{ fontFamily: FONT.body, fontSize: 12, lineHeight: 18, color: t.muted }}>Explique por qué se realizó este movimiento.</Text>
      </View>
    </Pressable>
    {activo ? <><Input label={tipo === 'apertura' ? 'Motivo de la apertura' : 'Motivo del cierre'}
      value={valor} onChangeText={onChange} multiline rows={3} fixedHeight
      placeholder={tipo === 'apertura' ? 'Para el ingreso del personal de limpieza' : 'Por finalización de las tareas de limpieza'} /><SugerenciasTexto opciones={sugerencias} onElegir={onChange}/></> : null}
  </View>;
}
