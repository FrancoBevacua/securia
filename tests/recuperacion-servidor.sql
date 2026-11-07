begin;
do $prueba$
declare objetivo uuid; dispositivo text:=encode(extensions.gen_random_bytes(32),'hex'); token text:=encode(extensions.gen_random_bytes(32),'hex');
base jsonb:=$base${"rev":0,"updatedAt":0,"site":{"cliente":"Prueba transaccional de nube","region":"","nombre":"","prefijo":"Gs","alogLibro":false,"precintoPrefijo":"","corteInforme":"19"},"posts":[{"id":"p","nombre":"Paseo","orden":0}],"franjas":[{"id":"f","puestoId":"p","nombre":"Mañana","entrada":"07:00","salida":"15:00","orden":0}],"guards":[{"id":"nube-test-a","nombre":"Ana","apellido":"Prueba","cuenta":true,"dni":"12345678","legajo":"","rol":"admin","puestoId":"p","franjaId":"f","fechaNac":"1990-01-01","foto":"data:image/jpeg;base64,AA=="},{"id":"nube-test-b","nombre":"Bruno","apellido":"Prueba","cuenta":true,"dni":"","legajo":"","rol":"vigilador","puestoId":"p","franjaId":"f","fechaNac":"1990-01-01","foto":"data:image/jpeg;base64,AA=="}],"directives":[],"dlogs":[],"accesses":[],"alogs":[],"reports":[{"id":"informe-prueba","texto":"Texto corporativo conservado","fotos":["data:image/jpeg;base64,AA=="]}],"novedades":[],"visits":[],"rounds":[],"rtemplates":[],"shifts":[],"punches":[{"id":"turno-cerrado","guardId":"nube-test-a","out":"19:00","closedAt":2}],"contacts":[],"infdias":[],"locales":[],"recorridos":[],"envios":[]}$base$::jsonb; telefono jsonb:=$telefono${"rev":0,"updatedAt":0,"site":{"cliente":"Prueba transaccional de nube","region":"","nombre":"","prefijo":"Gs","alogLibro":false,"precintoPrefijo":"","corteInforme":"19"},"posts":[{"id":"p","nombre":"Paseo","orden":0}],"franjas":[{"id":"f","puestoId":"p","nombre":"Mañana","entrada":"07:00","salida":"15:00","orden":0}],"guards":[{"id":"nube-test-a","nombre":"Ana","apellido":"Prueba","cuenta":true,"dni":"12345678","legajo":"","rol":"admin","puestoId":"p","franjaId":"f","fechaNac":"1990-01-01","foto":"data:image/jpeg;base64,AA=="},{"id":"nube-test-b","nombre":"Bruno","apellido":"Prueba","cuenta":true,"dni":"","legajo":"","rol":"vigilador","puestoId":"p","franjaId":"f","fechaNac":"1990-01-01","foto":"data:image/jpeg;base64,AA=="}],"directives":[],"dlogs":[],"accesses":[],"alogs":[],"reports":[{"id":"informe-prueba","texto":"Otra versión del teléfono","fotos":["data:image/jpeg;base64,AA=="]},{"id":"nuevo-prueba","texto":"Informe nuevo recuperado","fotos":["data:image/jpeg;base64,BB=="]}],"novedades":[{"id":"nota-prueba","guardId":"nube-test-a","createdBy":"nube-test-a","turnoId":"turno-cerrado","texto":"Novedad de turno cerrado preservada"}],"visits":[],"rounds":[],"rtemplates":[],"shifts":[],"punches":[{"id":"turno-cerrado","guardId":"nube-test-a","out":"19:00","closedAt":2}],"contacts":[],"infdias":[],"locales":[],"recorridos":[],"envios":[]}$telefono$::jsonb;
r jsonb; repetido jsonb; respaldo jsonb; id_respaldo uuid; ultima_revision bigint;
begin
 insert into guardia_private.documentos(cifrado) values(guardia_private.cifrar(base)) returning id into objetivo;
 insert into guardia_private.dispositivos(hash,objetivo) values(guardia_private.hash(dispositivo),objetivo);
 insert into guardia_private.sesiones(hash,dispositivo,guardia) values(guardia_private.hash(token),guardia_private.hash(dispositivo),'nube-test-a');
 if has_table_privilege('anon','guardia_private.recuperaciones','select') or has_table_privilege('anon','guardia_private.recuperaciones','insert') then raise exception 'Tabla accesible directamente'; end if;
 execute 'set local role anon';
 r:=public.guardia_recuperacion(jsonb_build_object('accion','recuperar','dispositivo',dispositivo,'token','invalido','estado',telefono));
 if (r->>'ok')::boolean then raise exception 'Aceptó token incorrecto'; end if;
 r:=public.guardia_recuperacion(jsonb_build_object('accion','recuperar','dispositivo',dispositivo,'token',token,'estado',telefono));
 if not (r->>'ok')::boolean or (r->>'incorporados')::integer<>1 or (r->>'resguardados')::integer<>2 then raise exception 'Recuperación incorrecta: %',r-'estado'; end if;
 if r#>>'{estado,reports,0,texto}'<>'Texto corporativo conservado' then raise exception 'Sobrescribió un dato'; end if;
 id_respaldo:=(r->>'id')::uuid;ultima_revision:=(r->>'revision')::bigint;
 repetido:=public.guardia_recuperacion(jsonb_build_object('accion','recuperar','dispositivo',dispositivo,'token',token,'estado',telefono));
 if repetido->>'id'<>r->>'id' or repetido->>'revision'<>r->>'revision' then raise exception 'Reintento no idempotente'; end if;
 respaldo:=public.guardia_recuperacion(jsonb_build_object('accion','leer','dispositivo',dispositivo,'token',token,'id',id_respaldo));
 if respaldo#>'{respaldo,telefono}' is distinct from telefono or respaldo#>'{respaldo,nube}' is distinct from base then raise exception 'Respaldo incompleto'; end if;
 r:=public.guardia_recuperacion(jsonb_build_object('accion','reiniciar_sesion','dispositivo',dispositivo,'token',token));
 if not (r->>'ok')::boolean then raise exception 'No reinició sesión'; end if;
 r:=public.guardia_recuperacion(jsonb_build_object('accion','listar','dispositivo',dispositivo,'token',token));
 if (r->>'ok')::boolean then raise exception 'Sesión revocada aún válida'; end if;
 execute 'reset role';
 if not exists(select 1 from guardia_private.recuperaciones where id=id_respaldo and guardia_private.abrir(cifrado)->'telefono'=telefono and position('Otra versión del teléfono' in encode(cifrado,'escape'))=0) then raise exception 'Cifrado incorrecto'; end if;
 if (select revision from guardia_private.documentos where id=objetivo)<>ultima_revision then raise exception 'Reiniciar modificó documento'; end if;
end;
$prueba$;
rollback;
select 'Pruebas transaccionales correctas; ROLLBACK completo' as resultado,
 (select count(*) from guardia_private.documentos) as objetivos,
 (select count(*) from guardia_private.recuperaciones) as respaldos,
 (select count(*) from guardia_private.sesiones where vence>now()) as sesiones_vigentes;
