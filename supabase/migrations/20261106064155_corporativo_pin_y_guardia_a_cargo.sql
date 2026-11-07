-- Cuenta del corporativo separada del perfil personal y del autor de cada registro.
-- Se reutiliza el verificador existente: esta migración no contiene ningún PIN.
create or replace function guardia_private.validar_corporativo(a jsonb,b jsonb,actor text) returns void
language plpgsql set search_path='' as $$
declare nuevo jsonb; anterior jsonb; cuenta jsonb; c text;
begin
 for nuevo in select value from jsonb_array_elements(b->'guards') loop
  select x into anterior from jsonb_array_elements(a->'guards') x where x->>'id'=nuevo->>'id';
  if nuevo=anterior then continue;end if;
  if coalesce((nuevo->>'corporativo')::boolean,false) is distinct from coalesce((anterior->>'corporativo')::boolean,false) then raise exception 'La identidad del corporativo se administra en el servidor';end if;
  if coalesce((anterior->>'corporativo')::boolean,false) and
   (nuevo-array['puestoId','puestoIds','puesto','franjaId','horaIn','horaOut','updatedAt']) is distinct from
   (anterior-array['puestoId','puestoIds','puesto','franjaId','horaIn','horaOut','updatedAt']) then raise exception 'La cuenta del corporativo sólo admite cambiar su PIN y puesto de referencia';end if;
 end loop;
 select x into cuenta from jsonb_array_elements(a->'guards') x where x->>'id'=actor;
 if not coalesce((cuenta->>'corporativo')::boolean,false) then return;end if;
 for nuevo in select value from jsonb_array_elements(b->'punches') loop
  if not exists(select 1 from jsonb_array_elements(a->'punches') x where x->>'id'=nuevo->>'id') and not coalesce((nuevo->>'deleted')::boolean,false) then
   if not exists(select 1 from jsonb_array_elements(b->'guards') x where x->>'id'=nuevo->>'responsableId' and not coalesce((x->>'deleted')::boolean,false) and not coalesce((x->>'corporativo')::boolean,false)) then raise exception 'Seleccione el guardia a cargo del corporativo';end if;
  end if;
 end loop;
 foreach c in array array['novedades','alogs','rounds'] loop
  for nuevo in select value from jsonb_array_elements(b->c) loop
   select x into anterior from jsonb_array_elements(a->c) x where x->>'id'=nuevo->>'id';
   if nuevo=anterior or coalesce((nuevo->>'deleted')::boolean,false) then continue;end if;
   if exists(select 1 from jsonb_array_elements(b->'guards') x where x->>'id'=nuevo->>'guardId' and coalesce((x->>'corporativo')::boolean,false)) then raise exception 'La firma del registro debe identificar a un guardia del equipo';end if;
  end loop;
 end loop;
end; $$;
revoke all on function guardia_private.validar_corporativo(jsonb,jsonb,text) from public,anon,authenticated;

create or replace function public.guardia_corporativo_rpc(p_request jsonb) returns jsonb
language plpgsql security definer set search_path='' set statement_timeout='45s' as $$
declare d guardia_private.dispositivos; doc guardia_private.documentos; cred guardia_private.credenciales;
 e jsonb; original jsonb; g jsonb; fila jsonb; actor text; token_nuevo text; correcto boolean; numero_intentos integer;
 instante bigint:=floor(extract(epoch from clock_timestamp())*1000); fecha text:=to_char(now() at time zone 'America/Argentina/Buenos_Aires','YYYY-MM-DD');
 hora text:=to_char(now() at time zone 'America/Argentina/Buenos_Aires','HH24:MI'); cerrados text[]:='{}';
