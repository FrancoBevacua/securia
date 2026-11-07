import React from 'react';
import {View} from 'react-native';
import type {FechaHoraProps} from './FechaHoraControl';
import {fechaDelControl,valorDelControl} from './fechaHora';
export default function FechaHoraControl(p:FechaHoraProps){
  return <View style={p.style}>{React.createElement('input',{
    type:p.tipo==='hora'?'time':'date',value:p.value?valorDelControl(fechaDelControl(p.value,p.tipo,p.formatoFecha),p.tipo):'',
    'aria-label':p.label||'Seleccionar',disabled:p.editable===false,
    onChange:(e:React.ChangeEvent<HTMLInputElement>)=>{if(e.target.value)p.onChangeText?.(valorDelControl(fechaDelControl(e.target.value,p.tipo),p.tipo,p.formatoFecha));},
    style:{width:'100%',boxSizing:'border-box',minHeight:52,padding:13,background:p.tema.surface,border:'1px solid '+p.tema.lineStrong,
      borderRadius:12,color:p.tema.text,colorScheme:p.tema.dark?'dark':'light',fontSize:16,fontFamily:'inherit'}
  })}</View>;
}
