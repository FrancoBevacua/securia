require('./register.cjs');
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const {pgcrypto}=require('@electric-sql/pglite/contrib/pgcrypto');
const {estadoVacio}=require('../src/model.ts');

const objetivo='00000000-0000-4000-8000-000000000031';
const dispositivo='a'.repeat(64), dispositivoGuardia='b'.repeat(64);
const dniAdmin='32123456',pinAdmin='394602',pinCorporativo='319241';
const migracion=(sufijo)=>fs.readFileSync('supabase/migrations/'+fs.readdirSync('supabase/migrations').find(f=>f.endsWith(sufijo+'.sql')),'utf8');
let db;
const rpc=async(nombre,datos)=>(await db.query('select public.'+nombre+'($1::jsonb) as r',[JSON.stringify(datos)])).rows[0].r;

before(async()=>{
 db=new PGlite({extensions:{pgcrypto}});
 await db.exec(`create role anon; create role authenticated; create role service_role;
 create schema extensions; create extension pgcrypto schema extensions;
 create schema vault; create table vault.secrets(name text primary key, decrypted_secret text);
 create view vault.decrypted_secrets as select * from vault.secrets;
 create function vault.create_secret(secret text, nombre text) returns void language sql as
 $$insert into vault.secrets values(nombre,secret) on conflict do nothing$$;`);
 await db.exec(fs.readFileSync('nube/002_servicio.sql','utf8'));
 for(const nombre of ['acceso_compartido_y_registro','firmas_y_panel_administrativo','acceso_admin_limitado','sincronizacion_turnos_offline',
  'sesiones_persistentes_y_reportes','sincronizacion_incremental','recuperacion_cifrada_sincronizacion','actividad_independiente_por_telefono',
  'altas_catalogo_operativas','sincronizacion_adjuntos_sin_timeout','recuperacion_adjuntos_lineal','sincronizacion_registros_adjuntos_v2',
  'securia_fichas_externos','puestos_multiples_guardias','corporativo_pin_y_guardia_a_cargo','crear_novedades_panel_web',
  'sincronizar_turnos_cerrados','sincronizar_firmas_historicas'])await db.exec(migracion(nombre));
 const e=estadoVacio();
 e.guards=[{id:'personal',rol:'vigilador',cuenta:true,dni:dniAdmin,nombre:'Admin de prueba'},
  {id:'guardia',rol:'vigilador',cuenta:true,dni:'30123456',nombre:'Guardia de prueba'},
  {id:'corp',rol:'admin',corporativo:true,cuenta:true,nombre:'Puesto de prueba'}];
 const turno={id:'turno-ajeno',guardId:'guardia',dispositivoId:'otro-telefono',out:'19:00',closedAt:2};
 e.punches=[turno];
 const registro={id:'registro',guardId:'guardia',createdBy:'guardia',turnoId:turno.id,lockedAt:2};
 e.novedades=[{...registro,texto:'Texto original'}];
 e.alogs=[{...registro,acceso:'Puerta de prueba'}];
 e.reports=[{id:'informe',createdBy:'guardia',f6:'Hecho original'}];
 await db.query('insert into guardia_private.documentos(id,cifrado) values($1,guardia_private.cifrar($2))',[objetivo,JSON.stringify(e)]);
 for(const [id,dni,pin] of [['personal',dniAdmin,'5640'],['guardia','30123456','4905'],['corp',null,pinCorporativo]]){
  await db.query(`insert into guardia_private.credenciales(objetivo,guardia,dni_hmac,sal,verificador)
   values($1,$2,guardia_private.identidad($3),'sal-prueba',extensions.crypt(guardia_private.identidad(guardia_private.hash('sal-prueba:'||$4)),extensions.gen_salt('bf',4)))`,[objetivo,id,dni,pin]);
 }
 await db.query('insert into guardia_private.dispositivos(hash,objetivo) values(guardia_private.hash($1),$3),(guardia_private.hash($2),$3)',[dispositivo,dispositivoGuardia,objetivo]);
 await db.exec(migracion('separar_administracion_corporativo'));
 await db.query('select guardia_private.activar_administrador($1,$2,$3)',[objetivo,'personal',pinAdmin]);
});
after(async()=>db?.close());

