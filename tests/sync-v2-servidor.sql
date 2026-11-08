-- Ejecutar únicamente después de activar el protocolo 2.
-- No utiliza cuentas reales; al terminar revierte todos los datos sintéticos.
begin;
do $prueba$
declare
 obj uuid; dispositivo text:=encode(extensions.gen_random_bytes(32),'hex'); token text:=encode(extensions.gen_random_bytes(32),'hex');
 e jsonb:=guardia_private.sync_vacio(); r jsonb; repetido jsonb; solicitud jsonb; filas jsonb; ref text;
 foto text:='data:image/jpeg;base64,YWJj'; h text:=guardia_private.hash(foto); instante timestamptz; ms numeric;
begin
 e:=e||jsonb_build_object('guards',jsonb_build_array(jsonb_build_object('id','sync-test','rol','admin','cuenta',true,'nombre','Prueba')),
 'punches',jsonb_build_array(jsonb_build_object('id','cerrado','guardId','sync-test','out','19:00','closedAt',200)));
 e:=jsonb_set(e,'{guards}',(e->'guards')||jsonb_build_array(jsonb_build_object('id','firma-historica','nombre','Prueba histórica','deleted',true)));
 e:=jsonb_set(e,'{novedades}',(select jsonb_agg(jsonb_build_object('id','historia-'||i,'texto','Histórico sintético','createdBy','sync-test','guardId','sync-test','turnoId','cerrado','lockedAt',200)) from generate_series(1,500) i));
 insert into guardia_private.documentos(cifrado) values(guardia_private.cifrar(e)) returning id into obj;
 insert into guardia_private.dispositivos(hash,objetivo) values(guardia_private.hash(dispositivo),obj);
 insert into guardia_private.sesiones(hash,dispositivo,guardia) values(guardia_private.hash(token),guardia_private.hash(dispositivo),'sync-test');
 instante:=clock_timestamp();
 r:=public.guardia_sync(jsonb_build_object('accion','consultar','dispositivo',dispositivo,'token',token,'cursor',0));
 if jsonb_array_length(r->'filas')<>200 or not (r->>'mas')::boolean then raise exception 'No pagina correctamente';end if;
 r:=public.guardia_sync(jsonb_build_object('accion','adjunto','dispositivo',dispositivo,'token',token,'hash',h,'numero',0,'partes',1,'longitud',length(foto),'contenido',foto));
 if not (r->>'completo')::boolean then raise exception 'No confirmó el adjunto';end if;ref:=r->>'ref';
 filas:=jsonb_build_array(
 jsonb_build_object('col','punches','id','offline','valor',jsonb_build_object('id','offline','guardId','sync-test','dispositivoId',guardia_private.hash(dispositivo),'in','07:00','out','19:00','fecha','2026-10-01','fechaOut','2026-10-01','startedAt',100,'closedAt',200)),
 jsonb_build_object('col','novedades','id','nueva','valor',jsonb_build_object('id','nueva','guardId','sync-test','createdBy','sync-test','turnoId','offline','texto','Prueba con evidencia','fotos',jsonb_build_array(ref))),
 jsonb_build_object('col','novedades','id','historia-1','valor',jsonb_build_object('id','historia-1','texto','Conflicto cerrado')));
 solicitud:=jsonb_build_object('accion','guardar','dispositivo',dispositivo,'token',token,'lote','123456789abcdef0','filas',filas);
 r:=public.guardia_sync(solicitud);repetido:=public.guardia_sync(solicitud);
 if r is distinct from repetido then raise exception 'El recibo no es idempotente';end if;
 if (select count(*) from jsonb_array_elements(r->'acuses') x where x->>'estado'='confirmado')<>2 then raise exception 'No incorporó el turno offline: %',r;end if;
 if (select count(*) from jsonb_array_elements(r->'acuses') x where x->>'estado'='resguardado')<>1 then raise exception 'No respaldó el conflicto';end if;
 -- Una entrega posterior al cierre conserva también la firma de un perfil dado de baja.
 filas:=jsonb_build_array(
 jsonb_build_object('col','novedades','id','tardia','valor',jsonb_build_object('id','tardia','guardId','firma-historica','createdBy','sync-test','turnoId','cerrado','texto','Entrega tardía sintética')),
 jsonb_build_object('col','alogs','id','acceso-tardio','valor',jsonb_build_object('id','acceso-tardio','guardId','firma-historica','createdBy','sync-test','turnoId','cerrado','acceso','Portón de prueba','tipo','cierre','fecha','2026-11-08','hora','08:00','p1','0123456')));
 r:=public.guardia_sync(jsonb_build_object('accion','guardar','dispositivo',dispositivo,'token',token,'lote','123456789abcdef1','filas',filas));
 if (select count(*) from jsonb_array_elements(r->'acuses') x where x->>'estado'='confirmado')<>2 then raise exception 'No incorporó entregas tardías con firma histórica: %',r;end if;
 r:=public.guardia_sync(jsonb_build_object('accion','foto','dispositivo',dispositivo,'token',token,'ref',ref));
 if r->>'foto' is distinct from foto then raise exception 'No recuperó exactamente el adjunto';end if;
 r:=public.guardia_sync(jsonb_build_object('accion','consultar','dispositivo',dispositivo,'token','invalido'));
 if r->>'codigo'<>'sesion' then raise exception 'No rechazó el token inválido';end if;
 ms:=extract(epoch from clock_timestamp()-instante)*1000;
 raise notice 'Protocolo 2 verificado sobre 500 filas. Tiempo total: % ms',ms;
end;
$prueba$;
rollback;
