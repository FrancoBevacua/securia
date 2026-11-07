import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import {Image} from '../Imagen';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useStore } from '../store';
import { rondaActiva } from '../logic';
import { Ronda, RondaTpl, Vigilador, dmy, dmyShort, hhmm, hs, isoDate, toMin, uid } from '../model';
import { gsName } from '../text';
import { FONT, R } from '../theme';
import {
  useTheme, Pantalla, SubCabecera, Card, Btn, Tag, Item, Empty, Stack, Row,
  Input, Sheet, Eyebrow, Hint, Seg, Confirmar, Toggle, useToast,
} from '../ui';
import { Ring } from '../icons';
import SelectorFirma from './SelectorFirma';
import FotosRegistro from './FotosRegistro';
import {segundosRonda,formatoCronometro} from '../rondaNocturna';
function ContenidoRonda({integrado,children}:{integrado:boolean;children:React.ReactNode}){return integrado?<View style={{gap:14}}>{children}</View>:<Pantalla top>{children}</Pantalla>;}

export default function Rondas({integrado=false}:{integrado?:boolean}={}) {
  const st = useStore();
  const t = useTheme();
  const toast = useToast();
  const [tpl, setTpl] = useState<RondaTpl | null | undefined>(undefined);
  const [punto, setPunto] = useState<number | null>(null);
  const [cerrar, setCerrar] = useState(false);
  const [cancelar, setCancelar] = useState(false);
  const [ver, setVer] = useState<Ronda | null>(null);
  const [, tick] = useState(0);
  const [guardando,setGuardando]=useState(false);
  const [cargandoFotos,setCargandoFotos]=useState(false);

  useEffect(() => { const i = setInterval(() => tick(x => x + 1), 1000); return () => clearInterval(i); }, []);

  const activa = rondaActiva(st.S, st.me!.id, st.telefonoId,'puntos');
  const tpls = st.list<RondaTpl>('rtemplates');
  const hist = st.list<Ronda>('rounds').filter(r => r.fin)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 25);

  const texto = (r: Ronda) => {
    const g = st.byId<Vigilador>('guards', r.guardId);
    let x = '*RONDA — ' + r.nombre.toUpperCase() + '*\n' + dmy(r.fecha) + ' · ' +
      r.inicio + ' a ' + (r.fin || '—') + '\n' + gsName(g, st.S.site) + '\n\n';
    r.puntos.forEach(p => {
      x += (p.hora || '--:--') + ' ' + p.n + (p.estado === 'nov' ? ' — CON NOVEDAD' : ' — sin novedad') + '\n' +
        (p.obs ? p.obs + '\n' : '');
    });
    return x.trim();
  };

  /* ---------- ronda en curso ---------- */
  if (activa) {
    const hechos = activa.puntos.filter(p => p.hora).length;
    const pct = activa.puntos.length?Math.round((hechos / activa.puntos.length) * 100):0;
    const dur=segundosRonda(activa);
    return (
      <ContenidoRonda integrado={integrado}>
        {!integrado?<SubCabecera titulo={activa.nombre} sub={'Ronda en curso desde las ' + activa.inicio}
          onBack={() => router.back()} />:null}
        <Card pad>
          <Row style={{ justifyContent: 'space-between' }}>
            <View>
              <Text style={{ fontFamily: FONT.monoMed, fontSize: 28, letterSpacing: -1, color: t.text }}>{formatoCronometro(dur)}</Text>
              <Hint>{hechos + ' de ' + activa.puntos.length + ' puntos'}</Hint>
            </View>
            <Ring pct={pct} color={t.accent} track={t.surface3} bg={t.surface} label={pct + '%'} font={FONT.monoMed} />
          </Row>
        </Card>
        <Card>
          {activa.puntos.map((p, i) => (
            <Item key={i} last={i === activa.puntos.length - 1}
              stripe={p.estado === 'nov' ? 'crit' : p.hora ? 'ok' : 'mute'}
              lead={p.hora || String(i + 1).padStart(2, '0')}
              title={p.n} subs={[p.obs]}
              right={p.estado === 'nov' ? <Tag label="Con novedad" kind="crit" />
                : p.hora ? <Tag label="OK" kind="ok" /> : undefined}
              onPress={() => setPunto(i)} />
          ))}
        </Card>
        <Card pad><Stack>
          <SelectorFirma label="Guardia que hizo el recorrido" valor={activa.guardId} onChange={guardId=>st.put('rounds',{...activa,createdBy:activa.createdBy||st.me!.id,guardId})}/>
          <FotosRegistro fotos={activa.fotos||[]} onChange={fotos=>st.put('rounds',{...activa,fotos})} disabled={guardando} onBusyChange={setCargandoFotos}/>
          <Hint>Al finalizar se agrega automáticamente a Novedades, en la categoría Recorrido.</Hint>
        </Stack></Card>
        <Row gap={9}>
          <Btn label="Cancelar ronda" variant="ghost" style={{ flex: 1 }} onPress={() => setCancelar(true)} />
          <Btn label={guardando?'Guardando…':'Cerrar ronda'} variant="primary" style={{ flex: 1 }} disabled={guardando||cargandoFotos}
            onPress={async () => {
              setGuardando(true);
              try {
                if(!st.S.guards.some(g=>g.id===activa.guardId&&!g.deleted))throw Error('Seleccione el guardia que hizo el recorrido.');
                const r = { ...activa, fin: hhmm(),fechaFin:isoDate(),alLibro:true };
                st.putVarios([{col:'rounds',obj:r},...(r.alLibro?[{col:'novedades' as const,obj:{id:'ronda:'+r.id,fecha:isoDate(),hora:r.fin,guardId:r.guardId,categoria:'Recorrido',datos:{tipoRecorrido:'nocturna'},texto:texto(r),fotos:r.fotos||[],origenTipo:'recorrido',origenId:r.id}}]:[])]);
                await st.confirmarGuardado();setVer(r);
              }catch(e:any){toast(e.message||'No se pudo guardar el recorrido.');}
              finally{setGuardando(false);}
            }} />
        </Row>

        <MarcarPunto ronda={activa} indice={punto} onClose={() => setPunto(null)} />
        <Confirmar visible={cancelar} etiqueta="Cancelar ronda"
          mensaje="¿Cancelar la ronda en curso? Se pierden los puntos marcados."
          onCancel={() => setCancelar(false)}
          onOk={() => { st.drop('rounds', activa.id); setCancelar(false); }} />
        <VerRonda ronda={ver} texto={texto} onClose={() => setVer(null)} />
      </ContenidoRonda>
    );
  }

  /* ---------- listado ---------- */
  return (
    <ContenidoRonda integrado={integrado}>
      {!integrado?<SubCabecera titulo="Ronda Nocturna" sub="Recorridas con puntos de control y horario de paso."
        onBack={() => router.back()} />:null}

      {tpls.length ? (
        <Card>
          <View style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: t.line }}>
            <Text style={{ fontFamily: FONT.disp, fontSize: 19, color: t.text }}>Iniciar recorrida</Text>
          </View>
          {tpls.map((x, i) => (
            <Item key={x.id} last={i === tpls.length - 1}
              title={x.nombre}
              subs={[x.puntos.length + ' puntos · ' + x.puntos.slice(0, 3).join(', ') + (x.puntos.length > 3 ? '…' : '')]}
              right={
                <>
                  <Btn icon="edit" variant="ghost" size="xs" onPress={() => setTpl(x)} />
                  <Btn label="Iniciar" variant="primary" size="xs" onPress={() => {
                    st.put('rounds', {
                      id: uid(), dispositivoId:st.telefonoId, tipoRecorrido:'puntos', tplId: x.id, nombre: x.nombre, guardId: st.responsable?.id||st.me!.id, createdBy: st.me!.id,alLibro:true,inicioAt:Date.now(),
                      fecha: isoDate(), inicio: hhmm(), fin: '', createdAt: Date.now(),
                      puntos: x.puntos.map(p => ({ n: p, hora: '', estado: '', obs: '' })),
                    });
                    toast('Ronda iniciada');
                  }} />
                </>
              } />
          ))}
        </Card>
      ) : (
        <Card>
          <Empty>Creá un recorrido con sus puntos de control y después lo iniciás con un toque.</Empty>
        </Card>
      )}

      <Btn label="Nuevo recorrido" icon="plus" variant="ghost" onPress={() => setTpl(null)} />

      {hist.length ? (
        <>
          <Eyebrow>Últimas rondas</Eyebrow>
          <Card>
            {hist.map((r, i) => {
              const g = st.byId<Vigilador>('guards', r.guardId);
              const nov = r.puntos.filter(p => p.estado === 'nov').length;
              return (
                <Item key={r.id} last={i === hist.length - 1} stripe={nov ? 'crit' : 'ok'}
                  lead={dmyShort(r.fecha)} title={r.nombre}
                  subs={[r.inicio + '–' + r.fin + ' · ' + (g ? g.apellido : '')]}
                  right={nov ? <Tag label={nov + ' nov.'} kind="crit" /> : <Tag label="Sin novedad" kind="ok" />}
                  onPress={() => setVer(r)} />
              );
            })}
          </Card>
        </>
      ) : null}

      <EditorRecorrido abierto={tpl !== undefined} tpl={tpl || null} onClose={() => setTpl(undefined)} />
      <VerRonda ronda={ver} texto={texto} onClose={() => setVer(null)} />
    </ContenidoRonda>
  );
}