test('el PIN corporativo da acceso operativo, el PIN administrativo exige su cuenta y sólo ésta gestiona el corporativo',async()=>{
 const login=(datos)=>rpc('guardia_rpc',{accion:'ingresar',dispositivo,...datos});
 const corp=await rpc('guardia_corporativo_rpc',{accion:'ingresar',dispositivo:dispositivoGuardia,pin:pinCorporativo});
 assert.equal(corp.ok,true);
 assert.equal(corp.estado.guards.find(g=>g.id==='corp').rol,'vigilador');
 assert.equal((await rpc('guardia_admin_rpc',{accion:'ingresar',dispositivo:dispositivoGuardia,pin:pinCorporativo})).ok,false);
 assert.equal((await rpc('guardia_corporativo_rpc',{accion:'cambiar_pin_corporativo',dispositivo:dispositivoGuardia,token:corp.token,nuevo:'883642'})).codigo,'prohibido');
 assert.equal((await login({dni:'30123456',pin:'4905',administracion:true})).ok,false);
 assert.equal((await login({dni:dniAdmin,pin:pinAdmin})).ok,false);
 const admin=await login({dni:dniAdmin,pin:pinAdmin,administracion:true});
 assert.equal(admin.ok,true);
 assert.equal(admin.guardia,'personal');
 assert.equal((await rpc('guardia_admin_rpc',{accion:'consultar',dispositivo,token:admin.token})).ok,true);
 assert.equal((await rpc('guardia_corporativo_rpc',{accion:'cambiar_pin_corporativo',dispositivo,token:admin.token,nuevo:'883642'})).ok,true);
 assert.equal((await rpc('guardia_corporativo_rpc',{accion:'ingresar',dispositivo:dispositivoGuardia,pin:pinCorporativo})).ok,false);
 assert.equal((await rpc('guardia_corporativo_rpc',{accion:'ingresar',dispositivo:dispositivoGuardia,pin:'883642'})).ok,true);
 assert.equal((await rpc('guardia_admin_rpc',{accion:'ingresar',dispositivo,dni:dniAdmin,pin:pinAdmin})).ok,true);
});

test('el servidor acepta las bajas administrativas de registros ajenos sin permitir cambiar su autoría',async()=>{
 const anterior=(await db.query('select guardia_private.abrir(cifrado) as e from guardia_private.documentos where id=$1',[objetivo])).rows[0].e;
 const bajas=structuredClone(anterior);
 for(const col of ['novedades','alogs','reports'])bajas[col][0].deleted=true;
 const validar=(nuevo,actor)=>db.query('select guardia_private.validar_cambios_sync($1,$2,$3),guardia_private.validar_telefono($1,$2,$3,$4)',
  [JSON.stringify(anterior),JSON.stringify(nuevo),actor,'otro-telefono-administrador']);
 await validar(bajas,'personal');
 await assert.rejects(validar(bajas,'corp'),/otro guardia/);
 bajas.novedades[0].createdBy='personal';
 await assert.rejects(validar(bajas,'personal'),/autoría/);
 const cambios=structuredClone(anterior);
 cambios.site.cliente='Cliente de prueba';
 await assert.rejects(validar(cambios,'corp'),/administración/);
 const informe=structuredClone(anterior);
 informe.reports[0].deleted=true;
 await assert.rejects(validar(informe,'corp'),/informe de otro guardia/);

 const admin=await rpc('guardia_rpc',{accion:'ingresar',dispositivo,dni:dniAdmin,pin:pinAdmin,administracion:true});
 const auth={dispositivo,token:admin.token};
 const pagina=await rpc('guardia_sync',{...auth,accion:'consultar',cursor:0});
 const filas=pagina.filas.filter(f=>['novedades','alogs','reports'].includes(f.col))
  .map(f=>({col:f.col,id:f.id,baseHash:f.hash,valor:{...f.valor,deleted:true}}));
 const r=await rpc('guardia_sync',{...auth,accion:'guardar',lote:'c18f8a63003a8bda',filas});
 assert.deepEqual(r.acuses.map(a=>a.estado),['confirmado','confirmado','confirmado']);
 assert.ok(r.acuses.every(a=>a.valor.createdBy==='guardia'&&a.valor.deleted));
});
