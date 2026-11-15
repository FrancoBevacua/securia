import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useStore } from '../store';
import { FONT, R } from '../theme';
import { useTheme, Pantalla, Cabecera, Btn, Tile, Row, Eyebrow, Card, useToast } from '../ui';
import { Icon } from '../icons';
import { guardiasDelCorporativo } from '../corporativo';

export default function Mas() {
  const st = useStore();
  const t = useTheme();
  const toast=useToast();
  const gs = st.me?.corporativo ? guardiasDelCorporativo(st.S,st.me).length : st.list('guards').filter(g=>!g.corporativo).length;
  const ir = (r: string) => () => router.push(r as any);

  return (
    <Pantalla>
      <Cabecera titulo="Más" sub={(st.S.site.cliente || 'Puesto') + (st.S.site.region ? ' · Región ' + st.S.site.region : '')} />

      <Eyebrow>Prioridad del servicio</Eyebrow>
      <Tile icon="libro" titulo="Libro de novedades" sub="Revisar novedades y exportar el informe" onPress={ir('/informedia')} />

      {st.esAdmin ? (
        <Pressable onPress={ir('/admin')} style={({ pressed }) => ({
          padding: 14, borderRadius: R.md, borderWidth: 1,
          backgroundColor: t.accentSoft, borderColor: t.accentLine, opacity: pressed ? 0.75 : 1,
        })}>
          <Row gap={12}>
            <Icon name="ajustes" size={22} color={t.accent} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: FONT.disp, fontSize: 17, color: t.text }}>Administración</Text>
              <Text style={{ fontFamily: FONT.body, fontSize: 11.5, color: t.muted }}>
                Puestos, directivas, roles y catálogos
              </Text>
            </View>
            <Icon name="back" size={17} color={t.accent} />
          </Row>
        </Pressable>
      ) : null}

      <Eyebrow>Operación</Eyebrow>
      <Tile icon="ronda" titulo="Recorridos" sub="Control de locales, Playa y Ronda Nocturna" onPress={ir('/recorridos')}/>
      <Tile icon="equipo" titulo="Ingresos/Egresos" sub="Vigiladores, adicionales y externos" onPress={ir('/ingresos')}/>
      <Row gap={10} style={{ alignItems: 'stretch' }}>
        <Tile icon="informes" titulo="Informes de seguridad" sub="Registrar un incidente" onPress={ir('/informes')} />
      </Row>
      {st.esAdmin?<Tile icon="directivas" titulo="Directivas" sub="Administrar y cargar el documento del puesto" onPress={ir('/directivas')} />:null}

      
      <Eyebrow>Puesto</Eyebrow>
      <Tile icon="bell" titulo="Avisos de directivas" sub="Recordatorios y permisos del teléfono" onPress={ir('/avisos')}/>
      <Row gap={10} style={{ alignItems: 'stretch' }}>
        <Tile icon="equipo" titulo="Equipo" sub={gs + (gs === 1 ? ' vigilador' : ' vigiladores')} onPress={ir('/equipo')} />
        <Tile icon="contactos" titulo="Contactos" sub="Teléfonos de emergencia" onPress={ir('/contactos')} />
      </Row>
      {st.esAdmin?<Row gap={10} style={{ alignItems: 'stretch' }}>
        <Tile icon="perfil" titulo="PIN corporativos" sub="Accesos por puesto" onPress={ir('/cuenta-corporativo')} />
        <Tile icon="ajustes" titulo="Ajustes" sub="Site, tema y respaldo" onPress={ir('/ajustes')} />
      </Row>:null}

      <Btn label="Cerrar sesión" variant="ghost" onPress={async () => {try{await st.salir();}catch(e:any){toast(e.message);}}} />
    </Pantalla>
  );
}
