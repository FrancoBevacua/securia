import React, { useState } from 'react';
import { router } from 'expo-router';
import { cuentasCorporativas, pinCorporativoValido } from '../corporativo';
import { puestos } from '../logic';
import { guardarPinCorporativoNube } from '../nube';
import { useStore } from '../store';
import { Banner, Btn, Card, Empty, Eyebrow, Hint, Input, Item, Pantalla, Selector, SubCabecera, Tag, useToast } from '../ui';

export default function CuentaCorporativo() {
  const st = useStore();
  const toast = useToast();
  const [modo, setModo] = useState<'crear' | 'cambiar'>();
  const [puestoId, setPuestoId] = useState('');
  const [pin, setPin] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  if (!st.esAdmin) return null;

  const asignados = new Set(cuentasCorporativas(st.S).map(g => g.puestoId));
  const activos = puestos(st.S);
  const disponibles = activos.filter(p => !asignados.has(p.id));
  const configurados = activos.filter(p => asignados.has(p.id));
  const seleccionado = activos.find(p => p.id === puestoId);

  const abrir = (accion: 'crear' | 'cambiar', id = '') => {
    setModo(accion);
    setPuestoId(id);
    setPin('');
    setConfirmar('');
    setError('');
  };

  const guardar = async () => {
    if (guardando || !modo || !seleccionado) return;
    if (!pinCorporativoValido(pin) || pin !== confirmar) {
      setError('Ingresá el mismo PIN de seis números en ambos campos.');
      return;
    }
    setGuardando(true);
    setError('');
    try {
      await st.reintentarNube();
      await guardarPinCorporativoNube(puestoId, pin, modo === 'crear');
      setModo(undefined);
      setPin('');
      setConfirmar('');
      toast(modo === 'crear' ? 'PIN corporativo creado' : 'PIN corporativo actualizado');
      try { await st.reintentarNube(); }
      catch { setError('El PIN se guardó. La lista se actualizará al sincronizar.'); }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Pantalla top>
      <SubCabecera titulo="PIN corporativos" sub="Administrá el acceso operativo de cada puesto." onBack={() => router.back()} />
      {modo ? (
        <Card pad style={{ gap: 12 }}>
          <Eyebrow>{modo === 'crear' ? 'Nuevo PIN corporativo' : 'Cambiar PIN de ' + seleccionado?.nombre}</Eyebrow>
          {modo === 'crear' ? <Selector label="Puesto" valor={puestoId} placeholder="Elegí un puesto"
            opciones={disponibles.map(p => ({ v: p.id, t: p.nombre }))}
            onChange={id => { if (!guardando) setPuestoId(id); }} /> : null}
          <Hint>Al ingresar con este PIN, se podrá elegir a un vigilador asignado al puesto.</Hint>
          <Input label="PIN de seis números" value={pin} onChangeText={v => setPin(v.replace(/\D/g, '').slice(0, 6))}
            maxLength={6} keyboardType="number-pad" secureTextEntry editable={!guardando} />
          <Input label="Repetir PIN" value={confirmar} onChangeText={v => setConfirmar(v.replace(/\D/g, '').slice(0, 6))}
            maxLength={6} keyboardType="number-pad" secureTextEntry editable={!guardando} />
          <Btn label={guardando ? 'Guardando…' : 'Guardar PIN'} variant="primary" disabled={guardando || !seleccionado} onPress={guardar} />
          <Btn label="Cancelar" variant="ghost" disabled={guardando} onPress={() => { setModo(undefined); setPin(''); setConfirmar(''); setError(''); }} />
        </Card>
      ) : (
        <Btn label="Crear PIN corporativo" icon="plus" variant="primary" disabled={!disponibles.length || guardando} onPress={() => abrir('crear')} />
      )}
      {error ? <Banner kind="warn">{error}</Banner> : null}
      {!modo && !disponibles.length ? <Hint>{activos.length ? 'Todos los puestos activos tienen un PIN corporativo.' : 'Creá un puesto para poder asignarle un PIN.'}</Hint> : null}
      <Eyebrow>Puestos con PIN</Eyebrow>
      <Card>
        {configurados.length ? configurados.map((p, i) => <Item key={p.id} title={p.nombre} last={i === configurados.length - 1}
          right={<Tag label="PIN activo" kind="ok" />} subs={['Tocá para cambiar el PIN']}
          onPress={guardando ? undefined : () => abrir('cambiar', p.id)} />) : <Empty>Todavía no hay puestos con PIN.</Empty>}
      </Card>
    </Pantalla>
  );
}
