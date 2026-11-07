import { Estado, Col, Rec, Vigilador, uid, now, merge } from './model';
import { validarCambioNovedad, turnoAbierto, motivoSoloLectura, horaValida, fechaValida } from './servicio';
import { legajoNormal, dniNormal, dniValido } from './cuentas';
import { fichaExterno } from './externos';
import {validarPuestosGuardia} from './puestosGuardia';

/** Una operación compuesta se publica sólo si todas sus filas son válidas. */
export function aplicarCambios(S: Estado, cambios: { col: Col; obj: any }[], actor: Vigilador | null, servicio = false, telefonoId?:string): Estado {
  const e = { ...S };
  for (const k of Object.keys(S)) if (Array.isArray((S as any)[k])) (e as any)[k] = (S as any)[k].slice();
  for (const { col, obj } of cambios) {
    const arr: any[] = e[col] || ((e as any)[col] = []);
    const i = arr.findIndex(r => r.id === obj.id);
    let g = { ...(i >= 0 ? arr[i] : {}), ...obj, id: obj.id || uid(), updatedAt: now() };
    if(col==='guards'&&!servicio&&!!g.corporativo!==(i>=0&&!!arr[i].corporativo))throw Error('La identidad del corporativo se administra en el servidor.');
    if(col==='guards'&&obj.puestoIds!==undefined&&!g.deleted)g={...g,puestoIds:validarPuestosGuardia(e,obj.puestoIds)};
    if (col === 'novedades' && !servicio) {
      validarCambioNovedad(e, i >= 0 ? arr[i] : undefined, actor, telefonoId);
      if (!horaValida(g.hora) || !fechaValida(g.fecha) || (!g.deleted && !g.texto?.trim())) throw new Error('La novedad necesita fecha, hora y texto válidos.');
      if (g.autoKey && i < 0) { const motivo = motivoSoloLectura(e, g, actor?.id, telefonoId); if (motivo) throw new Error(motivo); }
      if(!g.deleted && !e.guards.some(v=>v.id===g.guardId&&!v.deleted))throw Error('Seleccione el vigilador que realizó la novedad.');
      g = { ...g, createdBy: i>=0 ? arr[i].createdBy || arr[i].guardId : actor!.id, turnoId: turnoAbierto(e, actor!.id, telefonoId)!.id };
    }
    if (col === 'alogs' && !servicio) {
      const activo = turnoAbierto(e, actor?.id, telefonoId);
      if (!activo) throw new Error('Inicie sesión para registrar accesos.');
      if (i >= 0) {
        const a = arr[i];
        const motivo = motivoSoloLectura(e, { ...a, guardId: a.createdBy || a.guardId }, actor?.id, telefonoId);
        if (motivo) throw new Error(motivo);
      }
      if (!horaValida(g.hora) || !fechaValida(g.fecha)) throw new Error('El acceso necesita una fecha y hora válidas.');
      g = { ...g, createdBy: actor!.id, turnoId: activo.id };
    }
    if (col === 'guards' && g.cuenta && g.dni && (!dniValido(g.dni) || e.guards.some(r => r.id !== g.id && r.cuenta && !r.deleted && dniNormal(r.dni || '') === dniNormal(g.dni)))) throw new Error('El DNI no es válido o ya tiene una cuenta.');
    if (col === 'guards' && g.cuenta && g.legajo && !g.deleted && e.guards.some(r => r.id !== g.id && r.cuenta && !r.deleted && legajoNormal(r.legajo) === legajoNormal(g.legajo))) throw new Error('Ese legajo ya pertenece a otra cuenta.');
    if (col === 'punches' && i >= 0 && (arr[i].closedAt || arr[i].out)) throw new Error('Un turno cerrado no se puede modificar.');
    if (i >= 0) arr[i] = g; else arr.push(g);
    if (!g.deleted && g.acc && (col === 'visits' || col === 'novedades')) {
      const ficha = fichaExterno(e, g.acc, actor?.id || g.guardId);
      if (ficha) {
        e.externals = (e.externals || []).slice();
        const indice = e.externals.findIndex(x => x.id === ficha.id);
        if (indice < 0) e.externals.push(ficha); else e.externals[indice] = ficha;
      }
    }
  }
  return e;
}

export function restaurarRespaldo(S: Estado, datos: Estado, actor: Vigilador): Estado {
  if (actor.rol !== 'admin') throw new Error('La restauración está reservada a administración.');
  const e = merge(S, datos);
  // Una restauración no permite reescribir el historial de otro turno ni las cuentas existentes.
  const conservar = (col: Col, registros: Rec[]) => {
    const ids = new Set(registros.map(r => r.id));
    (e as any)[col] = [...(e[col] as Rec[]).filter(r => !ids.has(r.id)), ...registros];
  };
  conservar('novedades', S.novedades.filter(n => !!motivoSoloLectura(S, n, actor.id)));
  conservar('alogs', S.alogs.filter(a => !!motivoSoloLectura(S, { ...a, guardId: a.createdBy || a.guardId } as any, actor.id)));
  conservar('punches', S.punches);
  conservar('guards', S.guards.filter(g => g.cuenta));
  return e;
}
