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
 if (select count(*) from jsonb_array_elements(b->'punches') x where coalesce(x->>'out','')='' and coalesce(x->>'closedAt','')='')>1 then
   raise exception 'Ya existe un turno abierto';
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
