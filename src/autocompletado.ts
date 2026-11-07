import {Novedad} from './model';

const normal = (s:string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').replace(/\s+/g,' ').trim();
/** Sólo propone frases registradas; nunca completa ni guarda sin una selección. */
export function sugerenciasTexto(registros:Novedad[], valor:string, campo:'motivo'|'texto', excluirId?:string):string[]{
 const prefijo=normal(valor);
 if(prefijo.length<2)return [];
 const frases=new Map<string,{texto:string;frecuencia:number;ultima:string}>();
 for(const n of registros){
  if(n.deleted||n.id===excluirId)continue;
  if(campo==='motivo'&&!['apertura','cierre','apertura/cierre'].includes(n.categoria?.toLowerCase()))continue;
  if(campo==='motivo'&&n.datos?.incluirMotivo===false)continue;
  const texto=(campo==='motivo'?n.datos?.motivo:n.texto)?.trim();
  if(!texto||texto.length>1200)continue;
  const key=normal(texto);
  if(!key.startsWith(prefijo)||key===prefijo)continue;
  const anterior=frases.get(key),ultima=n.fecha+'T'+n.hora;
  frases.set(key,{texto:anterior&&anterior.ultima>ultima?anterior.texto:texto,frecuencia:(anterior?.frecuencia||0)+1,ultima:anterior&&anterior.ultima>ultima?anterior.ultima:ultima});
 }
 return [...frases.values()].sort((a,b)=>b.frecuencia-a.frecuencia||b.ultima.localeCompare(a.ultima)).slice(0,3).map(f=>f.texto);
}
