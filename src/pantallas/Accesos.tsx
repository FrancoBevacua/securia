import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useStore } from '../store';
import { motivoSoloLectura, turnoAbierto } from '../servicio';
import SelectorFirma from './SelectorFirma';
import {nuevoAcceso,mismoNombre} from '../altasCatalogo';
import ServicioActual from './ServicioActual';
import TipoAcceso from './TipoAcceso';
import SeleccionAccesos from './SeleccionAccesos';
import PuertasAcceso from './PuertasAcceso';
import LeerPrecintos from './LeerPrecintos';
import {puertasDeAcceso,inicioPrecinto,nuevasPuertas,precintosPorton,completarPuertas} from '../precintos';
import {validarGuardiaEnServicio} from '../controlesServicio';
import { alogsDe, catalogoAccesos, ultimoPrecinto } from '../logic';
import {
  AccesoLog, AccesoCat, PuertaPrecintos, TipoAccesoFisico, ConfiguracionPorton, SeleccionAccesos as DatosSeleccion, DOW,
  addDays, dmy, hhmm, isoDate, parseISO, uid,
  prefijoPrecinto, sufijoPrecinto, armarPrecinto, soloDigitos,
} from '../model';
import { gsName, textoInformeAccesos, textoAlogLibro, lineaPrecintos, motivoDeAcceso, nombreGrupoAccesos, listaAccesos, OpcInforme } from '../text';
import { FONT } from '../theme';
import {
  useTheme, Pantalla, Cabecera, Card, Btn, Tag, Seg, Item, Empty, Stack, Row, Chip, Chipbar,
  Input, Selector, Sheet, Toggle, Confirmar, Field, Eyebrow, useToast, Hint, Banner,
} from '../ui';

export default function Accesos() {
  const st = useStore();
  const t = useTheme();
  const toast = useToast();
  const [modo, setModo] = useState('reg');
  const [fecha, setFecha] = useState(isoDate());
  const [editar, setEditar] = useState<AccesoLog | null | undefined>(undefined);
  const [cat, setCat] = useState<AccesoCat | null | undefined>(undefined);
  const [informe, setInforme] = useState(false);


  const rows = alogsDe(st.S, fecha);
  const ap = rows.filter(r => r.tipo === 'apertura').length;
  const ci = rows.length - ap;
  const catalogo = catalogoAccesos(st.S);

  return (
    <Pantalla>
      <Cabecera titulo="Accesos" sub="Aperturas y cierres de puertas, portones y otros accesos para CCTV."
        derecha={modo === 'reg' ? <Btn icon="plus" variant="primary" onPress={() => setEditar(null)} /> : undefined} />

      <Seg acento valor={modo} onChange={setModo}
        opciones={[{ v: 'reg', t: 'Registros' }, { v: 'cat', t: 'Catálogo' }]} />

      {modo === 'reg' ? (
        <Stack gap={14}>
          <Row>
            <Btn icon="back" variant="ghost" size="sm" onPress={() => setFecha(f => addDays(f, -1))} />
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontFamily: FONT.disp, fontSize: 18, color: t.text }}>
                {DOW[parseISO(fecha).getDay()] + ' ' + dmy(fecha)}
              </Text>
              <Hint>{ap + ' apertura' + (ap === 1 ? '' : 's') + ' · ' + ci + ' cierre' + (ci === 1 ? '' : 's')}</Hint>
            </View>
            <Btn icon="back" variant="ghost" size="sm" style={{ transform: [{ scaleX: -1 }] }}
              onPress={() => setFecha(f => addDays(f, 1))} />
          </Row>

          {rows.length ? (
            <>
              <Card>
                {rows.map((r, i) => (
                  <Item key={r.id} last={i === rows.length - 1}
                    stripe={r.tipo === 'apertura' ? 'acc' : 'info'}
                    lead={r.hora} title={r.acceso}
                    tituloLineas={1} lineas={1}
                    subs={[r.gs, lineaPrecintos(r).replace('\n', ' · ') || r.nota || null, motivoDeAcceso(r) || null]}
                    right={<Tag label={r.tipo === 'apertura' ? 'Apert.' : 'Cierre'} kind={r.tipo === 'apertura' ? 'acc' : 'info'} />}
                    onPress={() => setEditar(r)} />
                ))}
              </Card>
              <Btn label="Generar informe para CCTV" icon="copy" variant="primary" onPress={() => setInforme(true)} />
            </>
          ) : (
            <Card><Empty>Sin registros para este día. Seleccione el botón + para cargar la primera apertura o cierre.</Empty></Card>
          )}
        </Stack>
      ) : (
        <Stack gap={14}>
          {catalogo.length ? (
            <Card>
              {catalogo.map((c, i) => (
                <Item key={c.id} last={i === catalogo.length - 1} lead={String(i + 1)}
                  title={c.nombre}
                  subs={[c.tipo.charAt(0).toUpperCase() + c.tipo.slice(1) + ' · ' +
                    (c.precintos ? c.precintos + ' precinto' + (c.precintos > 1 ? 's' : '') : 'sin precinto')]}
                  onPress={() => setCat(c)} />
              ))}
            </Card>
          ) : (
            <Card><Empty>Cargue acá las puertas, portones y accesos de su puesto. Después los seleccionás de una lista.</Empty></Card>
          )}
          <Btn label="Agregar acceso al catálogo" icon="plus" variant="ghost" onPress={() => setCat(null)} />
        </Stack>
      )}

      <EditorAlog abierto={editar !== undefined} registro={editar || null} fecha={fecha}
        onClose={() => setEditar(undefined)} />
      <EditorCatalogo abierto={cat !== undefined} item={cat || null} onClose={() => setCat(undefined)} />
      <HojaInforme visible={informe} fecha={fecha} onClose={() => setInforme(false)} />
    </Pantalla>
  );
}

