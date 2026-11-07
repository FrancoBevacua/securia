import React, { useEffect, useRef, useState } from 'react';
import { AppState, View, Text } from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useStore } from '../store';
import { visAdentro, visEspera, visNombre } from '../logic';
import {
  Acceso, AUTZ, Visita, accNormal, autLabel, autTag, dmy, fmtDNI, hhmm, isoDate,
  personasReales, uid,
} from '../model';
import { sujetoAcceso } from '../text';
import { FONT } from '../theme';
import {
  useTheme, Pantalla, SubCabecera, Card, Btn, Tag, Item, Empty, Stack, Row, Seg,
  Chip, Chipbar, Input, Field, Sheet, Banner, Hint, Confirmar, useToast,
} from '../ui';
import BloqueAcceso from './BloqueAcceso';
import {cambiosVisita} from '../movimientosVisita';
import {externosEnPredio} from '../presencias';

const TIPOS = ['Proveedor', 'Contratista', 'Visita', 'Empleado', 'Locatario'];

export default function Visitas({integrado=false}:{integrado?:boolean}={}) {
  const st = useStore();
  const t = useTheme();
  const toast = useToast();
  const [modo, setModo] = useState('dentro');
  const [editar, setEditar] = useState<Visita | null | undefined>(undefined);
  const [confirmar, setConfirmar] = useState<Visita | null>(null);


  const todas = st.list<Visita>('visits').sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const [ahora,setAhora]=useState(()=>new Date());
  useEffect(()=>{const tick=()=>setAhora(new Date()),timer=setInterval(tick,30000),sub=AppState.addEventListener('change',s=>{if(s==='active')tick();});return()=>{clearInterval(timer);sub.remove();};},[]);
  const vigentes=new Set(externosEnPredio(st.S,ahora).flatMap(g=>g.registros));
  const dentro = todas.filter(v=>vigentes.has(v.id)&&visAdentro(v));
  const espera = dentro.filter(visEspera);
  const rows = modo === 'dentro' ? dentro : todas;

  const egreso = async (v: Visita) => {
    try{
      st.putVarios(cambiosVisita({...v,horaOut:hhmm()},['out'],st.me!.id,new Date(),st.S.novedades,st.responsable?.id||st.me!.id));
      await st.confirmarGuardado();
      toast('Egreso asentado en el libro');
    }catch(e:any){toast(e.message);}
  };

  const copiarPresentes = async () => {
    let x = '*PERSONAS EN EL PREDIO — ' + dmy(isoDate()) + ' ' + hhmm() + '*\n\n';
    if (!dentro.length) x += 'Sin personal de terceros dentro del predio.';
    dentro.forEach(v => {
      const a = accNormal(v.acc, v);
      x += v.horaIn + ' — ' + visNombre(v) + '\n';
      if (a.tarea) x += a.tarea + (a.lugar ? ' en ' + a.lugar : '') + '\n';
      personasReales(a).forEach(p => { x += p.nombre + (p.dni ? ' — DNI ' + fmtDNI(p.dni) : '') + '\n'; });
      x += autLabel(a.autoriz) +
        (a.vehiculo?.activo ? ' · ' + [a.vehiculo.tipo, a.vehiculo.dominio].filter(Boolean).join(' ') : '') + '\n\n';
    });
    await Clipboard.setStringAsync(x.trim());
    toast('Listado copiado');
  };

  const contenido=(<>
      {!integrado?<SubCabecera titulo="Externos" sub="Cada ingreso y egreso se asienta solo en el libro."
        onBack={() => router.back()} />:null}

      {espera.length ? (
        <Banner kind="warn">
          <Text style={{ fontFamily: FONT.body, fontSize: 12.5, lineHeight: 18, color: t.warn }}>
            <Text style={{ fontFamily: FONT.bodyBold }}>
              {espera.length + ' ingreso' + (espera.length > 1 ? 's' : '') + ' sin confirmar'}
            </Text>
            {'\n' + espera.map(visNombre).join(' · ') + ' — aguardan confirmación del CCTV.'}
          </Text>
        </Banner>
      ) : null}

      <Seg acento valor={modo} onChange={setModo}
        opciones={[{ v: 'dentro', t: 'Ingresos vigentes (' + dentro.length + ')' }, { v: 'hist', t: 'Historial' }]} />

      <Btn label="Registrar ingreso" icon="plus" variant="primary" onPress={() => setEditar(null)} />

      {rows.length ? (
        <Card>
          {rows.map((v, i) => {
            const a = accNormal(v.acc, v);
            const per = personasReales(a);
            const kind = v.horaOut ? 'mute' : a.autoriz === 'retiro' ? 'crit' : autTag(a.autoriz);
            return (
              <Item key={v.id} last={i === rows.length - 1} stripe={kind}
                lead={v.horaIn} title={visNombre(v)} tituloLineas={1} lineas={1}
                subs={[
                  [a.tarea, a.lugar].filter(Boolean).join(' · ') || v.tipo,
                  (per.length > 1 ? per.length + ' empleados' : per[0]?.dni ? 'DNI ' + fmtDNI(per[0].dni) : '') +
                  (a.vehiculo?.activo && a.vehiculo.dominio ? ' · ' + a.vehiculo.dominio : '') +
                  (v.horaOut ? ' · Egresó ' + v.horaOut : ''),
                ]}
                right={
                  v.horaOut ? <Tag label="Egresó" kind="mute" />
                    : a.autoriz === 'espera' ? <Btn label="Confirmar" variant="primary" size="xs" onPress={() => setConfirmar(v)} />
                      : a.autoriz === 'retiro' ? <Tag label="Se retiró" kind="crit" />
                        : <Btn label="Egreso" variant="primary" size="xs" onPress={() => egreso(v)} />
                }
                onPress={() => setEditar(v)} />
            );
          })}
        </Card>
      ) : (
        <Card>
          <Empty>{modo === 'dentro' ? 'No hay visitas ni proveedores dentro del predio.' : 'Sin registros.'}</Empty>
        </Card>
      )}

      {rows.length ? (
        <Btn label="Copiar ingresos vigentes" icon="copy" variant="ghost" onPress={copiarPresentes} />
      ) : null}

      <EditorVisita abierto={editar !== undefined} visita={editar || null}
        onClose={() => setEditar(undefined)} />
      <HojaConfirmar visita={confirmar} onClose={() => setConfirmar(null)} />
    </>
  );
  return integrado?contenido:<Pantalla top>{contenido}</Pantalla>;
}

