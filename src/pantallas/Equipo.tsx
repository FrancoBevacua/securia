import { guardarPIN, verificarPIN, tienePIN } from '../cuentas';
import { cambiarPinNube, verEstadoNube } from '../nube';
import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useStore } from '../store';
import { franjasDe, nombrePuesto, puestos, franjaPorId, etiquetaFranja } from '../logic';
import {
  Vigilador, titulo, uid, edadDe, isoDesdeDmy, mascaraDmy, dmy,
} from '../model';
import { FONT } from '../theme';
import {
  useTheme, Pantalla, SubCabecera, Card, Btn, Tag, Item, Stack, Row, Input, Selector,
  Sheet, Hint, Confirmar, useToast, Eyebrow, Banner,
} from '../ui';
import { Avatar } from './Gate';
import Credencial from './Credencial';
import SelectorPuestosGuardia from './SelectorPuestosGuardia';
import {idsPuestosGuardia,nombresPuestosGuardia} from '../puestosGuardia';

/* ================= editor de vigilador ================= */
export function EditorVigilador({ abierto, vigilador, onClose }: {
  abierto: boolean; vigilador: Vigilador | null; onClose: () => void;
}) {
  const st = useStore();
  const toast = useToast();
  const [sexo,setSexo]=useState('');
  const [apellido, setApellido] = useState('');
  const [nombre, setNombre] = useState('');
  const [nac, setNac] = useState('');
  const [legajo, setLegajo] = useState('');
  const [tel, setTel] = useState('');
  const [email, setEmail] = useState('');
  const [puestoId, setPuestoId] = useState('');
  const [puestoIds,setPuestoIds]=useState<string[]>([]);
  const [error,setError]=useState('');
  const [franjaId, setFranjaId] = useState('');
  const [foto, setFoto] = useState('');
  const [borrar, setBorrar] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    setError('');
    const base=st.S.guards.find(g=>g.id===vigilador?.id)||vigilador;
    setSexo(vigilador?.sexo||'');
    setApellido(vigilador?.apellido || '');
    setNombre(vigilador?.nombre || '');
    setNac(vigilador?.fechaNac ? dmy(vigilador.fechaNac) : '');
    setLegajo(vigilador?.legajo || '');
    setTel(vigilador?.tel || '');
    setEmail(vigilador?.email || '');
    setPuestoId(base?.puestoId || '');
    setPuestoIds(idsPuestosGuardia(base||{puestoId:''}));
    setFranjaId(base?.franjaId || '');
    setFoto(vigilador?.foto || '');
  }, [abierto, vigilador?.id]);

  const elegirFoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { toast('Necesito permiso para acceder a las fotos'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.6, allowsEditing: true });
    if (res.canceled || !res.assets?.[0]) return;
    setFoto(await st.guardarFoto(res.assets[0].uri));
  };

  const guardar = () => {
    setError('');try{
    if (!apellido.trim()) { toast('Falta el apellido'); return; }
    const fr = franjaPorId(st.S, franjaId);
    const fechaNac = isoDesdeDmy(nac);
    if (nac && !fechaNac) { toast('La fecha de nacimiento va como DD/MM/AAAA'); return; }
    st.put('guards', {
      id: vigilador?.id || uid(), apellido: titulo(apellido), nombre: titulo(nombre),
      fechaNac, sexo:sexo as Vigilador['sexo'], edad: edadDe(fechaNac), cuenta: vigilador?.cuenta,
      legajo, dni: vigilador?.dni, tel, email, puestoId, puestoIds, franjaId, puesto: nombrePuesto(st.S, puestoId),
      rol: vigilador?.rol || 'vigilador',
      horaIn: fr?.entrada || vigilador?.horaIn || '06:00',
      horaOut: fr?.salida || vigilador?.horaOut || '14:00',
      francos: vigilador?.francos || '', foto,
    });
    onClose();
    toast('Datos guardados');
    }catch(e:any){setError(e.message||'No se pudieron guardar los datos.');}
  };

  const esUnicoAdmin = vigilador?.rol === 'admin' &&
    st.list<Vigilador>('guards').filter(x => x.rol === 'admin').length < 2;

  return (
    <Sheet visible={abierto} title={vigilador ? 'Datos del vigilador' : 'Registrar vigilador'} onClose={onClose}
      footer={
        <>
          {vigilador && vigilador.id !== st.me?.id ? (
            <Btn icon="trash" variant="danger" onPress={() => {
              if (esUnicoAdmin) { toast('No puede eliminar al único administrador'); return; }
              setBorrar(true);
            }} />
          ) : null}
          <Btn label="Guardar" variant="primary" style={{ flex: 1 }} onPress={guardar} />
        </>
      }>
      {error?<Banner kind="warn">{error}</Banner>:null}
      <View style={{ alignItems: 'center', gap: 9 }}>
        <Avatar g={{ ...(vigilador || {} as any), apellido, nombre, foto }} size={82} />
        <Row gap={7}>
          <Btn label="Cambiar foto" variant="ghost" size="sm" onPress={elegirFoto} />
          {foto ? <Btn label="Quitar" variant="ghost" size="xs" onPress={() => setFoto('')} /> : null}
        </Row>
      </View>
      <Row gap={11} style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}><Input label="Apellido" value={apellido} onChangeText={setApellido} /></View>
        <View style={{ flex: 1 }}><Input label="Nombre" value={nombre} onChangeText={setNombre} /></View>
      </Row>
      <Row gap={11} style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Input tipo="fecha" formatoFecha="dmy" label="Fecha de nacimiento" value={nac} onChangeText={v => setNac(mascaraDmy(v))}
            mono keyboardType="number-pad" placeholder="24/07/1990"
            hint={edadDe(isoDesdeDmy(nac)) ? edadDe(isoDesdeDmy(nac)) + ' años' : undefined} />
        </View>
        <View style={{ flex: 1 }}><Input label="Legajo" value={legajo} onChangeText={setLegajo} mono /></View>
      </Row>
      <Selector label="Sexo" valor={sexo} onChange={setSexo} opciones={[{v:'',t:'Seleccionar'},{v:'masculino',t:'Masculino'},{v:'femenino',t:'Femenino'}]}/>
      <SelectorPuestosGuardia puestos={puestos(st.S)} seleccion={puestoIds} principal={puestoId} onChange={(ids,principal)=>{
        setPuestoIds(ids);if(principal!==puestoId){setPuestoId(principal);setFranjaId(principal?franjasDe(st.S,principal)[0]?.id||'':'');}
      }}/>
      <Selector label="Turno" valor={franjaId} onChange={setFranjaId}
        opciones={[
          { v: '', t: 'Sin turno' },
          ...franjasDe(st.S, puestoId).map(f => ({
            v: f.id, t: f.alias ? f.nombre + ' — ' + f.alias : f.nombre, sub: f.entrada + ' a ' + f.salida,
          })),
        ]} />
      <Input label="Celular" value={tel} onChangeText={setTel} keyboardType="phone-pad" placeholder="341 555 5555" />
      <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />

      <Confirmar visible={borrar} mensaje="¿Eliminar a este vigilador del equipo? Sus registros quedan en el sistema."
        onCancel={() => setBorrar(false)}
        onOk={() => { if (vigilador) st.drop('guards', vigilador.id); setBorrar(false); onClose(); toast('Vigilador eliminado'); }} />
    </Sheet>
  );
}

