require('./register.cjs');
const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const {estadoVacio}=require('../src/model.ts'),{aplicarCambios}=require('../src/mutaciones.ts'),{iniciarServicio,cerrarServicio,turnoAbierto}=require('../src/servicio.ts');
const {ColaNube}=require('../src/colaNube.ts'),{reconciliarNube}=require('../src/reconciliarNube.ts');
const copia=structuredClone;
let db;const a={id:'a',nombre:'Ana',rol:'admin'},b={id:'b',nombre:'Bruno',rol:'vigilador'};
const base=()=>{const s=estadoVacio();s.guards=[a,b];return s;};
const abrir=(s,g,t)=>aplicarCambios(s,iniciarServicio(s,g,new Date('2026-09-24T07:00:00'),true,t),g,true,t);
const nota=(s,g,t,id)=>aplicarCambios(s,[{col:'novedades',obj:{id,guardId:g.id,fecha:'2026-09-24',hora:'08:00',texto:id}}],g,false,t);
const cerrar=(s,g,t)=>aplicarCambios(s,cerrarServicio(s,g,'',new Date('2026-09-24T19:00:00'),t),g,true,t);
before(async()=>{
 db=new PGlite();await db.exec('create schema guardia_private;create role anon;create role authenticated;');
 const original=fs.readFileSync('nube/002_servicio.sql','utf8');await db.exec(original.slice(original.indexOf('create or replace function guardia_private.validar_formato(')).split('$$;')[0]+'$$;');
 await db.exec(`create function public.guardia_rpc(p_request jsonb) returns jsonb language plpgsql as $f$
 declare estado jsonb;candidato jsonb;actor text;dh text;
 begin
 perform guardia_private.validar_cambios(estado,candidato,actor);
 if exists(select 1 from jsonb_array_elements(estado->'punches') x where x->>'guardId'=actor and coalesce(x->>'out','')='' and coalesce(x->>'closedAt','')='') then return '{}';end if;
 return '{}';end;$f$;
 create function public.guardia_recuperacion(p_request jsonb) returns jsonb language plpgsql as $f$
 declare remoto jsonb;candidato jsonb;intento jsonb;actor text;dispositivo_hash text;
 begin
 perform guardia_private.validar_cambios(remoto,candidato,actor);
 perform guardia_private.validar_cambios(remoto,intento,actor);
 return '{}';end;$f$;`);
 const sql=fs.readFileSync('supabase/migrations/20260925081327_actividad_independiente_por_telefono.sql','utf8');await db.exec(sql);await db.exec(fs.readFileSync('supabase/migrations/20260926181707_altas_catalogo_operativas.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20260929213349_sincronizacion_adjuntos_sin_timeout.sql','utf8'));
});
after(async()=>db?.close());
const validar=async(anterior,nuevo,g,t)=>{await db.query('select guardia_private.validar_cambios($1::jsonb,$2::jsonb,$3),guardia_private.validar_telefono($1::jsonb,$2::jsonb,$3,$4)',[JSON.stringify(anterior),JSON.stringify(nuevo),g.id,t]);};

