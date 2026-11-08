import SelectorFirma from './SelectorFirma';
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import {Image} from '../Imagen';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { useStore } from '../store';
import { Informe, dmy, dmyShort, hhmm, isoDate, uid } from '../model';
import { PLANTILLAS } from '../seed';
import { CRIT, LBL, PASOS, PH, critTag, gsName, textoReporte } from '../text';
import { nombrePuesto } from '../logic';
import { asistir } from '../assistant';
import {
  leerConfigIA, pedirIA, promptInforme, promptGenerarInforme, parsearInforme, ErrorIA,
} from '../ai';
import { pdfInforme } from '../pdf';
import { FONT, R } from '../theme';
import {
  useTheme, Pantalla, Cabecera, Card, Btn, Tag, Item, Empty, Stack, Row, Chip, Chipbar,
  Input, Sheet, Eyebrow, Hint, Divider, Confirmar, useToast,
} from '../ui';
import { Icon } from '../icons';
import {turnoAbierto,horaValida,fechaValida} from '../servicio';
import {generarInformeSeguridad, GRUPOS_INFORME} from '../informesSeguridad';

export const nuevoInforme = (S: any, me: any, responsable=me): Informe => {
  const r: any = {
    id: '', updatedAt: 0, estado: 'borrador', hora: '', fecha: isoDate(),
    createdBy: me.id, firmaId:responsable?.id, plantilla: '', createdAt: Date.now(), fotos: [],
  };
  for (let i = 1; i <= 16; i++) r['f' + i] = '';
  r.f1 = S.site.cliente || '';
  r.f2 = S.site.region || '';
  r.f3 = dmy(isoDate());
  r.f5 = 'Baja';
  r.f9 = 'Guardia de seguridad: ' + (responsable?.apellido || '') + ' ' + (responsable?.nombre || '');
  r.f14 = 'Guardia de turno - ' + (responsable?.apellido || '') + ' ' + (responsable?.nombre || '');
  return r as Informe;
};

