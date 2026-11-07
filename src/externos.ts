import { Acceso, Estado, Externo, accNormal, fmtDNI } from './model';
import {normalIdentidad} from './identidad';

const clave = normalIdentidad;
function personasUnicas(lista: Acceso['personas']): Acceso['personas'] {
  const vistos=new Set<string>(),conDni=new Set(lista.filter(p=>p.dni.replace(/\D/g,'')).map(p=>clave(p.nombre)));
  return lista.filter(p=>{
    const dni=p.dni.replace(/\D/g,''),nombre=clave(p.nombre),id=dni?'dni:'+dni:'nombre:'+nombre;
    if(!nombre||!dni&&conDni.has(nombre)||vistos.has(id))return false;
    vistos.add(id);return true;
  }).map(p=>({...p,nombre:p.nombre.trim(),dni:fmtDNI(p.dni)}));
}
/** Una empresa es una ficha; el DNI sin puntos identifica a cada empleado. */
export function fichaExterno(S: Estado, acc: Acceso, actor: string): Externo | null {
  const empresa = acc.empresa.trim().replace(/\s+/g, ' ');
  if (!empresa) return null;
  if (empresa.length > 120) throw Error('La razón social admite hasta 120 caracteres.');
  const id = 'externo:' + clave(empresa);
  const anterior = S.externals?.find(e => clave(e.empresa) === clave(empresa) && !e.deleted);
  const personas = new Map<string, Acceso['personas'][number]>();
  for (const p of [...(anterior?.personas || []), ...acc.personas]) {
    if (!p.nombre.trim()) continue;
    const dni = p.dni.replace(/\D/g, '');
    if (dni && !/^\d{7,8}$/.test(dni)) throw Error('Revise el DNI del empleado: debe tener 7 u 8 dígitos.');
    personas.set(dni ? 'dni:' + dni : 'nombre:' + clave(p.nombre), { nombre: p.nombre.trim(), dni: fmtDNI(dni) });
  }
  return { id, empresa, tarea: acc.tarea.trim(), lugar: acc.lugar.trim(), personas: personasUnicas([...personas.values()]), createdBy: anterior?.createdBy || actor, updatedAt: Date.now() };
}

export function historialExternos(S: Estado): Externo[] {
  const copia = { ...S, externals: [] as Externo[] };
  const visitas = S.visits.filter(x => !x.deleted).map(v => ({ acc: v.acc, createdBy: v.guardId, updatedAt: v.updatedAt }));
  const novedades = S.novedades.filter(n => !n.deleted && n.acc).map(n => ({ acc: n.acc!, createdBy: n.createdBy || n.guardId, updatedAt: n.updatedAt }));
  for (const x of [...visitas, ...novedades].sort((a,b) => a.updatedAt-b.updatedAt)) {
    try {
      const ficha = fichaExterno(copia, accNormal(x.acc), x.createdBy);
      if (ficha) {const i=copia.externals.findIndex(e=>e.id===ficha.id);if(i<0)copia.externals.push({...ficha,updatedAt:x.updatedAt});else copia.externals[i]={...ficha,updatedAt:x.updatedAt};}
    } catch { /* Un registro antiguo incompleto sigue disponible en su historial. */ }
  }
  // Las fichas persistidas prevalecen sobre los movimientos, incluso si su ID es antiguo.
  const ids=new Set<string>(),guardadas=new Map<string,Externo[]>();
  for(const ficha of S.externals||[]){const id=clave(ficha.empresa);guardadas.set(id,[...(guardadas.get(id)||[]),ficha]);}
  for(const ficha of [...(S.externals||[])].sort((a,b)=>b.updatedAt-a.updatedAt)){
    const id=clave(ficha.empresa);if(ids.has(id))continue;ids.add(id);
    copia.externals=copia.externals.filter(e=>clave(e.empresa)!==id);
    if(!ficha.deleted)copia.externals.push({...ficha,personas:personasUnicas([ficha,...guardadas.get(id)!.filter(e=>e.id!==ficha.id&&!e.deleted)].flatMap(e=>e.personas))});
  }
  return copia.externals.sort((a,b) => a.empresa.localeCompare(b.empresa, 'es'));
}

export function accesoDesdeFicha(f: Externo): Acceso {
  return { ...accNormal(), empresa: f.empresa, tarea: f.tarea, lugar: f.lugar, personas: f.personas.map(p => ({ ...p, dni: fmtDNI(p.dni) })) };
}
