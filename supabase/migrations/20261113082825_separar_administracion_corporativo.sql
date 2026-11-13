-- Activación desde SQL autorizado. El PIN se suministra como parámetro y sólo se guarda el verificador.
create function guardia_private.activar_administrador(obj uuid, id_guardia text, pin text) returns void
language plpgsql set search_path='' as $$
declare d guardia_private.documentos; e jsonb; g jsonb; sal_nueva text;
begin
 if coalesce(pin,'') !~ '^[0-9]{6}$' then raise exception 'El PIN debe tener seis dígitos'; end if;
 select * into d from guardia_private.documentos where id=obj for update;
 e:=guardia_private.abrir(d.cifrado);
 select x into g from jsonb_array_elements(e->'guards') x where x->>'id'=id_guardia
  and coalesce((x->>'cuenta')::boolean,false) and not coalesce((x->>'deleted')::boolean,false)
  and not coalesce((x->>'corporativo')::boolean,false);
 if g is null or not exists(select 1 from guardia_private.credenciales where objetivo=obj and guardia=id_guardia and dni_hmac is not null) then
  raise exception 'Seleccione una cuenta personal activa con DNI';
 end if;
 sal_nueva:=encode(extensions.gen_random_bytes(16),'hex');
 update guardia_private.credenciales set sal=sal_nueva,
  verificador=extensions.crypt(guardia_private.identidad(guardia_private.hash(sal_nueva||':'||pin)),extensions.gen_salt('bf',12))
  where objetivo=obj and guardia=id_guardia;
 delete from guardia_private.sesiones s using guardia_private.dispositivos t where s.dispositivo=t.hash and t.objetivo=obj and s.guardia=id_guardia;
 insert into guardia_private.auditoria(objetivo,actor,accion,cifrado)
  values(obj,id_guardia,'activar_administrador',guardia_private.cifrar(jsonb_build_object('guardia',id_guardia)));
 update guardia_private.documentos set cifrado=guardia_private.cifrar(jsonb_set(e,'{guards}',(
  select jsonb_agg(case when x->>'id'=id_guardia then x||jsonb_build_object('rol','admin','updatedAt',floor(extract(epoch from clock_timestamp())*1000)) else x end order by ord)
  from jsonb_array_elements(e->'guards') with ordinality f(x,ord)
 ))),revision=d.revision+1,actualizado=now() where id=obj;
end;
$$;
revoke all on function guardia_private.activar_administrador(uuid,text,text) from public,anon,authenticated;

