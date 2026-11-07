/* Generación y entrega de PDF en el dispositivo.
   Los informes salen en blanco y negro: se imprimen, se mandan por WhatsApp y
   se archivan, y el color no aporta nada en ese recorrido. */
import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { crearPDF, jpegSize } from './pdfw';
import {agruparEvidencias} from './evidencias';
import { construirPDFDia } from './pdfdia';
import { nombreArchivoReporte } from './reporte';
import { leerBytes, prepararFoto } from './media';
import { Estado, Informe, Novedad, AccesoLog, isoDate, dmy, hhmm, DOW, parseISO, toMin, addDays } from './model';
import { gsName, resumenAcceso, LBL, textoReporte, textoInformeAccesos, OpcInforme } from './text';

export async function bytesDeFoto(uri: string): Promise<Uint8Array | null> {
  try {
    const foto = await prepararFoto(uri, 1400);
    return await leerBytes(foto.uri);
  } catch {
    throw new Error('No se pudo leer una imagen de evidencia. Vuelva a adjuntarla antes de exportar.');
  }
}

export async function entregarPDF(nombre: string, bytes: Uint8Array, dialogTitle=nombre): Promise<'compartido' | 'guardado' | 'no'> {
  if (Platform.OS === 'web') {
    try {
      const blob = new Blob([bytes as any], { type: 'application/pdf' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = nombre;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      return 'guardado';
    } catch { return 'no'; }
  }
  const f = new File(Paths.cache, nombre);
  try { if (f.exists) f.delete(); } catch { }
  f.create();
  f.write(bytes);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(f.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle });
    return 'compartido';
  }
  return 'guardado';
}

/* Escala de grises: negro para el texto, gris para lo accesorio. */
const NEGRO = '0 0 0';
const GRIS = '0.38 0.38 0.38';
const GRIS_CLARO = '0.55 0.55 0.55';
const LINEA = '0.75 0.75 0.75';

const PIE = (S: Estado, quien: string) =>
  'Generado con SECURIA el ' + dmy(isoDate()) + ' a las ' + hhmm() + ' por ' + quien;

/* ---------- informe de seguridad ---------- */
export async function pdfInforme(r: Informe, S: Estado, quien: string) {
  const d = crearPDF();
  d.text('INFORME DE SEGURIDAD', { size: 19, bold: true });
  d.text((S.site.nombre || S.site.cliente || '').toUpperCase(), { size: 12, bold: true, color: NEGRO });
  d.text(((r as any).f4 || 'Sin tipificar') + '  ·  Criticidad ' + ((r as any).f5 || '—') +
    '  ·  ' + ((r as any).f3 || dmy(r.fecha)) + (r.hora ? ' ' + r.hora + ' hs' : ''),
    { size: 10, color: GRIS });
  d.band(2, NEGRO);
  const fotos = r.fotos || [];
  for (let i = 1; i <= 16; i++) {
    let v = (((r as any)['f' + i] || '') as string).trim();
    if (i === 3 && r.hora && v) v = v + ' - ' + r.hora + ' hs';
    if (i === 15 && fotos.length) {
      v = (v ? v + '\n' : '') + 'Registro fotográfico: ' + fotos.length + ' imagen' +
        (fotos.length > 1 ? 'es' : '') + ' adjunta' + (fotos.length > 1 ? 's' : '') + '.';
    }
    d.text(i + '. ' + LBL[i - 1].toUpperCase(), { size: 9, bold: true, color: NEGRO });
    d.text(v || 'N/A', { size: 10.5, indent: 8 });
    d.space(6);
  }
  if(fotos.length){
    d.newPage();d.text('EVIDENCIA FOTOGRÁFICA',{size:15,bold:true});
    const imagenes=[];for(const uri of fotos){const b=await bytesDeFoto(uri);if(!b)continue;const sz=jpegSize(b);if(!sz)throw Error('Imagen inválida');imagenes.push({bytes:b,...sz});}
    for(let i=0;i<imagenes.length;){const fila=[imagenes[i++]];if(fila[0].w/fila[0].h<1.8&&i<imagenes.length&&imagenes[i].w/imagenes[i].h<1.8)fila.push(imagenes[i++]);
      d.keepTogether(340);d.text(String((r as any).f4||'Informe de seguridad')+' — '+String((r as any).f6||''),{size:9,bold:true});d.space(6);d.imageRow(fila,'Fecha: '+dmy(r.fecha)+'   Hora: '+(r.hora||'No informada'),'Sector: '+(r.sector||'No informado'));
    }
  }
  d.space(6); d.rule(LINEA);
  d.text(PIE(S, quien), { size: 8, color: GRIS_CLARO });
  const nom = 'informe-' + (r.fecha || isoDate()) + '-' +
    (((r as any).f4 || 'seguridad') as string).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 28) + '.pdf';
  return entregarPDF(nom, d.build());
}

