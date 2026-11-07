import React,{useEffect,useState,useRef} from 'react';
import { View, Text } from 'react-native';
import {Image} from '../Imagen';
import {useStore} from '../store';
import {Novedad,Vigilador,Acceso,accNormal,hhmm,isoDate,addDays,toMin,uid,dmy,personasReales} from '../model';
import {CATEGORIAS_REPORTE,DatosAsiento,redactarAsiento,categoriaAsiento,apellidoNombre} from '../reporte';
import {gsName,novTextoCompleto,lineaPrecintos,textoMovimientoBreve} from '../text';
import {motivoSoloLectura,turnoAbierto,horaValida,fechaValida} from '../servicio';
import {Sheet,Input,Field,Chipbar,Chip,Row,Btn,Selector,Seg,Hint,Banner,Confirmar,useTheme,useToast} from '../ui';
import FotosRegistro from './FotosRegistro';
import {permiteEvidencia,descripcionEvidencia,LIMITE_DESCRIPCION_EVIDENCIA} from '../evidencias';
import {horariosPuesto} from '../horarios';
import {nuevoVigilador,nuevoAcceso,mismoNombre} from '../altasCatalogo';
import ServicioActual from './ServicioActual';
import BloqueAcceso from './BloqueAcceso';
import Dictado from './Dictado';
import RedaccionIA from './RedaccionIA';
import SelectorFirma from './SelectorFirma';
import {historialAdicionales} from '../adicionales';
import {Card,Item,Empty} from '../ui';
import SeleccionAccesos from './SeleccionAccesos';
import {dentro} from '../informedia';
import {validarDescanso,datosDescanso} from '../descansos';
import {Toggle} from '../ui';
import MotivoAcceso from './MotivoAcceso';
import SugerenciasTexto from './SugerenciasTexto';
import {sugerenciasTexto} from '../autocompletado';
import Rondas from './Rondas';