begin
 if octet_length(p_request::text)>4096 or coalesce(p_request->>'dispositivo','')!~'^[a-f0-9]{64}$' then return jsonb_build_object('ok',false,'error','Teléfono no vinculado.');end if;
 if p_request->>'accion'<>'ingresar' then return jsonb_build_object('ok',false,'error','Operación no disponible.');end if;
 if coalesce(p_request->>'pin','')!~'^[0-9]{6}$' then return jsonb_build_object('ok',false,'error','Ingrese el PIN de seis números del corporativo.');end if;
 select * into d from guardia_private.dispositivos where hash=guardia_private.hash(p_request->>'dispositivo') and not revocado for update;
 if d.hash is null then return jsonb_build_object('ok',false,'error','Teléfono no vinculado.');end if;
 if d.bloqueado_hasta>now() then return jsonb_build_object('ok',false,'error','Demasiados intentos. Espere un minuto.');end if;
 select * into doc from guardia_private.documentos where id=d.objetivo for update;
 e:=guardia_private.abrir(doc.cifrado);
 select x into g from jsonb_array_elements(e->'guards') x where coalesce((x->>'corporativo')::boolean,false) and x->>'rol'='admin' and coalesce((x->>'cuenta')::boolean,false) and not coalesce((x->>'deleted')::boolean,false);
 if g is null then return jsonb_build_object('ok',false,'error','La cuenta del corporativo todavía no está preparada.');end if;
 actor:=g->>'id';select * into cred from guardia_private.credenciales where objetivo=doc.id and guardia=actor;
 correcto:=cred.guardia is not null and extensions.crypt(guardia_private.identidad(guardia_private.hash(cred.sal||':'||(p_request->>'pin'))),cred.verificador)=cred.verificador;
 if not coalesce(correcto,false) then
  numero_intentos:=d.intentos+1;
  update guardia_private.dispositivos set intentos=case when numero_intentos>=5 then 0 else numero_intentos end,bloqueado_hasta=case when numero_intentos>=5 then now()+interval '1 minute' else null end where hash=d.hash;
  return jsonb_build_object('ok',false,'error','PIN incorrecto.');
 end if;
 update guardia_private.dispositivos set intentos=0,bloqueado_hasta=null where hash=d.hash;
 original:=e;
 -- Sólo el teléfono que inicia sesión realiza su traspaso. Otros teléfonos continúan su actividad.
 select coalesce(array_agg(x->>'id'),'{}') into cerrados from jsonb_array_elements(e->'punches') x
  where x->>'dispositivoId'=d.hash and x->>'guardId'<>actor and coalesce(x->>'out','')='' and coalesce(x->>'closedAt','')='' and not coalesce((x->>'deleted')::boolean,false);
 if cardinality(cerrados)>0 then
  e:=jsonb_set(e,'{punches}',(select coalesce(jsonb_agg(case when x->>'id'=any(cerrados) then x||jsonb_build_object('out',hora,'fechaOut',fecha,'closedAt',instante,'cierre','Inicio de sesión del corporativo','updatedAt',instante) else x end),'[]') from jsonb_array_elements(e->'punches') x));
  foreach actor in array array['novedades','alogs'] loop
   e:=jsonb_set(e,array[actor],(select coalesce(jsonb_agg(case when x->>'turnoId'=any(cerrados) then x||jsonb_build_object('lockedAt',instante,'updatedAt',instante) else x end),'[]') from jsonb_array_elements(e->actor) x));
  end loop;
  actor:=g->>'id';
 end if;
 e:=jsonb_set(e,'{rounds}',(select coalesce(jsonb_agg(case when x->>'dispositivoId'=d.hash and coalesce(x->>'fin','')='' and not coalesce((x->>'deleted')::boolean,false) and coalesce(x->>'createdBy',x->>'guardId')<>actor then x||jsonb_build_object('migradoDesdeActor',coalesce(x->>'createdBy',x->>'guardId'),'createdBy',actor,'updatedAt',instante) else x end),'[]') from jsonb_array_elements(e->'rounds') x));
 if e is distinct from original then
  insert into guardia_private.auditoria(objetivo,actor,accion,cifrado) values(doc.id,actor,'inicio_corporativo',guardia_private.cifrar(jsonb_build_object('anterior',original,'nuevo',e)));
  update guardia_private.documentos set cifrado=guardia_private.cifrar(e),revision=revision+1,actualizado=now() where id=doc.id returning * into doc;
 end if;
 delete from guardia_private.sesiones where dispositivo=d.hash;
 token_nuevo:=encode(extensions.gen_random_bytes(32),'hex');
 insert into guardia_private.sesiones(hash,dispositivo,guardia) values(guardia_private.hash(token_nuevo),d.hash,actor);
 return jsonb_build_object('ok',true,'token',token_nuevo,'guardia',actor,'estado',e,'revision',doc.revision);
end; $$;
revoke all on function public.guardia_corporativo_rpc(jsonb) from public;
grant execute on function public.guardia_corporativo_rpc(jsonb) to anon,authenticated;

