import React,{useEffect,useState} from 'react';
import {View,Text,Pressable} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {router,useLocalSearchParams} from 'expo-router';
import {useStore} from '../store';
import {Novedad,isoDate} from '../model';
import {categoriaAsiento} from '../reporte';
import {FONT} from '../theme';
import {Icon} from '../icons';
import {Pantalla,Btn,Card,Row,Hint,useTheme,Sheet,Toggle,Banner} from '../ui';
import {EditorNovedad} from './EditorAsiento';
import {colorCategoria} from '../categorias';
import {ACCIONES_RAPIDAS,RAPIDAS_INICIALES,normalizarAccesosRapidos} from '../accionesRapidas';
import {ElegirResponsable} from './GuardiaACargo';
import AccesoGuia from './AccesoGuia';

export default function Inicio(){
 const st=useStore(),t=useTheme();
 const [editar,setEditar]=useState<Novedad|null|undefined>(undefined),[categoria,setCategoria]=useState('Novedad');
 const params=useLocalSearchParams<{nueva?:string}>();
 useEffect(()=>{if(params.nueva){setCategoria(params.nueva);setEditar(null);router.setParams({nueva:undefined});}},[params.nueva]);
 const hoy=isoDate();
 const recientes=st.list<Novedad>('novedades').sort((a,b)=>(b.fecha+b.hora).localeCompare(a.fecha+a.hora)).slice(0,4);
 const nuevo=(tipo:string)=>{setCategoria(tipo);setEditar(null);};
 const [personalizar,setPersonalizar]=useState(false),[cambiarGuardia,setCambiarGuardia]=useState(false),[rapidas,setRapidas]=useState<string[]>(RAPIDAS_INICIALES),[borrador,setBorrador]=useState<string[]>([]),[errorAccesos,setErrorAccesos]=useState('');
 const claveRapidas='securia.accesos-rapidos/'+st.me?.id;
 useEffect(()=>{let vivo=true;AsyncStorage.getItem(claveRapidas).then(raw=>{if(vivo&&raw){try{setRapidas(normalizarAccesosRapidos(JSON.parse(raw)));}catch{}}});return()=>{vivo=false;};},[claveRapidas]);
 const acciones=rapidas.map(id=>ACCIONES_RAPIDAS.find(a=>a.id===id)).filter((a):a is typeof ACCIONES_RAPIDAS[number]=>!!a);
 const abrirAccesos=()=>{setBorrador([...rapidas]);setErrorAccesos('');setPersonalizar(true);};
 const guardia=st.responsable||st.me;
 return <Pantalla gap={18}>
  <View style={{gap:5}}><Text accessibilityRole="header" style={{fontFamily:FONT.dispBold,color:t.text,fontSize:27,lineHeight:34}}>Hola, {guardia?.nombre?.split(' ')[0]||'guardia'}</Text><Text style={{fontFamily:FONT.body,fontSize:14,color:t.text2}}>Cada novedad, bajo control.</Text></View>
  <AccesoGuia/>
  <Btn label="Nueva novedad" icon="plus" variant="primary" onPress={()=>nuevo('Novedad')}/>
  {st.me?.corporativo?<Card pad><Row><View style={{flex:1}}><Hint>Guardia a cargo</Hint><Text style={{color:t.text,fontFamily:FONT.bodySemi,fontSize:16}}>{[guardia?.nombre,guardia?.apellido].filter(Boolean).join(' ')}</Text></View><Btn label="Cambiar" size="sm" onPress={()=>setCambiarGuardia(true)}/></Row></Card>:null}
  <Row style={{justifyContent:'space-between'}}><Text style={{fontFamily:FONT.bodySemi,fontSize:15,color:t.text}}>Acciones rápidas</Text><Btn icon="edit" accessibilityLabel="Personalizar accesos rápidos" size="xs" variant="ghost" onPress={abrirAccesos}/></Row>
  <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{[...acciones,{id:'__agregar__',titulo:'Añadir',icono:'plus',ruta:''}].map(a=><Pressable key={a.id} accessibilityRole="button" accessibilityLabel={a.titulo} onPress={()=>a.id==='__agregar__'?abrirAccesos():router.push(a.ruta as any)} style={({pressed})=>({width:'23%',minHeight:76,minWidth:66,backgroundColor:t.surface2,borderColor:t.lineStrong,borderWidth:1,borderRadius:12,padding:8,alignItems:'center',justifyContent:'center',gap:7,opacity:pressed ? .7 : 1})}><Icon name={a.icono} color={t.text2} size={18}/><Text style={{fontFamily:FONT.bodySemi,fontSize:11,color:t.text,textAlign:'center'}}>{a.titulo}</Text></Pressable>)}</View>
  <Sheet visible={personalizar} title="Acciones rápidas" onClose={()=>setPersonalizar(false)} footer={<Btn label="Guardar accesos" variant="primary" onPress={async()=>{try{const ids=normalizarAccesosRapidos(borrador);await AsyncStorage.setItem(claveRapidas,JSON.stringify(ids));setRapidas(ids);setPersonalizar(false);}catch{setErrorAccesos('No se pudieron guardar los accesos. Vuelva a intentar.');}}}/>}><Hint>Elegí los accesos que querés ver en Inicio.</Hint>{ACCIONES_RAPIDAS.map(a=><Toggle key={a.id} label={a.titulo} value={borrador.includes(a.id)} onChange={on=>setBorrador(v=>on?[...new Set([...v,a.id])]:v.filter(id=>id!==a.id))}/>)}{errorAccesos?<Banner kind="warn">{errorAccesos}</Banner>:null}</Sheet>
  <Sheet visible={cambiarGuardia} title="¿Quién queda a cargo?" onClose={()=>setCambiarGuardia(false)}><ElegirResponsable onDone={()=>setCambiarGuardia(false)}/></Sheet>
  <Row style={{justifyContent:'space-between'}}><Text style={{fontFamily:FONT.bodySemi,fontSize:15,color:t.text}}>Últimas novedades</Text><Btn label="Ver todas" size="xs" variant="ghost" onPress={()=>router.push('/informedia')}/></Row>
  {recientes.length?recientes.map(n=>{const cat=categoriaAsiento(n);return <Pressable key={n.id} accessibilityRole="button" accessibilityLabel={n.hora+' '+n.texto} onPress={()=>setEditar(n)}><Card style={{borderRadius:14,borderLeftWidth:4,borderLeftColor:colorCategoria(cat)}}><Row gap={12} style={{padding:14,alignItems:'flex-start'}}><Icon name={cat==='EXTERNO'?'equipo':cat==='DESCANSO'?'descanso':'libro'} color={t.text2} size={23}/><View style={{flex:1,gap:5}}><Text numberOfLines={2} style={{fontFamily:FONT.bodySemi,fontSize:13.5,color:t.text,lineHeight:20}}>{n.texto}</Text><Text style={{fontFamily:FONT.body,fontSize:11.5,color:t.muted}}>{n.fecha===hoy?'Hoy':n.fecha} {n.hora} · {cat}</Text></View><Icon name="back" size={14} color={t.muted}/></Row></Card></Pressable>;}):<Card pad><Hint>Sin novedades registradas. Puede agregar la primera con el botón superior.</Hint></Card>}
  <EditorNovedad abierto={editar!==undefined} novedad={editar||null} fecha={hoy} categoriaInicial={categoria} onClose={()=>setEditar(undefined)}/>
 </Pantalla>;
}