function MarcarPunto({ ronda, indice, onClose }: { ronda: Ronda; indice: number | null; onClose: () => void }) {
  const st = useStore();
  const toast = useToast();
  const [estado, setEstado] = useState('ok');
  const [hora, setHora] = useState(hhmm());
  const [obs, setObs] = useState('');

  useEffect(() => {
    if (indice == null) return;
    const p = ronda.puntos[indice];
    setEstado(p.estado === 'nov' ? 'nov' : 'ok');
    setHora(p.hora || hhmm());
    setObs(p.obs || '');
  }, [indice]);

  if (indice == null) return null;
  const p = ronda.puntos[indice];

  return (
    <Sheet visible title={p.n} onClose={onClose}
      footer={
        <>
          <Btn label="Cancelar" variant="ghost" style={{ flex: 1 }} onPress={onClose} />
          <Btn label="Marcar punto" variant="primary" style={{ flex: 1 }} onPress={() => {
            const puntos = ronda.puntos.map((x, i) =>
              i === indice ? { ...x, hora: hora || hhmm(), fecha:x.fecha||isoDate(), estado, obs } : x);
            st.put('rounds', { ...ronda, puntos });
            onClose();
            toast('Punto marcado');
          }} />
        </>
      }>
      <Seg valor={estado} onChange={setEstado}
        opciones={[{ v: 'ok', t: 'Sin novedad' }, { v: 'nov', t: 'Con novedad' }]} />
      <Input tipo="hora" label="Hora de paso" value={hora} onChangeText={setHora} mono keyboardType="numbers-and-punctuation" />
      <Input label="Observación" value={obs} onChangeText={setObs} multiline rows={3}
        placeholder="Portón cerrado, precinto sin violar…" />
    </Sheet>
  );
}

