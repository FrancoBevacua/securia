import React,{useEffect,useState} from 'react';
import {AppState,Pressable,Text,View,useWindowDimensions} from 'react-native';
import {router} from 'expo-router';
import {useStore} from '../store';
import {dmy,fmtDNI,hhmm,isoDate,autLabel,Visita,Novedad} from '../model';
import {externosEnPredio,colorSector,normalPresencia} from '../presencias';
import {FONT} from '../theme';
import {Icon} from '../icons';
import {Pantalla,SubCabecera,Card,Input,Btn,Row,Hint,Tag,Sheet,Empty,Eyebrow,Item} from '../ui';
import {EditorVisita} from './Visitas';
import {EditorNovedad} from './EditorAsiento';

export default function Predio(){
 const st=useStore(),{width,fontScale}=useWindowDimensions();
 const [ahora,setAhora]=useState(()=>new Date()),[busqueda,setBusqueda]=useState(''),[seleccion,setSeleccion]=useState<string|null>(null);
 const [visita,setVisita]=useState<Visita|null|undefined>(undefined),[novedad,setNovedad]=useState<Novedad|undefined>(undefined);
 const editar=(id:string)=>{
  setSeleccion(null);
  const v=st.S.visits.find(v=>v.id===id&&!v.deleted);
  if(v)setVisita(v);else setNovedad(st.S.novedades.find(n=>n.id===id&&!n.deleted));
 };
 useEffect(()=>{const tick=()=>setAhora(new Date()),timer=setInterval(tick,30000),sub=AppState.addEventListener('change',s=>{if(s==='active')tick();});return()=>{clearInterval(timer);sub.remove();};},[]);
 const grupos=externosEnPredio(st.S,ahora),texto=normalPresencia(busqueda);
 const visibles=grupos.filter(g=>normalPresencia([g.empresa,g.sector,g.tarea,...g.personas.map(p=>p.nombre+' '+p.dni)].join(' ')).includes(texto));
 const sectores=[...new Set(visibles.map(g=>g.sector))],detalle=grupos.find(g=>g.id===seleccion);
 const columnas=width>=700&&fontScale<1.3?3:width>=380&&fontScale<1.3?2:1;
 const personas=grupos.filter(g=>g.estado==='confirmado').reduce((n,g)=>n+g.personas.length,0),espera=grupos.filter(g=>g.estado==='espera');
 return <Pantalla top>
  <SubCabecera titulo="En el predio" sub="Empresas, sectores y tareas en curso." onBack={()=>router.back()}/>
  <Card pad><Row><View style={{flex:1,gap:5}}><Eyebrow>Personal registrado</Eyebrow><Text style={{fontFamily:FONT.dispBold,fontSize:32,color:'#2EC693'}}>{personas}</Text><Hint>{grupos.filter(g=>g.estado==='confirmado').length+' equipos confirmados · '+[...new Set(grupos.map(g=>g.sector))].length+' sectores'}</Hint></View><Icon name="equipo" size={32} color="#2EC693"/></Row></Card>
  <Hint>{'Consulta: '+dmy(isoDate(ahora))+' '+hhmm(ahora)+'. Presencias según ingresos y egresos registrados en este teléfono y sincronizados.'}</Hint>
  <Hint>Los ingresos que superan 8 horas dejan de aparecer automáticamente. Sus movimientos se conservan en el historial.</Hint>
  <Btn label="Agregar personal al predio" icon="plus" variant="primary" onPress={()=>setVisita(null)}/>
  {espera.length?<Tag kind="warn" label={espera.length+' equipos aguardando confirmación'}/>:null}
  <Input label="Buscar razón social, sector, tarea o persona" value={busqueda} onChangeText={setBusqueda} placeholder="Ej.: limpieza, escalera al techo…"/>
  <Hint>Toque un bloque para ver el personal y los datos del ingreso. Los colores identifican sectores; escalera al techo siempre aparece en rojo.</Hint>
  {sectores.map(sector=><View key={sector} style={{gap:10}}>
   <Eyebrow>{sector}</Eyebrow>
   <View style={{flexDirection:'row',flexWrap:'wrap',gap:10}}>
    {visibles.filter(g=>g.sector===sector).map(g=><Pressable key={g.id} accessibilityRole="button" accessibilityLabel={g.empresa+'. Sector: '+g.sector+'. Tarea: '+g.tarea+'. Ver personal.'} onPress={()=>setSeleccion(g.id)} style={({pressed})=>({width:columnas===3?'31.5%':columnas===2?'48%':'100%',minHeight:170,padding:15,gap:10,borderRadius:16,backgroundColor:colorSector(g.sector),borderWidth:1,borderColor:'#FFFFFF44',borderBottomWidth:6,opacity:pressed ? 0.8 : 1})}>
     <Row style={{justifyContent:'space-between',flexWrap:'wrap'}}><Icon name="equipo" size={21} color="#FFFFFF"/><Text style={{color:'#FFFFFF',fontFamily:FONT.bodySemi,fontSize:12}}>{g.personas.length?g.personas.length+' personas':'Personal sin detallar'}</Text></Row>
     <Text style={{color:'#FFFFFF',fontFamily:FONT.bodyBold,fontSize:17,lineHeight:23}}>{g.empresa}</Text>
     <Text style={{color:'#FFFFFF',fontFamily:FONT.bodyMed,fontSize:13,lineHeight:19}}>{'Sector: '+g.sector}</Text>
     <Text style={{color:'#FFFFFF',fontFamily:FONT.body,fontSize:14,lineHeight:21}}>{'Tarea: '+g.tarea}</Text>
     <Text style={{color:'#FFFFFF',fontFamily:FONT.bodySemi,fontSize:12,lineHeight:18}}>{g.estado==='espera'?'Aguardando confirmación':'Ingreso '+dmy(g.fecha)+' '+g.hora}</Text>
    </Pressable>)}
   </View>
  </View>)}
  {!visibles.length?<Card><Empty>{grupos.length?'No hay coincidencias con la búsqueda.':'Sin personal externo con ingreso vigente registrado.'}</Empty></Card>:null}
  <Btn label="Registrar ingreso o egreso" icon="plus" variant="primary" onPress={()=>router.push('/ingresos?tipo=externo')}/>
  <Sheet visible={!!detalle} title={detalle?.empresa||'Detalle del equipo'} onClose={()=>setSeleccion(null)}>
   {detalle?<>
    <Card pad><Hint>{'Razón social: '+detalle.empresa}</Hint><Hint>{'Sector: '+detalle.sector}</Hint><Hint>{'Tarea: '+detalle.tarea}</Hint><Tag kind={detalle.estado==='espera'?'warn':'ok'} label={detalle.estado==='espera'?'Aguardando confirmación':'Ingreso confirmado'}/></Card>
    {detalle.fecha<isoDate(ahora)?<Hint>Este ingreso es de un día anterior y no tiene egreso posterior registrado. Verifique la presencia en el sector.</Hint>:null}
    <Eyebrow>Personal del equipo</Eyebrow>
    <Hint>Abra el registro para editar los datos, agregar o quitar personas, indicar su egreso o eliminar la carga.</Hint>
    <Card>{detalle.personas.length?detalle.personas.map((p,i)=><Item key={p.dni||p.nombre+i} title={p.nombre||'Nombre no informado'} onPress={()=>editar(p.registroId)} subs={['DNI: '+(fmtDNI(p.dni)||'No informado'),'Ingreso: '+dmy(p.fecha)+' '+p.hora]} last={i===detalle.personas.length-1}/>):<Empty>No se detalló el personal en el registro de ingreso.</Empty>}</Card>
    <Eyebrow>Datos del ingreso</Eyebrow>
    {detalle.accesos.map((a,i)=><Card pad key={detalle.registros[i]}><Hint>{autLabel(a.autoriz)+(a.confirmo?' · '+a.confirmo:'')}</Hint>{a.credencial?<Hint>{'Credencial: '+a.credencial}</Hint>:null}{a.vehiculo?.activo?<Hint>{'Vehículo: '+[a.vehiculo.tipo,a.vehiculo.marca,a.vehiculo.modelo,a.vehiculo.dominio].filter(Boolean).join(' · ')}</Hint>:null}{a.vehiculo?.chofer?<Hint>{'Chofer: '+a.vehiculo.chofer}</Hint>:null}{a.obs?<Hint>{'Observaciones: '+a.obs}</Hint>:null}<Btn label="Editar o eliminar registro" onPress={()=>editar(detalle.registros[i])}/></Card>)}
   </>:null}
  </Sheet>
  <EditorVisita abierto={visita!==undefined} visita={visita||null} onClose={()=>setVisita(undefined)}/>
  <EditorNovedad abierto={!!novedad} novedad={novedad||null} fecha={novedad?.fecha||isoDate()} categoriaInicial="Externos" onClose={()=>setNovedad(undefined)}/>
 </Pantalla>;
}
