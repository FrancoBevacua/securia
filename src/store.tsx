/* Estado de la aplicación: memoria, persistencia local y acciones. */
import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import { almacenLocal } from './almacenLocal';
import { prepararFoto, leerBytes, bytesBase64 } from './media';
import { File, Directory, Paths } from 'expo-file-system';
import {
  Estado, Col, Rec, Vigilador, estadoVacio, merge, uid, now, isoDate, titulo,
} from './model';
import { PUESTOS_BASE, ACCESOS_BASE, CONTACTOS_BASE, RONDA_BASE, VIGILADORES_BASE } from './seed';
import { setVocabulario } from './assistant';
import type { ModoTema } from './ui';
import { PALETA_DEFECTO, PaletaId } from './theme';
import { iniciarServicio, cerrarServicio, validarCambioNovedad, turnoAbierto, motivoSoloLectura, horaValida, fechaValida, esAdministrador } from './servicio';
import { guardarPIN, tienePIN, borrarPIN } from './cuentas';
import { aplicarCambios, restaurarRespaldo } from './mutaciones';
import * as nube from './nube';
import {CODIGO_CORPORATIVO} from './provisionCorporativa';
import {asegurarPuestosCobertura,idsPuestosGuardia,validarPuestosGuardia} from './puestosGuardia';
import {guardiaResponsable,cambiarResponsable,pinCorporativoValido} from './corporativo';
import {verificarPIN} from './cuentas';

const K_ESTADO = 'consigna.estado.v1';
const K_SESION = 'consigna.sesion.v1';
const K_TEMA = 'consigna.tema';
const K_PALETA = 'consigna.paleta';
const K_ASIS = 'consigna.asistente';
const K_AVISOS = 'consigna.avisos';
const K_DISENO = 'securia.diseno';

type Ctx = {
  listo: boolean;
  telefonoId:string;
  errorInicio:string;
  errorGuardado:string;
  confirmarGuardado:()=>Promise<void>;
  reintentarInicio:()=>void;
  S: Estado;
  me: Vigilador | null;
  responsable: Vigilador | null;
  seleccionarResponsable:(id:string)=>Promise<void>;
  ingresarCorporativo:(pin:string)=>Promise<void>;
  tema: ModoTema;
  paleta: PaletaId;
  asistente: boolean;
  avisos: boolean;
  setTema: (m: ModoTema) => void;
  setPaleta: (p: PaletaId) => void;
  setAsistente: (v: boolean) => void;
  setAvisos: (v: boolean) => void;
  entrar: (id: string) => void;
  salir: () => Promise<void>;
  ingresarNube: (dni:string,pin:string,puestoId?:string) => Promise<void>;
  vincularCuentaNube: (dni:string,pin:string,nombre:string,nacimiento:string) => Promise<void>;
  registrarNube: (g:Vigilador,pin:string) => Promise<void>;
    entrarCorporativo:(id:string,pin:string)=>Promise<void>;
  reintentarNube: () => Promise<void>;
  resolverDiferencias:(r:nube.RevisionDiferencias,op:('local'|'remoto')[])=>Promise<void>;
  recuperarSincronizacion:()=>Promise<nube.ResultadoRecuperacion|null>;
  reiniciarSesionRecuperada:()=>Promise<void>;
  cargarCatalogoNube: () => Promise<void>;
  list: <T = any>(c: Col) => T[];
  byId: <T = any>(c: Col, id: string) => T | undefined;
  put: <T extends Partial<Rec>>(c: Col, obj: T) => T & Rec;
  putVarios: (cambios: { col: Col; obj: any }[]) => void;
  drop: (c: Col, id: string) => void;
  setSite: (s: Partial<Estado['site']>) => void;
  reemplazar: (e: Estado) => void;
  guardarFoto: (uri: string) => Promise<string>;
  guardarArchivo: (uri: string, nombre: string) => Promise<string>;
  esAdmin: boolean;
};

const StoreCtx = createContext<Ctx>(null as any);
export const useStore = () => useContext(StoreCtx);
export const useEstadoNube = () => useSyncExternalStore(nube.escucharNube,nube.verEstadoNube,nube.verEstadoNube);

