import React from 'react';
import {TipoAccesoFisico,ConfiguracionPorton} from '../model';
import {Selector,Toggle,Hint} from '../ui';

export default function TipoAcceso({tipo,configuracion='ingreso',sinPrecinto,onChange}:{tipo:TipoAccesoFisico;configuracion?:ConfiguracionPorton;sinPrecinto:boolean;onChange:(tipo:TipoAccesoFisico,configuracion:ConfiguracionPorton,sinPrecinto:boolean)=>void}){
 return <>
  <Selector label="Tipo de acceso" valor={tipo} onChange={v=>onChange(v as TipoAccesoFisico,configuracion,v==='otro')} opciones={[{v:'emergencia',t:'Puerta de emergencia'},{v:'porton',t:'Portón'},{v:'otro',t:'Otro: pecera, ventanal, puerta chica…'}]}/>
  <Toggle label="No aplica precinto" value={sinPrecinto} onChange={v=>onChange(tipo,configuracion,v)}/>
  {sinPrecinto?<Hint>Este acceso se registra sin solicitar números de precinto.</Hint>:null}
 </>;
}