export default function Informes() {
  const st = useStore();
  const t = useTheme();
  const [abierto, setAbierto] = useState(false);
  const [r, setR] = useState<Informe | null>(null);
  const [paso, setPaso] = useState(0);
  const [lectura, setLectura] = useState<Informe|null>(null);
  const [grupo, setGrupo] = useState(0);
  const [confirmarBaja, setConfirmarBaja] = useState(false);
  const toast = useToast();

  const rs = st.list<Informe>('reports').sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const abrir = (inf?: Informe) => {
    setR(inf ? { ...inf } : nuevoInforme(st.S, st.me, st.responsable||st.me));
    setPaso(0);
    setAbierto(true);
  };

  if (lectura) return <Pantalla>
    <Cabecera titulo={String(lectura.f4||'Informe de seguridad')} sub={dmy(lectura.fecha)+' · '+lectura.hora+' · '+lectura.estado}/>
    <Btn label="Volver a informes" onPress={()=>setLectura(null)}/><Row><Btn label="Editar informe" style={{flex:1}} onPress={()=>{abrir(lectura);setLectura(null);}}/><Btn icon="trash" variant="danger" onPress={()=>setConfirmarBaja(true)}/></Row>
    <Card pad><Eyebrow>Resumen del hecho</Eyebrow><Text selectable style={{color:t.text,fontFamily:FONT.body,fontSize:17,lineHeight:26}}>{String(lectura.f6||'Sin resumen')}</Text></Card>
    <Chipbar>{GRUPOS_INFORME.map((g,i)=><Chip key={g.titulo} label={g.titulo} on={grupo===i} onPress={()=>setGrupo(i)}/>)}</Chipbar>
    {GRUPOS_INFORME[grupo].campos.map(i=><Card pad key={i}><Eyebrow>{i+'. '+LBL[i-1]}</Eyebrow><Text selectable style={{color:t.text,fontFamily:FONT.body,fontSize:15,lineHeight:24}}>{String(lectura['f'+i as `f${number}`]||'Sin completar')}</Text></Card>)}
    {lectura.fotos?.map((uri,i)=><Image key={i} source={{uri}} style={{height:240,width:'100%'}} resizeMode="contain"/>)}
    <Row><Btn label="Copiar informe" onPress={async()=>{await Clipboard.setStringAsync(textoReporte(lectura,st.S.site));toast('Informe copiado');}}/><Btn label="Compartir PDF" onPress={async()=>{try{await pdfInforme(lectura,st.S,gsName(st.me,st.S.site));}catch(e:any){toast(e.message);}}}/></Row>
    <Confirmar visible={confirmarBaja} mensaje="¿Eliminar este informe? La baja se conservará en el historial." onCancel={()=>setConfirmarBaja(false)} onOk={async()=>{try{st.drop('reports',lectura.id);await st.confirmarGuardado();setConfirmarBaja(false);setLectura(null);toast('Informe eliminado');}catch(e:any){toast(e.message);}}}/>
  </Pantalla>;

  return (
    <Pantalla>
      <Cabecera titulo="Informes" sub="Informe de seguridad de 16 puntos, con plantillas por tipo de incidente."
        derecha={<Btn icon="plus" variant="primary" onPress={() => abrir()} />} />

      {rs.length ? (
        <Card>
          {rs.map((x, i) => {
            const g = st.byId<any>('guards', x.createdBy);
            const res = ((x as any).f6 || '') as string;
            return (
              <Item key={x.id} last={i === rs.length - 1} stripe={critTag((x as any).f5)}
                lead={x.fecha?dmyShort(x.fecha):'Borrador'} title={(x as any).f4 || 'Sin tipificar'}
                subs={[
                  res.slice(0, 90) + (res.length > 90 ? '…' : ''),
                  (g ? g.apellido + ' ' + g.nombre : '') + (x.hora ? ' · ' + x.hora : '') +
                  ((x.fotos || []).length ? ' · ' + x.fotos.length + ' foto' + (x.fotos.length > 1 ? 's' : '') : ''),
                ]}
                right={<Tag label={(x as any).f5 || '—'} kind={critTag((x as any).f5)} />}
                onPress={() => {setLectura(x);setGrupo(0);}} />
            );
          })}
        </Card>
      ) : (
        <Card>
          <Empty>Sin informes cargados. Seleccione + para generar el primero: elegís el tipo de incidente y la app precarga los 16 puntos.</Empty>
        </Card>
      )}

      {r ? (
        <Asistente
          visible={abierto} informe={r} paso={paso}
          setPaso={setPaso} setInforme={setR}
          onClose={() => setAbierto(false)} />
      ) : null}
    </Pantalla>
  );
}