/* ================= alta y edición ================= */
export function EditorVisita({ abierto, visita, onClose }: {
  abierto: boolean; visita: Visita | null; onClose: () => void;
}) {
  const st = useStore();
  const toast = useToast();
  const [tipo, setTipo] = useState('Proveedor');
  const [acc, setAcc] = useState<Acceso>(accNormal());
  const [horaIn, setHoraIn] = useState(hhmm());
  const [horaOut, setHoraOut] = useState('');
  const [obs, setObs] = useState('');
  const [borrar, setBorrar] = useState(false);
  const [guardando,setGuardando]=useState(false),[error,setError]=useState('');
  const idRegistro=useRef(uid());

  useEffect(() => {
    if (!abierto) return;
    idRegistro.current=visita?.id||uid();
    setError('');setBorrar(false);
    setTipo(visita?.tipo || 'Proveedor');
    setAcc(accNormal(visita?.acc, visita));
    setHoraIn(visita?.horaIn || hhmm());
    setHoraOut(visita?.horaOut || '');
    setObs(accNormal(visita?.acc, visita).obs || '');
  }, [abierto, visita?.id]);

  const guardar = async () => {
    if(guardando)return;setGuardando(true);setError('');
    try{
    const a = { ...acc, obs };
    if (!a.empresa && !personasReales(a).length) { throw Error('Ingrese la razón social o al menos un empleado'); }
    let salida = horaOut;
    if (a.autoriz === 'retiro' && !salida) salida = horaIn;
    const anterior=st.S.visits.find(v=>v.id===idRegistro.current)||visita;
    const v: Visita = {
      id: idRegistro.current, updatedAt: 0, tipo, acc: a,
      nombre: a.empresa || personasReales(a)[0]?.nombre || '',
      horaIn: horaIn || hhmm(), horaOut: salida,
      fecha: anterior?.fecha || isoDate(), guardId: anterior?.guardId || st.responsable?.id || st.me!.id,
      createdAt: anterior?.createdAt || Date.now(),
      novIn: anterior?.novIn, novOut: anterior?.novOut, novConf: anterior?.novConf,
    };
    const cambios=cambiosVisita(v,v.horaOut&&a.autoriz!=='retiro'?['in','out']:['in'],st.me!.id,new Date(),st.S.novedades,st.responsable?.id||st.me!.id);
    if(!v.horaOut&&anterior?.novOut)cambios.unshift({col:'novedades',obj:{id:anterior.novOut,deleted:true}});
    st.putVarios(cambios);
    await st.confirmarGuardado();
    onClose();
    toast(a.autoriz === 'retiro'
      ? 'Registrado: personal sin confirmación, se retira'
      : 'Registrado y asentado en el libro');
    }catch(e:any){setError(e.message);}finally{setGuardando(false);}
  };

  return (
    <Sheet visible={abierto} title={visita ? 'Editar registro' : 'Registrar ingreso'} onClose={onClose}
      footer={
        <>
          {visita ? <Btn icon="trash" variant="danger" onPress={() => setBorrar(true)} /> : null}
          <Btn label={guardando?"Guardando…":"Guardar"} disabled={guardando} variant="primary" style={{ flex: 1 }} onPress={guardar} />
        </>
      }>
      {error?<Banner kind="warn">{error}</Banner>:null}
      <Field label="Tipo">
        <Chipbar>
          {TIPOS.map(x => <Chip key={x} label={x} on={tipo === x} onPress={() => setTipo(x)} />)}
        </Chipbar>
      </Field>
      <BloqueAcceso valor={acc} onChange={setAcc} />
      <Row gap={11} style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Input tipo="hora" label="Hora de ingreso" value={horaIn} onChangeText={setHoraIn} mono keyboardType="numbers-and-punctuation" />
        </View>
        {visita ? (
          <View style={{ flex: 1 }}>
            <Input tipo="hora" label="Hora de egreso" value={horaOut} onChangeText={setHoraOut} mono keyboardType="numbers-and-punctuation" />
          </View>
        ) : null}
      </Row>
      <Input label="Observaciones" value={obs} onChangeText={setObs} multiline rows={2}
        placeholder="Ingresa con herramienta propia…" />
      <Banner kind="info" icon="libro">
        Al guardar se genera el asiento en el Informe general con este mismo texto.
      </Banner>

      <Confirmar visible={borrar} mensaje="¿Eliminar este registro? También se quitan sus asientos del libro."
        onCancel={() => setBorrar(false)}
        onOk={async () => {
          try{
          if (visita) {
            st.putVarios([
              ...[...new Set([...(['novIn', 'novOut', 'novConf'] as const).map(k => visita[k]),...st.S.novedades.filter(n=>n.visitId===visita.id&&!n.deleted).map(n=>n.id)].filter(Boolean))]
                .map(id => ({ col: 'novedades' as const, obj: { id, deleted: true } })),
              { col: 'visits', obj: { id: visita.id, deleted: true } },
            ]);
          }
          await st.confirmarGuardado();
          setBorrar(false); onClose(); toast('Registro eliminado');
          }catch(e:any){setBorrar(false);setError(e.message);}
        }} />
    </Sheet>
  );
}

