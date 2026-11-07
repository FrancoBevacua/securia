require('./register.cjs');
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const {ColaNube}=require('../src/colaNube.ts');
const {reconciliarNube}=require('../src/reconciliarNube.ts');
const {estados}=require('./fixtures-nube.json');
const copia=x=>x==null?x:JSON.parse(JSON.stringify(x));
const actor='nube-test-a',otro='nube-test-b';
let db;
const sql=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const funcion=(texto,nombre)=>texto.slice(texto.indexOf(`create or replace function guardia_private.${nombre}(`)).split('$$;')[0]+'$$;';
const validar=(a,b,autor=actor)=>db.query('select guardia_private.validar_cambios($1::jsonb,$2::jsonb,$3::text)',[JSON.stringify(a),JSON.stringify(b),autor]);
before(async()=>{
 db=new PGlite();
 await db.exec('create schema guardia_private;');
 await db.exec(funcion(sql('nube/002_servicio.sql'),'validar_formato'));
 await db.exec(funcion(sql('supabase/migrations/20260912165040_firmas_y_panel_administrativo.sql'),'validar_cambios').replace('guardia_private.validar_cambios(','guardia_private.validar_cambios_antes('));
 await db.exec(sql('supabase/migrations/20260916190220_sincronizacion_turnos_offline.sql'));
});
after(async()=>{await db?.close();});

