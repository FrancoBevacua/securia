const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
test('sesión renovable, autorización, zona horaria y reserva única del reporte',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`
 create role anon;create role authenticated;create role service_role;
 create schema guardia_private;
 create table guardia_private.documentos(id uuid primary key,cifrado bytea);
 create table guardia_private.dispositivos(hash text primary key,objetivo uuid,revocado boolean default false);
 create table guardia_private.sesiones(hash text,dispositivo text,guardia text,vence timestamptz default now()+interval '24 hours');
 create function guardia_private.hash(t text) returns text language sql immutable as $$select t$$;
 create function guardia_private.cifrar(j jsonb) returns bytea language sql as $$select convert_to(j::text,'UTF8')$$;
 create function guardia_private.abrir(b bytea) returns jsonb language sql as $$select convert_from(b,'UTF8')::jsonb$$;
 create function public.guardia_rpc(p_request jsonb) returns jsonb language plpgsql security definer as $f$
 declare actor text;ses guardia_private.sesiones;e jsonb;
 begin
 select * into ses from guardia_private.sesiones where hash=p_request->>'token' and dispositivo=p_request->>'dispositivo' and vence>now();
 if ses.hash is null then return '{"ok":false,"codigo":"sesion"}'::jsonb;end if;
 actor:=ses.guardia;
 select guardia_private.abrir(doc.cifrado) into e from guardia_private.documentos doc join guardia_private.dispositivos d on d.objetivo=doc.id where d.hash=ses.dispositivo and not d.revocado;
 if e is null then return '{"ok":false}'::jsonb;end if;
 return jsonb_build_object('ok',true,'estado',e,'guardia',actor);
 end;$f$;
 insert into guardia_private.documentos values('00000000-0000-4000-8000-000000000001',guardia_private.cifrar('{"guards":[{"id":"a","rol":"admin"},{"id":"v","rol":"vigilador"}],"site":{}}'));
 insert into guardia_private.dispositivos values('telefono','00000000-0000-4000-8000-000000000001',false);
 insert into guardia_private.sesiones(hash,dispositivo,guardia) values('admin-token','telefono','a'),('vigilador-token','telefono','v');
 `);
 await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/20260919221752_sesiones_persistentes_y_reportes.sql'),'utf8'));
 const rpc=async p=>(await db.query('select public.guardia_whatsapp_config($1::jsonb) as r',[JSON.stringify(p)])).rows[0].r;
 assert.equal((await rpc({accion:'consultar',token:'falso',dispositivo:'telefono'})).ok,false);
 const config={nombre:'Supervisión de prueba',numero:'5493410000000',hora:'18:00',zona:'America/Argentina/Buenos_Aires',habilitado:true,consentimiento:true};
 assert.equal((await rpc({accion:'guardar',token:'vigilador-token',dispositivo:'telefono',config})).ok,false);
 const saved=await rpc({accion:'guardar',token:'admin-token',dispositivo:'telefono',config});
 assert.equal(saved.ok,true);assert.equal(saved.listo,false);assert.equal(saved.config.hora,'18:00');
 assert.ok((await db.query("select extract(epoch from (vence-now()))/86400 as dias from guardia_private.sesiones where hash='admin-token'")).rows[0].dias>29);
 await assert.rejects(rpc({accion:'guardar',token:'admin-token',dispositivo:'telefono',config:{...config,zona:'Inventada'}}),/zona horaria/);
 await assert.rejects(rpc({accion:'guardar',token:'admin-token',dispositivo:'telefono',config:{...config,consentimiento:false}}),/acepta/);
 await db.exec('set role anon');
 await assert.rejects(db.query("select public.guardia_whatsapp_trabajo('{ \"accion\":\"reservar\"}')"),/permission denied/);
 await assert.rejects(db.query('select * from guardia_private.whatsapp_config'),/permission denied/);
 await db.exec('reset role');
 await db.exec("update guardia_private.whatsapp_config set canal_listo=true,hora=((now() at time zone zona)-interval '1 minute')::time");
 const reservar=async()=>(await db.query("select public.guardia_whatsapp_trabajo('{ \"accion\":\"reservar\"}') as r")).rows[0].r;
 const job=await reservar();assert.ok(job.id);assert.equal(await reservar(),null);
 assert.equal((await db.query('select count(*) as n from guardia_private.whatsapp_envios')).rows[0].n,1);
 const marcar=async estado=>db.query('select public.guardia_whatsapp_trabajo($1::jsonb)',[JSON.stringify({accion:'marcar',id:job.id,estado})]);
 await assert.rejects(marcar('aceptado'),/Transición/);await marcar('enviando');await marcar('incierto');
 assert.equal(await reservar(),null);
 }finally{await db.close();}
});
