begin;
-- APLICAR_MIGRACION_AQUI
do $prueba$
declare e jsonb:=guardia_private.sync_vacio();obj uuid;tel text:=encode(extensions.gen_random_bytes(32),'hex');tok text:=encode(extensions.gen_random_bytes(32),'hex');personal text:=encode(extensions.gen_random_bytes(32),'hex');
 r jsonb; rev bigint;id text;datos jsonb;categoria text; invalido jsonb;rechazo boolean;antes integer;request jsonb;
begin
 e:=jsonb_set(e,'{guards}','[{"id":"corp-prueba","nombre":"Guardia Paseo","apellido":"","corporativo":true,"rol":"admin","cuenta":true},{"id":"guardia-prueba","nombre":"Ana","apellido":"Prueba","rol":"vigilador","cuenta":true},{"id":"baja-prueba","nombre":"Baja","apellido":"Prueba","rol":"vigilador","deleted":true}]');
 insert into guardia_private.documentos(cifrado) values(guardia_private.cifrar(e)) returning documentos.id,revision into obj,rev;
 insert into guardia_private.dispositivos(hash,objetivo) values(guardia_private.hash(tel),obj);
 insert into guardia_private.sesiones(hash,dispositivo,guardia) values(guardia_private.hash(tok),guardia_private.hash(tel),'corp-prueba'),(guardia_private.hash(personal),guardia_private.hash(tel),'guardia-prueba');
 execute 'set local role anon';
 foreach categoria in array array['NOVEDAD','RECORRIDO','ADICIONAL','INGRESO','EGRESO','APERTURA','CIERRE','EXTERNO','DESCANSO'] loop
  id:=gen_random_uuid()::text;datos:=jsonb_build_object('fecha','2026-11-06','hora','12:34','categoria',categoria,'guardId','guardia-prueba','texto','Control de prueba del sector.');
  request:=jsonb_build_object('accion','crear_asiento','dispositivo',tel,'token',tok,'revision',rev,'id',id,'datos',datos);
  r:=public.guardia_admin_rpc(request);
  if not coalesce((r->>'ok')::boolean,false) then raise exception 'No creó la novedad: %',r;end if;
  rev:=(r->>'revision')::bigint;
  r:=public.guardia_admin_rpc(request);
  if not coalesce((r->>'ok')::boolean,false) or (r->>'revision')::bigint<>rev then raise exception 'El reintento duplicó la novedad';end if;
 end loop;
 r:=public.guardia_admin_rpc(request||jsonb_build_object('id',gen_random_uuid()::text,'revision',rev-1));
 if r->>'codigo'<>'conflicto' then raise exception 'Aceptó una revisión anterior';end if;
 r:=public.guardia_admin_rpc(request||jsonb_build_object('id',gen_random_uuid()::text,'revision',rev,'token','invalido'));
 if r->>'codigo'<>'sesion' then raise exception 'Permitió crear sin sesión';end if;
 r:=public.guardia_admin_rpc(request||jsonb_build_object('id',gen_random_uuid()::text,'revision',rev,'token',personal));
 if r->>'codigo'<>'prohibido' then raise exception 'Permitió crear al vigilador desde el panel';end if;
 for invalido in select value from jsonb_array_elements(jsonb_build_array(
  datos||'{"texto":"   "}',datos||jsonb_build_object('texto',repeat('x',20001)),datos||'{"fecha":"2026-02-30"}',datos||'{"hora":"25:80"}',datos||'{"categoria":"inventada"}',datos||'{"guardId":"corp-prueba"}',datos||'{"guardId":"baja-prueba"}',datos||'{"guardId":"inexistente"}',datos||'{"createdBy":"otro"}',datos||'{"turnoId":"falso"}',datos||'{"fecha":null}',datos||'{"texto":{}}',datos-'guardId','[]'::jsonb)) loop
  rechazo:=false;
  begin perform public.guardia_admin_rpc(request||jsonb_build_object('id',gen_random_uuid()::text,'revision',rev,'datos',invalido));exception when others then rechazo:=true;end;
  if not rechazo then raise exception 'Aceptó datos inválidos: %',invalido;end if;
 end loop;
 r:=public.guardia_admin_rpc(jsonb_build_object('accion','editar_asiento','dispositivo',tel,'token',tok,'revision',rev,'col','novedades','id',id,'datos',jsonb_build_object('texto','Texto corregido desde el panel.')));
 if not coalesce((r->>'ok')::boolean,false) then raise exception 'No permite editar la novedad creada';end if;rev:=(r->>'revision')::bigint;
 r:=public.guardia_admin_rpc(request||jsonb_build_object('revision',rev));
 if r->>'codigo'<>'conflicto' then raise exception 'Un reintento reemplazó una edición posterior';end if;
 r:=public.guardia_rpc(jsonb_build_object('accion','consultar','dispositivo',tel,'token',personal));
 if not exists(select 1 from jsonb_array_elements(r#>'{estado,novedades}') x where x->>'id'=id and x->>'texto'='Texto corregido desde el panel.' and x->>'guardId'='guardia-prueba' and x->>'createdBy'='corp-prueba') then raise exception 'No aparece en el libro móvil con su firma';end if;
 r:=public.guardia_admin_rpc(jsonb_build_object('accion','eliminar_asiento','dispositivo',tel,'token',tok,'revision',rev,'col','novedades','id',id));
 if not coalesce((r->>'ok')::boolean,false) then raise exception 'No permite eliminar la novedad creada';end if;
 execute 'reset role';
 select guardia_private.abrir(cifrado) into e from guardia_private.documentos where documentos.id=obj;
 if jsonb_array_length(e->'novedades')<>9 or (select count(*) from jsonb_array_elements(e->'novedades') x where not coalesce((x->>'deleted')::boolean,false))<>8 then raise exception 'Cantidad incorrecta de novedades';end if;
 if jsonb_array_length(e->'punches')<>0 then raise exception 'El panel modificó actividades de teléfonos';end if;
 if (select count(*) from guardia_private.auditoria a where a.objetivo=obj and a.accion='crear_asiento')<>9 then raise exception 'La auditoría de altas no es exactamente una por novedad';end if;
 if (select count(*) from guardia_private.sync_filas f where f.objetivo=obj and f.col='novedades')<>9 then raise exception 'Las novedades no están disponibles para la sincronización móvil';end if;
end;
$prueba$;
rollback;
select 'CRUD de novedades web, firma, auditoría, permisos, validación, reintentos y visibilidad móvil verificados; ROLLBACK' as resultado;
