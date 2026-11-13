import React,{useState} from 'react';
import {nuevoVigilador,mismoNombre} from '../altasCatalogo';
import {useStore} from '../store';
import {Selector,Sheet,Input,Btn,Banner} from '../ui';
import {apellidoNombre} from '../reporte';
import SelectorPuestosGuardia from './SelectorPuestosGuardia';
import {puestos,franjasDe} from '../logic';
export default function SelectorFirma({valor,onChange,label='Vigilador que realizó la novedad'}:{valor:string;onChange:(id:string)=>void;label?:string}){
 const st=useStore();const [alta,setAlta]=useState(false),[apellido,setApellido]=useState(''),[nombre,setNombre]=useState(''),[error,setError]=useState('');
 const [puestoIds,setPuestoIds]=useState<string[]>([]),[puestoId,setPuestoId]=useState('');
 const agregar=async()=>{try{if(!apellido.trim()||!nombre.trim())throw Error('Complete apellido y nombre.');const existente=st.S.guards.find(g=>!g.deleted&&mismoNombre(g.apellido+' '+g.nombre,apellido+' '+nombre));const g=existente||{...nuevoVigilador(apellido,nombre),puestoId,puestoIds,franjaId:puestoId?franjasDe(st.S,puestoId)[0]?.id||'':''};if(!existente){st.put('guards',g);await st.confirmarGuardado();}onChange(g.id);setAlta(false);}catch(e:any){setError(e.message);}};
 return <><Selector label={label} valor={valor} onChange={v=>{if(v==='__nuevo__'){setAlta(true);setApellido('');setNombre('');setError('');setPuestoIds([]);setPuestoId('');}else onChange(v);}}
 opciones={[{v:'',t:'Seleccione el vigilador'},...(st.esAdmin?[{v:'__nuevo__',t:'No está en la lista: agregar vigilador'}]:[]),...st.S.guards.filter(g=>!g.deleted&&!g.corporativo).sort((a,b)=>apellidoNombre(a.apellido,a.nombre).localeCompare(apellidoNombre(b.apellido,b.nombre),'es')).map(g=>({v:g.id,t:apellidoNombre(g.apellido,g.nombre)}))]}/>{alta&&st.esAdmin?<Sheet visible title="¿Desea agregar un vigilador?" onClose={()=>setAlta(false)}><Input label="Apellido" value={apellido} onChangeText={setApellido}/><Input label="Nombre" value={nombre} onChangeText={setNombre}/><SelectorPuestosGuardia puestos={puestos(st.S)} seleccion={puestoIds} principal={puestoId} onChange={(ids,principal)=>{setPuestoIds(ids);setPuestoId(principal);}}/>{error?<Banner kind="warn">{error}</Banner>:null}<Btn label="Agregar vigilador" onPress={agregar}/></Sheet>:null}</>;
}
