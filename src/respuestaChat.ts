/** Las referencias siguen disponibles para la consulta interna, nunca en el texto entregado. */
export function limpiarRespuestaChat(texto:string){
 return texto.replace(/<(think|thinking|analysis|reasoning)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi,'')
  .replace(/\[(?:(?:O+|D|DOC|FUENTE)\s*\d+)(?:\s*[,;–-]\s*(?:(?:O+|D|DOC|FUENTE)\s*)?\d+)*\]/gi,'')
  .replace(/[ \t]+([,.;:!?])/g,'$1').replace(/[ \t]+$/gm,'').replace(/^[ \t]*(?:fuentes?|referencias?)(?:\s+(?:consultadas?|utilizadas?))?\s*:\s*$/gim,'')
  .replace(/\n{3,}/g,'\n\n').trim();
}
export type BloqueChat={tipo:'titulo'|'parrafo'|'lista';texto:string;marca?:string};
export function bloquesRespuestaChat(texto:string):BloqueChat[]{
 const bloques:BloqueChat[]=[];
 for(const linea of limpiarRespuestaChat(texto).split('\n')){
  if(!linea.trim()){bloques.push({tipo:'parrafo',texto:''});continue;}
  const titulo=linea.match(/^\s*#{1,4}\s+(.+)$/),lista=linea.match(/^\s*(?:([-*•])\s+|(\d+)[.)]\s+)(.+)$/);
  if(titulo)bloques.push({tipo:'titulo',texto:titulo[1]});
  else if(lista)bloques.push({tipo:'lista',texto:lista[3],marca:lista[2]?lista[2]+'.':'•'});
  else bloques.push({tipo:'parrafo',texto:linea});
 }
 return bloques;
}
