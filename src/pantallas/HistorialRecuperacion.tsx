import React,{useState} from 'react';
import { Text, Platform } from 'react-native';
import {Image} from '../Imagen';
import {File,Paths} from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {listarRecuperaciones,leerRecuperacion,Recuperacion,listarResguardos} from '../nube';
import {Estado} from '../model';
import {detalleDiferencia,registrosRecuperados,fotosDelDato} from '../detalleSincronizacion';
import {Btn,Sheet,Stack,Card,Hint,Banner,useTheme} from '../ui';

export default function HistorialRecuperacion(){
 const t=useTheme(),[abierto,setAbierto]=useState(false),[lista,setLista]=useState<Recuperacion[]>([]),[mas,setMas]=useState(false);
 const [copia,setCopia]=useState<{telefono:Estado;nube:Estado}|null>(null),[id,setId]=useState(''),[ocupado,setOcupado]=useState(false),[error,setError]=useState('');
 const [resguardos,setResguardos]=useState<Awaited<ReturnType<typeof listarResguardos>>>([]);
 const cargar=async(desde=0)=>{setOcupado(true);setError('');try{const filas=await listarRecuperaciones(desde);setLista(l=>desde?[...l,...filas]:filas);setMas(filas.length===20);if(!desde)setResguardos(await listarResguardos());}catch(e:any){setError(e.message);}finally{setOcupado(false);}};
 const exportar=async()=>{
  if(!copia)return;setOcupado(true);setError('');
  try{const contenido=JSON.stringify(copia),nombre='SECURIA-recuperacion-'+id.replace(/[^a-zA-Z0-9-]/g,'')+'.json';
   if(Platform.OS==='web'){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([contenido],{type:'application/json'}));a.href=url;a.download=nombre;a.click();setTimeout(()=>URL.revokeObjectURL(url),4000);}
   else{if(!await Sharing.isAvailableAsync())throw Error('No se puede abrir el selector de archivos en este teléfono.');const f=new File(Paths.cache,nombre);f.create({overwrite:true});f.write(contenido);await Sharing.shareAsync(f.uri,{mimeType:'application/json',dialogTitle:'Guardar copia completa'});}
  }catch(e:any){setError(e.message);}finally{setOcupado(false);}
 };
 return <>
  <Btn label="Historial de recuperación" variant="ghost" onPress={()=>{setAbierto(true);setCopia(null);void cargar();}}/>
  <Sheet visible={abierto} title="Datos recuperados" onClose={()=>{if(!ocupado)setAbierto(false);}} onBack={copia?()=>setCopia(null):undefined}>
   <Hint>Estos respaldos están guardados en el corporativo. Conservan los datos y las imágenes del teléfono y de la nube anteriores a cada recuperación.</Hint>
   {copia?<>
    <Btn label="Guardar copia completa" disabled={ocupado} onPress={exportar}/>
    {registrosRecuperados(copia.telefono,copia.nube).map((d,i)=>{const detalle=detalleDiferencia(d,copia.telefono,copia.nube);return <Card pad key={i}><Stack gap={8}>
     <Hint>{detalle.titulo}</Hint><Hint>Datos conservados del teléfono</Hint><Text selectable style={{color:t.text}}>{detalle.local}</Text>
     {fotosDelDato(d.local).map((uri,n)=><Image key={n} source={{uri}} style={{height:180,width:'100%'}} resizeMode="contain"/>)}
     <Hint>Datos del corporativo antes de recuperar</Hint><Text selectable style={{color:t.text}}>{detalle.remoto}</Text>
    </Stack></Card>;})}
   </>:<>
    {resguardos.map(r=><Card pad key={r.id}><Stack gap={8}>
     <Hint>{new Date(r.creado).toLocaleString('es-AR')} · {r.motivo}</Hint>
     <Text selectable style={{color:t.text}}>{r.dato.valor?.texto||r.dato.valor?.nombre||r.col+' · '+r.registro}</Text>
     {fotosDelDato(r.dato.valor).map((uri,i)=><Image key={i} source={{uri}} style={{height:180,width:'100%'}} resizeMode="contain"/>)}
    </Stack></Card>)}
    {lista.map(r=><Card pad key={r.id}><Stack gap={8}><Hint>{new Date(r.creado).toLocaleString('es-AR')}</Hint>
     <Hint>{r.incorporados} registros incorporados · {r.resguardados} versiones conservadas</Hint>
     <Btn label="Ver datos conservados" disabled={ocupado} onPress={async()=>{setOcupado(true);setError('');try{setCopia(await leerRecuperacion(r.id));setId(r.id);}catch(e:any){setError(e.message);}finally{setOcupado(false);}}}/>
    </Stack></Card>)}
    {!ocupado&&!lista.length&&!resguardos.length&&!error?<Hint>No hay recuperaciones guardadas para esta cuenta.</Hint>:null}
    {mas?<Btn label="Ver más" disabled={ocupado} onPress={()=>cargar(lista.length)}/>:null}
   </>}
   {ocupado?<Hint>Cargando…</Hint>:null}{error?<Banner kind="warn">{error}</Banner>:null}
  </Sheet>
 </>;
}
