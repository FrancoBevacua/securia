import React from 'react';
import {useStore} from '../../src/store';
import Admin from '../../src/pantallas/Admin';
import Inicio from '../../src/pantallas/Inicio';

export default function InicioSesion(){
  return useStore().esAdmin ? <Admin inicio/> : <Inicio/>;
}
