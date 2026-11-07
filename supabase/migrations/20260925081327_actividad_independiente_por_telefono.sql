-- La cola offline conserva la última instantánea: un turno puede llegar ya cerrado.
-- Se valida cada registro contra su turno, sin reabrir ni modificar historial cerrado.
create or replace function guardia_private.validar_cambios(a jsonb, b jsonb, actor text) returns void
language plpgsql set search_path='' as $$
declare c text; anterior jsonb; nuevo jsonb; g jsonb; administrador boolean; p jsonb; previo jsonb;
begin
 perform guardia_private.validar_formato(b);
 select x into g from jsonb_array_elements(a->'guards') x where x->>'id'=actor and not coalesce((x->>'deleted')::boolean,false);
 if g is null then raise exception 'Cuenta no disponible'; end if;
 administrador := g->>'rol'='admin';
 if exists(select 1 from jsonb_array_elements(b->'punches') x
   where coalesce(x->>'dispositivoId','')<>'' and not coalesce((x->>'deleted')::boolean,false)
    and coalesce(x->>'out','')='' and coalesce(x->>'closedAt','')=''
   group by x->>'dispositivoId' having count(*)>1) then
   raise exception 'Este teléfono ya tiene una actividad abierta';
 end if;
 foreach c in array array['posts','franjas','guards','directives','dlogs','accesses','alogs','reports','novedades','visits','rounds','rtemplates','shifts','punches','contacts','infdias','locales','recorridos','envios'] loop
   if not administrador and c in ('posts','franjas','directives','accesses','rtemplates','shifts') and a->c is distinct from b->c then
     raise exception 'Esta configuración requiere administración';
   end if;
   for anterior in select x from jsonb_array_elements(a->c) x loop
     select x into nuevo from jsonb_array_elements(b->c) x where x->>'id'=anterior->>'id';
     if nuevo is null then raise exception 'No se permite eliminar físicamente el historial'; end if;
     if nuevo=anterior then continue; end if;
     if c in ('novedades','alogs') then
       select x into p from jsonb_array_elements(a->'punches') x where x->>'id'=anterior->>'turnoId';
       if coalesce(anterior->>'createdBy',anterior->>'guardId','')<>actor or coalesce(anterior->>'lockedAt','')<>''
          or p is null or p->>'guardId' is distinct from actor or coalesce(p->>'out','')<>'' or coalesce(p->>'closedAt','')<>'' then
         raise exception 'El registro pertenece a otro guardia o a un turno cerrado';
       end if;
       if coalesce(nuevo->>'createdBy',nuevo->>'guardId') is distinct from coalesce(anterior->>'createdBy',anterior->>'guardId') or nuevo->>'turnoId' is distinct from anterior->>'turnoId' then
         raise exception 'La autoría de un registro no puede cambiar';
       end if;
     end if;
     if c in ('novedades','alogs') and not coalesce((nuevo->>'deleted')::boolean,false) and not exists(select 1 from jsonb_array_elements(b->'guards') z where z->>'id'=nuevo->>'guardId' and not coalesce((z->>'deleted')::boolean,false)) then raise exception 'Seleccione un vigilador del objetivo'; end if;
     if c='punches' then
       if anterior->>'guardId' is distinct from actor or coalesce(anterior->>'closedAt','')<>'' or coalesce(anterior->>'out','')<>'' or coalesce(nuevo->>'out','')='' then raise exception 'El turno sólo admite un cierre definitivo'; end if;
       if (nuevo - array['out','fechaOut','closedAt','cierre','updatedAt']) is distinct from (anterior - array['out','fechaOut','closedAt','cierre','updatedAt']) then raise exception 'No se puede reescribir el ingreso del turno'; end if;
     end if;
     if c='guards' then
       if nuevo->>'dni' is distinct from anterior->>'dni' or nuevo->>'cuenta' is distinct from anterior->>'cuenta' or nuevo->>'rol' is distinct from anterior->>'rol' then raise exception 'La identidad se administra mediante el servicio de cuentas'; end if;
       if not administrador and anterior->>'id'<>actor then raise exception 'No se puede editar otro perfil'; end if;
     end if;
   end loop;
   for nuevo in select x from jsonb_array_elements(b->c) x where not exists(select 1 from jsonb_array_elements(a->c) z where z->>'id'=x->>'id') loop
     if c in ('novedades','alogs') then
       select x into p from jsonb_array_elements(b->'punches') x where x->>'id'=nuevo->>'turnoId';
       select x into previo from jsonb_array_elements(a->'punches') x where x->>'id'=nuevo->>'turnoId';
       -- Sólo turnos propios nuevos, o que todavía estaban abiertos en la nube.
       if coalesce(nuevo->>'createdBy',nuevo->>'guardId','')<>actor or p is null or p->>'guardId' is distinct from actor
          or coalesce((p->>'deleted')::boolean,false)
          or (previo is not null and (previo->>'guardId' is distinct from actor or coalesce(previo->>'out','')<>'' or coalesce(previo->>'closedAt','')<>'')) then
         raise exception 'El registro debe pertenecer a un turno propio pendiente de sincronización';
       end if;
       if not exists(select 1 from jsonb_array_elements(b->'guards') z where z->>'id'=nuevo->>'guardId' and not coalesce((z->>'deleted')::boolean,false)) then raise exception 'Seleccione un vigilador del objetivo'; end if;
     end if;
     if c='punches' then
       if nuevo->>'guardId' is distinct from actor or coalesce((nuevo->>'deleted')::boolean,false) then raise exception 'Ingreso de turno inválido'; end if;
       -- Un turno cerrado offline debe incluir un cierre completo y posterior al ingreso.
       if coalesce(nuevo->>'out','')<>'' or coalesce(nuevo->>'closedAt','')<>'' then
         if coalesce(nuevo->>'out','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
            or coalesce(nuevo->>'fechaOut','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
            or coalesce(nuevo->>'startedAt','') !~ '^[0-9]+$' or coalesce(nuevo->>'closedAt','') !~ '^[0-9]+$' then
           raise exception 'El turno pendiente necesita un cierre completo';
         end if;
         if (nuevo->>'closedAt')::numeric < (nuevo->>'startedAt')::numeric then raise exception 'El cierre del turno es anterior al ingreso'; end if;
       end if;
     end if;
     if c='guards' and (coalesce((nuevo->>'cuenta')::boolean,false) or not administrador) then raise exception 'Crear la cuenta mediante el registro'; end if;
   end loop;
 end loop;
end;
$$;

-- La cola es local a cada teléfono. Sólo éste puede modificar su actividad y sus rondas.
create or replace function guardia_private.validar_telefono(a jsonb,b jsonb,actor text,telefono text) returns void
language plpgsql set search_path='' as $$
declare c text; fila jsonb; anterior jsonb; actividad jsonb;
begin
 foreach c in array array['punches','novedades','alogs','rounds'] loop
  for fila in select x from jsonb_array_elements(b->c) x loop
   select x into anterior from jsonb_array_elements(a->c) x where x->>'id'=fila->>'id';
   if fila=anterior then continue; end if;
   if c in ('punches','rounds') then
    if coalesce(anterior->>'dispositivoId','')<>'' and anterior->>'dispositivoId' is distinct from telefono then raise exception 'El registro pertenece a otro teléfono'; end if;
    if coalesce(fila->>'dispositivoId','')<>'' and fila->>'dispositivoId' is distinct from telefono then raise exception 'El dispositivo del registro no coincide'; end if;
    if anterior is not null and fila->>'dispositivoId' is distinct from anterior->>'dispositivoId' then raise exception 'No se puede cambiar el teléfono de un registro'; end if;
    if c='rounds' and coalesce(fila->>'dispositivoId','')<>'' and (coalesce(fila->>'createdBy',fila->>'guardId') is distinct from actor or (anterior is not null and coalesce(anterior->>'createdBy',anterior->>'guardId') is distinct from actor)) then raise exception 'La ronda pertenece a otra cuenta'; end if;
   else
    select x into actividad from jsonb_array_elements(b->'punches') x where x->>'id'=fila->>'turnoId';
    if coalesce(actividad->>'dispositivoId','')<>'' and actividad->>'dispositivoId' is distinct from telefono then raise exception 'La novedad pertenece a otro teléfono'; end if;
   end if;
  end loop;
 end loop;
end;
$$;
revoke all on function guardia_private.validar_telefono(jsonb,jsonb,text,text) from public,anon,authenticated;

-- Mantener los permisos del RPC; no crear puntos de acceso públicos nuevos.
do $migracion$
declare definicion text; punto text; cierre text;
begin
 select replace(pg_get_functiondef('public.guardia_rpc(jsonb)'::regprocedure),chr(13),'') into definicion;
 punto:='perform guardia_private.validar_cambios(estado,candidato,actor);';
 if position(punto in definicion)=0 then raise exception 'No se encontró la validación del RPC'; end if;
 definicion:=replace(definicion,punto,punto||' perform guardia_private.validar_telefono(estado,candidato,actor,dh);');
 cierre:=$p$where x->>'guardId'=actor and coalesce(x->>'out','')='' and coalesce(x->>'closedAt','')=''$p$;
 if position(cierre in definicion)=0 then raise exception 'No se encontró la validación de cierre de sesión'; end if;
 definicion:=replace(definicion,cierre,$p$where x->>'guardId'=actor and coalesce(x->>'dispositivoId','')=dh and coalesce(x->>'out','')='' and coalesce(x->>'closedAt','')=''$p$);
 execute definicion;
 select pg_get_functiondef('public.guardia_recuperacion(jsonb)'::regprocedure) into definicion;
 punto:='perform guardia_private.validar_cambios(remoto,candidato,actor);';
 if position(punto in definicion)=0 then raise exception 'No se encontró la validación de recuperación'; end if;
 definicion:=replace(definicion,punto,punto||' perform guardia_private.validar_telefono(remoto,candidato,actor,dispositivo_hash);');
 punto:='perform guardia_private.validar_cambios(remoto,intento,actor);';
 definicion:=replace(definicion,punto,punto||' perform guardia_private.validar_telefono(remoto,intento,actor,dispositivo_hash);');
 execute definicion;
end;
$migracion$;
notify pgrst,'reload schema';
