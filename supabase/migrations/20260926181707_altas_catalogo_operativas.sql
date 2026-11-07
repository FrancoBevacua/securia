-- Permitir altas operativas sin conceder edición de configuración ni creación de cuentas.
do $migracion$
declare f text;ancla text;
begin
 select pg_get_functiondef('guardia_private.validar_cambios(jsonb,jsonb,text)'::regprocedure) into f;
 ancla:=$a$c in ('posts','franjas','directives','accesses','rtemplates','shifts')$a$;
 if position(ancla in f)=0 then raise exception 'No se encontró la validación de catálogos';end if;
 f:=replace(f,ancla,$a$c in ('posts','franjas','directives','rtemplates','shifts')$a$);
 ancla:=$a$if nuevo=anterior then continue; end if;$a$;
 f:=replace(f,ancla,ancla||$a$
     if c='accesses' and not administrador then raise exception 'Sólo administración puede modificar accesos existentes';end if;
 $a$);
 ancla:=$a$if c='guards' and (coalesce((nuevo->>'cuenta')::boolean,false) or not administrador) then raise exception 'Crear la cuenta mediante el registro'; end if;$a$;
 if position(ancla in f)=0 then raise exception 'No se encontró la validación de personas';end if;
 f:=replace(f,ancla,$a$
     if c='guards' then
       if coalesce((nuevo->>'cuenta')::boolean,false) or coalesce(nuevo->>'rol','vigilador')<>'vigilador'
         or coalesce(nuevo->>'dni','')<>'' or coalesce(nuevo->>'pin','')<>'' then raise exception 'Crear la cuenta mediante el registro';end if;
       if trim(coalesce(nuevo->>'apellido',''))='' or trim(coalesce(nuevo->>'nombre',''))='' then raise exception 'Complete apellido y nombre';end if;
     end if;
     if c='accesses' and trim(coalesce(nuevo->>'nombre',''))='' then raise exception 'Indique el nombre del acceso';end if;
 $a$);
 execute f;
end;
$migracion$;
notify pgrst,'reload schema';
