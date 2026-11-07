require('./register.cjs');
const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const {estadoVacio}=require('../src/model.ts');
let db;const objetivo='00000000-0000-4000-8000-000000000001',otro='00000000-0000-4000-8000-000000000002';
const base=estadoVacio();base.guards=[{id:'a',nombre:'Ana',rol:'admin',cuenta:true},{id:'v',nombre:'Vigilador',rol:'vigilador',cuenta:true}];
base.reports=[{id:'reporte',texto:'Informe corporativo',fotos:['data:image/jpeg;base64,a'] }];
base.punches=[{id:'cerrado',guardId:'a',out:'19:00',closedAt:2}];
before(async()=>{
 db=new PGlite();await db.exec(`create role anon;create role authenticated;create schema guardia_private;
 create table guardia_private.documentos(id uuid primary key,cifrado bytea,revision bigint default 1,actualizado timestamptz default now());
 create table guardia_private.dispositivos(hash text primary key,objetivo uuid,revocado boolean default false);
 create table guardia_private.sesiones(hash text,dispositivo text,guardia text,vence timestamptz default now()+interval '1 day');
 create function guardia_private.hash(t text) returns text language sql immutable as $$select md5(t)$$;
 create function guardia_private.cifrar(j jsonb) returns bytea language sql as $$select convert_to(j::text,'UTF8')$$;
 create function guardia_private.abrir(b bytea) returns jsonb language sql as $$select convert_from(b,'UTF8')::jsonb$$;
 create function public.guardia_rpc(p_request jsonb) returns jsonb language plpgsql security definer set search_path='' as $f$
 declare ses guardia_private.sesiones;doc guardia_private.documentos;
 begin
 select s.* into ses from guardia_private.sesiones s join guardia_private.dispositivos d on d.hash=s.dispositivo
 where s.hash=p_request->>'token' and d.hash=guardia_private.hash(p_request->>'dispositivo') and not d.revocado and s.vence>now();
 if ses.hash is null then return '{"ok":false,"codigo":"sesion"}'::jsonb;end if;
 select o.* into doc from guardia_private.documentos o join guardia_private.dispositivos d on d.objetivo=o.id where d.hash=ses.dispositivo for update;
 return jsonb_build_object('ok',true,'estado',guardia_private.abrir(doc.cifrado),'revision',doc.revision,'guardia',ses.guardia);
 end;$f$;`);
 const sql=fs.readFileSync('nube/002_servicio.sql','utf8');await db.exec(sql.slice(sql.indexOf('create or replace function guardia_private.validar_formato(')).split('$$;')[0]+'$$;');
 await db.exec(fs.readFileSync('supabase/migrations/20260916190220_sincronizacion_turnos_offline.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20260925005245_recuperacion_cifrada_sincronizacion.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20260929213903_recuperacion_adjuntos_lineal.sql','utf8'));
 for(const id of [objetivo,otro])await db.query('insert into guardia_private.documentos(id,cifrado) values($1,guardia_private.cifrar($2::jsonb))',[id,JSON.stringify(base)]);
 await db.exec(`insert into guardia_private.dispositivos values(md5('telefono'),'${objetivo}',false),(md5('otro'),'${otro}',false);
 insert into guardia_private.sesiones(hash,dispositivo,guardia) values('admin',md5('telefono'),'a'),('vig',md5('telefono'),'v'),('ajeno',md5('otro'),'a');`);
});
after(async()=>db?.close());
const rpc=async(p,token='admin',dispositivo='telefono')=>(await db.query('select public.guardia_recuperacion($1::jsonb) as r',[JSON.stringify({...p,token,dispositivo})])).rows[0].r;
let id;
test('respalda ambos estados, incorpora altas válidas y aísla un registro de turno cerrado sin pisar el corporativo',async()=>{
 assert.equal((await rpc({accion:'reiniciar_sesion'})).ok,false);
 const telefono=structuredClone(base);telefono.reports[0].texto='Otra versión importante';telefono.reports.push({id:'nuevo',texto:'Informe sólo local',fotos:['data:image/jpeg;base64,b']});
 telefono.novedades=[{id:'pendiente-cerrado',createdBy:'a',guardId:'a',turnoId:'cerrado',texto:'Novedad histórica pendiente'}];
 const r=await rpc({accion:'recuperar',estado:telefono});id=r.id;
 assert.ok(id);assert.equal(r.incorporados,1);assert.equal(r.resguardados,2);assert.equal(r.estado.reports[0].texto,'Informe corporativo');assert.equal(r.estado.reports[1].texto,'Informe sólo local');
 assert.equal(r.estado.novedades.length,0);assert.equal(r.revision,2);
 const copia=await rpc({accion:'leer',id});assert.deepEqual(copia.respaldo,{telefono,nube:base});
 const repetida=await rpc({accion:'recuperar',estado:telefono});assert.equal(repetida.id,id);assert.equal(repetida.revision,2);
 assert.equal((await rpc({accion:'listar'})).respaldos.length,1);
});
test('una recuperación admite turno cerrado offline y su novedad juntos',async()=>{
 const telefono=structuredClone(base);telefono.punches.push({id:'offline',guardId:'a',fecha:'2026-09-20',in:'07:00',out:'19:00',fechaOut:'2026-09-20',startedAt:100,closedAt:200});
 telefono.novedades=[{id:'nota-offline',guardId:'a',createdBy:'a',turnoId:'offline',texto:'Novedad offline'}];
 const r=await rpc({accion:'recuperar',estado:telefono});assert.equal(r.incorporados,2);assert.equal(r.estado.novedades[0].texto,'Novedad offline');
});
test('no permite elevar rol, editar informes existentes ni publicar cuentas nuevas con la recuperación',async()=>{
 const telefono=structuredClone(base);telefono.guards[1].rol='admin';telefono.guards.push({id:'intruso',cuenta:true,rol:'admin'});telefono.reports[0].texto='Cambio incompatible';
 const r=await rpc({accion:'recuperar',estado:telefono},'vig');assert.equal(r.incorporados,0);assert.equal(r.estado.guards[1].rol,'vigilador');assert.equal(r.estado.guards.length,2);
 assert.equal(r.estado.reports[0].texto,'Informe corporativo');assert.ok(r.resguardados>=3);
});
test('sesión, objetivo y autor protegen los respaldos; acceso directo bloqueado',async()=>{
 assert.equal((await rpc({accion:'listar'},'invalido')).ok,false);
 assert.equal((await rpc({accion:'leer',id},'vig')).ok,false);
 assert.equal((await rpc({accion:'leer',id},'ajeno','otro')).ok,false);
 assert.equal((await rpc({accion:'listar'},'ajeno','otro')).respaldos.length,0);
 await db.exec('set role anon');await assert.rejects(db.query('select * from guardia_private.recuperaciones'),/permission denied/);await db.exec('reset role');
 await db.exec("update guardia_private.dispositivos set revocado=true where hash=md5('otro')");
 assert.equal((await rpc({accion:'recuperar',estado:base},'ajeno','otro')).ok,false);
});
test('el reinicio elimina sólo las sesiones del teléfono respaldado y conserva documentos y respaldos',async()=>{
 const doc=(await db.query('select cifrado,revision from guardia_private.documentos where id=$1',[objetivo])).rows[0];
 assert.equal((await rpc({accion:'reiniciar_sesion'})).ok,true);
 assert.equal((await rpc({accion:'listar'})).ok,false);
 assert.equal((await db.query("select count(*) as n from guardia_private.sesiones where dispositivo=md5('telefono')")).rows[0].n,0);
 assert.equal((await db.query("select count(*) as n from guardia_private.sesiones where dispositivo=md5('otro')")).rows[0].n,1);
 assert.deepEqual((await db.query('select cifrado,revision from guardia_private.documentos where id=$1',[objetivo])).rows[0],doc);
 assert.equal((await db.query('select count(*) as n from guardia_private.recuperaciones')).rows[0].n,3);
});