/* ================= listado del equipo ================= */
export default function Equipo() {
  const st = useStore(),t=useTheme();
  const [editar, setEditar] = useState<Vigilador | null | undefined>(undefined);
  const gs = st.list<Vigilador>('guards').filter(g=>!g.corporativo);

  return (
    <Pantalla top>
      <SubCabecera titulo="Equipo del objetivo"
        sub={gs.length + (gs.length === 1 ? ' vigilador registrado' : ' vigiladores registrados')}
        onBack={() => router.back()} />
      <Card>
        {gs.map((g, i) => (
          <Item key={g.id} last={i === gs.length - 1}
            lead={<Avatar g={g} />}
            title={g.apellido + ', ' + g.nombre}
            subs={[
              (nombresPuestosGuardia(st.S, g) || 'Sin puesto') +
              (g.franjaId ? ' · ' + etiquetaFranja(franjaPorId(st.S, g.franjaId)) : ''),
              st.esAdmin?[g.tel, g.email].filter(Boolean).join(' · '):'',
            ]}
            right={
              <>
                {g.rol === 'admin' ? <Tag label="Admin" kind="acc" /> : null}
                {g.id === st.me?.id ? <Tag label="Vos" kind="mute" /> : null}
              </>
            }
            onPress={st.esAdmin?()=>setEditar(g):undefined} />
        ))}
      </Card>
      {st.esAdmin?<Btn label="Registrar vigilador" icon="plus" variant="primary" onPress={() => setEditar(null)} />:null}

      <EditorVigilador abierto={editar !== undefined} vigilador={editar || null} onClose={() => setEditar(undefined)} />
    </Pantalla>
  );
}

