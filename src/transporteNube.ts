/** Expo envuelve las cancelaciones nativas en FetchError (no en AbortError). */
export function errorDeRed(error: unknown, abortado = false): Error & {sinConexion: true} | null {
  const e = error as {name?: string; message?: string};
  if (!abortado && !(error instanceof TypeError) && e?.name !== 'AbortError' &&
      !/^fetch failed:|Fetch request has been cancel(?:ed|led)|Network request failed|Failed to fetch/i.test(e?.message || '')) return null;
  return Object.assign(new Error('No hay respuesta de la nube. Revise Internet. Los cambios permanecen guardados en el teléfono y se volverán a sincronizar automáticamente.'), {sinConexion: true as const});
}

/** El límite incluye la lectura del cuerpo; los errores de negocio se procesan afuera. */
export async function solicitarNube(url: string, opciones: RequestInit, espera: number) {
  const abortar = new AbortController();
  const timer = setTimeout(() => abortar.abort(), espera);
  try {
    const respuesta = await fetch(url, {...opciones, signal: abortar.signal});
    if ([408, 429, 502, 503, 504, 520, 521, 522, 523, 524].includes(respuesta.status)) {
      throw Object.assign(new Error('La nube no pudo responder. Los cambios siguen guardados en el teléfono; se reintentará la sincronización automáticamente.'), {sinConexion: true});
    }
    let datos;
    try {
      datos = await respuesta.json();
    } catch (e) {
      if (abortar.signal.aborted) throw e;
      if (!(e instanceof SyntaxError) && !/JSON.*parse|unexpected.*(?:token|end)|JSON.*(?:invalid|unexpected)/i.test((e as Error)?.message || '')) throw e;
      throw Object.assign(new Error('La nube devolvió una respuesta incompleta. Los cambios siguen guardados en el teléfono; se reintentará la sincronización automáticamente.'), {sinConexion:true});
    }
    if (!datos || typeof datos !== 'object' || Array.isArray(datos) || (typeof datos.ok !== 'boolean' && typeof datos.code !== 'string')) {
      throw Object.assign(new Error('La nube devolvió una respuesta inválida. Los cambios siguen guardados en el teléfono; se reintentará la sincronización automáticamente.'), {sinConexion:true});
    }
    if (datos.code === '57014' || datos.code === '55P03' || /^08/.test(datos.code || '')) {
      throw Object.assign(new Error('La nube tardó demasiado en procesar los cambios. Siguen guardados en el teléfono; se reintentará la sincronización automáticamente.'), {sinConexion:true});
    }
    return {respuesta, datos};
  } catch (e) {
    throw errorDeRed(e, abortar.signal.aborted) || e;
  } finally {
    clearTimeout(timer);
  }
}
