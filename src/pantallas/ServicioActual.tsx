import React from 'react';
import { useStore } from '../store';
import { turnoAbierto } from '../servicio';
import { Banner } from '../ui';

/** La actividad se abre y se cierra junto con la sesión. */
export default function ServicioActual() {
  const st=useStore();
  if(turnoAbierto(st.S,st.me?.id,st.telefonoId))return null;
  return <Banner kind="info">Cierre sesión e ingrese nuevamente para continuar registrando actividad.</Banner>;
}
