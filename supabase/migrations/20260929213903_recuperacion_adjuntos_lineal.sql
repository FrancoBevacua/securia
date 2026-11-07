-- Evitar expandir reiteradamente las fotos de toda la colección durante
-- la recuperación. Conservar cifrado, sesión, validaciones y respaldo previo.
do $migracion$
declare f text; ancla text;
begin
 select replace(pg_get_functiondef('public.guardia_recuperacion(jsonb)'::regprocedure),chr(13),'') into f;
 ancla:=$a$select coalesce(jsonb_agg(x),'[]'::jsonb) into fila from jsonb_array_elements(telefono->c) x
   where coalesce(x->>'id','')<>'' and not exists(select 1 from jsonb_array_elements(remoto->c) z where z->>'id'=x->>'id');
  candidato:=jsonb_set(candidato,array[c],(candidato->c)||fila);$a$;
 if position(ancla in f)=0 then raise exception 'No se encontró la selección de altas a recuperar';end if;
 f:=replace(f,ancla,$a$with previas as materialized (select z->>'id' as id from jsonb_array_elements(remoto->c) z),
       nuevas as materialized (select x->>'id' as id,x as fila,orden from jsonb_array_elements(telefono->c) with ordinality t(x,orden))
  select coalesce(jsonb_agg(n.fila order by n.orden),'[]'::jsonb) into fila from nuevas n left join previas p using(id)
   where coalesce(n.id,'')<>'' and p.id is null;
  if jsonb_array_length(fila)>0 then candidato:=jsonb_set(candidato,array[c],(candidato->c)||fila);end if;$a$);
 ancla:=$a$for fila in select x from jsonb_array_elements(telefono->c) x where coalesce(x->>'id','')<>'' loop$a$;
 if position(ancla in f)=0 then raise exception 'No se encontró el aislamiento de altas';end if;
 f:=replace(f,ancla,$a$for fila in
    with previas as materialized (select z->>'id' as id from jsonb_array_elements(candidato->c) z),
         nuevas as materialized (select x->>'id' as id,x as fila,orden from jsonb_array_elements(telefono->c) with ordinality t(x,orden))
    select n.fila from nuevas n left join previas p using(id) where coalesce(n.id,'')<>'' and p.id is null order by n.orden loop$a$);
 ancla:=$a$for fila in select x from jsonb_array_elements(telefono->c) x loop
   select z into existente from jsonb_array_elements(candidato->c) z where z->>'id'=fila->>'id';
   if (fila-'updatedAt') is distinct from (existente-'updatedAt') then total_resguardados:=total_resguardados+1; end if;
  end loop;$a$;
 if position(ancla in f)=0 then raise exception 'No se encontró el conteo de diferencias respaldadas';end if;
 f:=replace(f,ancla,$a$with previas as materialized (select z->>'id' as id,z as fila from jsonb_array_elements(candidato->c) z),
       nuevas as materialized (select x->>'id' as id,x as fila from jsonb_array_elements(telefono->c) x)
  select total_resguardados+count(*) into total_resguardados from nuevas n left join previas p using(id)
   where (n.fila-'updatedAt') is distinct from (p.fila-'updatedAt');$a$);
 execute f;
end;
$migracion$;
notify pgrst,'reload schema';
