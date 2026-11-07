import React,{useState} from 'react';
import {View,Text,Pressable,ActivityIndicator} from 'react-native';
import {Image} from '../Imagen';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useStore} from '../store';
import {Vigilador} from '../model';
import {FONT} from '../theme';
import {useTheme,Pantalla,Card,Btn,Hint,Banner} from '../ui';
import {MarcaVigelium} from '../Marca';
import {Icon} from '../icons';
import {pinCorporativoValido} from '../corporativo';

export function Avatar({g,size=38}:{g:Vigilador;size?:number}){
 const t=useTheme(),ini=((g.apellido||g.nombre||'?')[0]+(g.apellido?g.nombre?.[0]||'':'')).toUpperCase();
 return g.foto?<Image source={{uri:g.foto}} style={{width:size,height:size,borderRadius:size/2}}/>:<View style={{width:size,height:size,borderRadius:size/2,backgroundColor:t.surface3,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:t.lineStrong}}><Text style={{fontFamily:FONT.dispBold,fontSize:size*.38,color:t.muted}}>{ini}</Text></View>;
}
export default function Gate(){
 const st=useStore(),t=useTheme(),ins=useSafeAreaInsets();
 const [pin,setPin]=useState(''),[error,setError]=useState(''),[ocupado,setOcupado]=useState(false);
 const ingresar=async()=>{if(ocupado||!pinCorporativoValido(pin))return;setOcupado(true);setError('');try{await st.ingresarCorporativo(pin);setPin('');}catch(e:any){setError(e.message||'No se pudo ingresar al corporativo.');setPin('');}finally{setOcupado(false);}};
 return <Pantalla gap={18}>
  <View style={{alignItems:'center',paddingTop:Math.max(16,ins.top),gap:14}}><MarcaVigelium color={t.text}/><Icon name="perfil" size={38} color={t.accentText}/><Text accessibilityRole="header" style={{color:t.text,fontFamily:FONT.dispBold,fontSize:36}}>Guardia Paseo</Text><Hint>Cuenta del corporativo</Hint></View>
  <Card pad style={{gap:18}}>
   <Text style={{color:t.text,fontFamily:FONT.bodySemi,fontSize:19,textAlign:'center'}}>Ingresá el PIN de seis números</Text>
   <View accessibilityLabel={'PIN: '+pin.length+' de 6 números ingresados'} style={{flexDirection:'row',justifyContent:'center',gap:14,paddingVertical:12}}>{Array.from({length:6},(_,i)=><View key={'espacio-'+i} style={{width:15,height:15,borderRadius:8,borderWidth:1,borderColor:t.muted,backgroundColor:i<pin.length?t.text:'transparent'}}/>)}</View>
   <View style={{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',gap:10}}>{['1','2','3','4','5','6','7','8','9','','0','borrar'].map((n,i)=>n?<Pressable key={n} accessibilityRole="button" accessibilityLabel={n==='borrar'?'Borrar último número':'Número '+n} disabled={ocupado} onPress={()=>{setError('');setPin(p=>n==='borrar'?p.slice(0,-1):(p+n).slice(0,6));}} style={({pressed})=>({width:'31%',minHeight:52,alignItems:'center',justifyContent:'center',backgroundColor:pressed?t.surface3:t.surface2,borderWidth:1,borderColor:t.line,borderRadius:12})}>{n==='borrar'?<Icon name="back" color={t.text} size={25}/>:<Text style={{color:t.text,fontFamily:FONT.body,fontSize:25}}>{n}</Text>}</Pressable>:<View key={'espacio-'+i} style={{width:'31%'}}/>)}</View>
   {error?<Banner kind="warn">{error}</Banner>:null}
   {ocupado?<ActivityIndicator color={t.accentText}/>:null}
   <Btn label={ocupado?'Ingresando…':'Entrar'} variant="primary" disabled={ocupado||!pinCorporativoValido(pin)} onPress={ingresar}/>
  </Card>
  <Hint>Después de ingresar, elegí el guardia que queda a cargo.</Hint>
 </Pantalla>;
}