/* ---------- semillas y migraciones ---------- */
function sembrarPuestos(S: Estado) {
  if (S.posts.length) return;
  PUESTOS_BASE.forEach((p, i) => {
    const id = uid();
    S.posts.push({ id, nombre: p.n, descripcion: p.d, orden: i, updatedAt: now() });
    p.turnos.forEach((tn, k) => {
      const fid = uid();
      S.franjas.push({
        id: fid, puestoId: id, nombre: tn.nombre, alias: tn.alias,
        entrada: tn.entrada, salida: tn.salida, orden: k, updatedAt: now(),
      });
      tn.dirs.forEach(d => S.directives.push({
        id: uid(), hora: d[0], nombre: d[1], novedades: d[2] || '',
        dias: [], puestoId: id, puesto: p.n, franjaId: fid, activa: true, updatedAt: now(),
      }));
    });
  });
}
export function sembrarEquipo(S: Estado) {
  if (S.guards.length) return;
  VIGILADORES_BASE.forEach(([apellido, nombre]) => S.guards.push({
    id: uid(), apellido, nombre, edad: '', email: '', tel: '',
    puestoId: '', franjaId: '', legajo: '', foto: '',
    horaIn: '', horaOut: '', francos: '', rol: 'vigilador', updatedAt: now(),
  }));
}
export function sembrarCatalogo(S: Estado) {
  if (S.accesses.length) return;
  ACCESOS_BASE.forEach((n: string, i: number) => S.accesses.push({
    id: uid(), nombre: n,
    tipo: /Pecera/.test(n) ? 'pecera' : /Puerta/.test(n) ? 'puerta' : 'porton',
    precintos: /Pecera|Bar Cup/.test(n) ? 0 : 1,
    orden: i, updatedAt: now(),
  }));
  S.rtemplates.push({ id: uid(), nombre: RONDA_BASE.nombre, puntos: RONDA_BASE.puntos.slice(), updatedAt: now() });
  CONTACTOS_BASE.forEach((c: string[]) => S.contacts.push({ id: uid(), nombre: c[0], rol: c[1], tel: c[2], updatedAt: now() }));
}
function migrar(S: Estado) {
  if (!S.posts) (S as any).posts = [];
  if (!S.franjas) (S as any).franjas = [];
  const vivos = <T extends Rec>(a: T[]) => (a || []).filter(x => !x.deleted);
  if (!S.posts.length && !vivos(S.guards).length) { sembrarPuestos(S); }
  else if (!S.posts.length) {
    const nombres: string[] = [];
    const add = (n?: string) => { n = String(n || '').trim(); if (n && nombres.indexOf(n) < 0) nombres.push(n); };
    vivos(S.guards).forEach(g => add(g.puesto));
    vivos(S.directives).forEach(d => add(d.puesto));
    const mapa: Record<string, string> = {};
    nombres.forEach((n, i) => { const id = uid(); mapa[n] = id; S.posts.push({ id, nombre: n, descripcion: '', orden: i, updatedAt: now() }); });
    vivos(S.guards).forEach(g => { if (g.puesto && mapa[g.puesto]) { g.puestoId = mapa[g.puesto]; g.updatedAt = now(); } });
    vivos(S.directives).forEach(d => { if (d.puesto && mapa[d.puesto]) { d.puestoId = mapa[d.puesto]; d.updatedAt = now(); } });
  }
  const gs = vivos(S.guards);
  asegurarPuestosCobertura(S);
  gs.forEach(g => {
    if (!g.puestoId && g.puesto) {
      const p = vivos(S.posts).find(x => x.nombre === g.puesto);
      if (p) { g.puestoId = p.id; g.updatedAt = now(); }
    }
    if (!g.franjaId && g.puestoId) {
      const f = vivos(S.franjas).filter(x => x.puestoId === g.puestoId).sort((a, b) => a.orden - b.orden)[0];
      if (f) { g.franjaId = f.id; g.horaIn = g.horaIn || f.entrada; g.horaOut = g.horaOut || f.salida; g.updatedAt = now(); }
    }
  });
}
function vocabulario(S: Estado): string[] {
  const out: string[] = [];
  S.accesses.forEach(a => out.push(a.nombre));
  S.posts.forEach(p => out.push(p.nombre));
  S.franjas.forEach(f => out.push(f.alias || ''));
  S.guards.forEach(g => { out.push(g.apellido); out.push(g.nombre); });
  out.push(S.site.cliente, S.site.nombre);
  return out.filter(Boolean);
}
function actualizarVocabulario(S:Estado,prev?:Estado){
  if(!prev||S.accesses!==prev.accesses||S.posts!==prev.posts||S.franjas!==prev.franjas||S.guards!==prev.guards||S.site!==prev.site)
    setVocabulario(vocabulario(S));
}

