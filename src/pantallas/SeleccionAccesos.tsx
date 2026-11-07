import React from 'react';
import { AccesoCat, SeleccionAccesos as DatosSeleccion } from '../model';
import { listaAccesos } from '../text';
import {accesosDelGrupo} from '../gruposAccesos';
import { Chip, Chipbar, Field, Hint, Input, Seg, Selector } from '../ui';

export default function SeleccionAccesos({ datos, catalogo, onChange, onElegirCatalogo }: {
  datos: DatosSeleccion & {acceso?: string}; catalogo: AccesoCat[];
  onChange: (cambio: DatosSeleccion & {acceso?: string}) => void;
  onElegirCatalogo?: (acceso:AccesoCat) => void;
}) {
  const varios = !!datos.grupoAccesos;
  const elegidos = listaAccesos(datos);
  // Los nombres guardados se conservan aunque cambie o se retire el catálogo.
  const opciones = accesosDelGrupo(catalogo,datos.grupoAccesos||'portones',elegidos);
  return <>
    <Field label="Registrar accesos"><Seg valor={varios?'varios':'uno'} onChange={v=>onChange(v==='varios'
      ? {grupoAccesos:'portones',accesos:[]}
      : {grupoAccesos:undefined,accesos:undefined})}
      opciones={[{v:'uno',t:'Un acceso'},{v:'varios',t:'Varios accesos'}]}/></Field>
    {varios ? <>
      <Selector label="Grupo de accesos" valor={datos.grupoAccesos!}
        onChange={v=>onChange({grupoAccesos:v as DatosSeleccion['grupoAccesos'],accesos:[]})}
        opciones={[{v:'portones',t:'Portones de playa'},{v:'emergencias',t:'Puertas de emergencias'},{v:'otros',t:'Otros accesos'}]}/>
      <Field label="Accesos incluidos"><Chipbar>{opciones.map(nombre=><Chip key={nombre} label={nombre}
        on={elegidos.includes(nombre)} onPress={()=>onChange({accesos:elegidos.includes(nombre)
          ? elegidos.filter(a=>a!==nombre) : [...elegidos,nombre]})}/>)}</Chipbar></Field>
      <Hint>{opciones.length ? 'Elegí los accesos del grupo. Podés tocar uno seleccionado para quitarlo.' : 'Agregá los accesos al catálogo para poder seleccionarlos.'}</Hint>
      <Hint>{elegidos.length+' seleccionado'+(elegidos.length===1?'':'s')}</Hint>
    </> : <>
      <Selector label="Acceso del catálogo" valor={datos.acceso||''} onChange={acceso=>{onChange({acceso});const c=catalogo.find(c=>c.nombre===acceso);if(c)onElegirCatalogo?.(c);}}
        opciones={[{v:'',t:'Seleccionar acceso'},...catalogo.filter(a=>!a.deleted).map(a=>({v:a.nombre,t:a.nombre}))]}/>
      <Input label="Nombre del acceso" value={datos.acceso||''} onChangeText={acceso=>onChange({acceso})} placeholder="Puertas E2 y E2 Bis"/>
    </>}
  </>;
}
