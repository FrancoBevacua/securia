require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module');
const anterior=new Map();let fallaBorrado=false;const load=Module._load;
Module._load=function(n,...a){if(n==='@react-native-async-storage/async-storage')return {getItem:async k=>anterior.get(k)??null,removeItem:async k=>{if(fallaBorrado)throw Error('sin espacio');anterior.delete(k);}};return load.call(this,n,...a);};
const {almacenLocal}=require('../src/almacenLocal.ts');
const sqlite=require('./sqlite-native.cjs');
test('un lote se confirma completo, mantiene el orden de lectura y revierte entero ante un error',async()=>{
 await almacenLocal.setItems([['lote/a','A'],['lote/b','B']]);
 assert.deepEqual(await almacenLocal.getItems(['lote/b','ausente','lote/a']),['B',null,'A']);
 const d=sqlite.conexiones.get('vigelium-datos.db').native;
 d.exec("CREATE TRIGGER fallo_lote BEFORE INSERT ON documentos WHEN new.clave='lote/error' BEGIN SELECT RAISE(ABORT, 'fallo de prueba'); END");
 await assert.rejects(almacenLocal.setItems([['lote/a','modificado'],['lote/error','X']]),/fallo de prueba/);
 assert.equal(await almacenLocal.getItem('lote/a'),'A');
 d.exec('DROP TRIGGER fallo_lote');
 await almacenLocal.removeItem('lote/b');
 assert.deepEqual(await almacenLocal.getItems(['lote/b','lote/a']),[null,'A']);
});
test('migra una cola de más de 10 MB y la recupera desde otra conexión al archivo',async()=>{
 const valor='cifrado:á'.repeat(1400000);anterior.set('cola-grande',valor);
 assert.equal(await almacenLocal.getItem('cola-grande'),valor);assert.equal(anterior.has('cola-grande'),false);
 const {DatabaseSync}=require('node:sqlite');const otra=new DatabaseSync(sqlite.conexiones.get('vigelium-datos.db').ruta);
 try{assert.equal(otra.prepare('SELECT valor FROM documentos WHERE clave=?').get('cola-grande').valor,valor);}finally{otra.close();}
});
test('una limpieza fallida no resucita la cola migrada y confirmada',async()=>{
 fallaBorrado=true;anterior.set('cola-vieja','cifrado original');
 assert.equal(await almacenLocal.getItem('cola-vieja'),'cifrado original');await almacenLocal.removeItem('cola-vieja');
 assert.equal(anterior.get('cola-vieja'),'cifrado original');assert.equal(await almacenLocal.getItem('cola-vieja'),null);fallaBorrado=false;
});
test('un SQLITE_FULL real rechaza la escritura y mantiene la copia anterior',async()=>{
 await almacenLocal.setItem('critica','última confirmada');const d=sqlite.conexiones.get('vigelium-datos.db').native;
 const paginas=d.prepare('PRAGMA page_count').get().page_count;d.exec('PRAGMA max_page_count = '+paginas);
 await assert.rejects(almacenLocal.setItem('critica','nuevo'.repeat(5000000)),/full/i);
 assert.equal(await almacenLocal.getItem('critica'),'última confirmada');d.exec('PRAGMA max_page_count = 1073741823');
});
test('si falla la migración se conserva el original en AsyncStorage',async()=>{
 const d=sqlite.conexiones.get('vigelium-datos.db').native,paginas=d.prepare('PRAGMA page_count').get().page_count;d.exec('PRAGMA max_page_count = '+paginas);
 anterior.set('migracion-fallida','datos'.repeat(5000000));await assert.rejects(almacenLocal.getItem('migracion-fallida'),/full/i);
 assert.ok(anterior.has('migracion-fallida'));d.exec('PRAGMA max_page_count = 1073741823');
});