function EditorRecorrido({ abierto, tpl, onClose }: { abierto: boolean; tpl: RondaTpl | null; onClose: () => void }) {
  const st = useStore();
  const toast = useToast();
  const [nombre, setNombre] = useState('');
  const [puntos, setPuntos] = useState('');
  const [borrar, setBorrar] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    setNombre(tpl?.nombre || '');
    setPuntos((tpl?.puntos || []).join('\n'));
  }, [abierto, tpl?.id]);

  return (
    <Sheet visible={abierto} title={tpl ? 'Editar recorrido' : 'Nuevo recorrido'} onClose={onClose}
      footer={
        <>
          {tpl ? <Btn icon="trash" variant="danger" onPress={() => setBorrar(true)} /> : null}
          <Btn label="Guardar" variant="primary" style={{ flex: 1 }} onPress={() => {
            const ps = puntos.split('\n').map(s => s.trim()).filter(Boolean);
            if (!nombre.trim() || !ps.length) { toast('Falta el nombre o los puntos'); return; }
            st.put('rtemplates', { id: tpl?.id || uid(), nombre, puntos: ps });
            onClose(); toast('Recorrido guardado');
          }} />
        </>
      }>
      <Input label="Nombre del recorrido" value={nombre} onChangeText={setNombre}
        placeholder="Ronda perimetral nocturna" />
      <Input label="Puntos de control" value={puntos} onChangeText={setPuntos} multiline rows={8}
        placeholder={'Portón ingreso Oroño\nPortón Ombú\nSector carga\nBicicletero'}
        hint="Un punto por línea, en el orden en que los recorrés." />
      <Confirmar visible={borrar} mensaje="¿Eliminar este recorrido?"
        onCancel={() => setBorrar(false)}
        onOk={() => { if (tpl) st.drop('rtemplates', tpl.id); setBorrar(false); onClose(); }} />
    </Sheet>
  );
}

function VerRonda({ ronda, texto, onClose }: { ronda: Ronda | null; texto: (r: Ronda) => string; onClose: () => void }) {
  const t = useTheme();
  const toast = useToast();
  if (!ronda) return null;
  const x = texto(ronda);
  return (
    <Sheet visible title={ronda.nombre} onClose={onClose}
      footer={
        <Btn label="Copiar" icon="copy" variant="primary" style={{ flex: 1 }}
          onPress={async () => { await Clipboard.setStringAsync(x); toast('Ronda copiada'); }} />
      }>
      <View style={{ backgroundColor: t.surface2, borderWidth: 1, borderColor: t.line, borderRadius: R.md, padding: 14 }}>
        <Text selectable style={{ fontFamily: FONT.mono, fontSize: 12.5, lineHeight: 20, color: t.text }}>{x}</Text>
      </View>
      {ronda.fotos?.map((uri,i)=><Image key={i} source={{uri}} style={{width:'100%',height:240,resizeMode:'contain'}}/>)}
    </Sheet>
  );
}
