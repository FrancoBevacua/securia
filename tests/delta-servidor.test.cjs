require('./register.cjs');
const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const {cambiosNube}=require('../src/cambiosNube.ts');
const {estadoVacio}=require('../src/model.ts');
const {estados}=require('./fixtures-nube.json');
let db;
const sql=fs.readFileSync('supabase/migrations/20260922233757_sincronizacion_incremental.sql','utf8');
before(async()=>{
 db=new PGlite();await db.exec('create schema guardia_private; create role anon; create role authenticated;');
 await db.exec(sql.slice(0,sql.indexOf('-- Conservar autenticación')));
 const base=fs.readFileSync('nube/002_servicio.sql','utf8');
 await db.exec(base.slice(base.indexOf('create or replace function guardia_private.validar_formato(')).split('$$;')[0]+'$$;');
 await db.exec(fs.readFileSync('supabase/migrations/20260916190220_sincronizacion_turnos_offline.sql','utf8'));
});
after(async()=>{await db?.close();});
const aplicar=async(e,d)=>(await db.query('select guardia_private.aplicar_delta($1::jsonb,$2::jsonb) as estado',[JSON.stringify(e),JSON.stringify(d)])).rows[0].estado;
test('PostgreSQL conserva historial, aplica sólo pendientes y valida la sesión completa offline',async()=>{
 const a=estados[0],b=estados[3],delta=cambiosNube(b,a);
 const resultado=await aplicar(a,delta);assert.deepEqual(resultado,b);
 await db.query('select guardia_private.validar_cambios($1::jsonb,$2::jsonb,$3)',[JSON.stringify(a),JSON.stringify(resultado),'nube-test-a']);
 assert.deepEqual(await aplicar(resultado,delta),resultado);
});
test('la combinación mantiene el orden y conserva registros omitidos, incluidas fotos',async()=>{
 const e=estadoVacio();e.reports=[{id:'a',texto:'Anterior',fotos:['imagen']},{id:'b',texto:'Sin cambios'}];
 const r=await aplicar(e,{reports:[{id:'b',texto:'Editado'},{id:'c',texto:'Nuevo'}]});
 assert.deepEqual(r.reports,[e.reports[0],{id:'b',texto:'Editado'},{id:'c',texto:'Nuevo'}]);
});
test('el delta rechaza formatos inválidos e IDs duplicados',async()=>{
 for(const delta of [null,[],{desconocida:[]},{reports:{}},{reports:[{}]},{reports:[{id:'x'},{id:'x'}]}])await assert.rejects(aplicar(estadoVacio(),delta));
});
test('las mismas restricciones de autoría e identidad se aplican a cambios incrementales',async()=>{
 const a=estados[0];const r=await aplicar(a,{guards:[{...a.guards[0],rol:'invalido'}]});
 await assert.rejects(db.query('select guardia_private.validar_cambios($1::jsonb,$2::jsonb,$3)',[JSON.stringify(a),JSON.stringify(r),'nube-test-a']),/identidad/);
});
