import React, { useMemo, useState } from 'react';
import { Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { actividadGuardiasDelDia, RegistrosDelDia, TIPOS_ACTIVIDAD, TipoActividad } from '../actividadGuardias';
import { Image } from '../Imagen';
import { AccesoLog, Informe, Novedad, dmy, isoDate } from '../model';
import { categoriaAsiento } from '../reporte';
import { fechaValida } from '../servicio';
import { useStore } from '../store';
import { motivoDeAcceso, resumenAcceso, textoAlogLibro, textoMovimientoBreve } from '../text';
import { FONT } from '../theme';
import { Card, Chip, Chipbar, Empty, Hint, Item, Pantalla, Selector, Sheet, SubCabecera, Tag, useTheme } from '../ui';
import { ContenidoInforme } from './Informes';

type Detalle = { titulo: string; resumen: string; fotos?: string[]; informe?: Informe };
const TODOS = '';

const consulta = {
  novedades(n: Novedad): Detalle {
    return { titulo: categoriaAsiento(n), resumen: textoMovimientoBreve(n.texto || resumenAcceso(n)), fotos: n.fotos };
  },
  accesos(a: AccesoLog): Detalle {
    return { titulo: (a.tipo === 'apertura' ? 'Apertura' : 'Cierre') + ' · ' + a.acceso, resumen: [textoAlogLibro(a), motivoDeAcceso(a)].filter(Boolean).join('\n\n') };
  },
  informes(r: Informe): Detalle {
    return { titulo: r.f4 || 'Informe de seguridad', resumen: r.f6 || '', informe: r };
  },
};

function filas(registros: RegistrosDelDia, tipo: TipoActividad) {
  switch (tipo) {
    case 'novedades': return registros.novedades.map(n => ({ ...consulta.novedades(n), id: n.id, hora: n.hora }));
    case 'accesos': return registros.accesos.map(a => ({ ...consulta.accesos(a), id: a.id, hora: a.hora }));
    case 'informes': return registros.informes.map(r => ({ ...consulta.informes(r), id: r.id, hora: r.hora }));
  }
}

export default function ActividadGuardia() {
  const { S, esAdmin } = useStore();
  const t = useTheme();
  const params = useLocalSearchParams<{ fecha?: string; guardia?: string; tipo?: string }>();
  const fecha = params.fecha && fechaValida(params.fecha) ? params.fecha : isoDate();
  const { guardias, total } = useMemo(() => actividadGuardiasDelDia(S, fecha), [S, fecha]);
  const [guardia, setGuardia] = useState(params.guardia || TODOS);
  const [tipo, setTipo] = useState<TipoActividad>(() => {
    const elegido = TIPOS_ACTIVIDAD.find(x => x.id === params.tipo);
    const registros = guardias.find(g => g.id === guardia)?.registros;
    return elegido?.id || TIPOS_ACTIVIDAD.find(x => registros?.[x.id].length)?.id || 'novedades';
  });
  const [registro, setRegistro] = useState<string>();
  if (!esAdmin) return null;

  const seleccion = guardias.find(g => g.id === guardia);
  const perfil = S.guards.find(g => g.id === guardia);
  const nombre = seleccion?.nombre || [perfil?.nombre, perfil?.apellido].filter(Boolean).join(' ') || 'Guardia sin identificar';
  const opcionesGuardia = [{ v: TODOS, t: 'Todos los guardias' }, ...guardias.map(g => ({ v: g.id, t: g.nombre }))];
  if (guardia && !seleccion) opcionesGuardia.push({ v: guardia, t: nombre });
  const registros = guardia === TODOS ? total : seleccion?.registros;
  const gruposVisibles = guardia === TODOS ? guardias : guardias.filter(g => g.id === guardia);
  const registrosVisibles = gruposVisibles.flatMap(g => filas(g.registros, tipo).map(r => ({ ...r, guardia: g.nombre })))
    .sort((a, b) => (b.hora || '').localeCompare(a.hora || ''));
  const detalle = registrosVisibles.find(r => r.id === registro);
  return (
    <Pantalla top>
      <SubCabecera titulo="Actividad del día" sub={dmy(fecha)} onBack={() => router.back()} />
      <Selector label="Guardia" valor={guardia} opciones={opcionesGuardia} onChange={setGuardia} />
      <Chipbar>
        {TIPOS_ACTIVIDAD.map(c => <Chip key={c.id} label={c.titulo + ' · ' + (registros?.[c.id].length ?? 0)} on={tipo === c.id} onPress={() => { setTipo(c.id); setRegistro(undefined); }} />)}
      </Chipbar>
      <Card>
        {registrosVisibles.length ? registrosVisibles.map((r, i) => (
          <Item key={r.id} lead={r.hora} title={r.titulo} subs={[guardia === TODOS ? r.guardia : null, r.resumen]}
            last={i === registrosVisibles.length - 1}
            right={r.informe?.estado === 'borrador' ? <Tag kind="info" label="Borrador" /> : undefined}
            onPress={() => setRegistro(r.id)} />
        )) : <Empty>Sin registros de esta categoría para la selección.</Empty>}
      </Card>
      <Sheet visible={!!detalle} title={detalle?.titulo || 'Detalle'} onClose={() => setRegistro(undefined)}>
        {detalle ? <>
          <Hint>{[detalle.guardia, dmy(fecha), detalle.hora, detalle.informe?.estado === 'borrador' && 'Borrador'].filter(Boolean).join(' · ')}</Hint>
          {detalle.informe ? <ContenidoInforme key={detalle.id} informe={detalle.informe} /> : <>
            <Text selectable style={{ color: t.text, fontFamily: FONT.body, fontSize: 15, lineHeight: 23 }}>{detalle.resumen}</Text>
            {detalle.fotos?.map((uri, i) => <Image key={i} source={{ uri }} style={{ height: 240, width: '100%' }} resizeMode="contain" />)}
          </>}
        </> : null}
      </Sheet>
    </Pantalla>
  );
}
