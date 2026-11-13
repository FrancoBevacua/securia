create function guardia_private.pin_coincide(obj uuid, id_guardia text, pin text) returns boolean
language sql stable set search_path='' as $$
 select coalesce((
  select extensions.crypt(guardia_private.identidad(guardia_private.hash(c.sal||':'||pin)),c.verificador)=c.verificador
  from guardia_private.credenciales c where c.objetivo=obj and c.guardia=id_guardia
 ),false);
$$;
revoke all on function guardia_private.pin_coincide(uuid,text,text) from public,anon,authenticated;

create function guardia_private.crear_administrador_pin(obj uuid,pin text) returns void
language plpgsql set search_path='' as $$
declare d guardia_private.documentos; e jsonb; corp jsonb; anterior jsonb; cuenta jsonb; sal_nueva text;
 id_admin constant text:='administrador-pin'; id_anterior text; instante bigint:=floor(extract(epoch from clock_timestamp())*1000);
begin
 if coalesce(pin,'') !~ '^[0-9]{6}$' then raise exception 'El PIN debe tener seis números';end if;
 select * into d from guardia_private.documentos where id=obj for update;
 e:=guardia_private.abrir(d.cifrado);
 select x into strict corp from jsonb_array_elements(e->'guards') x where coalesce((x->>'corporativo')::boolean,false) and not coalesce((x->>'deleted')::boolean,false);
 if guardia_private.pin_coincide(obj,corp->>'id',pin) then raise exception 'Elija un PIN distinto del PIN de Guardia de Paseo';end if;
 if exists(select 1 from jsonb_array_elements(e->'guards') x where x->>'id'=id_admin) then raise exception 'La cuenta independiente ya existe';end if;
 id_anterior:=corp->>'corporativoOrigenId';
 select x into anterior from jsonb_array_elements(e->'guards') x where x->>'id'=id_anterior and x->>'rol'='admin' and not coalesce((x->>'corporativo')::boolean,false);
 if anterior is not null and guardia_private.pin_coincide(obj,id_anterior,pin) then
  e:=jsonb_set(e,'{guards}',(select jsonb_agg(case when x->>'id'=id_anterior then x||jsonb_build_object('rol','vigilador','updatedAt',instante) else x end order by ord)
   from jsonb_array_elements(e->'guards') with ordinality f(x,ord)));
  -- El verificador personal anterior fue reemplazado. Invalidar el PIN administrativo en el perfil personal.
  update guardia_private.credenciales set verificador=extensions.crypt(encode(extensions.gen_random_bytes(32),'hex'),extensions.gen_salt('bf',12))
   where objetivo=obj and guardia=id_anterior;
  delete from guardia_private.sesiones s using guardia_private.dispositivos t where s.dispositivo=t.hash and t.objetivo=obj and s.guardia=id_anterior;
 end if;
 cuenta:=jsonb_build_object('id',id_admin,'rol','admin','cuenta',true,'nombre','Administrador','apellido','',
  'puestoId',coalesce(corp->>'puestoId',''),'franjaId',coalesce(corp->>'franjaId',''),'updatedAt',instante);
 e:=jsonb_set(e,'{guards}',(e->'guards')||jsonb_build_array(cuenta));
 sal_nueva:=encode(extensions.gen_random_bytes(16),'hex');
 insert into guardia_private.credenciales(objetivo,guardia,sal,verificador) values(obj,id_admin,sal_nueva,
  extensions.crypt(guardia_private.identidad(guardia_private.hash(sal_nueva||':'||pin)),extensions.gen_salt('bf',12)));
 insert into guardia_private.auditoria(objetivo,actor,accion,cifrado) values(obj,id_admin,'crear_administrador_pin',
  guardia_private.cifrar(jsonb_build_object('guardia',id_admin,'perfil_anterior',anterior->>'id')));
 update guardia_private.documentos set cifrado=guardia_private.cifrar(e),revision=d.revision+1,actualizado=now() where id=obj;
end;
$$;
revoke all on function guardia_private.crear_administrador_pin(uuid,text) from public,anon,authenticated;

