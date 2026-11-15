import React, { useEffect, useMemo, useState } from 'react';
import { AppState, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { actividadGuardiasDelDia, RegistrosDelDia, TIPOS_ACTIVIDAD, TipoActividad } from '../actividadGuardias';
import { Icon } from '../icons';
import { dmy, isoDate } from '../model';
import { guardiasEnServicio } from '../presencias';
import { useStore } from '../store';
import { FONT } from '../theme';
import { Btn, Card, Empty, Item, Row, Stack, Tag, useTheme } from '../ui';

const MAX_GUARDIAS = 3;

function abrirActividad(fecha: string, tipo?: TipoActividad, guardia?: string) {
  router.push({ pathname: '/actividad-guardia', params: { fecha, tipo, guardia } });
}

function Indicadores({ registros, fecha, guardia }: { registros: RegistrosDelDia; fecha: string; guardia?: { id: string; nombre: string } }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {TIPOS_ACTIVIDAD.map(({ id, titulo, icono }) => (
        <Pressable key={id} accessibilityRole="button"
          accessibilityLabel={[titulo, registros[id].length, guardia?.nombre].filter(v => v !== undefined).join(', ')}
          onPress={() => abrirActividad(fecha, id, guardia?.id)}
          style={({ pressed }) => ({
            flex: 1, minWidth: 0, padding: 8, borderRadius: 12, gap: 5,
            backgroundColor: t.surface2, borderColor: t.line, borderWidth: 1, opacity: pressed ? 0.7 : 1,
          })}>
          <Row gap={6}>
            <Icon name={icono} size={16} color={t.accentText} />
            <Text style={{ color: t.text, fontFamily: FONT.dispBold, fontSize: 23 }}>{registros[id].length}</Text>
          </Row>
          <Text style={{ color: t.text2, fontFamily: FONT.bodySemi, fontSize: 12 }}>{titulo}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function ResumenOperativo() {
  const { S } = useStore();
  const t = useTheme();
  const [ahora, setAhora] = useState(() => new Date());
  const [verTodos, setVerTodos] = useState(false);
  useEffect(() => {
    const actualizar = () => setAhora(new Date());
    const reloj = setInterval(actualizar, 15000);
    const sub = AppState.addEventListener('change', estado => { if (estado === 'active') actualizar(); });
    return () => { clearInterval(reloj); sub.remove(); };
  }, []);
  const fecha = isoDate(ahora);
  const presentes = useMemo(() => guardiasEnServicio(S, ahora).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')), [S, ahora]);
  const actividad = useMemo(() => actividadGuardiasDelDia(S, fecha), [S, fecha]);
  const filas = verTodos ? actividad.guardias : actividad.guardias.slice(0, MAX_GUARDIAS);
  const restantes = actividad.guardias.length - MAX_GUARDIAS;
  const encabezado = { color: t.text, fontFamily: FONT.bodySemi, fontSize: 17 };

  return (
    <Stack gap={16}>
      <Stack gap={8}>
        <Row>
          <Icon name="equipo" size={20} color={t.accentText} />
          <Text accessibilityRole="header" style={[encabezado, { flex: 1 }]}>Guardias en servicio</Text>
          <Tag label={String(presentes.length)} kind={presentes.length ? 'ok' : 'mute'} />
        </Row>
        <Card>
          {presentes.length ? presentes.map((g, i) => (
            <Item key={g.id} title={g.nombre}
              subs={[[g.puesto, g.ingreso && 'Ingreso ' + g.ingreso + (g.fecha !== fecha ? ' · ' + dmy(g.fecha) : '')].filter(Boolean).join(' · ')]}
              last={i === presentes.length - 1} stripe="ok" right={<Icon name="siguiente" size={16} color={t.muted} />}
              onPress={() => abrirActividad(fecha, undefined, g.id)} />
          )) : <Empty>No figuran guardias en servicio.</Empty>}
        </Card>
      </Stack>
      <Stack gap={8}>
        <Row>
          <Text accessibilityRole="header" style={[encabezado, { flex: 1 }]}>Actividad de hoy</Text>
          <Tag label={dmy(fecha)} kind="info" />
        </Row>
        <Indicadores registros={actividad.total} fecha={fecha} />
        {filas.map(g => (
          <Card pad key={g.id}>
            <Stack gap={8}>
              <Row gap={8}>
                <Icon name="perfil" size={17} color={t.accentText} />
                <Text style={{ flex: 1, color: t.text, fontFamily: FONT.bodySemi, fontSize: 15 }}>{g.nombre}</Text>
              </Row>
              <Indicadores registros={g.registros} fecha={fecha} guardia={g} />
            </Stack>
          </Card>
        ))}
        {restantes > 0 ? <Btn label={verTodos ? 'Ver menos guardias' : 'Ver todos los guardias con actividad'} variant="ghost" onPress={() => setVerTodos(v => !v)} /> : null}
      </Stack>
    </Stack>
  );
}
