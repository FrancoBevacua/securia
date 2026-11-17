import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SQLite from 'expo-sqlite';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

// Base propia: no hereda el tope de 6 MB ni CursorWindow de AsyncStorage Android.
// Los valores de la cola siguen cifrados con AES-GCM antes de llegar aquí.
let conexion: Promise<SQLite.SQLiteDatabase> | undefined;
async function db() {
  if (!conexion) conexion = (async () => {
    const d = await SQLite.openDatabaseAsync('vigelium-datos.db');
    await d.execAsync(`PRAGMA journal_mode = WAL;
      PRAGMA synchronous = FULL;
      CREATE TABLE IF NOT EXISTS documentos (clave TEXT PRIMARY KEY NOT NULL, valor TEXT);`);
    return d;
  })().catch(e => { conexion = undefined; throw e; });
  return conexion;
}

async function leerAnterior(clave: string): Promise<string | null> {
  try { return await AsyncStorage.getItem(clave); }
  catch (error) {
    // Una fila vieja > 2 MB puede no caber en CursorWindow. Leerla con SQLite
    // nativo sin modificar la base anterior ni aumentar su límite.
    if (Platform.OS !== 'android' || !/CursorWindow|Row too big/i.test(String(error))) throw error;
    const directorio = new Directory(Paths.document, '..', 'databases');
    if (!new File(directorio, 'RKStorage').exists) throw error;
    const anterior = await SQLite.openDatabaseAsync('RKStorage', { useNewConnection: true }, directorio.uri);
    try {
      const fila = await anterior.getFirstAsync<{value:string}>('SELECT value FROM catalystLocalStorage WHERE key = ?', clave);
      return fila?.value ?? null;
    } finally { await anterior.closeAsync(); }
  }
}

export const almacenLocal = {
  async getItems(claves: string[]): Promise<(string | null)[]> {
    if (!claves.length) return [];
    const filas = await (await db()).getAllAsync<{clave:string;valor:string|null}>(
      'SELECT clave, valor FROM documentos WHERE clave IN (' + claves.map(() => '?').join(',') + ')', ...claves,
    );
    const valores = new Map(filas.map(f => [f.clave, f.valor]));
    return Promise.all(claves.map(k => valores.has(k) ? valores.get(k)! : almacenLocal.getItem(k)));
  },
  async setItems(filas: [string, string][]): Promise<void> {
    // Una sentencia es atómica y hace un solo fsync, conservando synchronous=FULL.
    if (!filas.length) return;
    await (await db()).runAsync(
      'INSERT INTO documentos (clave, valor) VALUES ' + filas.map(() => '(?, ?)').join(',') +
      ' ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor', ...filas.flat(),
    );
  },
  async claves(prefijo:string):Promise<string[]> {
    return (await (await db()).getAllAsync<{clave:string}>(
      'SELECT clave FROM documentos WHERE clave >= ? AND clave < ? AND valor IS NOT NULL ORDER BY clave',
      prefijo,prefijo+'\uffff',
    )).map(x=>x.clave);
  },
  async compactar():Promise<void>{
    await (await db()).execAsync('PRAGMA wal_checkpoint(TRUNCATE); VACUUM;');
  },
  async getItem(clave: string): Promise<string | null> {
    const d = await db();
    const fila = await d.getFirstAsync<{valor:string|null}>('SELECT valor FROM documentos WHERE clave = ?', clave);
    if (fila) return fila.valor;
    const anterior = await leerAnterior(clave);
    if (anterior === null) return null;
    await almacenLocal.setItem(clave, anterior);
    const copia = await d.getFirstAsync<{valor:string}>('SELECT valor FROM documentos WHERE clave = ?', clave);
    if (copia?.valor !== anterior) throw Error('No se pudo verificar la migración. Se conserva la copia anterior.');
    // Si la limpieza falla, la nueva fila tiene prioridad. Nunca se resucita
    // una cola antigua tras haber confirmado sus cambios en el servidor.
    await AsyncStorage.removeItem(clave).catch(() => {});
    return anterior;
  },
  async setItem(clave: string, valor: string): Promise<void> {
    await (await db()).runAsync('INSERT INTO documentos (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor', clave, valor);
  },
  async removeItem(clave: string): Promise<void> {
    // Tombstone durable, incluso si todavía existe una copia anterior.
    await (await db()).runAsync('INSERT INTO documentos (clave, valor) VALUES (?, NULL) ON CONFLICT(clave) DO UPDATE SET valor = NULL', clave);
    await AsyncStorage.removeItem(clave).catch(() => {});
  },
};
