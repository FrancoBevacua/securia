-- Una baja del catálogo no borra la firma del historial ni impide entregar
-- registros offline. Sólo la sincronización admite firmantes históricos.
do $migracion$
declare f text; ancla text;
begin
 select pg_get_functiondef('guardia_private.validar_cambios_sync(jsonb,jsonb,text)'::regprocedure) into f;
 ancla:=$a$z->>'id'=nuevo->>'guardId' and not coalesce((z->>'deleted')::boolean,false)$a$;
 if position(ancla in f)=0 then raise exception 'No se encontró la validación del firmante';end if;
 f:=replace(f,ancla,$a$z->>'id'=nuevo->>'guardId'$a$);
 execute f;
end;
$migracion$;

-- Reintentar los respaldos restantes sin borrar ni reactivar perfiles. Cada
-- objetivo se escribe una vez; toda versión incompatible queda respaldada.
do $recuperacion$
declare objetivo_id uuid; r record; item jsonb; valor jsonb; previo jsonb; a jsonb; b jsonb; original jsonb; iguales boolean;
begin
 for objetivo_id in select distinct objetivo from guardia_private.sync_resguardos where recuperado is null loop
  select guardia_private.abrir(cifrado) into a from guardia_private.documentos where id=objetivo_id for update;
  original:=a;
  for r in select * from guardia_private.sync_resguardos where objetivo=objetivo_id and recuperado is null
    and col in ('novedades','alogs') and motivo in (
     'El registro pertenece a otro guardia o a un turno cerrado',
     'El registro debe pertenecer a un turno propio pendiente de sincronización',
     'Seleccione un vigilador del objetivo') order by creado,id loop
   item:=guardia_private.abrir(r.cifrado);valor:=item->'valor';
   select x into previo from jsonb_array_elements(a->r.col) x where x->>'id'=r.registro;
   if previo is not null and guardia_private.sync_huella(previo)=guardia_private.sync_huella(valor) then
    update guardia_private.sync_resguardos set recuperado=now() where id=r.id;continue;
   end if;
   iguales:=(previo-array['lockedAt','updatedAt'])=(valor-array['lockedAt','updatedAt']);
   -- El cierre puede haber agregado una marca de bloqueo en otro envío. Si
   -- el contenido es el mismo, conservar esa marca en lugar de crear conflicto.
   if iguales and previo ? 'lockedAt' then valor:=jsonb_set(valor,'{lockedAt}',previo->'lockedAt');end if;
   if previo is not null and not iguales and (case when item ? 'baseHash' then item->>'baseHash' is distinct from guardia_private.sync_huella(previo)
     else item->'base' is null or guardia_private.sync_huella(item->'base') is distinct from guardia_private.sync_huella(previo) end) then continue;end if;
   b:=guardia_private.aplicar_delta(a,jsonb_build_object(r.col,jsonb_build_array(valor)));
   begin
    perform guardia_private.validar_cambios_sync(a,b,r.actor);
    perform guardia_private.validar_telefono(a,b,r.actor,r.telefono);
   exception when raise_exception then continue;
   end;
   a:=b;update guardia_private.sync_resguardos set recuperado=now() where id=r.id;
  end loop;
  if a is distinct from original then
   update guardia_private.documentos set cifrado=guardia_private.cifrar(a),revision=revision+1,actualizado=now() where id=objetivo_id;
  end if;
 end loop;
end;
$recuperacion$;
notify pgrst,'reload schema';
