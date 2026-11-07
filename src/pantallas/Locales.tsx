import React from 'react';
import {Redirect} from 'expo-router';

/** Las rutas anteriores llevan al formulario unificado. */
export default function Locales(){
 return <Redirect href={{pathname:'/',params:{nueva:'Recorrido'}}}/>;
}
