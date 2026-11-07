-- Datos sintéticos; cada documento, dispositivo y sesión se revierte.
begin;
do $prueba$
declare
 objetivo uuid; dispositivo text:=encode(extensions.gen_random_bytes(32),'hex'); token text:=encode(extensions.gen_random_bytes(32),'hex');
 base jsonb; candidato jsonb; r jsonb; fotos text; inicio timestamptz; guardado_ms numeric; recuperado_ms numeric;
begin
 select jsonb_object_agg(c,'[]'::jsonb) into base from unnest(array['posts','franjas','guards','directives','dlogs','accesses','alogs','reports','novedades','visits','rounds','rtemplates','shifts','punches','contacts','infdias','locales','recorridos','envios']) c;
 base:=base||jsonb_build_object('site',jsonb_build_object('cliente','Prueba de adjuntos'),'updatedAt',0,'guards',jsonb_build_array(jsonb_build_object('id','adjuntos-test','nombre','Prueba','rol','admin','cuenta',true)),
 'punches',jsonb_build_array(jsonb_build_object('id','activo','guardId','adjuntos-test','dispositivoId',guardia_private.hash(dispositivo),'in','07:00','out','')));
 select jsonb_set(base,'{novedades}',jsonb_agg(jsonb_build_object('id','historica-'||i,'guardId','adjuntos-test','createdBy','adjuntos-test','turnoId','cerrado','lockedAt',1,'texto','Histórico sintético '||i))) into base from generate_series(1,400) i;
 -- Base64 incomprimible, del tamaño de los envíos observados en los logs.
 select 'data:image/jpeg;base64,'||string_agg(encode(extensions.gen_random_bytes(768),'base64'),'') into fotos from generate_series(1,8192);
 candidato:=jsonb_set(base,'{novedades}',(base->'novedades')||jsonb_build_array(jsonb_build_object('id','foto-nueva','guardId','adjuntos-test','createdBy','adjuntos-test','turnoId','activo','texto','Evidencia','fotos',jsonb_build_array(fotos))));
 insert into guardia_private.documentos(cifrado) values(guardia_private.cifrar(base)) returning id into objetivo;
 insert into guardia_private.dispositivos(hash,objetivo) values(guardia_private.hash(dispositivo),objetivo);
 insert into guardia_private.sesiones(hash,dispositivo,guardia) values(guardia_private.hash(token),guardia_private.hash(dispositivo),'adjuntos-test');
 execute 'set local role anon';
 inicio:=clock_timestamp();
 r:=public.guardia_rpc(jsonb_build_object('accion','guardar','dispositivo',dispositivo,'token',token,'revision',1,'cambios',jsonb_build_object('novedades',jsonb_build_array(candidato#>'{novedades,400}'))));
 guardado_ms:=extract(epoch from clock_timestamp()-inicio)*1000;
 if not coalesce((r->>'ok')::boolean,false) then raise exception 'Guardado falló: %',r-'estado';end if;
 r:=public.guardia_rpc(jsonb_build_object('accion','consultar','dispositivo',dispositivo,'token',token));
 if r#>>'{estado,novedades,400,fotos,0}' is distinct from fotos then raise exception 'No conservó el adjunto completo';end if;
 -- Una diferencia cerrada debe quedar respaldada; el historial remoto no se reescribe.
 candidato:=jsonb_set(candidato,'{novedades,0,texto}','"Diferencia a resguardar"');
 inicio:=clock_timestamp();
 r:=public.guardia_recuperacion(jsonb_build_object('accion','recuperar','dispositivo',dispositivo,'token',token,'estado',candidato));
 recuperado_ms:=extract(epoch from clock_timestamp()-inicio)*1000;
 if not coalesce((r->>'ok')::boolean,false) or r->>'id' is null or (r->>'resguardados')::integer<>1 then raise exception 'Respaldo falló: %',r-'estado';end if;
 if r#>>'{estado,novedades,0,texto}' is distinct from 'Histórico sintético 1' then raise exception 'Reescribió el histórico';end if;
 execute 'reset role';
 perform set_config('consigna.prueba_adjuntos',jsonb_build_object('bytes',length(fotos),'guardar_ms',guardado_ms,'recuperar_ms',recuperado_ms)::text,true);
 raise notice 'Adjunto % bytes; guardar % ms; recuperar % ms; foto íntegra; histórico protegido',length(fotos),guardado_ms,recuperado_ms;
end;
$prueba$;
select current_setting('consigna.prueba_adjuntos')::jsonb as tiempos;
rollback;
select 'Adjuntos grandes verificados, ROLLBACK completo' as resultado;