/* ================= asistente de 16 puntos ================= */
export function Asistente({ visible, informe, paso, setPaso, setInforme, onClose }: {
  visible: boolean; informe: Informe; paso: number;
  setPaso: (n: number) => void; setInforme: (r: Informe) => void; onClose: () => void;
}) {
  const st = useStore();
  const t = useTheme();
  const toast = useToast();
  const [plantillas, setPlantillas] = useState(false);
  const [sugerencia, setSugerencia] = useState<{ texto: string; avisos: string[] } | null>(null);
  const [pensando, setPensando] = useState(false);
  const [borrar, setBorrar] = useState(false);
  const [errorResumen,setErrorResumen]=useState('');
  const total = PASOS.length;

  const eliminar = () => {
    if (informe.id) st.drop('reports', informe.id);
    setBorrar(false);
    onClose();
    toast('Informe eliminado');
  };
  const BotonBorrar = informe.id
    ? <Btn icon="trash" variant="danger" onPress={() => setBorrar(true)} />
    : null;

  const set = (k: string, v: any) => setInforme({ ...informe, [k]: v } as Informe);

  const guardar = async (extra?: Partial<Informe>) => {
    const base: any = { ...informe, ...extra };
    if(base.fotos?.length&&!base.sector?.trim())throw Error('Indique el sector de la evidencia fotográfica.');
    if (!base.id) { base.id = uid(); base.createdAt = Date.now(); }
    const m = String(base.f3 || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (m) base.fecha = m[3] + '-' + m[2] + '-' + m[1];
    st.put('reports', base);
    setInforme(base);
    await st.confirmarGuardado();
    return base as Informe;
  };
  const finalizar=async()=>{
    if(pensando)return;setPensando(true);setErrorResumen('');
    try{
      const cambios=generarInformeSeguridad(st.S,informe,st.me!.id,st.telefonoId);
      setInforme(cambios[0].obj);
      st.putVarios(cambios);
      await st.confirmarGuardado();
      setPaso(total);toast('Informe generado y resumen agregado al libro de novedades');
    }catch(e:any){
      const mensaje=e.message||'No se pudo generar el informe. Revise los datos y vuelva a intentar.';
      setErrorResumen(mensaje);toast(mensaje);
      if(Number.isInteger(e.pasoInforme))setPaso(e.pasoInforme);
    }
    finally{setPensando(false);}
  };

  const agregarFotos = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { toast('Necesito permiso para acceder a las fotos'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images', allowsMultipleSelection: true, quality: 0.7,
    });
    if (res.canceled || !res.assets) return;
    const guardadas: string[] = [];
    for (const a of res.assets) guardadas.push(await st.guardarFoto(a.uri));
    setInforme({ ...informe, fotos: [...(informe.fotos || []), ...guardadas] } as Informe);
    toast(guardadas.length + (guardadas.length === 1 ? ' foto agregada' : ' fotos agregadas'));
  };
  const tomarFoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { toast('Necesito permiso para usar la cámara'); return; }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (res.canceled || !res.assets?.[0]) return;
    const uri = await st.guardarFoto(res.assets[0].uri);
    setInforme({ ...informe, fotos: [...(informe.fotos || []), uri] } as Informe);
  };

  const revisarReglas = () => {
    const txt = [6, 7, 8].map(i => (informe as any)['f' + i] || '').join('\n\n');
    if (!txt.trim()) { toast('Escriba el resumen primero'); return; }
    setSugerencia(asistir(txt, { cat: 'Incidencia' }));
  };
  const redactarIA = async () => {
    const notas = [6, 7, 8].map(i => String((informe as any)['f' + i] || '')).filter(Boolean).join('\n');
    if (notas.trim().length < 15) { toast('Escriba primero las notas del hecho en el punto 6'); return; }
    const cfg = await leerConfigIA();
    setPensando(true);
    try {
      const salida = await pedirIA(promptGenerarInforme(notas, {
        cliente: String((informe as any).f1 || st.S.site.cliente),
        region: String((informe as any).f2 || st.S.site.region),
        fecha: String((informe as any).f3 || dmy(informe.fecha)),
        hora: informe.hora,
        tipo: String((informe as any).f4 || ''),
        criticidad: String((informe as any).f5 || ''),
        guardia: gsName(st.me, st.S.site) + (st.me?.puestoId ? ' — ' + nombrePuesto(st.S, st.me.puestoId) : ''),
        etiquetas: LBL,
      }), cfg);
      const campos = parsearInforme(salida, LBL);
      const n = Object.keys(campos).length;
      if (n >= 8) {
        setInforme({ ...informe, ...campos, f5: (informe as any).f5 || campos.f5 } as Informe);
        toast('Informe redactado con IA. Revíselo antes de enviarlo.');
      } else {
        setSugerencia({
          texto: salida.slice(0, 1500),
          avisos: ['El modelo no respetó el formato de 16 puntos. Revise la respuesta y copie el contenido pertinente.'],
        });
      }
    } catch (e: any) {
      toast(e instanceof ErrorIA ? e.message : 'No se pudo consultar la IA');
    } finally {
      setPensando(false);
    }
  };

  const revisarIA = async () => {
    const cfg = await leerConfigIA();
    setPensando(true);
    try {
      const salida = await pedirIA(promptInforme(textoReporte(informe, st.S.site)), cfg);
      const limpio = salida.replace(/^```[a-z]*\n?|```$/g, '').trim();
      const campos: any = {};
      for (let i = 1; i <= 16; i++) {
        const re = new RegExp('_' + i + '\\.\\s*\\*[^*]+\\*_\\s*\\n([\\s\\S]*?)(?=\\n_' + (i + 1) + '\\.|$)');
        const m = limpio.match(re);
        if (m) campos['f' + i] = m[1].trim();
      }
      if (Object.keys(campos).length >= 8) {
        setInforme({ ...informe, ...campos } as Informe);
        toast('Informe revisado por la IA');
      } else {
        setSugerencia({ texto: limpio.slice(0, 1200), avisos: ['La IA devolvió el texto en otro formato: revisalo y copie lo que sirva.'] });
      }
    } catch (e: any) {
      toast(e instanceof ErrorIA ? e.message : 'No se pudo consultar la IA');
    } finally {
      setPensando(false);
    }
  };

  /* ---------- vista previa ---------- */
  if (paso >= total) {
    const texto = textoReporte(informe, st.S.site);
    return (
      <Sheet visible={visible} title="Vista previa" onClose={onClose} onBack={() => setPaso(total - 1)}
        footer={
          <View style={{flex:1,gap:8}}>
            {errorResumen?<Text accessibilityRole="alert" style={{color:t.text,fontFamily:FONT.body,fontSize:14}}>{errorResumen}</Text>:null}
            <Row>
            {BotonBorrar}
            <Btn icon="down" onPress={async () => {
              toast('Armando el PDF…');
              try{const guardado = await guardar();
              const res = await pdfInforme(guardado, st.S, gsName(st.me, st.S.site));
              if (res === 'no') toast('No se pudo generar el PDF');}catch(e:any){toast(e.message);}
            }} />
            <Btn label="Copiar" icon="copy" variant="primary" style={{ flex: 1 }}
              onPress={async () => { await Clipboard.setStringAsync(texto); toast('Informe copiado'); }} />
            </Row>
          </View>
        }>
        <Pasos paso={paso} total={total} />
        <SelectorFirma valor={(informe as any).firmaId||''} onChange={v=>set('firmaId',v)}/>
        <Row>
          {pensando
            ? <ActivityIndicator color={t.accent} />
            : <Btn label="Revisar todo con IA" variant="ghost" size="xs" icon="bell" onPress={revisarIA} />}
        </Row>
        <Eyebrow>Informe listo</Eyebrow>
        <Btn label={pensando?'Preparando resumen…':'Actualizar resumen en Informe general'} disabled={pensando} onPress={finalizar}/>
        {errorResumen?<Hint>{errorResumen}</Hint>:null}
        <View style={{ backgroundColor: t.surface2, borderWidth: 1, borderColor: t.line, borderRadius: R.md, padding: 14 }}>
          <Text selectable style={{ fontFamily: FONT.mono, fontSize: 12.5, lineHeight: 20, color: t.text }}>{texto}</Text>
        </View>
        {(informe.fotos || []).length ? (
          <>
            <Eyebrow>Evidencia adjunta</Eyebrow>
            <Fotos informe={informe} setInforme={setInforme} />
          </>
        ) : null}
        <Confirmar visible={borrar} mensaje="¿Eliminar este informe? No se puede deshacer."
          onCancel={() => setBorrar(false)} onOk={eliminar} />
      </Sheet>
    );
  }

  const seccion = PASOS[paso];
  return (
    <>
      <Sheet visible={visible && !plantillas} title="Informe de seguridad" onClose={onClose}
        onBack={paso > 0 ? () => setPaso(paso - 1) : undefined}
        footer={
          <View style={{flex:1,gap:8}}>
            {errorResumen?<Text accessibilityRole="alert" style={{color:t.text,fontFamily:FONT.body,fontSize:14}}>{errorResumen}</Text>:null}
            <Row>
            {BotonBorrar}
            <Btn label="Guardar borrador" variant="ghost" disabled={pensando} style={{ flex: 1 }}
              onPress={async () => {setPensando(true);try{await guardar(); onClose(); toast('Borrador guardado en el teléfono');}catch(e:any){setErrorResumen(e.message);}finally{setPensando(false);} }} />
            <Btn label={pensando?'Generando…':paso === total - 1 ? 'Generar informe' : 'Siguiente'} disabled={pensando} variant="primary" style={{ flex: 1 }}
              onPress={async () => {
                if(paso===total-1){await finalizar();return;}
                setPensando(true);try{await guardar(); setPaso(paso + 1);}catch(e:any){setErrorResumen(e.message);}finally{setPensando(false);}
              }} />
            </Row>
          </View>
        }>
        <Pasos paso={paso} total={total} />
        {errorResumen?<Hint>{errorResumen}</Hint>:null}
        <SelectorFirma label="Vigilador que realizó la novedad" valor={informe.firmaId||''} onChange={v=>set('firmaId',v)}/>
        <Eyebrow>{'Paso ' + (paso + 1) + ' de ' + total + ' · ' + seccion.t}</Eyebrow>

        {paso === 0 ? (
          <Btn variant="ghost" size="sm" icon="informes"
            label={informe.plantilla ? 'Plantilla: ' + informe.plantilla : 'Elegir plantilla de incidente'}
            onPress={() => setPlantillas(true)} />
        ) : null}

        {seccion.campos.map(i => {
          const lab = i + '. ' + LBL[i - 1];
          const val = String((informe as any)['f' + i] || '');
          if (i === 3) {
            return (
              <Row key={i} gap={11} style={{ alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Input tipo="fecha" formatoFecha="dmy" label={lab} value={val} onChangeText={v => set('f3', v)} mono placeholder="23/08/2026" />
                </View>
                <View style={{ flex: 1 }}>
                  <Input tipo="hora" label="Hora del hecho" value={informe.hora} onChangeText={v => set('hora', v)} mono placeholder="04:20" />
                </View>
              </Row>
            );
          }
          if (i === 5) {
            return (
              <View key={i} style={{ gap: 6 }}>
                <Text style={{ fontFamily: FONT.disp, fontSize: 12.5, letterSpacing: 1.3, color: t.muted, textTransform: 'uppercase' }}>{lab}</Text>
                <Chipbar>
                  {CRIT.map(c => <Chip key={c} label={c} on={val === c} onPress={() => set('f5', c)} />)}
                </Chipbar>
              </View>
            );
          }
          const largo = [6, 7, 8, 9, 11, 12, 13, 15, 16].includes(i);
          return (
            <Input key={i} label={lab} value={val} onChangeText={v => set('f' + i, v)}
              multiline={largo} rows={i === 6 || i === 15 ? 5 : 3} placeholder={PH[i] || ''} />
          );
        })}

        {paso === 1 ? (
          <>
            <Hint>
              Escriba las notas del hecho con la información disponible. La IA arma con eso el informe
              completo de los 16 puntos, claro y detallado, sin inventar datos.
            </Hint>
            {pensando ? (
              <Row gap={10}>
                <ActivityIndicator color={t.accent} />
                <Hint>Redactando el informe…</Hint>
              </Row>
            ) : (
              <Row>
                <Btn label="Redactar con IA" variant="primary" size="sm" icon="informes" onPress={redactarIA} />
              </Row>
            )}
            {sugerencia ? (
              <Card pad style={{ backgroundColor: t.accentSoft, borderColor: t.accentLine }}>
                <Stack gap={10}>
                  <Eyebrow>Sugerencia</Eyebrow>
                  <Text style={{ fontFamily: FONT.body, fontSize: 14, lineHeight: 21, color: t.text }}>{sugerencia.texto}</Text>
                  {sugerencia.avisos.length ? <Hint>{sugerencia.avisos.join('\n')}</Hint> : null}
                  <Row>
                    <Btn label="Aplicar" variant="primary" size="sm" onPress={() => {
                      const partes = sugerencia.texto.split('\n\n');
                      const nuevo: any = { ...informe };
                      [6, 7, 8].forEach((i, k) => { if (partes[k] != null) nuevo['f' + i] = partes[k]; });
                      setInforme(nuevo); setSugerencia(null); toast('Redacción corregida');
                    }} />
                    <Btn label="Dejar como está" variant="ghost" size="sm" onPress={() => setSugerencia(null)} />
                  </Row>
                </Stack>
              </Card>
            ) : null}
          </>
        ) : null}

        {paso === total - 1 ? (
          <>
            <Divider />
            <Eyebrow>Evidencia fotográfica</Eyebrow><Input label="Sector de la evidencia" value={informe.sector||''} onChangeText={sector=>setInforme({...informe,sector})}/>
            <Hint>Las fotos se agrupan con fecha, hora y sector al final del informe.</Hint>
            <Fotos informe={informe} setInforme={setInforme} />
            <Row>
              <Btn label="Cámara" icon="plus" variant="ghost" style={{ flex: 1 }} onPress={tomarFoto} />
              <Btn label="Galería" icon="plus" variant="ghost" style={{ flex: 1 }} onPress={agregarFotos} />
            </Row>
          </>
        ) : null}
      </Sheet>

      <Confirmar visible={borrar} mensaje="¿Eliminar este informe? No se puede deshacer."
        onCancel={() => setBorrar(false)} onOk={eliminar} />

      <Sheet visible={plantillas} title="Plantillas de incidente" onClose={() => setPlantillas(false)}
        onBack={() => setPlantillas(false)}>
        <Hint>Precarga los puntos 4 al 16 con la redacción habitual del tipo de incidente. Después ajustás lo que haga falta.</Hint>
        <Card>
          {PLANTILLAS.map((p: any, i: number) => (
            <Item key={p.t} last={i === PLANTILLAS.length - 1} stripe={critTag(p.crit)}
              title={p.t} subs={[p.f[8] ? p.f[8].slice(0, 70) + '…' : '']}
              right={<Tag label={p.crit} kind={critTag(p.crit)} />}
              onPress={() => {
                const nuevo: any = { ...informe, plantilla: p.t, f5: p.crit };
                Object.keys(p.f).forEach(k => { if (!nuevo['f' + k] || +k !== 6) nuevo['f' + k] = p.f[k]; });
                setInforme(nuevo);
                setPlantillas(false);
                toast('Plantilla aplicada: ' + p.t);
              }} />
          ))}
        </Card>
      </Sheet>
    </>
  );
}

function Pasos({ paso, total }: { paso: number; total: number }) {
  const t = useTheme();
  return (
    <Row gap={4}>
      {Array.from({ length: total + 1 }).map((_, i) => (
        <View key={i} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i <= paso ? t.accent : t.line }} />
      ))}
    </Row>
  );
}

