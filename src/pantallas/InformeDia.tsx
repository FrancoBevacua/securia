/* Informe general de las novedades de 12 o 24 horas, el que va al supervisor.
   Se arma solo con lo que ya está cargado en el turno; el vigilador elige la
   ventana horaria, agrega lo que falte, adjunta evidencia y lo exporta. */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ActivityIndicator, ScrollView, AppState } from 'react-native';
import {Image} from '../Imagen';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useStore } from '../store';
import {
  InformeDia, Novedad, addDays, dmy, hhmm, isoDate, uid, pad2, toMin,
} from '../model';
import {
  EntradaDia, entradasDeVentana, textoInformeDia, cierrePorDefecto, ventanaHoy, horaCorte, hayTrascendentes, resumenCorto, validarRedaccionDia,
  limites, horaFin, ventanaParaEntrega, ventanaReciente, ventanaDelHecho,
} from '../informedia';
import { CATEGORIAS } from '../seed';
import { asistir } from '../assistant';
import { leerConfigIA, pedirIA, promptInformeDia, ErrorIA } from '../ai';
import { pdfInformeDia } from '../pdf';
import { gsName, textoMovimientoBreve } from '../text';
import { FONT } from '../theme';
import {
  useTheme, Pantalla, SubCabecera, Cabecera, Card, Btn, Item, Empty, Stack, Row, Chip, Chipbar,
  Input, Field, Sheet, Selector, Eyebrow, Hint, Banner, Tag, Toggle, useToast,
} from '../ui';
import { EditorNovedad } from './Novedades';
import ImportarLibro from './ImportarLibro';
import ServicioActual from './ServicioActual';
import RedaccionIA from './RedaccionIA';
import { turnoAbierto, fechaValida } from '../servicio';
import {FILTROS_LIBRO,agruparLibro,filtrarLibro,opcionesGsLibro} from '../filtrosLibro';

