-- Los adjuntos cifrados superan el límite de 3 s de anon. Exención acotada
-- a los dos RPC que ya validan dispositivo, sesión, autoría y revisión.
-- https://supabase.com/docs/guides/database/postgres/timeouts#function-level
alter function public.guardia_rpc(jsonb) set statement_timeout to '45s';
alter function public.guardia_recuperacion(jsonb) set statement_timeout to '45s';

-- Recorrer cada colección una vez: el subquery correlacionado anterior
-- volvía a expandir las fotos de todos los cambios para cada fila histórica.
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
   if (select count(*)<>count(distinct x->>'id') or coalesce(bool_or(jsonb_typeof(x)<>'object' or coalesce(x->>'id','')=''),false)
       from jsonb_array_elements(filas) x) then raise exception 'Identificadores inválidos o duplicados'; end if;
   with anteriores as materialized (
     select viejo->>'id' as id,viejo,orden from jsonb_array_elements(estado->c) with ordinality t(viejo,orden)
   ), nuevas as materialized (
     select n->>'id' as id,n,orden from jsonb_array_elements(filas) with ordinality t(n,orden)
   ), todas as (
     select coalesce(n.n,a.viejo) as fila,0 as bloque,a.orden from anteriores a left join nuevas n using(id)
     union all
     select n.n,1,n.orden from nuevas n left join anteriores a using(id) where a.id is null
   )
   select coalesce(jsonb_agg(fila order by bloque,orden),'[]'::jsonb) into combinado from todas;
   resultado:=jsonb_set(resultado,array[c],combinado);
 end loop;
 return resultado;
end;
$$;
revoke all on function guardia_private.aplicar_delta(jsonb,jsonb) from public,anon,authenticated;

create or replace function guardia_private.validar_formato(j jsonb) returns void
language plpgsql set search_path='' as $$
declare c text; filas jsonb;
 colecciones text[]:=array['posts','franjas','guards','directives','dlogs','accesses','alogs','reports','novedades','visits','rounds','rtemplates','shifts','punches','contacts','infdias','locales','recorridos','envios'];
begin
 if jsonb_typeof(j) is distinct from 'object' or octet_length(j::text)>33554432 or jsonb_typeof(j->'site') is distinct from 'object' then
   raise exception 'El objetivo debe ser válido y no superar 32 MB';
 end if;
 if not j ?& colecciones then raise exception 'Colecciones incompletas'; end if;
 for c,filas in select key,value from jsonb_each(j) where key=any(colecciones) loop
   if jsonb_typeof(filas) is distinct from 'array' then raise exception 'Colección inválida: %',c; end if;
   if (select count(*)<>count(distinct r->>'id') or coalesce(bool_or(coalesce(r->>'id','')=''),false)
       from jsonb_array_elements(filas) r) then raise exception 'Identificadores inválidos: %',c; end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(j->'guards') g where g ? 'pin') then raise exception 'No se admite un PIN dentro del perfil'; end if;
end;
$$;

-- Mantener íntegros los controles instalados. Cambiar sólo la selección de
-- filas a JOIN materializados; las mismas reglas procesan altas/ediciones.
do $migracion$
declare f text; ancla text;
begin
 select pg_get_functiondef('guardia_private.validar_cambios(jsonb,jsonb,text)'::regprocedure) into f;
 ancla:=$a$for anterior in select x from jsonb_array_elements(a->c) x loop
     select x into nuevo from jsonb_array_elements(b->c) x where x->>'id'=anterior->>'id';$a$;
 if position(ancla in f)=0 then raise exception 'No se encontró el recorrido de ediciones'; end if;
 f:=replace(f,ancla,$a$for anterior,nuevo in
     with previas as materialized (select x->>'id' as id,x as fila from jsonb_array_elements(a->c) x),
          nuevas as materialized (select x->>'id' as id,x as fila from jsonb_array_elements(b->c) x)
     select p.fila,n.fila from previas p left join nuevas n using(id) where p.fila is distinct from n.fila loop$a$);
 ancla:=$a$for nuevo in select x from jsonb_array_elements(b->c) x where not exists(select 1 from jsonb_array_elements(a->c) z where z->>'id'=x->>'id') loop$a$;
 if position(ancla in f)=0 then raise exception 'No se encontró el recorrido de altas'; end if;
 f:=replace(f,ancla,$a$for nuevo in
     with previas as materialized (select x->>'id' as id from jsonb_array_elements(a->c) x),
          nuevas as materialized (select x->>'id' as id,x as fila from jsonb_array_elements(b->c) x)
     select n.fila from nuevas n left join previas p using(id) where p.id is null loop$a$);
 execute f;
 select pg_get_functiondef('guardia_private.validar_telefono(jsonb,jsonb,text,text)'::regprocedure) into f;
 ancla:=$a$for fila in select x from jsonb_array_elements(b->c) x loop
   select x into anterior from jsonb_array_elements(a->c) x where x->>'id'=fila->>'id';$a$;
 if position(ancla in f)=0 then raise exception 'No se encontró la validación del teléfono'; end if;
 f:=replace(f,ancla,$a$for fila,anterior in
   with previas as materialized (select x->>'id' as id,x as fila from jsonb_array_elements(a->c) x),
        nuevas as materialized (select x->>'id' as id,x as fila from jsonb_array_elements(b->c) x)
   select n.fila,p.fila from nuevas n left join previas p using(id) where n.fila is distinct from p.fila loop$a$);
 execute f;
end;
$migracion$;
notify pgrst,'reload schema';