function Fotos({ informe, setInforme }: { informe: Informe; setInforme: (r: Informe) => void }) {
  const t = useTheme();
  const fotos = informe.fotos || [];
  if (!fotos.length) return <Hint>Todavía no cargaste fotos. La primera se usa como portada del informe.</Hint>;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {fotos.map((uri, i) => (
        <View key={uri} style={{
          width: '31%', aspectRatio: 1, borderRadius: 10, overflow: 'hidden',
          borderWidth: 1, borderColor: t.line, backgroundColor: t.surface2,
        }}>
          <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          {i === 0 ? (
            <View style={{ position: 'absolute', top: 5, left: 5, backgroundColor: t.accent, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ fontFamily: FONT.dispBold, fontSize: 9.5, color: t.accentInk }}>PORTADA</Text>
            </View>
          ) : (
            <Pressable onPress={() => setInforme({ ...informe, fotos: [uri, ...fotos.filter(x => x !== uri)] } as Informe)}
              style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(12,17,21,0.72)', padding: 4 }}>
              <Text style={{ fontFamily: FONT.bodySemi, fontSize: 10.5, color: '#fff', textAlign: 'center' }}>Hacer portada</Text>
            </Pressable>
          )}
          <Pressable onPress={() => setInforme({ ...informe, fotos: fotos.filter(x => x !== uri) } as Informe)}
            style={{
              position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: 12,
              backgroundColor: 'rgba(12,17,21,0.72)', alignItems: 'center', justifyContent: 'center',
            }}>
            <Icon name="x" size={13} color="#fff" width={2.4} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}