/* ---------------- registro de apertura o cierre ---------------- */
function EditorAlog({ abierto, registro, fecha, onClose }: {
  abierto: boolean; registro: AccesoLog | null; fecha: string; onClose: () => void;
}) {
  const st = useStore();
  const toast = useToast();
  const [tipo, setTipo] = useState<'apertura' | 'cierre'>('apertura');
  const [acceso, setAcceso] = useState('');
  const [seleccion, setSeleccion] = useState<DatosSeleccion>({});
  const [hora, setHora] = useState(hhmm());
  const [guardId, setGuardId] = useState('');
  const [puertas,setPuertas]=useState<PuertaPrecintos[]>(puertasDeAcceso());
  const [leerPrecintos,setLeerPrecintos]=useState(false);
  const [nota, setNota] = useState('');
  const [tipoAcceso,setTipoAcceso]=useState<TipoAccesoFisico>('emergencia');
  const [configuracion,setConfiguracion]=useState<ConfiguracionPorton>('ingreso');
  const [sinPrecinto,setSinPrecinto]=useState(false);
  const [alta,setAlta]=useState(false);

  const catalogo = catalogoAccesos(st.S);
  const sug = ultimoPrecinto(st.S);
  /* El prefijo sale del último precinto cargado; si todavía no hay ninguno,
     del que esté guardado en Ajustes. */
  const pref = prefijoPrecinto(sug) || soloDigitos(st.S.site.precintoPrefijo).slice(0, 4);

  useEffect(() => {
    if (!abierto) return;
    setTipo((registro?.tipo as any) || 'apertura');
    setAcceso(registro?.acceso || '');
    setSeleccion({grupoAccesos:registro?.grupoAccesos,accesos:registro?.accesos});
    setAlta(false);
    setLeerPrecintos(false);
    setHora(registro?.hora || hhmm());
    setGuardId(registro?.guardId || st.responsable?.id || '');
    const inicial=puertasDeAcceso(registro);
    if(!registro)inicial[0].precintos=[inicioPrecinto(pref)];
    setPuertas(inicial);
    setNota(registro?.nota || '');
    setTipoAcceso(registro?.tipoAcceso||'emergencia');
    setConfiguracion(registro?.configuracionPorton||'ingreso');
    setSinPrecinto(registro?.sinPrecinto??(!!registro&&!(registro.p1||registro.p2||registro.puertas?.some(p=>p.precintos.some(Boolean)))));
  }, [abierto, registro?.id]);

  const varios = !!seleccion.grupoAccesos;
  const nombreAcceso = seleccion.grupoAccesos ? nombreGrupoAccesos(seleccion.grupoAccesos) : acceso.trim();
  const mensajeGrupo = varios ? textoAlogLibro({tipo,acceso:nombreAcceso,...seleccion,incluirMotivo:false,nota,p1:'',p2:''} as AccesoLog) : '';

  const guardar = (agregar?:boolean) => {
    if (varios ? !listaAccesos(seleccion).length : !acceso.trim()) { toast('Indique el acceso'); return; }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) { toast('Ingrese una hora válida (HH:MM)'); return; }
    const g = st.byId<any>('guards', guardId);
    if(!g||g.deleted){toast('Seleccione el vigilador que realizó la novedad');return;}
    let completas:PuertaPrecintos[];
    try{completas=varios?[]:completarPuertas(tipoAcceso==='porton'?precintosPorton(puertas,pref):puertas,pref,sinPrecinto);}catch(e:any){toast(e.message);return;}
    const numeros=completas.flatMap(p=>p.precintos);
    const n1=numeros[0]||'',n2=numeros[1]||'';
    const nuevoPref = prefijoPrecinto(numeros[numeros.length-1] || '') || pref;
    const id = registro?.id || uid();
    const vinculadas = st.list<any>('novedades').filter(n => n.alogId === id);
    const novId = undefined; // No agregar aperturas ni cierres de la seccion Accesos al libro automáticamente
    const r = {
      id, tipo, hora: hora || hhmm(), guardId: g.id,
      gs: gsName(g, st.S.site), acceso:nombreAcceso, ...seleccion, p1: n1, p2: n2, puertas:completas,
      nota, fecha, incluirMotivo:false, motivo:undefined, tipoAcceso, configuracionPorton:tipoAcceso==='porton'?undefined:configuracion, sinPrecinto:varios?false:sinPrecinto,
      orden: registro?.orden ?? Date.now(),
      novId, p1tipo: '', p2tipo: '',
    };
    const falta=!varios&&!st.S.accesses.some(c=>!c.deleted&&mismoNombre(c.nombre,acceso));
    if(falta&&agregar===undefined){setAlta(true);return;}setAlta(false);
    const cambios: any[] = [{ col: 'alogs', obj: r }];
    if (falta && agregar) {
      cambios.push({ col: 'accesses', obj: {
        id: uid(), nombre: acceso, tipo: tipoAcceso, configuracionPorton:tipoAcceso==='porton'?undefined:configuracion, sinPrecinto,
        precintos: numeros.length, orden: Date.now(),
      } });
    }
    if (novId) {
      cambios.push({ col: 'novedades', obj: {
        id: novId, fecha: r.fecha, hora: r.hora, guardId: r.guardId,
        categoria: 'Acceso', texto: textoAlogLibro(r as any), alogId: r.id, acc: null,
      } });
      vinculadas.filter(n => n.id !== novId).forEach(n => cambios.push({ col: 'novedades', obj: { id: n.id, deleted: true } }));
    }
    st.putVarios(cambios);
    if (nuevoPref) st.setSite({ precintoPrefijo: nuevoPref });
    onClose();
    toast('Registro guardado');
  };

  const motivo = registro ? motivoSoloLectura(st.S, { ...registro, guardId: registro.createdBy || registro.guardId } as any, st.me?.id, st.telefonoId) : '';
  if (motivo) return <Sheet visible={abierto} title="Detalle del acceso" onClose={onClose}><Banner kind="info">{motivo}</Banner><Input label="Registro" value={textoAlogLibro(registro!)} editable={false} multiline rows={8} /></Sheet>;
  if (!turnoAbierto(st.S, st.me?.id, st.telefonoId)) return <Sheet visible={abierto} title="Registrar acceso" onClose={onClose}><ServicioActual /></Sheet>;

  return (
      <><Sheet visible={abierto&&!leerPrecintos} title={registro ? 'Editar registro' : 'Registrar acceso'} onClose={onClose}
      footer={
        <>
          {registro ? (
            <Btn icon="trash" variant="danger" onPress={() => {
              st.putVarios([{ col: 'alogs', obj: { id: registro.id, deleted: true } },
                ...st.list<any>('novedades').filter(n => n.alogId === registro.id || n.id === registro.novId).map(n => ({ col: 'novedades' as const, obj: { id: n.id, deleted: true } }))]); onClose(); toast('Registro eliminado');
            }} />
          ) : null}
          <Btn label={registro ? 'Guardar' : 'Agregar a la lista'} variant="primary" style={{ flex: 1 }} onPress={()=>guardar()} />
        </>
      }>
      <Seg acento valor={tipo} onChange={v => setTipo(v as any)}
        opciones={[{ v: 'apertura', t: 'Apertura' }, { v: 'cierre', t: 'Cierre' }]} />
      <SeleccionAccesos datos={{acceso,...seleccion}} catalogo={catalogo} onChange={cambio=>{
        if(cambio.acceso!==undefined)setAcceso(cambio.acceso);
        if('grupoAccesos' in cambio || 'accesos' in cambio)setSeleccion(s=>({...s,...cambio}));
      }} onElegirCatalogo={c=>{
        const tp:TipoAccesoFisico=c.tipo==='porton'?'porton':['pecera','ventanal','otro','acceso'].includes(c.tipo)?'otro':'emergencia';
        setTipoAcceso(tp);setConfiguracion(c.configuracionPorton||'ingreso');setSinPrecinto(c.sinPrecinto??(c.precintos===0||tp==='otro'));
        const ps=nuevasPuertas(tp,c.configuracionPorton,pref);
        if(tp==='emergencia'&&c.precintos>0)ps[0].precintos=Array(Math.min(c.precintos,20)).fill(inicioPrecinto(pref));
        setPuertas(ps);
      }}/>
      {alta?<Confirmar visible etiqueta="Aceptar" variante="primary" mensaje="El acceso no existe. ¿Desea agregarlo al catálogo? Si cancela, se guarda sólo el registro." onOk={()=>guardar(true)} onCancel={()=>guardar(false)}/>:null}

      <Row gap={11} style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Input tipo="hora" label="Hora" value={hora} onChangeText={setHora} mono keyboardType="numbers-and-punctuation" />
        </View>
        <View style={{ flex: 1 }}>
          <SelectorFirma label="Vigilador" valor={guardId} onChange={setGuardId}/>
        </View>
      </Row>
      {varios ? <Hint>Para registrar puertas y precintos, cargue cada acceso por separado.</Hint> : <>
       <TipoAcceso tipo={tipoAcceso} configuracion={configuracion} sinPrecinto={sinPrecinto} onChange={(tp,cf,sp)=>{setTipoAcceso(tp);setConfiguracion(cf);setSinPrecinto(sp);if(tp!==tipoAcceso||cf!==configuracion||(!sp&&!puertas.length))setPuertas(nuevasPuertas(tp==='otro'?'emergencia':tp,cf,pref));}}/>
       {!sinPrecinto?<><PuertasAcceso valor={puertas} onChange={setPuertas} prefijo={pref} porton={tipoAcceso==='porton'}/><Btn label="Leer precintos con cámara" icon="informes" disabled={!acceso.trim()} onPress={()=>setLeerPrecintos(true)}/></>:null}
      </>}
      <Input label="Nota (opcional)" value={nota} onChangeText={setNota} placeholder="Camión de descarga KFC" />
      {varios ? <>
        <Input label="Mensaje automático" value={mensajeGrupo} editable={false} multiline rows={6} fixedHeight/>
        <Btn label="Copiar mensaje" icon="copy" disabled={!listaAccesos(seleccion).length}
          onPress={async()=>{await Clipboard.setStringAsync(mensajeGrupo);toast('Mensaje copiado');}}/>
      </> : null}
    </Sheet><LeerPrecintos visible={abierto&&leerPrecintos} acceso={acceso} porton={tipoAcceso==='porton'} onClose={()=>setLeerPrecintos(false)} onAceptar={setPuertas}/></>
  );
}