/* ================= confirmación posterior ================= */
function HojaConfirmar({ visita, onClose }: {
  visita: Visita | null; onClose: () => void;
}) {
  const st = useStore();
  const t = useTheme();
  const toast = useToast();
  const [resultado, setResultado] = useState<'cctv' | 'admin' | 'retiro'>('cctv');
  const [confirmo, setConfirmo] = useState('');

  useEffect(() => {
    if (!visita) return;
    setResultado('cctv');
    setConfirmo(accNormal(visita.acc, visita).confirmo || '');
  }, [visita?.id]);

  if (!visita) return null;
  const a = accNormal(visita.acc, visita);

  const guardar = async () => {
    try{
      const nuevo: Acceso = { ...a, autoriz: resultado, confirmo };
      const v: Visita = { ...visita, acc: nuevo, ...(resultado==='retiro'?{horaOut:hhmm()}:{}) };
      st.putVarios(cambiosVisita(v,[resultado==='retiro'?'out':'conf'],st.me!.id,new Date(),st.S.novedades,st.responsable?.id||st.me!.id));
      await st.confirmarGuardado();onClose();
      toast(resultado === 'retiro' ? 'Asentado: se retira sin confirmación' : 'Autorización confirmada y asentada');
    }catch(e:any){toast(e.message);}
  };

  return (
    <Sheet visible={!!visita} title="Confirmar autorización" onClose={onClose}
      footer={
        <>
          <Btn label="Cancelar" variant="ghost" style={{ flex: 1 }} onPress={onClose} />
          <Btn label="Guardar" variant="primary" style={{ flex: 1 }} onPress={guardar} />
        </>
      }>
      <Banner kind="info" icon="bell">
        <Text style={{ fontFamily: FONT.body, fontSize: 12.5, lineHeight: 18, color: t.slate }}>
          {sujetoAcceso(a, visita.tipo) + (a.tarea ? ' — ' + a.tarea : '') +
            '\nIngreso registrado a las ' + visita.horaIn + ' aguardando confirmación.'}
        </Text>
      </Banner>
      <Field label="Resultado">
        <Chipbar>
          {AUTZ.filter(x => x[0] !== 'espera').map(([v, lab]) => (
            <Chip key={v} label={lab} on={resultado === v} onPress={() => setResultado(v as any)} />
          ))}
        </Chipbar>
      </Field>
      <Input label="Quién confirmó" value={confirmo} onChangeText={setConfirmo} placeholder="Op. Gómez" />
    </Sheet>
  );
}
