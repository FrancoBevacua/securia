import { Estado, Informe, Col, uid } from './model';
import { fechaValida, horaValida, turnoAbierto } from './servicio';

export const GRUPOS_INFORME = [
  { titulo: 'El hecho', campos: [6, 7, 8] },
  { titulo: 'Identificación', campos: [1, 2, 3, 4, 5] },
  { titulo: 'Intervención y seguimiento', campos: [9, 10, 11, 12, 13] },
  { titulo: 'Cierre', campos: [14, 15, 16] },
];
export function resumenInforme(r: Informe): string {
  const limpiar=(v:unknown)=>String(v||'').replace(/[*_#`]/g,'').replace(/\s+/g,' ').trim();
  const normal=(v:string)=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,'').trim();
  const usados=new Set<string>();
  // Se seleccionan ideas completas de distintos puntos, sin cortar el texto a mitad de una frase.
  const idea=(v:unknown,max:number)=>{
    const texto=limpiar(v).replace(/^(?:se informa que|se deja constancia de que|resumen del hecho\s*:)\s*/i,'');
    // No se confunden los puntos de un DNI, dominio o abreviatura con el fin de una oración.
    const protegido=texto.replace(/\b(Sr|Sra|Srta|Dr|Dra|Ing|Lic|Av|Nro|aprox|hs)\./gi,'$1\uE000');
    const frases=(protegido.match(/.+?(?:[.!?]+(?=\s|$)|$)/g)||[]).map(f=>f.replace(/\uE000/g,'.'));
    for(const frase of frases){
      let limpia=frase.trim().replace(/[.!?]+$/,'');
      if(limpia.length>max){
        // Se omiten aclaraciones y oraciones coordinadas completas, nunca palabras sueltas.
        limpia=limpia.replace(/\s*\([^()]*\)/g,'').split(/;\s*|,\s+(?=se\b|el personal\b|la guardia\b)/i)[0].trim();
      }
      const key=normal(limpia);
      if(!key||/^(?:n a|na|no aplica|sin datos|sin completar|ninguno|ninguna)$/.test(key)||usados.has(key))continue;
      if(limpia.length<=max){usados.add(key);return limpia+'.';}
    }
    // Una enumeración extensa puede contener una primera idea completa separada por punto y coma.
    const clausula=texto.split(';')[0].trim();
    if(texto.includes(';')&&clausula.length<=max&&!usados.has(normal(clausula))){usados.add(normal(clausula));return clausula.replace(/[.!?]+$/,'')+'.';}
    return '';
  };
  const tipo=idea(r.f4,90)||'Incidente registrado.';
  const partes=['Informe de seguridad: '+tipo];
  const hecho=idea(r.f6,240);
  if(hecho)partes.push('Hecho: '+hecho);
  const acciones=idea(r.f8,150)||idea(r.f11,150)||idea(r.f10,150);
  if(acciones)partes.push('Intervención: '+acciones);
  const estado=idea(r.f12,130)||idea(r.f7,130);
  if(estado)partes.push('Estado: '+estado);
  // Si los puntos centrales sólo contienen frases demasiado largas, se conserva contexto verificable.
  if(!hecho){const sector=idea(r.sector,80);if(sector)partes.push('Sector: '+sector);}
  if(!acciones&&!estado){const seguimiento=idea(r.f13,130);if(seguimiento)partes.push('Seguimiento: '+seguimiento);}
  return partes.join(' ');
}
/** Informe y resumen se validan y persisten como una sola operación local. */
export function generarInformeSeguridad(S: Estado, r: Informe, actor: string, telefonoId?: string): {col:Col;obj:any}[] {
  const turno = turnoAbierto(S, actor, telefonoId);
  if (!turno) throw Error('Inicie sesión para generar el informe.');
  if (!S.guards.some(g=>g.id===r.firmaId&&!g.deleted)) throw Error('Seleccione el vigilador que realizó la novedad.');
  if (!String(r.f6 || '').trim()) throw Error('Complete el resumen del hecho en el punto 6.');
  const m = String(r.f3 || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const fecha = m ? m[3]+'-'+m[2]+'-'+m[1] : r.fecha;
  if (!fechaValida(fecha) || !horaValida(r.hora)) throw Error('Indique la fecha y el horario del hecho.');
  if (r.fotos?.length && !r.sector?.trim()) throw Error('Indique el sector de la evidencia fotográfica.');
  const base = {...r, fecha, id:r.id || uid(), estado:'generado', createdAt:r.createdAt || Date.now(), updatedAt:Date.now()};
  return [
    {col:'reports',obj:base},
    {col:'novedades',obj:{id:'informe:'+base.id+':'+turno.id,fecha,hora:base.hora,guardId:r.firmaId,categoria:'Novedad',trascendente:true,origenId:base.id,texto:resumenInforme(base),sector:base.sector,fotos:[]}},
  ];
}