/* ---------------- catálogo ---------------- */
function EditorCatalogo({ abierto, item, onClose }: { abierto: boolean; item: AccesoCat | null; onClose: () => void }) {
  const st = useStore();
  const toast = useToast();
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('porton');
  const [precintos, setPrecintos] = useState('1');
  const [configuracion,setConfiguracion]=useState<ConfiguracionPorton>('ingreso');
  const [sinPrecinto,setSinPrecinto]=useState(false);

  useEffect(() => {
    if (!abierto) return;
    setNombre(item?.nombre || '');
    setTipo(item?.tipo==='porton'?'porton':!item||['puerta','emergencia'].includes(item.tipo)?'emergencia':'otro');
    setConfiguracion(item?.configuracionPorton||'ingreso');setSinPrecinto(item?.sinPrecinto??item?.precintos===0);
    setPrecintos(String(item?.precintos ?? 1));
  }, [abierto, item?.id]);

  return (
    <Sheet visible={abierto} title={item ? 'Editar acceso' : 'Nuevo acceso'} onClose={onClose}
      footer={
        <>
          {item ? <Btn icon="trash" variant="danger" onPress={() => { st.drop('accesses', item.id); onClose(); toast('Acceso quitado'); }} /> : null}
          <Btn label="Guardar" variant="primary" style={{ flex: 1 }} onPress={() => {
            if (!nombre.trim()) { toast('Ingrese un nombre'); return; }
            if(!sinPrecinto&&(!/^\d{1,3}$/.test(precintos)||+precintos<1)){toast('Indique una cantidad válida de precintos.');return;}
            st.put('accesses', {
              id: item?.id || uid(), nombre, tipo, configuracionPorton:configuracion,sinPrecinto, precintos:sinPrecinto?0:+precintos,
              orden: item?.orden ?? Date.now(),
            });
            onClose(); toast('Acceso guardado');
          }} />
        </>
      }>
      <Input label="Nombre" value={nombre} onChangeText={setNombre} placeholder="Portón ingreso Oroño" />
      <TipoAcceso tipo={tipo as TipoAccesoFisico} configuracion={configuracion} sinPrecinto={sinPrecinto} onChange={(tp,cf,sp)=>{setTipo(tp);setConfiguracion(cf);setSinPrecinto(sp);}}/>
      {!sinPrecinto&&tipo!=='porton'?<Input label="Cantidad de precintos" value={precintos} onChangeText={v=>setPrecintos(soloDigitos(v).slice(0,3))} keyboardType="number-pad" hint="Cantidad habitual; puede agregar puertas al registrar."/>:null}
    </Sheet>
  );
}

