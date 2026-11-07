import { COLS, Estado } from './model';
import { mismoEstado } from './colaNube';

/** Sólo las altas y ediciones pendientes; las bajas siguen siendo lógicas. */
export function cambiosNube(local: Estado, remoto: Estado): Partial<Estado> {
  const cambios: Partial<Estado> = {};
  for (const col of COLS) {
    const existentes = new Map((remoto[col] || []).map(r => [r.id, r]));
    const filas = (local[col] || []).filter(r => !existentes.has(r.id) ||
      !mismoEstado(r as any, existentes.get(r.id) as any));
    if (filas.length) (cambios as any)[col] = filas;
    const ids = new Set((local[col] || []).map(r => r.id));
    if ((remoto[col] || []).some(r => !ids.has(r.id))) throw Error('No se permite eliminar físicamente el historial.');
  }
  if (!mismoEstado(local.site as any, remoto.site as any)) cambios.site = local.site;
  if (Object.keys(cambios).length) cambios.updatedAt = local.updatedAt;
  return cambios;
}
