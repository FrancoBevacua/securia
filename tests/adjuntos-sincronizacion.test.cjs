require('./register.cjs');
const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const {estadoVacio}=require('../src/model.ts');
const {cambiosNube}=require('../src/cambiosNube.ts');
let db;
const migracion=fs.readFileSync('supabase/migrations/20260929213349_sincronizacion_adjuntos_sin_timeout.sql','utf8');
before(async()=>{
 db=new PGlite();await db.exec('create schema guardia_private;create role anon;create role authenticated;');
 const original=fs.readFileSync('nube/002_servicio.sql','utf8');
 await db.exec(original.slice(original.indexOf('create or replace function guardia_private.validar_formato(')).split('$$;')[0]+'$$;');
 await db.exec(`create function public.guardia_rpc(p_request jsonb) returns jsonb language plpgsql as $f$
 declare estado jsonb;candidato jsonb;actor text;dh text;
 begin perform guardia_private.validar_cambios(estado,candidato,actor);
 if exists(select 1 from jsonb_array_elements(estado->'punches') x where x->>'guardId'=actor and coalesce(x->>'out','')='' and coalesce(x->>'closedAt','')='') then return '{}';end if;
 return '{}';end;$f$;
 create function public.guardia_recuperacion(p_request jsonb) returns jsonb language plpgsql as $f$
 declare remoto jsonb;candidato jsonb;intento jsonb;actor text;dispositivo_hash text;
 begin perform guardia_private.validar_cambios(remoto,candidato,actor);perform guardia_private.validar_cambios(remoto,intento,actor);return '{}';end;$f$;`);
 await db.exec(fs.readFileSync('supabase/migrations/20260925081327_actividad_independiente_por_telefono.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20260926181707_altas_catalogo_operativas.sql','utf8'));
 const delta=fs.readFileSync('supabase/migrations/20260922233757_sincronizacion_incremental.sql','utf8');await db.exec(delta.slice(0,delta.indexOf('-- Conservar autenticación')));
 await db.exec(migracion);
});
after(async()=>db?.close());
const validar=(a,b)=>db.query('select guardia_private.validar_cambios($1::jsonb,$2::jsonb,$3),guardia_private.validar_telefono($1::jsonb,$2::jsonb,$3,$4)',[JSON.stringify(a),JSON.stringify(b),'a','telefono']);
const aplicar=async(a,d)=>(await db.query('select guardia_private.aplicar_delta($1::jsonb,$2::jsonb) as estado',[JSON.stringify(a),JSON.stringify(d)])).rows[0].estado;
function estadoGrande(){
 const s=estadoVacio();s.guards=[{id:'a',rol:'admin',nombre:'Ana'}];s.punches=[{id:'activo',guardId:'a',dispositivoId:'telefono',in:'07:00',out:''}];
 s.novedades=Array.from({length:400},(_,i)=>({id:'n'+i,fecha:'2026-09-29',hora:'08:00',guardId:'a',createdBy:'a',turnoId:'cerrado',texto:'Registro histórico '+i,lockedAt:1}));
 s.novedades[0].fotos=['data:image/jpeg;base64,'+'a'.repeat(8*1024*1024)];
 return s;
}
test('sincroniza historial de más de 8 MB con 400 registros, fotos y una alta sin alterar el pasado',async()=>{
 const a=estadoGrande(),b=structuredClone(a);b.novedades.push({id:'nueva',guardId:'a',createdBy:'a',turnoId:'activo',texto:'Nueva novedad'});
 const r=await aplicar(a,cambiosNube(b,a));assert.deepEqual(r,b);await validar(a,r);
 assert.deepEqual(r.novedades[0].fotos,a.novedades[0].fotos);
});
test('el JOIN conserva orden, reemplazos y altas de varias fotos en una misma colección',async()=>{
 const a=estadoGrande(),d={reports:[{id:'r1',fotos:['uno']},{id:'r2',fotos:['dos']}]};
 const b=await aplicar(a,d);const c=await aplicar(b,{reports:[{id:'r2',fotos:['dos editada']},{id:'r3',fotos:['tres']}]});
 assert.deepEqual(c.reports,[d.reports[0],{id:'r2',fotos:['dos editada']},{id:'r3',fotos:['tres']}]);
});
test('la optimización sigue rechazando cambio o borrado de evidencia en un turno cerrado',async()=>{
 const a=estadoGrande();
 for(const mutar of [s=>s.novedades[0].fotos=['reemplazo'],s=>s.novedades.shift()]){
  const b=structuredClone(a);mutar(b);await assert.rejects(validar(a,b),/turno cerrado|eliminar físicamente/);
 }
});
test('rechaza IDs duplicados, incompletos y catálogos sin colección',async()=>{
 const a=estadoVacio();
 for(const d of [null,[],{reports:[{}]},{reports:[{id:'x'},{id:'x'}]},{inventada:[]}])await assert.rejects(aplicar(a,d));
 for(const mutar of [s=>delete s.reports,s=>s.novedades=[{id:'x'},{id:'x'}],s=>s.guards=[{id:'a',pin:'1234'}]]){
  const b=structuredClone(a);mutar(b);await assert.rejects(db.query('select guardia_private.validar_formato($1::jsonb)',[JSON.stringify(b)]));
 }
});
test('sólo los RPC de sincronización tienen la excepción de tiempo de 45 segundos',async()=>{
 const r=await db.query("select proname,proconfig from pg_proc where proname in ('guardia_rpc','guardia_recuperacion','validar_cambios')");
 for(const f of r.rows)assert.equal((f.proconfig||[]).includes('statement_timeout=45s'),f.proname!=='validar_cambios');
});
