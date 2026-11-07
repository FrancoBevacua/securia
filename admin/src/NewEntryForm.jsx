import React,{useState} from 'react';
import {isoDate,hhmm} from '../shared/model';

export const CATEGORIAS_NOVEDAD=['NOVEDAD','RECORRIDO','ADICIONAL','INGRESO','EGRESO','APERTURA','CIERRE','EXTERNO','DESCANSO'];

export default function NewEntryForm({guards,busy,error,onSave,onClose,onRefresh}){
 const [id]=useState(()=>crypto.randomUUID());
 const [datos,setDatos]=useState(()=>({fecha:isoDate(),hora:hhmm(),categoria:'NOVEDAD',guardId:'',texto:''}));
 const [validacion,setValidacion]=useState('');
 const set=(k,v)=>{setValidacion('');setDatos(s=>({...s,[k]:v}));};
 return <form className="new-entry-form" onSubmit={e=>{
  e.preventDefault();if(busy)return;
  if(!datos.texto.trim()){setValidacion('Escriba la descripción de la novedad.');return;}
  if(!guards.some(g=>g.id===datos.guardId&&!g.deleted&&!g.corporativo)){setValidacion('Seleccione el guardia que realizó la novedad.');return;}
  onSave({id,datos:{...datos,texto:datos.texto.trim()}});
 }}>
  <div className="two">
   <label className="field"><span>Fecha</span><input required type="date" value={datos.fecha} onChange={e=>set('fecha',e.target.value)}/></label>
   <label className="field"><span>Horario</span><input required type="time" value={datos.hora} onChange={e=>set('hora',e.target.value)}/></label>
  </div>
  <label className="field"><span>Categoría</span><select aria-label="Categoría" required value={datos.categoria} onChange={e=>set('categoria',e.target.value)}>{CATEGORIAS_NOVEDAD.map(c=><option key={c} value={c}>{c}</option>)}</select></label>
  <label className="field"><span>Guardia que realizó la novedad</span><select aria-label="Guardia que realizó la novedad" required value={datos.guardId} onChange={e=>set('guardId',e.target.value)}><option value="">Seleccione el guardia</option>{guards.filter(g=>!g.deleted&&!g.corporativo).map(g=><option key={g.id} value={g.id}>{[g.apellido,g.nombre].filter(Boolean).join(', ')}</option>)}</select></label>
  <label className="field"><span>Descripción</span><textarea aria-label="Descripción" required rows={7} maxLength={20000} value={datos.texto} onChange={e=>set('texto',e.target.value)} placeholder="Describa lo ocurrido y las acciones realizadas…"/></label>
  <p className="muted">La novedad se agrega al libro compartido y a los informes del servicio con la firma del guardia seleccionado.</p>
  {validacion&&<div className="error" role="alert">{validacion}</div>}
  <div className="modal-actions">
   <button type="button" disabled={busy} onClick={onClose}>Cancelar</button>
   {error&&<button type="button" disabled={busy} onClick={onRefresh}>Actualizar vista</button>}
   <button className="primary" disabled={busy}>{busy?'Guardando…':'Crear novedad'}</button>
  </div>
 </form>;
}
