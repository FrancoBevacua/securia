require('./register.cjs');
const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs');
const {PGlite}=require('@electric-sql/pglite'),{estadoVacio}=require('../src/model.ts');
let db;const objetivo='00000000-0000-4000-8000-000000000011';
const sql=p=>fs.readFileSync(p,'utf8');
const funcion=(s,n)=>s.slice(s.indexOf('create or replace function guardia_private.'+n+'(')).split('$$;')[0]+'$$;';
before(async()=>{
 db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role;create schema guardia_private;create schema extensions;
 create table guardia_private.documentos(id uuid primary key default gen_random_uuid(),cifrado bytea,revision bigint default 1,actualizado timestamptz default now());
 create table guardia_private.dispositivos(hash text primary key,objetivo uuid references guardia_private.documentos(id),revocado boolean default false);
 create table guardia_private.sesiones(hash text primary key,dispositivo text,guardia text,vence timestamptz default now()+interval '1 day');
 create table guardia_private.whatsapp_envios(id uuid primary key,objetivo uuid);
 create function extensions.digest(t text,alg text) returns bytea language sql immutable as $$select decode(md5(t)||md5(t),'hex')$$;
 create function guardia_private.hash(t text) returns text language sql immutable as $$select md5(t)||md5(t)$$;
 create function guardia_private.cifrar(j jsonb) returns bytea language sql as $$select convert_to(j::text,'UTF8')$$;
 create function guardia_private.abrir(b bytea) returns jsonb language sql as $$select convert_from(b,'UTF8')::jsonb$$;
 create function public.guardia_rpc(p_request jsonb) returns jsonb language plpgsql as $f$begin
 return '{"ok":true}'::jsonb;end;$f$;
 create function public.guardia_recuperacion(p_request jsonb) returns jsonb language plpgsql as $f$begin
 return '{"ok":true}'::jsonb;end;$f$;
 create function public.guardia_admin_rpc(p_request jsonb) returns jsonb language plpgsql as $f$
 declare col text;anterior jsonb;doc guardia_private.documentos;begin
 return jsonb_build_object('foto',case when col='guards' then anterior->'foto' else anterior->'fotos'->coalesce((p_request->>'indice')::integer,0) end);end;$f$;
 create function public.guardia_whatsapp_trabajo(p_request jsonb) returns jsonb language plpgsql as $f$
 declare c guardia_private.whatsapp_envios;begin if p_request->>'accion'='reservar' then return null;end if;return null;end;$f$;`);
 await db.exec(funcion(sql('nube/002_servicio.sql'),'validar_formato'));
 await db.exec(sql('supabase/migrations/20260916190220_sincronizacion_turnos_offline.sql'));
 // Instalar la validación vigente, incluida la separación por teléfono.
 let telefono=sql('supabase/migrations/20260925081327_actividad_independiente_por_telefono.sql');
 await db.exec(telefono.slice(0,telefono.indexOf('-- Mantener los permisos')));
 await db.exec(sql('supabase/migrations/20260926181707_altas_catalogo_operativas.sql'));
 await db.exec(sql('supabase/migrations/20260929213349_sincronizacion_adjuntos_sin_timeout.sql'));
 const e=estadoVacio();e.guards=[{id:'a',cuenta:true,rol:'admin',nombre:'Prueba'}];
 e.punches=[{id:'cerrado',guardId:'a',out:'19:00',closedAt:2},{id:'abierto',guardId:'a',in:'07:00',out:'',dispositivoId:'978b39d912803d77694bc962ac80c77c978b39d912803d77694bc962ac80c77c'}];
 e.novedades=Array.from({length:410},(_,i)=>({id:'historica-'+i,createdBy:'a',guardId:'a',turnoId:'cerrado',lockedAt:2,texto:'Histórico '+i}));
 e.reports=[{id:'foto-antigua',fotos:['data:image/jpeg;base64,YWJj']}];
 await db.query('insert into guardia_private.documentos(id,cifrado) values($1,guardia_private.cifrar($2::jsonb))',[objetivo,JSON.stringify(e)]);
 await db.exec(sql('supabase/migrations/20261001071312_sincronizacion_registros_adjuntos_v2.sql'));
 await db.exec(sql('supabase/migrations/20261025012906_securia_fichas_externos.sql'));
 const recuperable={col:'novedades',id:'recuperable',valor:{id:'recuperable',createdBy:'a',guardId:'a',turnoId:'cerrado',texto:'Entrega pendiente de prueba'}};
 await db.query(`insert into guardia_private.sync_resguardos(objetivo,actor,telefono,col,registro,motivo,cifrado)
 values($1,'a',guardia_private.hash('telefono'),'novedades','recuperable','El registro debe pertenecer a un turno propio pendiente de sincronización',guardia_private.cifrar($2::jsonb))`,[objetivo,JSON.stringify(recuperable)]);
 await db.exec(sql('supabase/migrations/20261108052136_sincronizar_turnos_cerrados.sql'));
 await db.exec(sql('supabase/migrations/20261108052837_sincronizar_firmas_historicas.sql'));
 await db.exec(`insert into guardia_private.dispositivos values(guardia_private.hash('telefono'),'${objetivo}',false);
 insert into guardia_private.sesiones(hash,dispositivo,guardia) values(guardia_private.hash('token'),guardia_private.hash('telefono'),'a');`);
});
after(async()=>db?.close());
const rpc=async p=>(await db.query('select public.guardia_sync($1::jsonb) as r',[JSON.stringify({...p,dispositivo:'telefono',token:'token'})])).rows[0].r;
const guardar=(filas,lote='123456789abcdef0')=>rpc({accion:'guardar',lote,filas});
test('migra fotos a referencias, conserva el original y pagina sin bytes de imágenes',async()=>{
 let cursor=0,mas=true,filas=[];
 while(mas){const r=await rpc({accion:'consultar',cursor});assert.ok(r.filas.length<=200);assert.ok(r.cursor>cursor);filas.push(...r.filas);cursor=r.cursor;mas=r.mas;}
 const foto=filas.find(f=>f.id==='foto-antigua').valor.fotos[0];assert.match(foto,/^vige:\/\//);assert.equal((await rpc({accion:'foto',ref:foto})).foto,'data:image/jpeg;base64,YWJj');
 assert.ok(!JSON.stringify(filas).includes('base64,'));assert.equal((await db.query('select count(*)::int as n from guardia_private.sync_originales')).rows[0].n,1);
 assert.equal((await rpc({accion:'consultar',cursor})).filas.length,0);
});
test('acepta un turno cerrado offline y sus notas con recibo idempotente',async()=>{
 const p={id:'offline',guardId:'a',in:'07:00',out:'19:00',fecha:'2026-10-01',fechaOut:'2026-10-01',startedAt:100,closedAt:200};
 const filas=[{col:'punches',id:p.id,valor:p},{col:'novedades',id:'nota-offline',valor:{id:'nota-offline',createdBy:'a',guardId:'a',turnoId:p.id,texto:'Pendiente'}}];
 const r=await guardar(filas);assert.deepEqual(r.acuses.map(x=>x.estado),['confirmado','confirmado']);
 assert.deepEqual(await guardar(filas),r);
});
test('sincroniza ediciones pendientes de un turno cerrado sin elevar el rol',async()=>{
 const pagina=await rpc({accion:'consultar',cursor:0}),guard=pagina.filas.find(x=>x.col==='guards');
 const r=await guardar([
 {col:'novedades',id:'historica-1',base: {id:'historica-1',createdBy:'a',guardId:'a',turnoId:'cerrado',lockedAt:2,texto:'Histórico 1'},valor:{id:'historica-1',createdBy:'a',guardId:'a',turnoId:'cerrado',lockedAt:2,texto:'Otra versión'}},
 {col:'reports',id:'informe-nuevo',valor:{id:'informe-nuevo',texto:'Informe'}},
 {col:'guards',id:'a',baseHash:guard.hash,valor:{...guard.valor,cuenta:false}}
 ],'123456789abcdef1');
 assert.equal(r.acuses.find(x=>x.id==='informe-nuevo').estado,'confirmado');assert.equal(r.acuses.find(x=>x.id==='historica-1').estado,'confirmado');assert.equal(r.acuses.filter(x=>x.estado==='resguardado').length,1);
 assert.equal((await rpc({accion:'resguardos'})).resguardos.length,2);
});

test('recupera el respaldo antiguo y conserva el historial de recuperación',async()=>{
 const filas=await db.query("select guardia_private.abrir(cifrado) as valor from guardia_private.sync_filas where objetivo=$1 and col='novedades' and id='recuperable'",[objetivo]);
 assert.equal(filas.rows[0].valor.texto,'Entrega pendiente de prueba');
 assert.equal((await db.query("select recuperado is not null as recuperado from guardia_private.sync_resguardos where registro='recuperable'")).rows[0].recuperado,true);
});

test('acepta notas tardías en varios lotes y rechaza cambiar su autor o teléfono',async()=>{
 for(let lote=0;lote<2;lote++){
  const filas=Array.from({length:130},(_,i)=>({col:'novedades',id:'tardia-'+lote+'-'+i,valor:{id:'tardia-'+lote+'-'+i,createdBy:'a',guardId:'a',turnoId:'cerrado',lockedAt:2,texto:'Nota tardía'}}));
  assert.ok((await guardar(filas,'abcdefabcdefabcd'+lote)).acuses.every(a=>a.estado==='confirmado'));
 }
 const fila={id:'autor-ajeno',createdBy:'otro',guardId:'a',turnoId:'cerrado',texto:'Otra cuenta'};
 assert.equal((await guardar([{col:'novedades',id:fila.id,valor:fila}],'abcdefabcdefabc4')).acuses[0].estado,'resguardado');
 const otroTelefono=await guardar([{col:'punches',id:'otro-telefono',valor:{id:'otro-telefono',guardId:'a',dispositivoId:'otro',out:''}}],'abcdefabcdefabc5');
 assert.equal(otroTelefono.acuses[0].estado,'resguardado');
});

test('la baja del firmante no impide sincronizar su firma histórica',async()=>{
 const e=(await db.query('select guardia_private.abrir(cifrado) as e from guardia_private.documentos where id=$1',[objetivo])).rows[0].e;
 e.guards.push({id:'firma-historica',nombre:'Prueba',deleted:true});
 await db.query('update guardia_private.documentos set cifrado=guardia_private.cifrar($1::jsonb) where id=$2',[JSON.stringify(e),objetivo]);
 const n={id:'firma-archivada',guardId:'firma-historica',createdBy:'a',turnoId:'cerrado',texto:'Registro histórico'};
 assert.equal((await guardar([{col:'novedades',id:n.id,valor:n}],'abcdefabcdefabc6')).acuses[0].estado,'confirmado');
});
test('un cambio concurrente no sobrescribe y diferencias sólo de updatedAt no bloquean',async()=>{
 const r=await guardar([{col:'reports',id:'informe-nuevo',valor:{id:'informe-nuevo',texto:'Informe',updatedAt:999}}],'123456789abcdef2');
 assert.equal(r.acuses[0].estado,'confirmado');
 const otro=await guardar([{col:'reports',id:'informe-nuevo',baseHash:'vieja',valor:{id:'informe-nuevo',texto:'Reemplazo'}}],'123456789abcdef3');
 assert.equal(otro.acuses[0].estado,'resguardado');assert.equal(otro.acuses[0].valor.texto,'Informe');
});
test('rechaza sesiones inválidas y lectura directa; valida integridad y objetivo del adjunto',async()=>{
 const invalid=(await db.query("select public.guardia_sync('{\"accion\":\"consultar\",\"token\":\"otro\",\"dispositivo\":\"telefono\"}') as r")).rows[0].r;assert.equal(invalid.codigo,'sesion');
 await db.exec('set role anon');await assert.rejects(db.query('select * from guardia_private.sync_filas'),/permission denied/);await db.exec('reset role');
 const t='data:image/jpeg;base64,ZXZpZGVuY2lh',hash=(await db.query('select guardia_private.hash($1) as h',[t])).rows[0].h;
 const r=await rpc({accion:'adjunto',hash,numero:0,partes:1,longitud:t.length,contenido:t});assert.equal(r.completo,true);
 assert.equal((await rpc({accion:'foto',ref:r.ref})).foto,t);
 await assert.rejects(rpc({accion:'adjunto',hash:'a'.repeat(64),numero:0,partes:1,longitud:t.length,contenido:t}),/verificación/);
 await assert.rejects(rpc({accion:'foto',ref:r.ref.replace(objetivo,'00000000-0000-4000-8000-000000000099')}),/otro objetivo/);
});
test('un documento nuevo se normaliza después de insertar, sin violar su clave foránea',async()=>{
 const e=estadoVacio();e.guards=[{id:'nuevo',rol:'admin',cuenta:true}];await db.query('insert into guardia_private.documentos(cifrado) values(guardia_private.cifrar($1::jsonb))',[JSON.stringify(e)]);
});

test('sincroniza fichas cifradas de externos y rechaza autoría o DNI inválidos',async()=>{
 const ficha={id:'externo:proveedor prueba',empresa:'Proveedor Prueba',tarea:'Mantenimiento',lugar:'Playa',createdBy:'a',personas:[{nombre:'Persona de prueba',dni:'36.010.660'}]};
 const r=await guardar([{col:'externals',id:ficha.id,valor:ficha}],'abcdefabcdefabc1');
 assert.equal(r.acuses[0].estado,'confirmado');
 // La primera página puede no incluir aún la ficha: consultar por su secuencia.
 const almacenada=await db.query("select guardia_private.abrir(cifrado) as ficha from guardia_private.sync_filas where objetivo=$1 and col='externals' and id=$2",[objetivo,ficha.id]);
 assert.deepEqual(almacenada.rows[0].ficha,ficha);
 const mala=await guardar([{col:'externals',id:ficha.id,baseHash:r.acuses[0].hash,valor:{...ficha,createdBy:'otro'}}],'abcdefabcdefabc2');
 assert.equal(mala.acuses[0].estado,'resguardado');
 const incompleta=await guardar([{col:'externals',id:'externo:invalido',valor:{...ficha,id:'externo:invalido',personas:[{nombre:'Persona',dni:'123'}]}}],'abcdefabcdefabc3');
 assert.equal(incompleta.acuses[0].estado,'resguardado');
 const estado=estadoVacio();estado.guards=[{id:'a',rol:'admin'}];
 delete estado.externals;
 await db.query('select guardia_private.validar_formato($1::jsonb)',[JSON.stringify(estado)]);
 const fusion=(await db.query('select guardia_private.aplicar_delta($1::jsonb,$2::jsonb) as e',[JSON.stringify({...estado,externals:[ficha]}),JSON.stringify({reports:[]})])).rows[0].e;
 assert.deepEqual(fusion.externals,[ficha]);
});