function perfilTelefono(e:Estado,g:Vigilador){
  if(g.corporativo)return g;
  const p=turnoAbierto(e,g.id,nube.telefonoId?.());
  const puestoId=p?.puestoId||g.puestoId,franjaId=p?.franjaId||g.franjaId;
  return puestoId===g.puestoId&&franjaId===g.franjaId?g:{...g,puestoId,franjaId};
}

/* ---------- proveedor ---------- */
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [S, setS] = useState<Estado>(() => estadoVacio());
  const [me, setMe] = useState<Vigilador | null>(null);
  const meRef=useRef<Vigilador|null>(null);meRef.current=me;
  const [listo, setListo] = useState(false);
  const [errorInicio,setErrorInicio]=useState('');
  const [errorGuardado,setErrorGuardado]=useState('');
  const [intentoInicio,setIntentoInicio]=useState(0);
  const [tema, setTemaEstado] = useState<ModoTema>('dark');
  const [paleta, setPaletaEstado] = useState<PaletaId>(PALETA_DEFECTO);
  const [asistente, setAsisEstado] = useState(true);
  const [avisos, setAvisosEstado] = useState(true);
  const ref = useRef<Estado>(S);
  const baseVista=useRef<Estado|undefined>(undefined);
  const vistaPersistida=useRef<Estado|undefined>(undefined);
  const guardadoLocal = useRef<Promise<void>>(Promise.resolve());

  const publicarConfirmado=useCallback((actual:Estado,confirmado:Estado)=>{
    if(ref.current!==actual)return;
    baseVista.current=confirmado;
    vistaPersistida.current=confirmado;
    if(actual===confirmado)return;
    ref.current=confirmado;setS(confirmado);
    if(actual.guards!==confirmado.guards||actual.punches!==confirmado.punches){
      const guardia=meRef.current;
      const perfil=guardia&&confirmado.guards.find(x=>x.id===guardia.id&&!x.deleted);
      if(perfil){const siguiente=perfilTelefono(confirmado,perfil);meRef.current=siguiente;setMe(siguiente);}
    }
    actualizarVocabulario(confirmado,actual);
  },[]);

  /* carga inicial */
  useEffect(() => {
    setListo(false);setErrorInicio('');
    (async () => {
      try {
        // Desde 1.4.2 no se ejecuta ninguna limpieza de cuentas, claves ni historial.
        let vinculada=await nube.iniciarNube();
        if(Platform.OS!=='web'&&!vinculada){await nube.conectarTelefono();vinculada=true;}
        const [crudo, sesion, tm, pal, asis, avi, diseno] = await Promise.all([
          vinculada ? Promise.resolve(null) : almacenLocal.getItem(K_ESTADO), vinculada ? Promise.resolve(null) : AsyncStorage.getItem(K_SESION),
          AsyncStorage.getItem(K_TEMA), AsyncStorage.getItem(K_PALETA),
          AsyncStorage.getItem(K_ASIS), AsyncStorage.getItem(K_AVISOS),
          AsyncStorage.getItem(K_DISENO),
        ]);
        let e = crudo ? merge(estadoVacio(), JSON.parse(crudo)) : estadoVacio();
        if(vinculada){
          const recuperada=await nube.restaurarSesionNube();
          if(recuperada){
            e=recuperada.estado;baseVista.current=recuperada.base;vistaPersistida.current=e;
            const g=e.guards.find(g=>g.id===recuperada.guardia&&!g.deleted);
            if(g){const abierta=abrirActividad(e,g);if(abierta!==e)await persistir(abierta,e);e=abierta;setMe(perfilTelefono(e,g));}
          }
          // La pantalla de PIN no usa el catálogo. El acceso autenticado lo trae
          // junto con la sesión; no bloquear el inicio con una consulta duplicada.
          else e=estadoVacio();
        }
        else migrar(e);
        for (const g of e.guards) {
          if (g.cuenta && g.pin) {
            if (!await tienePIN(g.id)) await guardarPIN(g.id, g.pin);
            delete g.pin;
          }
        }
        setVocabulario(vocabulario(e));
        ref.current = e; setS(e);
        if(!vinculada)await almacenLocal.setItem(K_ESTADO, JSON.stringify(e));
        if (sesion && Platform.OS==='web') {
          const g = e.guards.find(x => x.id === sesion && !x.deleted);
          if (g?.cuenta) {e=abrirActividad(e,g);ref.current=e;setS(e);await almacenLocal.setItem(K_ESTADO,JSON.stringify(e));setMe(g);}
        }
        if (tm) setTemaEstado(tm as ModoTema);
        if (pal) setPaletaEstado(pal as PaletaId);
        if(diseno!=='centro-control'){
          setTemaEstado('dark');setPaletaEstado('securia');
          await Promise.all([[K_TEMA,'dark'],[K_PALETA,'securia'],[K_DISENO,'centro-control']].map(([k,v])=>AsyncStorage.setItem(k,v))).catch(()=>{});
        }
        if (asis != null) setAsisEstado(asis !== '0');
        if (avi != null) setAvisosEstado(avi !== '0');
      } catch (err) {
        setErrorInicio(err instanceof Error?err.message:'No se pudo preparar el acceso. Vuelva a intentar.');
        console.warn('No se pudo leer el estado guardado', err);
      } finally {
        setListo(true);
      }
    })();
  }, [intentoInicio]);

  const persistir = useCallback((e: Estado,anterior?:Estado) => {
    const base=baseVista.current;
    const escritura=guardadoLocal.current.catch(()=>{}).then(async()=>{
      if(nube.verEstadoNube().vinculada){
        await nube.guardarLocal(e,confirmado=>publicarConfirmado(e,confirmado),base,anterior===vistaPersistida.current?anterior:undefined);
      }else await almacenLocal.setItem(K_ESTADO,JSON.stringify(e));
      vistaPersistida.current=e;
    });
    guardadoLocal.current=escritura;
    escritura.then(()=>{if(guardadoLocal.current===escritura)setErrorGuardado('');},()=>{
      if(guardadoLocal.current===escritura)setErrorGuardado('No se pudo guardar el último cambio en el teléfono. Mantenga la aplicación abierta y pulse Reintentar.');
    });
    return escritura;
  }, [publicarConfirmado]);

  // Reintenta al volver a la app y cada 30 s en primer plano. La copia local
  // nunca espera Internet y la confirmación remota no pisa nuevas ediciones.
  useEffect(()=>{
    if(!listo||!me||!nube.verEstadoNube().vinculada)return;
    let ocupado=false;
    const reintentar=async(alVolver=false)=>{
      if(ocupado||AppState.currentState!=='active'||nube.revisionEnCurso?.()||nube.verEstadoNube().guardando||nube.verEstadoNube().reautenticar)return;
      if(!alVolver&&!errorGuardado&&!nube.verEstadoNube().pendiente&&Date.now()-Date.parse(nube.verEstadoNube().ultima)<30000)return;
      ocupado=true;const actual=ref.current;
      try{
        if(errorGuardado)await persistir(actual);else await guardadoLocal.current;
        await nube.reintentarNube();
        const confirmado=nube.estadoConfirmado();
        if(confirmado)publicarConfirmado(actual,confirmado);
      }catch{}finally{ocupado=false;}
    };
    const sub=AppState.addEventListener('change',s=>{if(s==='active')void reintentar(true);});
    void reintentar(true);
    const timer=setInterval(()=>void reintentar(),30000);
    return()=>{sub.remove();clearInterval(timer);};
  },[listo,me?.id,errorGuardado,persistir,publicarConfirmado]);

  const aplicar = useCallback((mut: (e: Estado) => Estado) => {
      const prev = ref.current;
      const e=mut(prev);
      e.updatedAt = now();
      actualizarVocabulario(e,prev);
      persistir(e,prev);
      ref.current = e;
      setS(e);
  }, [persistir]);

  const lote = useCallback((cambios: { col: Col; obj: any }[], servicio = false) => {
    aplicar(e => aplicarCambios(e, cambios, me, servicio, nube.telefonoId?.()));
  }, [aplicar, me]);

  const abrirActividad = (e: Estado, g: Vigilador) => g.corporativo||turnoAbierto(e,g.id,nube.telefonoId?.()) ? e
    : aplicarCambios(e,iniciarServicio(e,g,new Date(),true,nube.telefonoId?.()),g,true);
  const entrarLocal = (g: Vigilador) => {
    const e=abrirActividad(ref.current,g);
    ref.current=e;setS(e);meRef.current=g;setMe(g);persistir(e);
    AsyncStorage.setItem(K_SESION,g.id).catch(()=>{});
  };

  const aceptarNube=async(r:{estado:Estado;guardia:string;base?:Estado},puestoId?:string)=>{
    baseVista.current=r.base;
    vistaPersistida.current=r.estado;
    let g=r.estado.guards.find(g=>g.id===r.guardia&&!g.deleted);
    if(!g)throw Error('Cuenta no disponible.');
    if(puestoId){if(!r.estado.posts.some(p=>p.id===puestoId&&!p.deleted))throw Error('El puesto ya no está disponible.');g={...g,puestoId,franjaId:r.estado.franjas.find(f=>f.puestoId===puestoId&&!f.deleted)?.id||''};}
    let e=r.estado;const anterior=turnoAbierto(e,g.id,nube.telefonoId?.());
    if(puestoId&&anterior&&anterior.puestoId!==puestoId)e=aplicarCambios(e,cerrarServicio(e,g,'Cambio de puesto',new Date(),nube.telefonoId?.()),g,true);
    e=abrirActividad(e,g);
    g=perfilTelefono(e,g);
    ref.current=e;setS(e);
    if(e!==r.estado)await persistir(e,r.estado);
    meRef.current=g;setMe(g);
    setVocabulario(vocabulario(r.estado));
    await almacenLocal.removeItem(K_ESTADO);await AsyncStorage.removeItem(K_SESION);
  };

  const api: Ctx = useMemo(() => ({
    listo, S, me, tema, paleta, asistente, avisos, telefonoId:nube.telefonoId?.()||'',
    responsable:guardiaResponsable(S,me,nube.telefonoId?.()),
    seleccionarResponsable:async(id)=>{
      const cuenta=meRef.current;if(!cuenta)throw Error('Ingrese al corporativo.');
      const cambios=cambiarResponsable(ref.current,cuenta,id,nube.telefonoId?.()||'');
      if(cambios.length)lote(cambios,true);
      await guardadoLocal.current;
    },
    ingresarCorporativo:async(pin)=>{
      if(!pinCorporativoValido(pin))throw Error('Ingrese el PIN de seis números del corporativo.');
      await guardadoLocal.current;
      if(nube.verEstadoNube().vinculada){await aceptarNube(await nube.ingresarCorporativoNube(pin));return;}
      const cuenta=ref.current.guards.find(g=>g.corporativo&&!g.deleted);
      if(!cuenta||!await verificarPIN(cuenta.id,pin))throw Error('PIN incorrecto.');
      entrarLocal(cuenta);await guardadoLocal.current;
    },
    errorInicio,errorGuardado,confirmarGuardado:()=>guardadoLocal.current,reintentarInicio:()=>setIntentoInicio(v=>v+1),
    ingresarNube:async(dni,pin,puestoId)=>{await guardadoLocal.current;await aceptarNube(await nube.ingresarNube(dni,pin),puestoId);},
    vincularCuentaNube:async(dni,pin,nombre,nacimiento)=>aceptarNube(await nube.vincularCuentaNube(dni,pin,nombre,nacimiento)),
    registrarNube:async(g,pin)=>aceptarNube(await nube.registrarNube(g,pin)),
      entrarCorporativo:async(id,pin)=>{
        const g=ref.current.guards.find(x=>x.id===id&&!x.deleted);if(!g)throw Error('Cuenta no disponible.');
        if(Platform.OS==='web'){entrarLocal(g);await guardadoLocal.current;return;}
        await guardadoLocal.current;
        await almacenLocal.setItem(K_ESTADO,JSON.stringify(ref.current));
        await aceptarNube(await nube.vincularNube(CODIGO_CORPORATIVO,ref.current,g,pin));
      },
    reintentarNube:async()=>{const actual=ref.current;if(errorGuardado)await persistir(actual);else await guardadoLocal.current;await nube.reintentarNube();const confirmado=nube.estadoConfirmado();if(confirmado)publicarConfirmado(actual,confirmado);},
    resolverDiferencias:async(r,op)=>{await guardadoLocal.current;const actual=ref.current;const e=await nube.resolverDiferenciasNube(r,op);publicarConfirmado(actual,e);},
    recuperarSincronizacion:async()=>{
      const actual=ref.current;
      // Si hubo un fallo de disco, primero debe conservarse lo que aún está en memoria.
      if(errorGuardado)await persistir(actual);else await guardadoLocal.current;
      const r=await nube.recuperarSincronizacion();
      const e=r?.estado||nube.estadoConfirmado();
      if(e&&ref.current===actual){publicarConfirmado(actual,e);setErrorGuardado('');}
      return r;
    },
    reiniciarSesionRecuperada:async()=>{
      await guardadoLocal.current;await nube.reiniciarSesionRecuperada();
      baseVista.current=undefined;vistaPersistida.current=undefined;ref.current=estadoVacio();setS(ref.current);meRef.current=null;setMe(null);setErrorGuardado('');
    },
    cargarCatalogoNube:async()=>{const e=await nube.catalogoNube();if(!meRef.current){ref.current=e;setS(e);}},
    esAdmin: esAdministrador(me),
    setTema: (m) => { setTemaEstado(m); AsyncStorage.setItem(K_TEMA, m).catch(() => {}); },
    setPaleta: (p) => { setPaletaEstado(p); AsyncStorage.setItem(K_PALETA, p).catch(() => {}); },
    setAsistente: (v) => { setAsisEstado(v); AsyncStorage.setItem(K_ASIS, v ? '1' : '0').catch(() => {}); },
    setAvisos: (v) => { setAvisosEstado(v); AsyncStorage.setItem(K_AVISOS, v ? '1' : '0').catch(() => {}); },
    entrar: (id) => {
      const g = ref.current.guards.find(x => x.id === id);
      if (g) entrarLocal(g);
    },
    salir: async () => {
      const g=meRef.current;
      if(g && turnoAbierto(ref.current,g.id,nube.telefonoId?.())) {
        const prev=ref.current;
        const e=aplicarCambios(prev,cerrarServicio(prev,g,'',new Date(),nube.telefonoId?.()),g,true);
        e.updatedAt=now();ref.current=e;setS(e);persistir(e,prev);
      }
      await guardadoLocal.current;
      if(nube.verEstadoNube().vinculada){
        if(nube.verEstadoNube().pendiente)await nube.reintentarNube();
        await nube.cerrarSesionNube();
        baseVista.current=undefined;vistaPersistida.current=undefined;
        ref.current=estadoVacio();setS(ref.current);
      }
      meRef.current=null;setMe(null);await AsyncStorage.removeItem(K_SESION);
    },
    list: (c) => ((S as any)[c] || []).filter((r: Rec) => !r.deleted),
    byId: (c, id) => ((S as any)[c] || []).find((r: Rec) => r.id === id),
    put: (c, obj: any) => {
      const guardado = { ...obj, id: obj.id || uid(), updatedAt: now() };
      lote([{ col: c, obj: guardado }]);
      if (me && c === 'guards' && guardado.id === me.id) setMe(g => ({ ...(g as any), ...guardado }));
      return guardado;
    },
    putVarios: (cambios) => {
      lote(cambios);
    },
    drop: (c, id) => { if ((ref.current[c] as Rec[]).some(r => r.id === id)) lote([{ col: c, obj: { id, deleted: true } }]); },
    setSite: (s) => {
      if(!esAdministrador(meRef.current))throw Error('Esta configuración requiere administración.');
      aplicar(e => ({...e,site:{...e.site,...s}}));
    },
    reemplazar: (e) => { if (me) e = restaurarRespaldo(ref.current, e, me); migrar(e); setVocabulario(vocabulario(e)); ref.current = e; setS(e); persistir(e); },
    guardarArchivo: async (uri: string, nombre: string) => {
      try {
        if (Platform.OS === 'web') {
          const mime = /\.pdf$/i.test(nombre) ? 'application/pdf' : 'application/octet-stream';
          return 'data:' + mime + ';base64,' + bytesBase64(await leerBytes(uri));
        }
        const dir = new Directory(Paths.document, 'adjuntos');
        if (!dir.exists) dir.create({ intermediates: true });
        const ext = (nombre.match(/\.[a-z0-9]+$/i) || ['.bin'])[0];
        const destino = new File(dir, uid() + ext);
        new File(uri).copy(destino);
        return destino.uri;
      } catch (err) {
        console.warn('No se pudo copiar el archivo', err);
        throw new Error('No se pudo guardar el archivo en el teléfono. Vuelva a adjuntarlo.');
      }
    },
    guardarFoto: async (uri: string) => {
      try {
        const foto = await prepararFoto(uri);
        if (Platform.OS === 'web') return 'data:image/jpeg;base64,' + foto.base64;
        const dir = new Directory(Paths.document, 'fotos');
        if (!dir.exists) dir.create({ intermediates: true });
        const destino = new File(dir, uid() + '.jpg');
        const origen = new File(foto.uri);
        origen.copy(destino);
        return destino.uri;
      } catch (err) {
        console.warn('No se pudo copiar la foto', err);
        throw new Error('No se pudo guardar la foto en este dispositivo.');
      }
    },
  }), [listo, S, me, tema, paleta, asistente, avisos, aplicar, persistir, lote, errorInicio, errorGuardado,publicarConfirmado]);

  return <StoreCtx.Provider value={api}>{children}</StoreCtx.Provider>;
}

