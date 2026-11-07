-- Prueba del RPC real con datos ficticios; no conserva cambios.
begin;
do $prueba$
declare objetivo uuid; dispositivo text:=encode(extensions.gen_random_bytes(32),'hex'); token text:=encode(extensions.gen_random_bytes(32),'hex');
base jsonb:=$base${"rev":0,"updatedAt":0,"site":{"cliente":"Prueba transaccional de nube","region":"","nombre":"","prefijo":"Gs","alogLibro":false,"precintoPrefijo":"","corteInforme":"19"},"posts":[{"id":"p","nombre":"Paseo","orden":0}],"franjas":[{"id":"f","puestoId":"p","nombre":"Mañana","entrada":"07:00","salida":"15:00","orden":0}],"guards":[{"id":"nube-test-a","nombre":"Ana","apellido":"Prueba","cuenta":true,"dni":"12345678","legajo":"","rol":"admin","puestoId":"p","franjaId":"f","fechaNac":"1990-01-01","foto":"data:image/jpeg;base64,AA=="},{"id":"nube-test-b","nombre":"Bruno","apellido":"Prueba","cuenta":true,"dni":"","legajo":"","rol":"vigilador","puestoId":"p","franjaId":"f","fechaNac":"1990-01-01","foto":"data:image/jpeg;base64,AA=="}],"directives":[],"dlogs":[],"accesses":[],"alogs":[],"reports":[{"id":"informe-prueba","texto":"Texto corporativo conservado","fotos":["data:image/jpeg;base64,AA=="]}],"novedades":[],"visits":[],"rounds":[],"rtemplates":[],"shifts":[],"punches":[],"contacts":[],"infdias":[],"locales":[],"recorridos":[],"envios":[]}$base$::jsonb;
nuevo jsonb; malo jsonb; extra jsonb; r jsonb; rechazo boolean;
begin
 nuevo:=jsonb_set(base,'{guards}',(base->'guards')||'[{"id":"persona-nueva","apellido":"Prueba","nombre":"Carla","cuenta":false,"rol":"vigilador"}]'::jsonb);
 nuevo:=jsonb_set(nuevo,'{accesses}','[{"id":"acceso-nuevo","nombre":"Puerta de prueba"}]'::jsonb);
 insert into guardia_private.documentos(cifrado) values(guardia_private.cifrar(base)) returning id into objetivo;
 insert into guardia_private.dispositivos(hash,objetivo) values(guardia_private.hash(dispositivo),objetivo);
 insert into guardia_private.sesiones(hash,dispositivo,guardia) values(guardia_private.hash(token),guardia_private.hash(dispositivo),'nube-test-b');
 execute 'set local role anon';
 r:=public.guardia_rpc(jsonb_build_object('accion','guardar','dispositivo',dispositivo,'token','invalido','estado',nuevo,'revision',1));
 if (r->>'ok')::boolean then raise exception 'Aceptó sesión inválida';end if;
 for extra in select value from jsonb_array_elements('[{"cuenta":true},{"rol":"admin"},{"dni":"12345678"},{"pin":"1234"}]'::jsonb) loop
  malo:=jsonb_set(nuevo,'{guards,2}',(nuevo#>'{guards,2}')||extra);rechazo:=false;
  begin
   perform public.guardia_rpc(jsonb_build_object('accion','guardar','dispositivo',dispositivo,'token',token,'estado',malo,'revision',1));
  exception when others then
   if position('cuenta' in SQLERRM)=0 and position('PIN dentro del perfil' in SQLERRM)=0 then raise;end if;rechazo:=true;
  end;
  if not rechazo then raise exception 'Permitió crear credenciales o elevar roles';end if;
 end loop;
 r:=public.guardia_rpc(jsonb_build_object('accion','guardar','dispositivo',dispositivo,'token',token,'estado',nuevo,'revision',1));
 if not (r->>'ok')::boolean then raise exception 'No permitió altas operativas: %',r;end if;
 malo:=jsonb_set(nuevo,'{accesses,0,nombre}','"Modificación no autorizada"'::jsonb);rechazo:=false;
 begin
  perform public.guardia_rpc(jsonb_build_object('accion','guardar','dispositivo',dispositivo,'token',token,'estado',malo,'revision',2));
 exception when others then
  if position('administración' in SQLERRM)=0 then raise;end if;rechazo:=true;
 end;
 if not rechazo then raise exception 'Permitió editar acceso existente';end if;
 r:=public.guardia_rpc(jsonb_build_object('accion','consultar','dispositivo',dispositivo,'token',token));
 if not (r->>'ok')::boolean or r->'estado' is distinct from nuevo or (r->>'revision')::bigint<>2 then raise exception 'Estado o revisión inesperados';end if;
 execute 'reset role';
end;$prueba$;
rollback;
select 'Altas operativas autenticadas, rechazo de credenciales, roles y edición de accesos; ROLLBACK completo' as resultado,
 (select count(*) from guardia_private.documentos) as objetivos,
 (select sum(revision) from guardia_private.documentos) as revision_total;