do $funciones$
declare f text; ancla text;
begin
 select pg_get_functiondef('guardia_private.validar_cambios(jsonb,jsonb,text)'::regprocedure) into f;
 ancla:='perform guardia_private.validar_formato(b);';
 if position(ancla in f)=0 then raise exception 'No se encontró la validación de cambios';end if;
 execute replace(f,ancla,ancla||' perform guardia_private.validar_corporativo(a,b,actor);');
 select pg_get_functiondef('public.guardia_rpc(jsonb)'::regprocedure) into f;
 ancla:=$a$perfil:=p_request->'perfil';$a$;
 if position(ancla in f)=0 then raise exception 'No se encontró el registro de perfiles';end if;
 f:=replace(f,ancla,ancla||$a$ if coalesce((perfil->>'corporativo')::boolean,false) then raise exception 'La cuenta del corporativo se administra en el servidor';end if; $a$);
 ancla:=$a$if accion='cambiar_pin' then$a$;
 if position(ancla in f)=0 then raise exception 'No se encontró el cambio de PIN';end if;
 execute replace(f,ancla,ancla||$a$
  if exists(select 1 from jsonb_array_elements(estado->'guards') x where x->>'id'=actor and coalesce((x->>'corporativo')::boolean,false)) and coalesce(p_request->>'nuevo','')!~'^[0-9]{6}$' then raise exception 'El PIN del corporativo debe tener seis números';end if;
 $a$);
 select pg_get_functiondef('public.guardia_admin_rpc(jsonb)'::regprocedure) into f;
 ancla:=$a$if accion='ingresar' then$a$;
 if position(ancla in f)=0 then raise exception 'No se encontró el acceso del panel';end if;
 f:=replace(f,ancla,ancla||$a$
  if coalesce(p_request->>'dni','')='' then
   acceso:=public.guardia_corporativo_rpc(p_request);
   if coalesce((acceso->>'ok')::boolean,false) then
    update guardia_private.sesiones set vence=now()+interval '8 hours' where hash=guardia_private.hash(acceso->>'token');
    return jsonb_build_object('ok',true,'token',acceso->>'token');
   end if;
   return acceso;
  end if;
 $a$);
 ancla:=$a$cambio:=coalesce(p_request->'datos','{}'::jsonb);$a$;
 if position(ancla in f)=0 then raise exception 'No se encontró la edición del panel';end if;
 f:=replace(f,ancla,ancla||$a$
  if accion in ('editar_cuenta','eliminar_cuenta') and exists(select 1 from jsonb_array_elements(e->'guards') x where x->>'id'=registro and coalesce((x->>'corporativo')::boolean,false)) then raise exception 'La cuenta del corporativo se administra desde su PIN';end if;
 $a$);execute f;
end;
$funciones$;

do $cuenta$
declare d record; e jsonb; anterior jsonb; origen jsonb; cuenta jsonb; cred guardia_private.credenciales; puesto jsonb; franja jsonb; nuevo_id text;
 instante bigint:=floor(extract(epoch from clock_timestamp())*1000);
begin
 for d in select * from guardia_private.documentos for update loop
  e:=guardia_private.abrir(d.cifrado);
  if exists(select 1 from jsonb_array_elements(e->'guards') x where coalesce((x->>'corporativo')::boolean,false) and not coalesce((x->>'deleted')::boolean,false)) then continue;end if;
  select x into origen from jsonb_array_elements(e->'guards') x where lower(trim(x->>'nombre'))='franco' and lower(trim(x->>'apellido'))='bevacua' and x->>'rol'='admin' and not coalesce((x->>'deleted')::boolean,false);
  if origen is null then continue;end if;
  select * into cred from guardia_private.credenciales where objetivo=d.id and guardia=origen->>'id';
  if cred.guardia is null then raise exception 'La cuenta original no tiene verificador de PIN';end if;
  select x into puesto from jsonb_array_elements(e->'posts') x where lower(trim(x->>'nombre'))='paseo' and not coalesce((x->>'deleted')::boolean,false);
  if puesto is null then raise exception 'No se encontró el puesto Paseo';end if;
  select x into franja from jsonb_array_elements(e->'franjas') x where x->>'puestoId'=puesto->>'id' and not coalesce((x->>'deleted')::boolean,false) order by (x->>'orden')::integer nulls last limit 1;
  anterior:=e;nuevo_id:=gen_random_uuid()::text;
  cuenta:=jsonb_build_object('id',nuevo_id,'nombre','Guardia Paseo','apellido','','corporativo',true,'corporativoOrigenId',origen->>'id','rol','admin','cuenta',true,'puestoId',puesto->>'id','puesto','Paseo','puestoIds',jsonb_build_array(puesto->>'id'),'franjaId',coalesce(franja->>'id',''),'horaIn',coalesce(franja->>'entrada',''),'horaOut',coalesce(franja->>'salida',''),'updatedAt',instante);
  e:=jsonb_set(e,'{guards}',(select jsonb_agg(case when x->>'id'=origen->>'id' then x||jsonb_build_object('rol','vigilador','updatedAt',instante) else x end) from jsonb_array_elements(e->'guards') x)||jsonb_build_array(cuenta));
  perform guardia_private.validar_formato(e);
  insert into guardia_private.credenciales(objetivo,guardia,dni_hmac,sal,verificador) values(d.id,nuevo_id,null,cred.sal,cred.verificador);
  insert into guardia_private.auditoria(objetivo,actor,accion,cifrado) values(d.id,origen->>'id','crear_cuenta_corporativo',guardia_private.cifrar(jsonb_build_object('anterior',anterior,'nuevo',e)));
  update guardia_private.documentos set cifrado=guardia_private.cifrar(e),revision=revision+1,actualizado=now() where id=d.id;
 end loop;
end;
$cuenta$;
notify pgrst,'reload schema';
