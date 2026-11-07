-- Envío incremental: reconstruir el candidato bajo el bloqueo del RPC existente.
create or replace function guardia_private.aplicar_delta(estado jsonb, cambios jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare c text; filas jsonb; combinado jsonb; resultado jsonb:=estado;
begin
 if cambios is null or jsonb_typeof(cambios)<>'object' then raise exception 'Cambios inválidos'; end if;
 for c,filas in select key,value from jsonb_each(cambios) loop
   if c in ('site','updatedAt') then
     resultado:=jsonb_set(resultado,array[c],filas); continue;
   end if;
   if c not in ('posts','franjas','guards','directives','dlogs','accesses','alogs','reports','novedades','visits','rounds','rtemplates','shifts','punches','contacts','infdias','locales','recorridos','envios')
      or jsonb_typeof(filas)<>'array' then raise exception 'Colección inválida'; end if;
   if exists(select 1 from jsonb_array_elements(filas) x where jsonb_typeof(x)<>'object' or coalesce(x->>'id','')='')
      or (select count(*) from jsonb_array_elements(filas))<>(select count(distinct x->>'id') from jsonb_array_elements(filas) x)
      then raise exception 'Identificadores inválidos o duplicados'; end if;
   select coalesce(jsonb_agg(coalesce((select n from jsonb_array_elements(filas) n where n->>'id'=viejo->>'id'),viejo) order by orden),'[]'::jsonb)
     into combinado from jsonb_array_elements(estado->c) with ordinality t(viejo,orden);
   select combinado||coalesce(jsonb_agg(n order by orden),'[]'::jsonb) into combinado
     from jsonb_array_elements(filas) with ordinality t(n,orden)
     where not exists(select 1 from jsonb_array_elements(estado->c) viejo where viejo->>'id'=n->>'id');
   resultado:=jsonb_set(resultado,array[c],combinado);
 end loop;
 return resultado;
end;
$$;
revoke all on function guardia_private.aplicar_delta(jsonb,jsonb) from public,anon,authenticated;

-- Conservar autenticación, cifrado, revisiones y validación del RPC instalado.
do $migracion$
declare definicion text; anterior text:='candidato:=p_request->''estado''; revision:=(p_request->>''revision'')::bigint;';
begin
 select pg_get_functiondef('public.guardia_rpc(jsonb)'::regprocedure) into definicion;
 if position(anterior in definicion)=0 then raise exception 'No se encontró el punto de actualización del RPC'; end if;
 definicion:=replace(definicion,anterior,
   'candidato:=case when p_request ? ''cambios'' then guardia_private.aplicar_delta(estado,p_request->''cambios'') else p_request->''estado'' end; revision:=(p_request->>''revision'')::bigint;');
 execute definicion;
end;
$migracion$;
notify pgrst,'reload schema';