do $migracion$
declare f text; ancla text; desde integer; hasta integer;
begin
 f:=replace(pg_get_functiondef('public.guardia_corporativo_rpc(jsonb)'::regprocedure),chr(13),'');
 desde:=strpos(f,' select x into g from jsonb_array_elements');
 hasta:=strpos(f,' if not coalesce(correcto,false) then');
 if desde=0 or hasta<=desde then raise exception 'No se encontró la verificación del PIN';end if;
 f:=substring(f,1,desde-1)||$b$
 select x into g from jsonb_array_elements(e->'guards') x
 where coalesce((x->>'corporativo')::boolean,false) and coalesce((x->>'cuenta')::boolean,false) and not coalesce((x->>'deleted')::boolean,false);
 correcto:=guardia_private.pin_coincide(doc.id,g->>'id',p_request->>'pin');
 select x into fila from jsonb_array_elements(e->'guards') x where x->>'id'='administrador-pin'
  and x->>'rol'='admin' and coalesce((x->>'cuenta')::boolean,false) and not coalesce((x->>'deleted')::boolean,false);
 if guardia_private.pin_coincide(doc.id,fila->>'id',p_request->>'pin') then
  g:=fila;
  correcto:=true;
 elsif p_request->>'solo_admin'='true' then
  correcto:=false;
 end if;
 actor:=g->>'id';
$b$||substring(f,hasta);
 ancla:=$a$original:=e;$a$;
 f:=replace(f,ancla,ancla||$b$
 if p_request->>'solo_admin'='true' then
  delete from guardia_private.sesiones where dispositivo=d.hash;
  token_nuevo:=encode(extensions.gen_random_bytes(32),'hex');
  insert into guardia_private.sesiones(hash,dispositivo,guardia) values(guardia_private.hash(token_nuevo),d.hash,actor);
  return jsonb_build_object('ok',true,'token',token_nuevo,'guardia',actor);
 end if;
 $b$);
 -- Una sesión administrativa no hereda rondas operativas.
 f:=replace(f,$a$and coalesce(x->>'createdBy',x->>'guardId')<>actor$a$,$b$and actor<>'administrador-pin' and coalesce(x->>'createdBy',x->>'guardId')<>actor$b$);
 execute f;

 f:=replace(pg_get_functiondef('public.guardia_admin_rpc(jsonb)'::regprocedure),chr(13),'');
 ancla:=$a$return jsonb_build_object('ok',false,'error','Ingrese el DNI y el PIN del administrador.');$a$;
 if strpos(f,ancla)=0 then raise exception 'No se encontró el acceso del panel';end if;
 execute replace(f,ancla,$b$acceso:=public.guardia_corporativo_rpc(p_request||jsonb_build_object('solo_admin',true));
   if coalesce((acceso->>'ok')::boolean,false) then
    update guardia_private.sesiones set vence=now()+interval '8 hours' where hash=guardia_private.hash(acceso->>'token');
    return jsonb_build_object('ok',true,'token',acceso->>'token');
   end if;
   return acceso;$b$);

 f:=replace(pg_get_functiondef('guardia_private.cambiar_pin_corporativo(jsonb)'::regprocedure),chr(13),'');
 ancla:=$a$sal_nueva:=encode(extensions.gen_random_bytes(16),'hex');$a$;
 execute replace(f,ancla,$b$if guardia_private.pin_coincide(d.objetivo,'administrador-pin',p->>'nuevo') then
  raise exception 'Elija un PIN distinto del PIN de administración';
 end if;
 $b$||ancla);

 f:=replace(pg_get_functiondef('public.guardia_rpc(jsonb)'::regprocedure),chr(13),'');
 ancla:=$a$if accion='cambiar_pin' then$a$;
 execute replace(f,ancla,ancla||$b$
  if actor='administrador-pin' and exists(select 1 from jsonb_array_elements(estado->'guards') x
   where coalesce((x->>'corporativo')::boolean,false) and guardia_private.pin_coincide(doc.id,x->>'id',p_request->>'nuevo')) then
   raise exception 'Elija un PIN distinto del PIN de Guardia de Paseo';
  end if;
 $b$);
end;
$migracion$;
notify pgrst,'reload schema';