do $migracion$
declare f text; ancla text; nombre text;
begin
 foreach nombre in array array['validar_cambios','validar_cambios_sync'] loop
  f:=replace(pg_get_functiondef(('guardia_private.'||nombre||'(jsonb,jsonb,text)')::regprocedure),chr(13),'');
  f:=replace(f,$a$administrador := g->>'rol'='admin';$a$,$b$administrador := coalesce(g->>'rol'='admin',false) and not coalesce((g->>'corporativo')::boolean,false);
  if not administrador and a->'site' is distinct from b->'site' then raise exception 'Configuración exclusiva de administración';end if;$b$);
  f:=replace(f,$a$c in ('posts','franjas','directives','rtemplates','shifts')$a$,$b$c in ('posts','franjas','directives','rtemplates','shifts','accesses','contacts','envios')$b$);
  ancla:=$a$if coalesce(anterior->>'createdBy',anterior->>'guardId','')<>actor$a$;
  if position(ancla in f)=0 then raise exception 'Falta la validación de autoría';end if;
  f:=replace(f,ancla,replace(ancla,'if ','if not administrador and ('));
  f:=replace(f,$a$ then
         raise exception 'El registro pertenece a otro guardia o a un turno cerrado';$a$,$b$) then
         raise exception 'El registro pertenece a otro guardia o a un turno cerrado';$b$);
  ancla:=$a$if c='punches' then
       if anterior$a$;
  if position(ancla in f)=0 then raise exception 'Falta la validación de cambios existentes';end if;
  f:=replace(f,ancla,$b$if c='reports' and ((not administrador and anterior->>'createdBy' is distinct from actor) or nuevo->>'createdBy' is distinct from anterior->>'createdBy') then
       raise exception 'No se puede modificar el informe de otro guardia ni cambiar su autor';
     end if;
     if c in ('novedades','alogs') and nuevo->>'lockedAt' is distinct from anterior->>'lockedAt'
      and (administrador and coalesce(anterior->>'createdBy',anterior->>'guardId') is distinct from actor) then
       raise exception 'No se puede cambiar el cierre de un registro ajeno';
     end if;
     if c='guards' and not administrador and coalesce((nuevo->>'deleted')::boolean,false) then
       raise exception 'Esta configuración requiere administración';
     end if;
     $b$||ancla);
  ancla:=$a$if c='guards' then
       if coalesce((nuevo->>'cuenta')::boolean,false)$a$;
  if position(ancla in f)=0 then raise exception 'Falta la validación de altas de guardias';end if;
  f:=replace(f,ancla,$b$if c='reports' and nuevo->>'createdBy' is distinct from actor then raise exception 'El informe debe conservar su autor';end if;
     if c='guards' then
       if not administrador then raise exception 'Esta configuración requiere administración';end if;
       if coalesce((nuevo->>'cuenta')::boolean,false)$b$);
  execute f;
 end loop;

 f:=replace(pg_get_functiondef('guardia_private.validar_telefono(jsonb,jsonb,text,text)'::regprocedure),chr(13),'');
 ancla:=$a$select x into actividad from jsonb_array_elements(b->'punches') x where x->>'id'=fila->>'turnoId';$a$;
 if position(ancla in f)=0 then raise exception 'Falta la validación de teléfono';end if;
 execute replace(f,ancla,$b$if anterior is not null and exists(select 1 from jsonb_array_elements(a->'guards') g
    where g->>'id'=actor and g->>'rol'='admin' and not coalesce((g->>'corporativo')::boolean,false)
     and not coalesce((g->>'deleted')::boolean,false)) then continue;end if;
    $b$||ancla);

 f:=replace(pg_get_functiondef('public.guardia_rpc(jsonb)'::regprocedure),chr(13),'');
 ancla:=$a$es_ok:=es_ok and perfil is not null;$a$;
 if position(ancla in f)=0 then raise exception 'Falta la validación del ingreso';end if;
 f:=replace(f,ancla,ancla||$b$
       if accion in ('ingresar','vincular_cuenta') then
        es_ok:=es_ok and (coalesce(p_request->>'administracion','')='true') =
          (coalesce(perfil->>'rol'='admin',false) and not coalesce((perfil->>'corporativo')::boolean,false));
        if p_request->>'administracion'='true' then es_ok:=es_ok and p_request->>'pin' ~ '^[0-9]{6}$';end if;
       end if;$b$);
 ancla:=$a$if accion='cambiar_pin' then$a$;
 f:=replace(f,ancla,ancla||$b$
  if exists(select 1 from jsonb_array_elements(estado->'guards') g where g->>'id'=actor and coalesce((g->>'corporativo')::boolean,false)) then raise exception 'Sólo administración puede cambiar el PIN del corporativo';end if;
  if exists(select 1 from jsonb_array_elements(estado->'guards') g where g->>'id'=actor and g->>'rol'='admin') and coalesce(p_request->>'nuevo','') !~ '^[0-9]{6}$' then raise exception 'El PIN de administrador debe tener seis números';end if;
 $b$);
 execute f;

 f:=replace(pg_get_functiondef('public.guardia_corporativo_rpc(jsonb)'::regprocedure),chr(13),'');
 ancla:=$a$if p_request->>'accion'<>'ingresar' then$a$;
 if position(ancla in f)=0 then raise exception 'Falta el ingreso del corporativo';end if;
 f:=replace(f,ancla,$b$if p_request->>'accion'='cambiar_pin_corporativo' then
  return guardia_private.cambiar_pin_corporativo(p_request);
 end if;
 $b$||ancla);
 f:=replace(f,$a$and x->>'rol'='admin' and coalesce((x->>'cuenta')$a$,$b$and coalesce((x->>'cuenta')$b$);
 execute f;

 f:=replace(pg_get_functiondef('public.guardia_admin_rpc(jsonb)'::regprocedure),chr(13),'');
 f:=replace(f,$a$jsonb_build_object('accion','ingresar')$a$,$b$jsonb_build_object('accion','ingresar','administracion',true)$b$);
 f:=replace(f,$a$x->>'rol'='admin' and coalesce((x->>'cuenta')$a$,$b$x->>'rol'='admin' and not coalesce((x->>'corporativo')::boolean,false) and coalesce((x->>'cuenta')$b$);
 f:=replace(f,$a$if coalesce(p_request->>'dni','')='' then
   acceso:=public.guardia_corporativo_rpc(p_request);
   if coalesce((acceso->>'ok')::boolean,false) then
    update guardia_private.sesiones set vence=now()+interval '8 hours' where hash=guardia_private.hash(acceso->>'token');
    return jsonb_build_object('ok',true,'token',acceso->>'token');
   end if;
   return acceso;
  end if;$a$,$b$if coalesce(p_request->>'dni','')='' then
   return jsonb_build_object('ok',false,'error','Ingrese el DNI y el PIN del administrador.');
  end if;$b$);
 execute f;
end;
$migracion$;

create function guardia_private.cambiar_pin_corporativo(p jsonb) returns jsonb
language plpgsql set search_path='' as $$
declare d guardia_private.dispositivos; s guardia_private.sesiones; e jsonb; corp text; sal_nueva text;
begin
 if coalesce(p->>'nuevo','') !~ '^[0-9]{6}$' then raise exception 'El PIN debe tener seis números';end if;
 select * into d from guardia_private.dispositivos where hash=guardia_private.hash(p->>'dispositivo') and not revocado for update;
 select * into s from guardia_private.sesiones where hash=guardia_private.hash(p->>'token') and dispositivo=d.hash and vence>now();
 if s.hash is null then return jsonb_build_object('ok',false,'codigo','sesion','error','Inicie sesión como administrador.');end if;
 select guardia_private.abrir(cifrado) into e from guardia_private.documentos where id=d.objetivo for update;
 if not exists(select 1 from jsonb_array_elements(e->'guards') g where g->>'id'=s.guardia and g->>'rol'='admin'
  and coalesce((g->>'cuenta')::boolean,false) and not coalesce((g->>'corporativo')::boolean,false)
  and not coalesce((g->>'deleted')::boolean,false)) then
  return jsonb_build_object('ok',false,'codigo','prohibido','error','Sólo administración puede cambiar el PIN.');
 end if;
 select g->>'id' into corp from jsonb_array_elements(e->'guards') g where coalesce((g->>'corporativo')::boolean,false) and not coalesce((g->>'deleted')::boolean,false);
 sal_nueva:=encode(extensions.gen_random_bytes(16),'hex');
 update guardia_private.credenciales set sal=sal_nueva,
  verificador=extensions.crypt(guardia_private.identidad(guardia_private.hash(sal_nueva||':'||(p->>'nuevo'))),extensions.gen_salt('bf',12))
  where objetivo=d.objetivo and guardia=corp;
 if not found then raise exception 'La cuenta del corporativo todavía no está preparada';end if;
 insert into guardia_private.auditoria(objetivo,actor,accion,cifrado) values(d.objetivo,s.guardia,'cambiar_pin_corporativo',
  guardia_private.cifrar(jsonb_build_object('guardia',corp)));
 return jsonb_build_object('ok',true);
end;
$$;
revoke all on function guardia_private.cambiar_pin_corporativo(jsonb) from public,anon,authenticated;

-- Mantener la identidad y las sesiones operativas al retirar el rol compartido.
update guardia_private.documentos d set cifrado=guardia_private.cifrar(jsonb_set(guardia_private.abrir(d.cifrado),'{guards}',(
 select jsonb_agg(case when coalesce((x->>'corporativo')::boolean,false) and x->>'rol'='admin'
  then x||jsonb_build_object('rol','vigilador','updatedAt',floor(extract(epoch from clock_timestamp())*1000)) else x end order by ord)
 from jsonb_array_elements(guardia_private.abrir(d.cifrado)->'guards') with ordinality f(x,ord)
))),revision=d.revision+1,actualizado=now()
where exists(select 1 from jsonb_array_elements(guardia_private.abrir(d.cifrado)->'guards') g where coalesce((g->>'corporativo')::boolean,false) and g->>'rol'='admin');
notify pgrst,'reload schema';
