import React,{useState} from 'react';
import {router,useLocalSearchParams} from 'expo-router';
import {useStore} from '../store';
import {Novedad,isoDate,dmy} from '../model';
import {categoriaAsiento} from '../reporte';
import {Pantalla,SubCabecera,Seg,Btn,Card,Item,Empty,Eyebrow} from '../ui';
import Visitas from './Visitas';
import {EditorNovedad} from './EditorAsiento';

export default function Ingresos(){
 const st=useStore(),params=useLocalSearchParams<{tipo?:string}>();
 const [tipo,setTipo]=useState(['externo','adicional'].includes(params.tipo||'')?params.tipo!:'vigilador');
 const [editar,setEditar]=useState<Novedad|null|undefined>(undefined);
 const registros=st.list<Novedad>('novedades').filter(n=>{
  const c=categoriaAsiento(n);return tipo==='externo'?c==='EXTERNO'&&!n.visitId:tipo==='adicional'?c==='ADICIONAL':['INGRESO','EGRESO'].includes(c);
 }).sort((a,b)=>(b.fecha+b.hora).localeCompare(a.fecha+a.hora));
 return <Pantalla top>
  <SubCabecera titulo="Ingresos/Egresos" sub="Vigiladores, adicionales y externos en un solo lugar." onBack={()=>router.back()}/>
  <Seg valor={tipo} onChange={setTipo} opciones={[{v:'vigilador',t:'Vigiladores'},{v:'adicional',t:'Adicionales'},{v:'externo',t:'Externos'}]}/>
  {tipo==='externo'?<Visitas integrado/>:<Btn label="Registrar ingreso o egreso" icon="plus" variant="primary" onPress={()=>setEditar(null)}/>}
  {registros.length?<><Eyebrow>Registros del libro</Eyebrow><Card>{registros.map((n,i)=><Item key={n.id} last={i===registros.length-1} lead={n.hora} title={n.texto} tituloLineas={2} subs={[dmy(n.fecha)]} onPress={()=>setEditar(n)}/>)}</Card></>:tipo!=='externo'?<Card><Empty>Sin movimientos de esta categoría.</Empty></Card>:null}
  <EditorNovedad abierto={editar!==undefined} novedad={editar||null} fecha={editar?.fecha||isoDate()} categoriaInicial={tipo==='adicional'?'Adicional':tipo==='externo'?'Externos':'Ingresos/Egresos'} onClose={()=>setEditar(undefined)}/>
 </Pantalla>;
}
