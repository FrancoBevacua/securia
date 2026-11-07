import React,{useState} from 'react';
import {Modal,Platform,Pressable,Text,View,StyleProp,ViewStyle} from 'react-native';
import DateTimePicker,{DateTimePickerAndroid} from '@react-native-community/datetimepicker';
import {Theme,FONT,R} from './theme';
import {Icon} from './icons';
import {fechaDelControl,valorDelControl,TipoFechaHora,FormatoFecha} from './fechaHora';
export type FechaHoraProps={tipo:TipoFechaHora;formatoFecha?:FormatoFecha;value:string;onChangeText?:(v:string)=>void;label?:string;placeholder?:string;editable?:boolean;style?:StyleProp<ViewStyle>;tema:Theme};
export default function FechaHoraControl(p:FechaHoraProps){
  const [abierto,setAbierto]=useState(false),[seleccion,setSeleccion]=useState(new Date()),t=p.tema;
  const abrir=()=>{
    const value=fechaDelControl(p.value,p.tipo,p.formatoFecha);
    if(Platform.OS==='android')DateTimePickerAndroid.open({value,mode:p.tipo==='hora'?'time':'date',
      display:p.tipo==='hora'?'clock':'calendar',is24Hour:true,
      positiveButton:{label:'Aceptar'},negativeButton:{label:'Cancelar'},
      onChange:(event,date)=>{if(event.type==='set'&&date)p.onChangeText?.(valorDelControl(date,p.tipo,p.formatoFecha));}});
    else{setSeleccion(value);setAbierto(true);}
  };
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={(p.label||'Seleccionar')+': '+(p.value||'Sin seleccionar')}
      accessibilityHint={p.tipo==='hora'?'Abre el reloj del sistema':'Abre el calendario del sistema'}
      disabled={p.editable===false} onPress={abrir}
      style={[{minHeight:52,padding:13,flexDirection:'row',alignItems:'center',gap:10,backgroundColor:t.surface,borderWidth:1,borderColor:t.lineStrong,borderRadius:R.sm},p.style]}>
      <Text style={{flex:1,color:p.value?t.text:t.muted,fontFamily:FONT.mono,fontSize:15}}>
        {p.value?(p.tipo==='fecha'&&p.formatoFecha!=='dmy'?p.value.split('-').reverse().join('/'):p.value):p.placeholder||'Seleccionar'}
      </Text><Icon name={p.tipo==='hora'?'clock':'turnos'} size={19} color={t.accent}/>
    </Pressable>
    {Platform.OS==='ios'?<Modal visible={abierto} transparent animationType="slide" onRequestClose={()=>setAbierto(false)}>
      <View style={{flex:1,justifyContent:'center',padding:20,backgroundColor:'#0008'}}>
        <View accessibilityViewIsModal style={{padding:16,borderRadius:24,backgroundColor:t.surface}}>
          <Text style={{fontFamily:FONT.bodySemi,fontSize:18,color:t.text}}>{p.label||'Seleccionar'}</Text>
          <DateTimePicker value={seleccion} mode={p.tipo==='hora'?'time':'date'} locale="es_AR" is24Hour
            display={p.tipo==='fecha'?'inline':'spinner'} themeVariant={t.dark?'dark':'light'} onChange={(_,date)=>{if(date)setSeleccion(date);}}/>
          <View style={{flexDirection:'row',justifyContent:'space-between'}}>
            <Pressable accessibilityRole="button" onPress={()=>setAbierto(false)} style={{minHeight:48,padding:14}}><Text style={{color:t.accent}}>Cancelar</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={()=>{p.onChangeText?.(valorDelControl(seleccion,p.tipo,p.formatoFecha));setAbierto(false);}} style={{minHeight:48,padding:14}}><Text style={{color:t.accent}}>Aceptar</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>:null}
  </>;
}