/* ================= mi perfil ================= */
export function Perfil() {
  const st = useStore();
  const t = useTheme();
  const toast = useToast();
  const [editar, setEditar] = useState(false);
  const [pinAbierto, setPinAbierto] = useState(false);
  const [pin, setPin] = useState('');
  const [pinAnterior, setPinAnterior] = useState('');
  const me = st.me!;
  const perfil=st.S.guards.find(g=>g.id===me.id)||me;

  if(me.corporativo)return null;

  return (
    <Pantalla top>
      <SubCabecera titulo="Mi perfil" sub="Sus datos, su foto y su acceso." onBack={() => router.back()} />

      <Credencial g={me} />

      <Card pad>
        <Stack gap={14}>
          <Eyebrow>Mis puestos</Eyebrow>
          <Hint>{nombresPuestosGuardia(st.S,perfil)||'Sin puestos asignados'}</Hint>
          <Selector label="Puesto principal" valor={perfil.puestoId}
            hint="Es su puesto de referencia. Al iniciar sesión elige el puesto que va a cubrir."
            onChange={v => {
              const f = franjasDe(st.S, v)[0];
              st.put('guards', {
                ...perfil, puestoId: v, puestoIds:idsPuestosGuardia({...perfil,puestoId:v}), puesto: nombrePuesto(st.S, v),
                franjaId: f?.id || '', horaIn: f?.entrada || '', horaOut: f?.salida || '',
              });
              toast('Puesto actualizado');
            }}
            opciones={puestos(st.S).map(p => ({ v: p.id, t: p.nombre, sub: p.descripcion }))} />
          <Selector label="Turno de referencia" valor={perfil.franjaId}
            hint="Las directivas del servicio corresponden al puesto de la actividad iniciada en este teléfono."
            onChange={v => {
              const f = franjaPorId(st.S, v);
              st.put('guards', { ...perfil, franjaId: v, horaIn: f?.entrada || '', horaOut: f?.salida || '' });
              toast('Turno actualizado');
            }}
            opciones={franjasDe(st.S, perfil.puestoId).map(f => ({
              v: f.id, t: f.alias ? f.nombre + ' — ' + f.alias : f.nombre, sub: f.entrada + ' a ' + f.salida,
            }))} />
          <Btn label="Editar mis datos" icon="edit" variant="primary" onPress={() => setEditar(true)} />
        </Stack>
      </Card>

      <Card>
        <Item title="PIN de acceso"
          subs={['PIN personal para iniciar sesión en el teléfono compartido.']}
          onPress={() => { setPin(''); setPinAnterior(''); setPinAbierto(true); }} />
        <Item last title="Cerrar sesión" subs={['Vuelve a la pantalla de acceso de su cuenta']}
          onPress={async () => { try { await st.salir(); } catch (e: any) { toast(e.message); } }} />
      </Card>

      <EditorVigilador abierto={editar} vigilador={me} onClose={() => setEditar(false)} />

      <Sheet visible={pinAbierto} title="PIN de acceso" onClose={() => setPinAbierto(false)}
        footer={
          <>
            <Btn label="Cancelar" variant="ghost" style={{ flex: 1 }} onPress={() => setPinAbierto(false)} />
            <Btn label="Guardar" variant="primary" style={{ flex: 1 }} onPress={async () => {
              try{
                if(verEstadoNube().vinculada)await cambiarPinNube(pinAnterior,pin);
                else{if (await tienePIN(me.id) && !await verificarPIN(me.id, pinAnterior)) { toast('El PIN actual no coincide'); return; }await guardarPIN(me.id, pin);}
                setPinAbierto(false); toast('PIN actualizado');
              }catch(e:any){toast(e.message);}
            }} />
          </>
        }>
        <Input label="PIN actual (si ya tiene uno)" value={pinAnterior} onChangeText={setPinAnterior} keyboardType="number-pad" maxLength={6} secureTextEntry />
        <Input label={st.esAdmin?'Nuevo PIN (6 dígitos)':'Nuevo PIN (4 a 6 dígitos)'} value={pin} onChangeText={setPin} keyboardType="number-pad" maxLength={6} secureTextEntry />
      </Sheet>
    </Pantalla>
  );
}