export default function InformeDiaPantalla({integrado=false}:{integrado?:boolean}={}) {
  const st = useStore();
  const t = useTheme();
  const toast = useToast();

  const [fechaManual, setFechaManual] = useState(() => isoDate());
  const [automatico, setAutomatico] = useState(true);
  const [ajustarPeriodo,setAjustarPeriodo]=useState(false);
  const [ahora,setAhora] = useState(() => new Date());
  const [corte, setCorte] = useState(() => horaCorte(st.S));
  const [duracion,setDuracion]=useState<12|24>(24);
  const fechaEntrega=automatico?limites(ventanaReciente(corte,duracion,false,ahora)).hasta.fecha:fechaManual;
  const setFechaEntrega=(v:string|((f:string)=>string))=>{setAutomatico(false);setFechaManual(typeof v==='function'?v(fechaEntrega):v);};
  useEffect(()=>{
    const tick=()=>setAhora(new Date()), timer=setInterval(tick,15000);
    const sub=AppState.addEventListener('change',s=>{if(s==='active')tick();});
    return()=>{clearInterval(timer);sub.remove();};
  },[]);
  const [guardando,setGuardando]=useState(false);
  const [fotos, setFotos] = useState<string[]>([]);
  const [editar, setEditar] = useState<Novedad | null | undefined>(undefined);
  const [vista, setVista] = useState(false);
  const [leerLibro, setLeerLibro] = useState(false);
  const [pensando, setPensando] = useState(false);
  const [texto, setTexto] = useState('');
  const [fuente, setFuente] = useState('');
  const [detalle, setDetalle] = useState<EntradaDia | null>(null);
  const [filtros,setFiltros]=useState<string[]>([]),[busqueda,setBusqueda]=useState('');
  const [gs,setGs]=useState('');

  const fechaCorrecta=fechaValida(fechaEntrega);
  const ventana = ventanaParaEntrega(fechaCorrecta?fechaEntrega:isoDate(),corte,duracion);
  const {fecha}=ventana,fin=horaFin(ventana),hasta=limites(ventana).hasta.fecha;
  const entradas = useMemo(() => fechaCorrecta?entradasDeVentana(st.S, ventana):[], [st.S, fecha, corte,duracion,fechaCorrecta]);
  const opcionesGs=useMemo(()=>opcionesGsLibro(entradas),[entradas]);
  const gsVigente=opcionesGs.some(o=>o.v===gs)?gs:'';
  useEffect(()=>{if(gs&&!gsVigente)setGs('');},[gs,gsVigente]);
  const visibles=useMemo(()=>filtrarLibro(entradas,filtros,busqueda,gsVigente),[entradas,filtros,busqueda,gsVigente]);
  const dias=useMemo(()=>agruparLibro(visibles),[visibles]);

  /* El informe guardado de esta ventana, si ya se hizo uno. */
  const guardado = st.list<InformeDia>('infdias').find(x => x.fecha === fecha && x.desde === corte && (x.duracion??24)===duracion);
  const cierre = '';

  useEffect(() => {
    setFotos(guardado?.fotos || []);
    setTexto(textoMovimientoBreve(guardado?.texto || ''));
    setFuente(guardado?.fuente || '');
  }, [fecha, corte, duracion, guardado?.id]);

  const fotosDelLibro = entradas.filter(e => e.origen === 'novedad').flatMap(e => st.byId<Novedad>('novedades', e.ids[0])?.fotos || []);
  const fotosParaPDF = [...new Set([...fotos, ...fotosDelLibro])];
  const borrador = textoInformeDia(entradas, {
    site: st.S.site.cliente, fecha, cierre, fotos: fotosParaPDF.length,ventana,
  });
  const redaccionVigente = !!texto && fuente === borrador;
  const definitivo = redaccionVigente ? texto : borrador;

  /* ---------- acciones ---------- */
  const guardar = async () => {
    if(!fechaCorrecta)throw Error('Revise la fecha de entrega (AAAA-MM-DD).');
    st.put('infdias', {
      id: guardado?.id || uid(), fecha, desde: corte, hasta: fin, duracion, fechaHasta:hasta,
      cierre, texto: definitivo, fotos,
      fuente: borrador,
      createdBy: st.me!.id, createdAt: guardado?.createdAt || Date.now(),
    });
    await st.confirmarGuardado();
    toast('Informe guardado en el teléfono');
  };

  const exportar = async (supervisor=false) => {
    if(guardando)return;
    setGuardando(true);
    try {
      await guardar();
      const r = await pdfInformeDia(
        { fecha, corte, cierre, fotos: fotosParaPDF, texto: definitivo },
        st.S, gsName(st.me, st.S.site),supervisor?(st.S.site.supervisorTel||''):undefined);
      if(r==='no')throw Error('No se pudo descargar el PDF. Vuelva a intentarlo.');
      toast(r === 'compartido' ? 'PDF adjunto al selector. Elija el supervisor y confirme el envío.' : 'PDF generado');
    } catch (e:any) {
      console.warn(e);
      toast(e.message||'No se pudo generar el PDF');
    }finally{setGuardando(false);}
  };

  return (
    <Pantalla top={!integrado}>
      {integrado?<Cabecera titulo="Libro de novedades" sub="Registro cronológico del servicio."/>:<SubCabecera titulo="Libro de novedades"
        sub="Registro cronológico del servicio."
        onBack={() => router.back()} />}

      <ServicioActual />
      {/* ---------- ventana horaria ---------- */}
      <Card pad>
        <Stack gap={12}>
          <Eyebrow>Período</Eyebrow>
          <Text style={{fontFamily:FONT.bodySemi,fontSize:16,lineHeight:24,color:t.text}}>{dmy(fecha)+' · '+corte+'\n'+dmy(hasta)+' · '+fin}</Text>
          <Hint>{automatico?'El libro avanza automáticamente al siguiente período.':'Consultando un período seleccionado.'}</Hint>
          <Btn label={ajustarPeriodo?'Cerrar opciones':'Cambiar período'} variant="ghost" onPress={()=>setAjustarPeriodo(v=>!v)}/>
          {ajustarPeriodo?<>
          <Toggle label="Informe actual automático" sub="Al llegar al corte se muestra el informe siguiente. Cada novedad conserva su fecha real."
            value={automatico} onChange={v=>{setFechaManual(fechaEntrega);setAhora(new Date());setAutomatico(v);if(v){setCorte(horaCorte(st.S));setDuracion(24);}}}/>
          <Chipbar>{[{desde:'07:00',horas:12,etiqueta:'07 → 19 · 12 h'},{desde:'19:00',horas:12,etiqueta:'19 → 07 · 12 h'},{desde:'19:00',horas:24,etiqueta:'19 → 19 · 24 h'}].map(p=><Chip key={p.etiqueta} label={p.etiqueta} on={corte===p.desde&&duracion===p.horas} onPress={()=>{setCorte(p.desde);setDuracion(p.horas as 12|24);}}/>)}</Chipbar>
          <Chipbar>{([12,24] as const).map(h=><Chip key={h} label={h+' horas'} on={duracion===h} onPress={()=>setDuracion(h)}/>)}</Chipbar>
          <Input tipo="fecha" label="Fecha de entrega / fin" value={fechaEntrega} onChangeText={setFechaEntrega} placeholder="AAAA-MM-DD" mono hint="La app calcula el día de inicio automáticamente."/>
          <Row>
            <Btn icon="back" variant="ghost" size="sm" disabled={!fechaCorrecta} onPress={() => setFechaEntrega(f => addDays(f, -1))} />
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontFamily: FONT.disp, fontSize: 17, color: t.text }}>
                {dmy(fecha) + '  ' + corte}
              </Text>
              <Hint>{'hasta ' + dmy(hasta) + ' ' + fin+' · '+duracion+' horas'}</Hint>
            </View>
            <Btn icon="back" variant="ghost" size="sm" style={{ transform: [{ scaleX: -1 }] }}
              disabled={!fechaCorrecta} onPress={() => setFechaEntrega(f => addDays(f, 1))} />
          </Row>
          <Row><Btn label="Termina hoy" size="sm" variant="ghost" onPress={()=>setFechaEntrega(isoDate())}/><Btn label="Último finalizado" size="sm" variant="ghost" onPress={()=>setFechaEntrega(limites(ventanaReciente(corte,duracion,true)).hasta.fecha)}/></Row>
          <Field label="Hora de inicio" hint="El fin se calcula según la duración elegida. A igual horario, son 24 horas.">
            <Input tipo="hora" label="Elegir hora de corte" value={corte} onChangeText={setCorte}/>
            <Chipbar>
              {['06:00', '07:00', '14:00', '19:00', '22:00', '23:00', '00:00'].map(h => (
                <Chip key={h} label={h} on={corte === h} onPress={() => {
                  setCorte(h);
                }} />
              ))}
            </Chipbar>
          </Field>
          </>:null}
          {!fechaCorrecta?<Banner kind="warn">Revise la fecha de entrega (AAAA-MM-DD).</Banner>:<Hint>{entradas.length+' registros incluidos. Desde el inicio indicado hasta antes del horario de fin.'}</Hint>}
        </Stack>
      </Card>

      {/* ---------- entradas ---------- */}
      <Card pad><Stack gap={10}>
        <Eyebrow>Buscar en el libro</Eyebrow>
        <Input label="Texto, persona, empresa o sector" value={busqueda} onChangeText={setBusqueda} placeholder="Ej.: limpieza, Oroño, apellido…"/>
        <Chipbar><Chip label="Todos" on={!filtros.length} onPress={()=>setFiltros([])}/>{FILTROS_LIBRO.map(f=><Chip key={f.v} label={f.t} on={filtros.includes(f.v)} onPress={()=>setFiltros(actual=>actual.includes(f.v)?actual.filter(v=>v!==f.v):[...actual,f.v])}/>)}</Chipbar>
        <Hint>{visibles.length+' de '+entradas.length+' registros del período. Puede combinar categorías. El informe para compartir incluye el período completo.'}</Hint>
        <Selector label="Filtrar por Gs" valor={gsVigente} onChange={setGs} opciones={[{v:'',t:'Todos los Gs'},...opcionesGs]}/>
        {filtros.length||busqueda||gsVigente?<Btn label="Limpiar filtros" size="sm" onPress={()=>{setFiltros([]);setBusqueda('');setGs('');}}/>:null}
      </Stack></Card>
      {dias.length ? dias.map(dia => (
        <Stack key={dia.fecha} gap={8}>
          <Eyebrow>{'Día ' + dmy(dia.fecha)}</Eyebrow>
          {dia.bloques.map(bloque=><Stack key={bloque.clave} gap={6}>
          <Text accessibilityRole="header" style={{color:t.text,fontFamily:FONT.bodySemi,fontSize:15}}>{bloque.firma}</Text>
          <Card>{bloque.entradas.map((e, i, lista) => (
            <FilaEntrada key={e.clave} e={e} last={i === lista.length - 1} onPress={() => {
              if (e.origen === 'novedad') { setEditar(st.byId<Novedad>('novedades', e.ids[0]) || null); return; }
              if (e.origen === 'acceso') {
                const registros = st.S.alogs.filter(a => e.ids.includes(a.id)).sort((a,b) => a.hora.localeCompare(b.hora));
                const g = registros[registros.length - 1]?.guardId || '';
                setEditar({ id: 'auto:' + e.clave, autoKey: e.clave, fecha: e.fecha, hora: e.hora,
                  guardId: g, createdBy:registros[0]?.createdBy||g, turnoId:registros[0]?.turnoId, lockedAt:registros[0]?.lockedAt, categoria: e.categoria||'Apertura', texto: e.texto + (e.items || []).map(x => '\n• ' + x).join(''), updatedAt: 0 });
              } else setDetalle(e);
            }} />
          ))}</Card>
          </Stack>)}
        </Stack>
      )) : <Card><Empty>{entradas.length?'No hay coincidencias. Pruebe otro texto o quite los filtros.':'No hay novedades en este período. Revise las fechas y el horario antes de generar el informe.'}</Empty></Card>}
      <Row gap={9}>
        <Btn label="Agregar novedad" icon="plus" variant="primary" style={{ flex: 1 }}
          disabled={!fechaCorrecta} onPress={() => setEditar(null)} />
        <Btn label="Ver informe" icon="informes" variant="ghost" style={{ flex: 1 }}
          onPress={() => setVista(true)} />
      </Row>

      <Btn label="Leer foto del libro físico" icon="informes" variant="ghost" onPress={() => setLeerLibro(true)} />
      {/* ---------- salida ---------- */}
      <Card pad>
        <Stack gap={11}>
          <Eyebrow>Compartir</Eyebrow>
          <RedaccionIA texto={borrador} categoria="Informe general"
            generarPrompt={v => promptInformeDia(v, { site: st.S.site.cliente, fecha: dmy(fecha), desde: corte, hasta: fin })}
            validar={validarRedaccionDia} onTexto={v => { setTexto(v); setFuente(borrador); setVista(true); }} />
          {redaccionVigente ? (
            <Banner kind="info" icon="check">
              {'El informe quedó redactado por la IA. Si desea volver al armado automático, seleccione Descartar redacción.'}
            </Banner>
          ) : null}
          {texto && !redaccionVigente ? <Banner kind="info">Los registros cambiaron. El informe ya incluye los datos actuales; puede volver a revisar la redacción con IA.</Banner> : null}
          {texto ? <Btn label="Descartar redacción" variant="ghost" size="sm" onPress={() => setTexto('')} /> : null}
          <Row gap={9}>
            <Btn label="Copiar" icon="copy" variant="primary" style={{ flex: 1 }}
              disabled={guardando||!fechaCorrecta} onPress={async () => {setGuardando(true);try{await guardar(); await Clipboard.setStringAsync(definitivo); toast('Informe copiado. Péguelo en el chat del supervisor.');}catch(e:any){toast(e.message);}finally{setGuardando(false);} }} />
            <Btn label={guardando?'Guardando…':'Exportar PDF'} disabled={guardando||!fechaCorrecta} icon="share" variant="ghost" style={{ flex: 1 }} onPress={()=>exportar()} />
          </Row>
          <Hint>Puede copiar el informe o exportarlo como PDF.</Hint>
        </Stack>
      </Card>

      <ImportarLibro abierto={leerLibro} fecha={fecha} onClose={() => setLeerLibro(false)} />
      <EditorNovedad abierto={editar !== undefined} novedad={editar || null} fecha={fecha} corte={corte} duracion={duracion}
        onGuardado={(dia,hora)=>{const v=ventanaDelHecho(dia,hora,horaCorte(st.S));setCorte(v.corte);setDuracion(24);setFechaEntrega(limites(v).hasta.fecha);setAhora(new Date());setAutomatico(v.fecha===ventanaReciente(v.corte,24,false).fecha);}}
        onClose={() => setEditar(undefined)} />
      <Sheet visible={!!detalle} title={detalle ? detalle.hora + ' · Detalle' : 'Detalle'} onClose={() => setDetalle(null)}>
        <Text selectable style={{ fontFamily: FONT.body, fontSize: 15, lineHeight: 23, color: t.text }}>
          {detalle?.texto}{detalle?.items?.map(i => '\n• ' + i).join('')}
        </Text>
      </Sheet>

      <Sheet visible={vista} title="Informe de novedades" onClose={() => setVista(false)}
        footer={
          <Btn label="Copiar" icon="copy" variant="primary" style={{ flex: 1 }}
            onPress={async () => { await Clipboard.setStringAsync(definitivo); toast('Informe copiado'); }} />
        }>
        <View style={{
          backgroundColor: t.surface2, borderWidth: 1, borderColor: t.line, borderRadius: 12, padding: 14,
        }}>
          <Text selectable style={{ fontFamily: FONT.mono, fontSize: 12, lineHeight: 19, color: t.text }}>
            {definitivo}
          </Text>
        </View>
      </Sheet>
    </Pantalla>
  );
}

/* ---------------- una entrada de la lista ---------------- */
function FilaEntrada({ e, last, onPress }: { e: EntradaDia; last: boolean; onPress: () => void }) {
  const resumen = resumenCorto(e);
  return (
    <Item last={last} lead={e.hora} onPress={onPress} tituloLineas={2} lineas={1}
      title={e.items && e.items.length ? e.texto.replace(/:$/, '') : e.texto}
      subs={[e.firma||null,e.items && e.items.length ? resumen : null]}
      right={<Tag label={e.categoria||'NOVEDAD'}
        kind={e.origen === 'acceso' ? 'acc' : 'mute'} />} />
  );
}

