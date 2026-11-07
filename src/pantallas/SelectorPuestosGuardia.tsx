import React from 'react';
import {Puesto} from '../model';
import {Card,Eyebrow,Hint,Selector,Toggle} from '../ui';

export default function SelectorPuestosGuardia({puestos,seleccion,principal,onChange}:{puestos:Puesto[];seleccion:string[];principal:string;onChange:(ids:string[],principal:string)=>void}){
 const ids=new Set(seleccion);
 return <Card pad>
  <Eyebrow>Puestos que puede cubrir</Eyebrow>
  <Hint>Seleccione todos los puestos del guardia. Puede asignar dos, tres o más.</Hint>
  {puestos.map(p=><Toggle key={p.id} label={p.nombre} value={ids.has(p.id)} onChange={activo=>{
   const siguientes=new Set(ids);if(activo)siguientes.add(p.id);else siguientes.delete(p.id);
   const lista=[...siguientes];onChange(lista,siguientes.has(principal)?principal:lista[0]||'');
  }}/>) }
  {ids.size>0?<Selector label="Puesto principal" valor={principal} onChange={id=>onChange([...ids],id)} opciones={puestos.filter(p=>ids.has(p.id)).map(p=>({v:p.id,t:p.nombre}))}/>:<Hint>Sin puestos asignados.</Hint>}
 </Card>;
}
