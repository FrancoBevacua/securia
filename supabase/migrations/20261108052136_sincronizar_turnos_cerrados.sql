-- Sincronizar es entregar cambios ya guardados en el teléfono, incluso después
-- del cierre. La edición interactiva conserva su validación de sólo lectura.
-- Se mantienen la autoría, el objetivo, el teléfono y el control de concurrencia.
do $migracion$
declare f text; ancla text;
begin
 select pg_get_functiondef('guardia_private.validar_cambios(jsonb,jsonb,text)'::regprocedure) into f;
 f:=replace(f,'guardia_private.validar_cambios(', 'guardia_private.validar_cambios_sync(');
 ancla:=$a$coalesce(anterior->>'createdBy',anterior->>'guardId','')<>actor or coalesce(anterior->>'lockedAt','')<>''
          or p is null or p->>'guardId' is distinct from actor or coalesce(p->>'out','')<>'' or coalesce(p->>'closedAt','')<>''$a$;
 if position(ancla in f)=0 then raise exception 'No se encontró la validación de edición de registros';end if;
 f:=replace(f,ancla,$a$coalesce(anterior->>'createdBy',anterior->>'guardId','')<>actor
          or p is null or p->>'guardId' is distinct from actor or coalesce((p->>'deleted')::boolean,false)$a$);
 ancla:=$a$or (previo is not null and (previo->>'guardId' is distinct from actor or coalesce(previo->>'out','')<>'' or coalesce(previo->>'closedAt','')<>''))$a$;
 if position(ancla in f)=0 then raise exception 'No se encontró la validación de altas de registros';end if;
 f:=replace(f,ancla,'');
 execute f;
 select pg_get_functiondef('public.guardia_sync(jsonb)'::regprocedure) into f;
 if position('perform guardia_private.validar_cambios(a,b,s.guardia);' in f)=0 then raise exception 'No se encontró la validación del RPC';end if;
 f:=replace(f,'perform guardia_private.validar_cambios(a,b,s.guardia);','perform guardia_private.validar_cambios_sync(a,b,s.guardia);');
 execute f;
end;
$migracion$;
revoke all on function guardia_private.validar_cambios_sync(jsonb,jsonb,text) from public,anon,authenticated;

-- Reincorporar entregas rechazadas por la regla anterior. Se conserva cada
-- respaldo cifrado y no se reemplaza una versión que cambió en otro dispositivo.
alter table guardia_private.sync_resguardos add column recuperado timestamptz;
do $recuperacion$
declare r record; item jsonb; previo jsonb; a jsonb; b jsonb;
begin
 for r in select * from guardia_private.sync_resguardos
   where col in ('novedades','alogs') and motivo in (
    'El registro pertenece a otro guardia o a un turno cerrado',
    'El registro debe pertenecer a un turno propio pendiente de sincronización')
   order by creado,id loop
  perform 1 from guardia_private.documentos where id=r.objetivo for update;
  item:=guardia_private.abrir(r.cifrado);
  select guardia_private.abrir(cifrado) into previo from guardia_private.sync_filas where objetivo=r.objetivo and col=r.col and id=r.registro;
  if previo is not null and guardia_private.sync_huella(previo)=guardia_private.sync_huella(item->'valor') then
   update guardia_private.sync_resguardos set recuperado=now() where id=r.id;continue;
  end if;
  if previo is not null and (case when item ? 'baseHash' then item->>'baseHash' is distinct from guardia_private.sync_huella(previo)
    else item->'base' is null or guardia_private.sync_huella(item->'base') is distinct from guardia_private.sync_huella(previo) end) then continue;end if;
  select guardia_private.abrir(cifrado) into a from guardia_private.documentos where id=r.objetivo;
  b:=guardia_private.aplicar_delta(a,jsonb_build_object(r.col,jsonb_build_array(item->'valor')));
  begin
   perform guardia_private.validar_cambios_sync(a,b,r.actor);
   perform guardia_private.validar_telefono(a,b,r.actor,r.telefono);
  exception when raise_exception then continue;
  end;
  update guardia_private.documentos set cifrado=guardia_private.cifrar(b),revision=revision+1,actualizado=now() where id=r.objetivo;
  update guardia_private.sync_resguardos set recuperado=now() where id=r.id;
 end loop;
end;
$recuperacion$;
notify pgrst,'reload schema';