/* ---------- alta inicial ---------- */
export function crearObjetivo(
  S: Estado,
  datos: {
    cliente: string; region: string; nombre: string; prefijo: string;
    apellido: string; nombreVig: string; puestoId: string; puestoIds?: string[]; franjaId: string;
    legajo?: string; dni?: string; fechaNac?: string; foto?: string; sexo?: Vigilador['sexo'];
    guardId?: string;
  }
): { estado: Estado; guardId: string } {
  const e: Estado = JSON.parse(JSON.stringify(S));
  e.site = {
    ...e.site,
    cliente: datos.cliente, region: datos.region,
    nombre: datos.nombre || datos.cliente, prefijo: datos.prefijo || 'Gs', alogLibro: false,
  };
  const fr = e.franjas.find(f => f.id === datos.franjaId);
  const puestoNombre = (e.posts.find(p => p.id === datos.puestoId) || { nombre: '' }).nombre;
  const existente = datos.guardId ? e.guards.find(x => x.id === datos.guardId) : undefined;
  const puestoIds=validarPuestosGuardia(e,idsPuestosGuardia({puestoId:datos.puestoId,puestoIds:datos.puestoIds??existente?.puestoIds}));
  let g: Vigilador;
  if (existente) {
    Object.assign(existente, {
      puestoId: datos.puestoId, puestoIds, franjaId: datos.franjaId, puesto: puestoNombre,
      horaIn: fr?.entrada || '06:00', horaOut: fr?.salida || '14:00',
      legajo: datos.legajo ?? existente.legajo, dni: datos.dni ?? existente.dni,
      fechaNac: datos.fechaNac ?? existente.fechaNac, sexo: datos.sexo ?? existente.sexo,
      foto: datos.foto || existente.foto,
      cuenta: true, rol: 'vigilador', updatedAt: now(),
    });
    g = existente;
  } else {
    g = {
      id: uid(), apellido: titulo(datos.apellido), nombre: titulo(datos.nombreVig),
      edad: '', email: '', tel: '', puestoId: datos.puestoId, puestoIds, franjaId: datos.franjaId,
      puesto: puestoNombre, legajo: datos.legajo || '', dni: datos.dni || '', foto: datos.foto || '',
      fechaNac: datos.fechaNac || '', sexo: datos.sexo,
      horaIn: fr?.entrada || '06:00', horaOut: fr?.salida || '14:00', francos: '',
      cuenta: true, rol: 'vigilador', updatedAt: now(),
    };
    e.guards.push(g);
  }
  sembrarCatalogo(e);
  e.updatedAt = now();
  return { estado: e, guardId: g.id };
}