test('vigilador agrega personas y accesos sin poder crear cuentas ni modificar catálogos existentes',async()=>{
 const s=base(),n=copia(s);n.guards.push({id:'nuevo',apellido:'Pérez',nombre:'Juan',cuenta:false,rol:'vigilador'});n.accesses.push({id:'p',nombre:'Puerta 4'});
 await validar(s,n,b,'telefono-b');
 const editado=copia(n);editado.accesses[0].nombre='Cambio';await assert.rejects(validar(n,editado,b,'telefono-b'),/administración/);
 for(const extra of [{cuenta:true},{rol:'admin'},{dni:'12345678'}]){const malo=copia(n);Object.assign(malo.guards.at(-1),extra);await assert.rejects(validar(s,malo,b,'telefono-b'),/cuenta/);}
});
test('la migración aplica la protección de dispositivo y el cierre sólo al teléfono actual',async()=>{
 const rpc=(await db.query("select pg_get_functiondef('public.guardia_rpc(jsonb)'::regprocedure) as f")).rows[0].f;
 assert.match(rpc,/validar_telefono\(estado,candidato,actor,dh\)/);assert.match(rpc,/dispositivoId',''\)=dh/);
 const recuperacion=(await db.query("select pg_get_functiondef('public.guardia_recuperacion(jsonb)'::regprocedure) as f")).rows[0].f;assert.match(recuperacion,/validar_telefono\(remoto,intento,actor,dispositivo_hash\)/);
});
for(const mismoGuardia of [false,true])test('dos teléfonos operan sin esperar al otro; misma cuenta: '+mismoGuardia,async()=>{
 const g=mismoGuardia?a:b;
 let s=abrir(base(),a,'telefono-a');s=nota(s,a,'telefono-a','nota-a');
 const dos=nota(abrir(s,g,'telefono-b'),g,'telefono-b','nota-b');await validar(s,dos,g,'telefono-b');
 const fin=cerrar(dos,a,'telefono-a');await validar(dos,fin,a,'telefono-a');
 assert.ok(turnoAbierto(fin,g.id,'telefono-b'));assert.equal(turnoAbierto(fin,a.id,'telefono-a'),undefined);
 assert.equal(fin.novedades.find(x=>x.id==='nota-b').lockedAt,undefined);assert.ok(fin.novedades.find(x=>x.id==='nota-a').lockedAt);
 const siguiente=nota(fin,g,'telefono-b','segunda-b');await validar(fin,siguiente,g,'telefono-b');
});
test('otro teléfono no puede cerrar ni alterar la actividad aunque use la misma cuenta',async()=>{
 const s=nota(abrir(base(),a,'telefono-a'),a,'telefono-a','nota');
 await assert.rejects(validar(s,cerrar(s,a,'telefono-a'),a,'telefono-b'),/otro teléfono/);
 const fraudulento=copia(s);fraudulento.punches[0].dispositivoId='telefono-b';
 await assert.rejects(validar(s,fraudulento,a,'telefono-b'),/teléfono|reescribir|cierre definitivo/);
 const modificada=copia(s);modificada.novedades[0].texto='Alteración desde otro teléfono';
 await assert.rejects(validar(s,modificada,a,'telefono-b'),/otro teléfono/);
});
test('un teléfono sincroniza su jornada cerrada offline con el otro todavía activo',async()=>{
 const original=base(),activo=nota(abrir(original,b,'telefono-b'),b,'telefono-b','nota-b');
 const offline=cerrar(nota(abrir(original,a,'telefono-a'),a,'telefono-a','nota-a'),a,'telefono-a');
 const mezclado=reconciliarNube(offline,activo,original);await validar(activo,mezclado,a,'telefono-a');
 assert.ok(turnoAbierto(mezclado,b.id,'telefono-b'));assert.equal(mezclado.novedades.length,2);
});
test('una colisión de revisión se reconsulta sola y envía sólo el teléfono con pendientes',async()=>{
 const original=base(),local=nota(abrir(original,a,'telefono-a'),a,'telefono-a','nota-a');
 let remoto=copia(original),revision=1,pendiente=null,intentos=0;
 const cola=new ColaNube({leer:async()=>copia(pendiente),escribir:async p=>{pendiente=copia(p);},quitar:async()=>{pendiente=null;},actor:()=>a.id,revision:()=>1,base:()=>original,reconciliar:reconciliarNube,confirmar:()=>{},consultar:async()=>({estado:copia(remoto),revision}),
  enviar:async p=>{if(++intentos===1){remoto=nota(abrir(original,b,'telefono-b'),b,'telefono-b','nota-b');revision++;throw Object.assign(Error('Revisión nueva'),{codigo:'conflicto'});}assert.equal(p.revision,revision);await validar(remoto,p.estado,a,'telefono-a');remoto=copia(p.estado);return ++revision;}});
 await cola.guardar(local);assert.equal(pendiente,null);assert.equal(intentos,2);assert.equal(remoto.novedades.length,2);assert.ok(turnoAbierto(remoto,b.id,'telefono-b'));
});
