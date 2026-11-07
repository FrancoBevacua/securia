-- Fichas compartidas por objetivo sobre las filas cifradas existentes.
-- No se agregan tablas públicas ni permisos de acceso directo.
create or replace function guardia_private.sync_cols() returns text[]
language sql immutable set search_path='' as $$
 select array['posts','franjas','guards','directives','dlogs','accesses','alogs','reports','novedades','visits','rounds','rtemplates','shifts','punches','contacts','infdias','locales','recorridos','envios','externals'];
$$;

do $migracion$
declare f text; nombre text; firma regprocedure;
begin
 foreach nombre in array array['guardia_private.validar_formato(jsonb)','guardia_private.validar_cambios(jsonb,jsonb,text)','guardia_private.aplicar_delta(jsonb,jsonb)'] loop
  firma:=nombre::regprocedure;
  select pg_get_functiondef(firma) into f;
  if position($ancla$'recorridos','envios'$ancla$ in f)=0 then raise exception 'No se encontró el catálogo de colecciones en %',nombre;end if;
  f:=replace(f,$ancla$'recorridos','envios'$ancla$,$ancla$'recorridos','envios','externals'$ancla$);
  -- Los teléfonos anteriores no envían la nueva colección; no borrar sus fichas.
  if nombre='guardia_private.validar_formato(jsonb)' then
   f:=regexp_replace(f,'\mbegin\M', $cuerpo$begin
    j:=jsonb_set(j,'{externals}',coalesce(j->'externals','[]'::jsonb));$cuerpo$,'i');
  elsif nombre='guardia_private.validar_cambios(jsonb,jsonb,text)' then
   f:=regexp_replace(f,'\mbegin\M', $cuerpo$begin
    a:=jsonb_set(a,'{externals}',coalesce(a->'externals','[]'::jsonb));
    b:=jsonb_set(b,'{externals}',coalesce(b->'externals',a->'externals','[]'::jsonb));$cuerpo$,'i');
  end if;
  execute f;
 end loop;
end;
$migracion$;

-- Validación de dominio independiente del cliente. La autorización de objetivo
-- sigue a cargo del RPC y de su sesión, nunca de claims editables por el usuario.
create function guardia_private.validar_fichas_externos(a jsonb,b jsonb,actor text) returns void
language plpgsql set search_path='' as $$
declare ficha jsonb; previa jsonb; persona jsonb;
begin
 for ficha,previa in
  with previas as materialized (select value->>'id' as id,value as fila from jsonb_array_elements(coalesce(a->'externals','[]'::jsonb))),
       nuevas as materialized (select value->>'id' as id,value as fila from jsonb_array_elements(coalesce(b->'externals','[]'::jsonb)))
  select n.fila,p.fila from nuevas n left join previas p using(id) where n.fila is distinct from p.fila loop
  if length(trim(coalesce(ficha->>'empresa',''))) not between 1 and 120
    or jsonb_typeof(ficha->'personas') is distinct from 'array'
    or jsonb_array_length(ficha->'personas')>300
    or coalesce(ficha->>'createdBy','')='' then raise exception 'Ficha de externo inválida';end if;
  if (previa is null and ficha->>'createdBy' is distinct from actor)
    or (previa is not null and ficha->>'createdBy' is distinct from previa->>'createdBy') then raise exception 'La autoría de la ficha no puede cambiar';end if;
  for persona in select value from jsonb_array_elements(ficha->'personas') loop
   if trim(coalesce(persona->>'nombre',''))='' or (coalesce(persona->>'dni','')<>'' and regexp_replace(persona->>'dni','[^0-9]','','g') !~ '^[0-9]{7,8}$') then raise exception 'Revise nombre y DNI de los empleados externos';end if;
  end loop;
 end loop;
end;
$$;
revoke all on function guardia_private.validar_fichas_externos(jsonb,jsonb,text) from public,anon,authenticated;
do $migracion$
declare f text;
begin
 select pg_get_functiondef('guardia_private.validar_cambios(jsonb,jsonb,text)'::regprocedure) into f;
 if position('perform guardia_private.validar_formato(b);' in f)=0 then raise exception 'No se encontró la validación de formato';end if;
 f:=replace(f,'perform guardia_private.validar_formato(b);','perform guardia_private.validar_formato(b); perform guardia_private.validar_fichas_externos(a,b,actor);');
 execute f;
end;
$migracion$;
revoke all on function guardia_private.sync_cols(),guardia_private.validar_formato(jsonb),guardia_private.validar_cambios(jsonb,jsonb,text),guardia_private.aplicar_delta(jsonb,jsonb) from public,anon,authenticated;
notify pgrst,'reload schema';
