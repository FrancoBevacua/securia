import type { AccesoLog, Estado, Informe, Novedad } from './model';

export const TIPOS_ACTIVIDAD = [
  { id: 'novedades', titulo: 'Novedades', icono: 'libro' },
  { id: 'accesos', titulo: 'Aperturas y cierres', icono: 'accesos' },
  { id: 'informes', titulo: 'Informes de seguridad', icono: 'informes' },
] as const;

export type TipoActividad = typeof TIPOS_ACTIVIDAD[number]['id'];
export type RegistrosDelDia = { novedades: Novedad[]; accesos: AccesoLog[]; informes: Informe[] };
export const SIN_GUARDIA = 'sin-guardia';
const vacio = (): RegistrosDelDia => ({ novedades: [], accesos: [], informes: [] });

/** Usa la fecha civil del hecho y atribuye cada registro a su firma, si existe. */
export function actividadGuardiasDelDia(S: Estado, fecha: string) {
  const delDia = <T extends { fecha: string; deleted?: boolean; hora: string }>(lista: T[]) =>
    lista.filter(r => !r.deleted && r.fecha === fecha).sort((a, b) => (b.hora || '').localeCompare(a.hora || ''));
  const accesos = delDia(S.alogs);
  const asientosAccesos = new Set(accesos.map(a => a.novId).filter(Boolean));
  // Los asientos históricos generados por Accesos se consultan junto con aperturas y cierres.
  const novedades = delDia(S.novedades).filter(n => !n.alogId && !asientosAccesos.has(n.id) &&
    !/^(acceso:|playa:)/.test(n.autoKey || '') && !/^servicio-(in|out):/.test(n.id));
  const informes = delDia(S.reports);
  const total = { novedades, accesos, informes };

  const porGuardia = new Map<string, { id: string; nombre: string; registros: RegistrosDelDia }>();
  const guardias = new Map(S.guards.map(g => [g.id, g]));
  const grupo = (id: string, firma?: string) => {
    const nombre = guardias.get(id);
    const nombreRegistrado = [nombre?.nombre, nombre?.apellido].filter(Boolean).join(' ');
    let fila = porGuardia.get(id);
    if (!fila) {
      fila = { id, nombre: nombreRegistrado || firma || 'Guardia sin identificar', registros: vacio() };
      porGuardia.set(id, fila);
    } else if (!nombreRegistrado && firma && fila.nombre === 'Guardia sin identificar') {
      fila.nombre = firma;
    }
    return fila.registros;
  };
  for (const n of novedades) grupo(n.guardId || n.createdBy || SIN_GUARDIA).novedades.push(n);
  for (const a of accesos) grupo(a.guardId || a.createdBy || SIN_GUARDIA, a.guardId ? a.gs : undefined).accesos.push(a);
  for (const r of informes) grupo(r.firmaId || r.createdBy || SIN_GUARDIA).informes.push(r);

  return { total, guardias: [...porGuardia.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')) };
}
