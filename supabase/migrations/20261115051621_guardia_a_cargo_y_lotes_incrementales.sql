-- El reflejo del panel y las filas del cursor se actualizan en la misma transacción.
do $migracion$
declare f text; ancla text;
begin
 f:=replace(pg_get_functiondef('guardia_private.sync_importar(uuid,jsonb)'::regprocedure),chr(13),'');
 ancla:=$a$foreach c in array array['site']||guardia_private.sync_cols() loop$a$;
 if strpos(f,ancla)=0 then raise exception 'No se encontró la importación por colección';end if;
 execute replace(f,ancla,ancla||$b$
  if not e ? c then continue;end if;$b$);

 f:=replace(pg_get_functiondef('public.guardia_sync(jsonb)'::regprocedure),chr(13),'');
 ancla:=$a$e jsonb; rev bigint;$a$;
 if strpos(f,ancla)=0 then raise exception 'No se encontró la declaración de la sincronización';end if;
 f:=replace(f,ancla,ancla||' espejo_previo text;');
 ancla:=$a$select guardia_private.abrir(cifrado),revision into e,rev from guardia_private.documentos where id=d.objetivo;
  if delta<>'{}' then
   e:=guardia_private.aplicar_delta(e,delta);
   update guardia_private.documentos set cifrado=guardia_private.cifrar(e),revision=rev+1,actualizado=now() where id=d.objetivo;
  end if;$a$;
 if strpos(f,ancla)=0 then raise exception 'No se encontró la escritura del lote';end if;
 execute replace(f,ancla,$b$
  if delta='{}' then
   select revision into rev from guardia_private.documentos where id=d.objetivo;
  else
   select guardia_private.abrir(cifrado),revision into e,rev from guardia_private.documentos where id=d.objetivo;
   e:=guardia_private.aplicar_delta(e,delta);
   perform guardia_private.sync_importar(d.objetivo,delta);
   espejo_previo:=current_setting('guardia.sync.mirror',true);
   perform set_config('guardia.sync.mirror','1',true);
   update guardia_private.documentos set cifrado=guardia_private.cifrar(e),revision=rev+1,actualizado=now() where id=d.objetivo;
   perform set_config('guardia.sync.mirror',coalesce(espejo_previo,''),true);
  end if;$b$);

 f:=replace(pg_get_functiondef('guardia_private.validar_corporativo(jsonb,jsonb,text)'::regprocedure),chr(13),'');
 ancla:=$a$x->>'id'=nuevo->>'responsableId'$a$;
 if strpos(f,ancla)=0 then raise exception 'No se encontró la validación del responsable';end if;
 execute replace(f,ancla,ancla||' and x->>''rol'' is distinct from ''admin''');
end;
$migracion$;