test('reproduce el error anterior y sincroniza atómicamente un turno completo cerrado offline',async()=>{
 await assert.rejects(db.query('select guardia_private.validar_cambios_antes($1::jsonb,$2::jsonb,$3)',[JSON.stringify(estados[0]),JSON.stringify(estados[3]),actor]),/Se necesita un turno propio abierto/);
 await validar(estados[0],estados[3]);
});
test('el flujo conectado sigue aceptando inicio, novedades y cierre en envíos separados',async()=>{
 for(let i=1;i<estados.length;i++)await validar(estados[i-1],estados[i]);
 await validar(estados[3],estados[3]);
});
for(const perderRespuesta of [false,true])test(`la cola recupera el turno cerrado persistido sin perder registros (respuesta perdida: ${perderRespuesta})`,async()=>{
 let pendiente=null,remoto=copia(estados[0]),revision=1,cliente=1,conectado=false,perder=perderRespuesta,envios=0,confirmado;
 const cola=new ColaNube({leer:async()=>copia(pendiente),escribir:async p=>{pendiente=copia(p);},quitar:async()=>{pendiente=null;},
   consultar:async()=>{if(!conectado)throw Error('Sin conexión');return {estado:copia(remoto),revision};},
   enviar:async p=>{assert.equal(p.revision,revision);await validar(remoto,p.estado);remoto=copia(p.estado);revision++;envios++;if(perder){perder=false;throw Error('Respuesta perdida');}return revision;},
   actor:()=>actor,revision:()=>cliente,base:()=>estados[0],reconciliar:reconciliarNube,confirmar:(r,e)=>{cliente=r;confirmado=copia(e);}});
 for(let i=1;i<estados.length;i++)await assert.rejects(cola.guardar(estados[i]),/Sin conexión/);
 assert.deepEqual(pendiente.estado,estados[3]);
 conectado=true;
 if(perderRespuesta)await assert.rejects(cola.reintentar(),/Respuesta perdida/);
 await cola.reintentar();
 assert.equal(pendiente,null);assert.equal(envios,1);assert.equal(cliente,2);
 assert.deepEqual(remoto,estados[3]);assert.deepEqual(confirmado,estados[3]);
});
function siguienteTurno(){
 const e=copia(estados[3]);
 const p={...estados[1].punches[0],id:'turno-siguiente',startedAt:estados[3].punches[0].closedAt,fecha:'2026-09-10',in:'15:00'};
 e.punches.push(p);
 e.novedades.push({id:'nota-siguiente',turnoId:p.id,guardId:otro,createdBy:actor,fecha:p.fecha,hora:p.in,texto:'Firma del compañero; carga propia.'});
 e.alogs.push({id:'acceso-siguiente',turnoId:p.id,guardId:otro,createdBy:actor,fecha:p.fecha,hora:p.in});
 return e;
}
test('acepta cierre pendiente más nuevo turno activo con otro firmante en el mismo lote',async()=>{
 const e=siguienteTurno();
 await validar(estados[0],e);
 await validar(estados[2],e);
});
test('el nuevo turno cerrado también admite accesos offline con autor y firmante diferentes',async()=>{
 const e=copia(estados[3]);e.alogs=[{id:'acceso-offline',turnoId:e.punches[0].id,guardId:otro,createdBy:actor,fecha:'2026-09-10',hora:'09:00',lockedAt:e.punches[0].closedAt}];
 await validar(estados[0],e);
});
test('recupera varios turnos completos acumulados y el formato anterior sin createdBy',async()=>{
 const e=siguienteTurno(),p=e.punches[1];
 p.out='23:00';p.fechaOut='2026-09-10';p.closedAt=p.startedAt+8*60*60*1000;
 e.novedades.at(-1).lockedAt=p.closedAt;e.alogs[0].lockedAt=p.closedAt;
 await validar(estados[0],e);
 assert.equal(estados[3].novedades[1].createdBy,undefined);
 await validar(estados[0],estados[3]);
});
test('conserva turnos históricos sin timestamps y un turno remoto iniciado después del cierre offline',async()=>{
 const base=copia(estados[0]),e=copia(estados[3]);
 const historico={id:'turno-historico',guardId:actor,fecha:'2026-09-09',in:'07:00',out:'15:00'};
 const remoto={...estados[1].punches[0],id:'turno-remoto',guardId:otro,in:'15:00',startedAt:estados[3].punches[0].closedAt};
 base.punches.push(historico,remoto);e.punches.push(copia(historico),copia(remoto));
 await validar(base,e);
});
test('una revisión remota más reciente se combina con el turno offline antes de validarlo',async()=>{
 let remoto=copia(estados[0]);remoto.guards[0].nombre='Ana María';
 let pendiente={estado:copia(estados[3]),base:copia(estados[0]),revision:1,guardia:actor,numero:4};
 const cola=new ColaNube({leer:async()=>copia(pendiente),escribir:async p=>{pendiente=copia(p);},quitar:async()=>{pendiente=null;},
  consultar:async()=>({estado:copia(remoto),revision:2}),enviar:async p=>{await validar(remoto,p.estado);remoto=copia(p.estado);return 3;},
  actor:()=>actor,revision:()=>1,reconciliar:reconciliarNube,confirmar:()=>{}});
 await cola.reintentar();assert.equal(pendiente,null);assert.equal(remoto.guards[0].nombre,'Ana María');assert.deepEqual(remoto.punches,estados[3].punches);
});
test('rechaza agregar o cambiar notas y accesos de un turno ya cerrado en el servidor',async()=>{
 for(const col of ['novedades','alogs']){
  const e=copia(estados[3]);e[col].push({id:'tardia',turnoId:e.punches[0].id,guardId:actor,createdBy:actor});
  await assert.rejects(validar(estados[3],e),/turno propio pendiente/);
 }
 const e=copia(estados[3]);e.novedades[1].texto='Reescritura';
 await assert.rejects(validar(estados[3],e),/turno cerrado/);
});
test('no admite autor ajeno, turno ajeno, turno ausente ni cambio de autoría',async()=>{
 for(const campo of ['createdBy','turnoId']){
  const e=copia(estados[3]);e.novedades[1][campo]=otro;
  await assert.rejects(validar(estados[0],e),/turno propio pendiente/);
 }
 const ajeno=copia(estados[3]);ajeno.punches[0].guardId=otro;
 await assert.rejects(validar(estados[0],ajeno),/turno propio pendiente|Ingreso de turno inválido/);
 const autor=copia(estados[2]);autor.novedades[1].createdBy=otro;
 await assert.rejects(validar(estados[2],autor),/autoría/);
});
test('el turno cerrado conserva ingreso, propietario e historial inmutables',async()=>{
 const cerrado=copia(estados[3]);cerrado.punches[0].out='';delete cerrado.punches[0].closedAt;
 await assert.rejects(validar(estados[3],cerrado),/cierre definitivo/);
 const reescrito=copia(estados[3]);reescrito.punches[0].in='08:00';
 await assert.rejects(validar(estados[2],reescrito),/reescribir el ingreso/);
 const eliminado=copia(estados[3]);eliminado.novedades.shift();
 await assert.rejects(validar(estados[3],eliminado),/eliminar físicamente/);
});
test('sincronizar un lote no permite elevar el rol, editar otra cuenta ni cambiar configuración',async()=>{
 const base=copia(estados[0]);base.guards[0].rol='vigilador';
 const cerrado=copia(estados[3]);cerrado.guards[0].rol='vigilador';
 await validar(base,cerrado);
 const rol=copia(cerrado);rol.guards[0].rol='admin';
 await assert.rejects(validar(base,rol),/identidad/);
 const perfil=copia(cerrado);perfil.guards[1].nombre='Cambio ajeno';
 await assert.rejects(validar(base,perfil),/otro perfil/);
 const configuracion=copia(cerrado);configuracion.posts[0].nombre='Cambio sin permiso';
 await assert.rejects(validar(base,configuracion),/requiere administración/);
 const firma=copia(cerrado);firma.novedades[1].guardId='inexistente';firma.novedades[1].createdBy=actor;
 await assert.rejects(validar(base,firma),/vigilador del objetivo/);
});
test('rechaza cierres offline incompletos o anteriores al ingreso y dos turnos abiertos',async()=>{
 for(const campo of ['out','closedAt','startedAt','fechaOut']){
  const e=copia(estados[3]);delete e.punches[0][campo];
  await assert.rejects(validar(estados[0],e),/cierre completo/);
 }
 const temprano=copia(estados[3]);temprano.punches[0].closedAt=temprano.punches[0].startedAt-1;
 await assert.rejects(validar(estados[0],temprano),/anterior al ingreso/);
 const dos=copia(estados[1]);dos.punches.push({...dos.punches[0],id:'segundo'});
 await assert.rejects(validar(estados[0],dos),/Ya existe un turno abierto/);
});