/* ---------- Informe general del día ---------- */
export async function pdfLibro(rows: Novedad[], fecha: string, S: Estado, quien: string, nombreDe: (id: string) => string) {
  const d = crearPDF();
  d.text('LIBRO DE NOVEDADES', { size: 19, bold: true });
  d.text((S.site.cliente || 'Puesto') + (S.site.region ? '  ·  Región ' + S.site.region : ''), { size: 10, color: GRIS });
  d.text(DOW[parseISO(fecha).getDay()] + ' ' + dmy(fecha) + '  ·  ' + rows.length + ' asientos', { size: 10, color: GRIS });
  d.band(2, NEGRO);
  if (!rows.length) d.text('Sin asientos registrados.', { size: 11 });
  rows.forEach(n => {
    const acc = resumenAcceso(n);
    d.text(n.hora + '   ' + (n.categoria || 'NOVEDAD').toUpperCase(), { size: 9.5, bold: true, color: NEGRO });
    if (acc) d.text(acc, { size: 9.5, bold: true, color: GRIS });
    d.text(n.texto, { size: 10.5 });
    d.text(nombreDe(n.guardId), { size: 8.5, color: GRIS_CLARO });
    d.space(7);
  });
  d.space(6); d.rule(LINEA);
  d.text(PIE(S, quien), { size: 8, color: GRIS_CLARO });
  return entregarPDF('libro-novedades-' + fecha + '.pdf', d.build());
}

/* ---------- aperturas y cierres ---------- */
export async function pdfAccesos(rows: AccesoLog[], fecha: string, o: OpcInforme, S: Estado, quien: string) {
  const d = crearPDF();
  const et = o.tipo === 'ambos' ? 'APERTURAS Y CIERRES' : o.tipo === 'apertura' ? 'APERTURAS' : 'CIERRES';
  d.text(et, { size: 19, bold: true });
  d.text((S.site.cliente || '') + '  ·  ' + dmy(fecha), { size: 10, color: GRIS });
  d.band(2, NEGRO);
  textoInformeAccesos(rows, fecha, { ...o, encabezado: false }, S.site).split('\n\n').forEach(bl => {
    const ls = bl.split('\n');
    if (!ls[0]) return;
    d.text(ls[0], { size: 10.5, bold: true });
    ls.slice(1).forEach(l => d.text(l, { size: 10.5, indent: 8 }));
    d.space(7);
  });
  d.space(6); d.rule(LINEA);
  d.text(PIE(S, quien), { size: 8, color: GRIS_CLARO });
  return entregarPDF('accesos-' + fecha + '.pdf', d.build());
}


/* ---------- informe general de las 24 horas ---------- */
export async function pdfInformeDia(
  r: { fecha: string; corte: string; cierre: string; fotos: string[]; texto: string },
  S: Estado,
  quien: string,
  supervisor?: string,
) {
  const fotos: Uint8Array[] = [];
  for (const uri of r.fotos || []) {
    const bytes = await bytesDeFoto(uri);
    if (bytes) fotos.push(bytes);
  }
  const grupos=agruparEvidencias(S,r.fotos).map(g=>({...g,fotos:g.fotos.map(uri=>fotos[r.fotos.indexOf(uri)])}));
  const nombre=nombreArchivoReporte(r.fecha),bytes=construirPDFDia(r.texto,fotos,grupos);
  if(supervisor!==undefined){
    // ACTION_SEND con permiso de lectura del archivo. Abrir una conversación por
    // número dispara dos actividades en WhatsApp y puede perder EXTRA_STREAM.
    return entregarPDF(nombre,bytes,'Enviar PDF · elija WhatsApp y el supervisor'+(supervisor?' ('+supervisor+')':''));
  }
  return entregarPDF(nombre,bytes);
}