export function EditorNovedad({abierto,novedad,fecha,corte,duracion=24,categoriaInicial='Novedad',textoInicial,onClose,onGuardado}:{abierto:boolean;novedad:Novedad|null;fecha:string;corte?:string;duracion?:12|24;categoriaInicial?:string;textoInicial?:string;onClose:()=>void;onGuardado?:(fecha:string,hora:string)=>void}){
 const st=useStore(),t=useTheme(),toast=useToast();
 const [categoria,setCategoria]=useState('Novedad'),[datos,setDatos]=useState<DatosAsiento>({}),[texto,setTexto]=useState<string|null>(null);
 const [dia,setDia]=useState(fecha),[hora,setHora]=useState(hhmm()),[acc,setAcc]=useState<Acceso>(accNormal());
 const [verAdicionales,setVerAdicionales]=useState(false),[busquedaAdicional,setBusquedaAdicional]=useState('');
 const [error,setError]=useState(''),[borrar,setBorrar]=useState(false);
 const [firma,setFirma]=useState('');
 const [fotos,setFotos]=useState<string[]>([]),[sector,setSector]=useState(''),[fotosOcupadas,setFotosOcupadas]=useState(false),[alta,setAlta]=useState('');
 const [descripcionFoto,setDescripcionFoto]=useState('');
 const [guardando,setGuardando]=useState(false);const idNuevo=useRef(uid());
 const motivo=novedad?motivoSoloLectura(st.S,novedad,st.me?.id,st.telefonoId):'';const sinTurno=!turnoAbierto(st.S,st.me?.id,st.telefonoId);
 useEffect(()=>{if(!abierto)return;
  const alogId=novedad?.alogId||(novedad?.autoKey?.startsWith('acceso:')?novedad.autoKey.slice(7):undefined);
  const alog=alogId?st.S.alogs.find(a=>a.id===alogId):undefined;
  const cat=novedad?(novedad.categoria==='Acceso'&&alog?alog.tipo.toUpperCase():categoriaAsiento(novedad)):categoriaInicial==='Externos'?'EXTERNO':categoriaInicial.toUpperCase();
  setCategoria(['ADICIONAL','INGRESO','EGRESO','INGRESO/EGRESO','INGRESOS/EGRESOS'].includes(cat)?'Ingreso/Egreso':cat==='EXTERNO'?'Externos':['APERTURA','CIERRE','APERTURA/CIERRE'].includes(cat)?'Apertura/Cierre':cat.charAt(0)+cat.slice(1).toLowerCase());
  setDatos({...novedad?.datos|| (alog?{acceso:alog.acceso,grupoAccesos:alog.grupoAccesos,accesos:alog.accesos,motivo:alog.motivo,incluirMotivo:alog.incluirMotivo,
   observaciones:[lineaPrecintos(alog),alog.nota].filter(Boolean).join('. ')}:{movimiento:cat==='EGRESO'||novedad?.mov==='out'?'egreso':'ingreso',puestoId:st.me?.puestoId,lugar:'el paseo'}),
   operacionAcceso:cat==='CIERRE'?'cierre':novedad?.datos?.operacionAcceso||'apertura',
   realizadoPorId:novedad?.datos?.realizadoPorId,realizadoPor:novedad?.datos?.realizadoPor,
   tipoRecorrido:novedad?.datos?.tipoRecorrido||'locales',controlLocales:novedad?.datos?.controlLocales||'abiertos',
   ...(cat==='ADICIONAL'?{tipoPersona:'adicional' as const,turno:novedad?.datos?.turno||'09:00-16:00'}:cat==='EXTERNO'?{tipoPersona:'externo' as const}:{})});
  setFotos(novedad?.fotos||[]);setSector(novedad?.sector||st.S.posts.find(p=>p.id===st.me?.puestoId)?.nombre||'');setAlta('');setVerAdicionales(false);setBusquedaAdicional('');setFirma(novedad?.guardId||st.responsable?.id||'');setTexto(novedad?textoMovimientoBreve(novedad.texto):textoInicial??null);setAcc(accNormal(novedad?.acc));const h=novedad?.hora||hhmm();setHora(h);
  setDescripcionFoto(novedad?.descripcionEvidencia||'');
  setDia(novedad?.fecha||isoDate());
  idNuevo.current=novedad?.id||uid();setError('');setBorrar(false);setGuardando(false);
 },[abierto,novedad?.id]);
 const cambiar=(v:Partial<DatosAsiento>)=>{setDatos(d=>({...d,...v}));setTexto(null);};
 const esAdicional=categoria==='Adicional'||(categoria==='Ingreso/Egreso'&&datos.tipoPersona==='adicional');
 const puesto=esAdicional?'Paseo':st.S.posts.find(p=>p.id===datos.puestoId)?.nombre||'';
 const adicionales=historialAdicionales(st.S.novedades).filter(a=>(a.apellido+' '+a.nombre).toLocaleLowerCase('es').includes(busquedaAdicional.toLocaleLowerCase('es')));
 const cuerpo=texto??redactarAsiento(categoria,datosDescanso(st.S,{...datos,...(categoria==='Recorrido'&&datos.tipoRecorrido==='playa'?{lugar:'la playa'}:{})}),acc,puesto);
 const guardar=async(agregar?:boolean)=>{if(guardando)return;setGuardando(true);try{
  if(!fechaValida(dia)||!horaValida(hora))throw Error('Revise la fecha (AAAA-MM-DD) y la hora (HH:MM).');
  if(categoria==='Descanso')validarDescanso(st.S,datos,dia,hora);
  if(!novedad||novedad.datos){
   if(['Ingreso/Egreso','Adicional'].includes(categoria)){
    if(!datos.apellido?.trim()||!datos.nombre?.trim())throw Error('Complete apellido y nombre en sus campos correspondientes.');
    if(datos.movimiento!=='egreso'&&(!datos.turno?.trim()||(categoria==='Ingreso/Egreso'&&datos.tipoPersona!=='adicional'&&!puesto)))throw Error('Complete el puesto y el turno del ingreso.');
   }
   if(categoria==='Externos'&&!acc.empresa&&!personasReales(acc).length)throw Error('Ingrese la firma o los datos de la persona externa.');
   if(categoria==='Apertura/Cierre'&&(datos.grupoAccesos?!datos.accesos?.length:!datos.acceso?.trim()))throw Error('Seleccione o indique el acceso.');
  }
  if(!cuerpo.trim())throw Error('Ingrese la descripción de la novedad.');
  if(categoria==='Apertura/Cierre'&&datos.incluirMotivo&&!datos.motivo?.trim())throw Error('Complete el motivo o desactive Agregar motivo.');
  if(!permiteEvidencia(categoria)&&fotos.some(f=>!novedad?.fotos?.includes(f)))throw Error('La evidencia se adjunta en Novedad, Externos, Apertura o Cierre. Seleccione una de esas categorías.');
  if(fotos.length&&!sector.trim())throw Error('Indique el sector de la evidencia.');
  const nuevos:any[]=[];
  if(categoria==='Ingreso/Egreso'&&datos.tipoPersona!=='adicional'&&datos.apellido?.trim()&&datos.nombre?.trim()&&!st.S.guards.some(g=>!g.deleted&&mismoNombre(g.apellido+' '+g.nombre,datos.apellido+' '+datos.nombre)))nuevos.push({col:'guards',obj:nuevoVigilador(datos.apellido,datos.nombre)});
  if(categoria==='Apertura/Cierre'&&!datos.grupoAccesos&&datos.acceso?.trim()&&!st.S.accesses.some(a=>!a.deleted&&mismoNombre(a.nombre,datos.acceso!)))nuevos.push({col:'accesses',obj:nuevoAcceso(datos.acceso)});
  if(nuevos.length&&agregar===undefined){setAlta(nuevos[0].col==='guards'?'El vigilador no existe. ¿Desea agregarlo al equipo?':'El acceso no existe. ¿Desea agregarlo al catálogo?');return;}
  if(agregar)st.putVarios(nuevos);setAlta('');
  st.put('novedades',{...novedad,id:idNuevo.current,fecha:dia,hora,guardId:firma,fotos,sector:sector.trim(),descripcionEvidencia:descripcionEvidencia(descripcionFoto),
   categoria:categoria==='Ingreso/Egreso'&&datos.tipoPersona==='adicional'?'Adicional':categoria==='Ingreso/Egreso'?(datos.movimiento==='egreso'?'Egreso':'Ingreso'):categoria==='Externos'?'Externo':categoria==='Apertura/Cierre'?(datos.operacionAcceso==='cierre'?'Cierre':'Apertura'):categoria,
   datos:categoria==='Descanso'?datosDescanso(st.S,datos):categoria==='Recorrido'?{...datos,lugar:datos.tipoRecorrido==='playa'?'la playa':datos.lugar}:esAdicional?{...datos,tipoPersona:'adicional',lugar:'Paseo',puestoId:st.S.posts.find(p=>!p.deleted&&p.nombre.trim().toLowerCase()==='paseo')?.id}:datos,texto:cuerpo.trim(),acc:categoria==='Externos'?acc:null,
   origenTipo:categoria==='Ingreso/Egreso'?(datos.tipoPersona==='adicional'?'policial':'guardia'):categoria==='Adicional'?'policial':categoria==='Recorrido'?'recorrido':novedad?.origenTipo==='libro-foto'?'libro-foto':undefined});
  await st.confirmarGuardado();
  onGuardado?.(dia,hora);onClose();toast('Registro guardado en el teléfono');
 }catch(e:any){setError(e.message);}finally{setGuardando(false);}};
 if(novedad&&motivo)return <Sheet visible={abierto} title="Registro · Solo lectura" onClose={onClose}>
  <Banner kind="info">{motivo}</Banner><Hint>{dmy(novedad.fecha)+' · '+novedad.hora+' · '+gsName(st.byId<Vigilador>('guards',novedad.guardId),st.S.site)}</Hint>
  <Text selectable style={{color:t.text,fontSize:15,lineHeight:23}}>{novTextoCompleto(novedad)}</Text>
  {novedad.fotos?.map(uri=><Image key={uri} source={{uri}} style={{width:'100%',height:240,resizeMode:'contain'}}/>)}</Sheet>;
 return <Sheet visible={abierto} title={novedad?'Editar registro':'Nueva novedad'} onClose={()=>{if(!guardando)onClose();}} footer={<>
  {novedad?<Btn icon="trash" variant="danger" disabled={sinTurno} onPress={()=>setBorrar(true)}/>:null}
  {!(categoria==='Recorrido'&&datos.tipoRecorrido==='nocturna'&&!novedad)?<Btn label={guardando?'Guardando…':'Guardar'} variant="primary" disabled={sinTurno||guardando||fotosOcupadas} style={{flex:1}} onPress={()=>guardar()}/>:null}</>}>
  {sinTurno?<ServicioActual/>:null}
  <SelectorFirma label={categoria==='Apertura/Cierre'?'Guardia que registra la novedad':undefined} valor={firma} onChange={setFirma}/>
  <Field label="Categoría"><Chipbar>{CATEGORIAS_REPORTE.map(c=><Chip key={c} label={c} on={c==='Ingresos/Egresos'?['Ingreso/Egreso','Adicional','Externos'].includes(categoria):categoria===c} onPress={()=>{setCategoria(c==='Ingresos/Egresos'?(datos.tipoPersona==='externo'?'Externos':'Ingreso/Egreso'):c);setTexto(null);setError('');}}/>)}</Chipbar></Field>
  <Row><View style={{flex:1}}><Input tipo="fecha" label={categoria==='Descanso'?'Fecha de inicio':'Fecha'} value={dia} onChangeText={setDia} placeholder="AAAA-MM-DD" mono/></View>
   <View style={{flex:1}}><Input tipo="hora" label={categoria==='Descanso'?'Inicio del descanso':'Horario'} value={hora} onChangeText={setHora} placeholder="HH:MM" mono/></View></Row>
  {!novedad&&corte?<Hint>Indique la fecha y hora reales del hecho. Se ubicará en el período correspondiente.</Hint>:null}
  {['Ingreso/Egreso','Adicional','Externos'].includes(categoria)?<Seg valor={datos.movimiento||'ingreso'} onChange={v=>cambiar({movimiento:v as any})} opciones={[{v:'ingreso',t:'Ingreso'},{v:'egreso',t:'Egreso'}]}/>:null}
  {['Ingreso/Egreso','Adicional','Externos'].includes(categoria)?<Selector label="Tipo de ingreso o egreso" valor={categoria==='Externos'?'externo':categoria==='Adicional'?'adicional':datos.tipoPersona||'vigilador'} onChange={v=>{setCategoria(v==='externo'?'Externos':'Ingreso/Egreso');cambiar({tipoPersona:v as any,turno:v==='adicional'?'09:00-16:00':''});}} opciones={[{v:'vigilador',t:'Vigiladores'},{v:'adicional',t:'Adicionales'},{v:'externo',t:'Externos'}]}/>:null}
  {['Ingreso/Egreso','Adicional'].includes(categoria)?<>
   {categoria==='Ingreso/Egreso'&&datos.tipoPersona!=='adicional'?<Selector label="Vigilador del equipo" valor="" onChange={id=>{const g=st.byId<Vigilador>('guards',id);if(g){const f=st.S.franjas.find(x=>x.id===g.franjaId);cambiar({apellido:g.apellido,nombre:g.nombre,puestoId:g.puestoId,turno:f?f.entrada+'-'+f.salida:''});}}} opciones={[{v:'',t:'Seleccionar o completar los datos'},...st.list<Vigilador>('guards').map(g=>({v:g.id,t:apellidoNombre(g.apellido,g.nombre)}))]}/>:null}
   {esAdicional?<><Hint>Puesto: Paseo</Hint><Btn label="Elegir adicional del historial" onPress={()=>setVerAdicionales(true)}/><Sheet visible={verAdicionales} title="Historial de adicionales policiales" onClose={()=>setVerAdicionales(false)}><Input label="Buscar adicional" value={busquedaAdicional} onChangeText={setBusquedaAdicional}/><Card>{adicionales.length?adicionales.map(a=><Item key={a.id} title={apellidoNombre(a.apellido,a.nombre)} subs={['Paseo · '+(a.turno||'Sin turno registrado'),'Último movimiento: '+dmy(a.fecha)+' '+a.hora]} onPress={()=>{cambiar({apellido:a.apellido,nombre:a.nombre,turno:a.turno||'09:00-16:00'});setVerAdicionales(false);}}/>):<Empty>Sin adicionales en el historial. Complete sus datos para registrar el primero.</Empty>}</Card></Sheet></>:null}
   <Input label="Apellido" value={datos.apellido||''} onChangeText={apellido=>cambiar({apellido})}/><Input label="Nombre" value={datos.nombre||''} onChangeText={nombre=>cambiar({nombre})}/>
   {datos.movimiento!=='egreso'?<>{!esAdicional?<Selector label="Puesto" valor={datos.puestoId||''} onChange={puestoId=>cambiar({puestoId})} opciones={st.S.posts.filter(p=>!p.deleted).map(p=>({v:p.id,t:p.nombre}))}/>:null}<Selector label="Horarios predefinidos" valor={datos.turno||''} onChange={turno=>cambiar({turno})} opciones={[{v:'',t:'Seleccionar horario'},...horariosPuesto(puesto,datos.tipoPersona==='adicional'||categoria==='Adicional')]}/><Input label="Turno" value={datos.turno||''} onChangeText={turno=>cambiar({turno})} placeholder="09:00-16:00"/></>:null}
  </>:null}
  {categoria==='Externos'?<><Selector label="Tipo de externo" valor={datos.tipoExterno||'Visita'} onChange={tipoExterno=>cambiar({tipoExterno})} opciones={['Proveedor','Contratista','Visita','Empleado','Locatario'].map(v=>({v,t:v}))}/><BloqueAcceso valor={acc} onChange={a=>{setAcc(a);setTexto(null);}}/></>:null}
  {categoria==='Descanso'?<>
    <SelectorFirma label="Guardia que toma el descanso" valor={datos.guardiaDescansoId||''} onChange={guardiaDescansoId=>cambiar({guardiaDescansoId})}/>
    <Selector label="Puesto del descanso" valor={datos.puestoId||''} onChange={puestoId=>cambiar({puestoId})} opciones={[{v:'',t:'Seleccione un puesto'},...st.S.posts.filter(p=>!p.deleted).map(p=>({v:p.id,t:p.nombre}))]}/>
    <Toggle label="El puesto requiere cobertura" value={!!datos.requiereCobertura} onChange={requiereCobertura=>cambiar({requiereCobertura})}/>
    {datos.requiereCobertura?<SelectorFirma label="Guardia que cubre" valor={datos.cubreId||''} onChange={cubreId=>cambiar({cubreId})}/>:null}
    <Hint>La fecha y el horario del registro indican el inicio. Al terminar, abra este descanso y complete el fin.</Hint>
    <Row><View style={{flex:1}}><Input tipo="hora" label="Fin (opcional)" value={datos.finDescanso||''} onChangeText={finDescanso=>cambiar({finDescanso,fechaFinDescanso:finDescanso<hora?addDays(dia,1):dia})}/></View><View style={{flex:1}}><Input tipo="fecha" label="Fecha de fin" value={datos.fechaFinDescanso||dia} onChangeText={fechaFinDescanso=>cambiar({fechaFinDescanso})}/></View></Row>
  </>:null}
  {categoria==='Recorrido'?<>
   <Field label="Tipo de recorrido"><Seg valor={datos.tipoRecorrido||'locales'} onChange={v=>cambiar({tipoRecorrido:v as 'locales'|'playa'|'nocturna'})} opciones={[{v:'locales',t:'Control de locales'},{v:'playa',t:'Playa'},{v:'nocturna',t:'Ronda Nocturna'}]}/></Field>
   {(!datos.tipoRecorrido||datos.tipoRecorrido==='locales')?<Field label="Control de locales"><Seg valor={datos.controlLocales||'abiertos'} onChange={v=>cambiar({controlLocales:v as 'abiertos'|'cerrados'})} opciones={[{v:'abiertos',t:'Locales abiertos'},{v:'cerrados',t:'Locales cerrados'}]}/></Field>:null}
   {datos.tipoRecorrido==='nocturna'&&!novedad?<Rondas integrado/>:<><Input label="Observaciones (si las hubiera)" value={datos.observaciones||''} onChangeText={observaciones=>cambiar({observaciones})} multiline rows={3} fixedHeight placeholder="Sin novedades"/>
   <Hint>Se agrega automáticamente al libro. Si no escribe observaciones, se registra «Sin novedades».</Hint></>}
  </>:null}
  {categoria==='Apertura/Cierre'?<>
   <SelectorFirma label={datos.operacionAcceso==='cierre'?'Guardia que realizó el cierre (opcional)':'Guardia que realizó la apertura (opcional)'} valor={datos.realizadoPorId||''} onChange={id=>{const g=st.S.guards.find(g=>g.id===id&&!g.deleted&&!g.corporativo);cambiar({realizadoPorId:g?.id,realizadoPor:g?gsName(g,st.S.site):undefined});}}/>
   <Hint>Podés registrar la operación realizada por otro guardia. La firma del registro se conserva por separado.</Hint>
   <Field label="Operación"><Seg valor={datos.operacionAcceso||'apertura'} onChange={v=>cambiar({operacionAcceso:v as 'apertura'|'cierre'})} opciones={[{v:'apertura',t:'Apertura'},{v:'cierre',t:'Cierre'}]}/></Field>
   <SeleccionAccesos datos={datos} catalogo={st.S.accesses} onChange={cambiar}/>
   <MotivoAcceso activo={!!datos.incluirMotivo} valor={datos.motivo||''} tipo={datos.operacionAcceso||'apertura'} onToggle={incluirMotivo=>cambiar({incluirMotivo})} onChange={motivo=>cambiar({motivo})} sugerencias={sugerenciasTexto(st.S.novedades,datos.motivo||'','motivo',novedad?.id)}/>
  </>:null}
  {categoria==='Recorrido'?(datos.tipoRecorrido==='nocturna'&&!novedad?null:<Field label="Vista previa del recorrido"><Text selectable style={{color:t.text,fontSize:15,lineHeight:24}}>{cuerpo}</Text></Field>):<>
  <Input label="Descripción del registro" value={cuerpo} onChangeText={setTexto} multiline rows={6} fixedHeight placeholder="Describa el hecho, el lugar y las medidas adoptadas."/>
  {categoria==='Novedad'?<SugerenciasTexto opciones={sugerenciasTexto(st.S.novedades,cuerpo,'texto',novedad?.id)} onElegir={setTexto}/>:null}
  <Dictado enabled={abierto&&!sinTurno} onTexto={v=>setTexto((cuerpo.trim()?cuerpo.trim()+' ':'')+v)}/>
  <RedaccionIA texto={cuerpo} categoria={categoria} onTexto={setTexto} disabled={sinTurno}/>
  </>}
  {permiteEvidencia(categoria)?<>
   <Input label="Sector" value={sector} onChangeText={setSector} placeholder="Puesto, portón o sector"/>
   <Input label="Descripción breve de las fotos (opcional)" value={descripcionFoto} onChangeText={setDescripcionFoto} maxLength={LIMITE_DESCRIPCION_EVIDENCIA} placeholder="Ej.: Precinto dañado en portón"/>
   <Hint>Podés agregar una descripción de hasta 100 caracteres para la evidencia. Se mostrará junto a la hora y el tipo de novedad.</Hint>
   <FotosRegistro fotos={fotos} onChange={setFotos} disabled={guardando} onBusyChange={setFotosOcupadas}/>
  </>:null}
  {alta?<Confirmar visible etiqueta="Aceptar" variante="primary" mensaje={alta+' Si elige cancelar, se guardará el registro sin agregarlo a la lista.'} onOk={()=>guardar(true)} onCancel={()=>guardar(false)}/>:null}
  {error?<Banner kind="warn">{error}</Banner>:null}
  <Confirmar visible={borrar} mensaje="¿Eliminar este registro del Informe general?" onCancel={()=>setBorrar(false)} onOk={()=>{try{if(novedad){if(st.byId('novedades',novedad.id))st.drop('novedades',novedad.id);else st.put('novedades',{...novedad,deleted:true});}setBorrar(false);onClose();}catch(e:any){setError(e.message);setBorrar(false);}}}/>
 </Sheet>;
}