/* ---------------- informe para CCTV ---------------- */
function HojaInforme({ visible, fecha, onClose }: { visible: boolean; fecha: string; onClose: () => void }) {
  const st = useStore();
  const t = useTheme();
  const toast = useToast();
  const [o, setO] = useState<OpcInforme>({ orden: 'carga', tipo: 'ambos', encabezado: false });
  const texto = textoInformeAccesos(alogsDe(st.S, fecha), fecha, o, st.S.site);
  const advertencias=alogsDe(st.S,fecha).filter(r=>o.tipo==='ambos'||r.tipo===o.tipo).flatMap(r=>{try{validarGuardiaEnServicio(st.S,r.guardId,r.fecha,r.hora);return [];}catch(e:any){return [r.acceso+': '+e.message];}});

  return (
    <Sheet visible={visible} title="Informe para CCTV" onClose={onClose}
      footer={
        <Btn label="Copiar" icon="copy" variant="primary" style={{ flex: 1 }} disabled={!!advertencias.length}
          onPress={async () => { await Clipboard.setStringAsync(texto); toast('Informe copiado. Péguelo en el chat del CCTV.'); }} />
      }>
      {advertencias.length?<Banner kind="warn">{advertencias.join('\n')}</Banner>:<Banner kind="info">Guardias verificados en servicio para los horarios registrados.</Banner>}
      <Field label="Incluir">
        <Seg valor={o.tipo} onChange={v => setO(x => ({ ...x, tipo: v as any }))}
          opciones={[{ v: 'ambos', t: 'Todo' }, { v: 'apertura', t: 'Aperturas' }, { v: 'cierre', t: 'Cierres' }]} />
      </Field>
      <Field label="Ordenar por">
        <Chipbar>
          {[['carga', 'Orden de carga'], ['hora', 'Hora'], ['guardia', 'Vigilador'], ['acceso', 'Acceso']].map(([v, lab]) => (
            <Chip key={v} label={lab} on={o.orden === v} onPress={() => setO(x => ({ ...x, orden: v as any }))} />
          ))}
        </Chipbar>
      </Field>
      <Toggle label="Encabezado con fecha y site" value={o.encabezado}
        onChange={v => setO(x => ({ ...x, encabezado: v }))} />
      <Eyebrow>Vista previa</Eyebrow>
      <View style={{
        backgroundColor: t.surface2, borderWidth: 1, borderColor: t.line, borderRadius: 12, padding: 14,
      }}>
        <Text selectable style={{ fontFamily: FONT.mono, fontSize: 12.5, lineHeight: 20, color: t.text }}>
          {texto || 'Sin registros para el filtro elegido.'}
        </Text>
      </View>
    </Sheet>
  );
}
