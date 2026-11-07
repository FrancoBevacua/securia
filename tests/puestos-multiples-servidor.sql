-- Ejecutar con la migración dentro de BEGIN / ROLLBACK: sólo datos ficticios.
do $prueba$
declare e jsonb; base jsonb; obj uuid; admin_tel text:=encode(extensions.gen_random_bytes(32),'hex');
 reg_tel text:=encode(extensions.gen_random_bytes(32),'hex'); admin_token text:=encode(extensions.gen_random_bytes(32),'hex');
 ids jsonb; perfil jsonb; r jsonb; reg jsonb; revision_actual bigint; rechazo boolean; originales integer;
begin
 select guardia_private.sync_vacio() into base;
 base:=jsonb_set(base,'{posts}','[{"id":"paseo-prueba","nombre":"Paseo","orden":0}]');
 base:=jsonb_set(base,'{franjas}','[{"id":"turno-prueba","puestoId":"paseo-prueba","nombre":"Mañana","entrada":"06:00","salida":"14:00"}]');
 base:=jsonb_set(base,'{guards}','[{"id":"admin-prueba","nombre":"Ana","apellido":"Prueba","rol":"admin","cuenta":true,"puestoId":"paseo-prueba","franjaId":"turno-prueba"}]');
 e:=guardia_private.completar_puestos_cobertura(base);
 if jsonb_array_length(e->'posts')<>3 or e is distinct from guardia_private.completar_puestos_cobertura(e) then raise exception 'Catálogo duplicado o incompleto';end if;
 if e->'guards' is distinct from base->'guards' then raise exception 'La actualización modificó las cuentas';end if;
 ids:='["paseo-prueba","securia:puesto:bicicletero","securia:puesto:franquero"]'::jsonb;
 insert into guardia_private.documentos(cifrado) values(guardia_private.cifrar(e)) returning id into obj;
 insert into guardia_private.dispositivos(hash,objetivo) values(guardia_private.hash(admin_tel),obj),(guardia_private.hash(reg_tel),obj);
 insert into guardia_private.sesiones(hash,dispositivo,guardia) values(guardia_private.hash(admin_token),guardia_private.hash(admin_tel),'admin-prueba');
 perfil:=jsonb_build_object('id','registro-prueba','apellido','Puestos','nombre','Prueba','dni','98765432','fechaNac','1990-01-01','sexo','masculino','foto','data:image/jpeg;base64,AA==','puestoId','paseo-prueba','puestoIds',ids,'franjaId','turno-prueba','rol','vigilador','cuenta',true);
 execute 'set local role anon';
 r:=public.guardia_rpc(jsonb_build_object('accion','registrar','dispositivo',reg_tel,'dni','98765432','pin','6382','perfil',perfil));
 execute 'reset role';
 if not coalesce((r->>'ok')::boolean,false) then raise exception 'Falló el registro: %',r;end if;
 select x into reg from jsonb_array_elements(r->'estado'->'guards') x where x->>'id'=r->>'guardia';
 if reg->'puestoIds' is distinct from ids or reg->>'puestoId'<>'paseo-prueba' or reg->>'rol'<>'vigilador' then raise exception 'El alta perdió puestos o alteró el rol';end if;
 -- El protocolo incremental entrega los tres puestos al segundo teléfono.
 execute 'set local role anon';
 r:=public.guardia_sync(jsonb_build_object('accion','consultar','dispositivo',reg_tel,'token',r->>'token','cursor',0));
 execute 'reset role';
 if not exists(select 1 from jsonb_array_elements(r->'filas') f where f->>'col'='guards' and f->>'id'=reg->>'id' and f->'valor'->'puestoIds'=ids) then raise exception 'La sincronización perdió las asignaciones';end if;
 select revision into revision_actual from guardia_private.documentos where id=obj;
 execute 'set local role anon';
 r:=public.guardia_admin_rpc(jsonb_build_object('accion','editar_cuenta','dispositivo',admin_tel,'token',admin_token,'id',reg->>'id','revision',revision_actual,'datos',jsonb_build_object('puestoIds',ids-'securia:puesto:franquero')));
 execute 'reset role';
 if not coalesce((r->>'ok')::boolean,false) then raise exception 'Falló la edición de puestos: %',r;end if;
 select x into reg from guardia_private.documentos d cross join lateral jsonb_array_elements(guardia_private.abrir(d.cifrado)->'guards') x where d.id=obj and x->>'id'=reg->>'id';
 if jsonb_array_length(reg->'puestoIds')<>2 then raise exception 'No se guardó la edición administrativa';end if;
 for ids in select value from jsonb_array_elements('["texto",["inexistente"],["paseo-prueba","paseo-prueba"],[12]]'::jsonb) loop
  rechazo:=false;
  begin perform guardia_private.validar_puestos_guardia(jsonb_build_object('puestoIds',ids),e);
  exception when others then rechazo:=true;end;
  if not rechazo then raise exception 'Aceptó una lista de puestos inválida: %',ids;end if;
 end loop;
 if has_function_privilege('anon','guardia_private.validar_puestos_guardia(jsonb,jsonb)','EXECUTE')
 or has_function_privilege('authenticated','guardia_private.completar_puestos_cobertura(jsonb)','EXECUTE') then raise exception 'Las funciones internas quedaron expuestas';end if;
end;
$prueba$;
