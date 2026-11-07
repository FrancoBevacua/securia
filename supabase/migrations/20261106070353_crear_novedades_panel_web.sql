-- Amplía el RPC administrativo existente: conserva autenticación, revisión y auditoría.
do $migracion$
declare f text; ancla text;
begin
 select pg_get_functiondef('public.guardia_admin_rpc(jsonb)'::regprocedure) into f;
 ancla:=$a$ cambio:=coalesce(p_request->'datos','{}'::jsonb);$a$;
 if position(ancla in f)=0 then raise exception 'No se encontró la lectura de datos del panel';end if;
 f:=replace(f,ancla,'');
 ancla:=$a$ if (p_request->>'revision')::bigint is distinct from doc.revision then$a$;
 if position(ancla in f)=0 then raise exception 'No se encontró la revisión del panel';end if;
 f:=replace(f,ancla,$a$
 cambio:=coalesce(p_request->'datos','{}'::jsonb);
 if accion='crear_asiento' then
  if coalesce(registro,'')!~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'Identificador de novedad inválido';end if;
  if jsonb_typeof(cambio)<>'object' then raise exception 'Datos de novedad inválidos';end if;
  if exists(select 1 from jsonb_object_keys(cambio) k where k not in ('fecha','hora','categoria','texto','guardId')) then raise exception 'Campo de novedad no permitido';end if;
  if exists(select 1 from unnest(array['fecha','hora','categoria','texto','guardId']) k where jsonb_typeof(cambio->k) is distinct from 'string') then raise exception 'Complete fecha, hora, categoría, guardia y descripción';end if;
  cambio:=cambio||jsonb_build_object('texto',trim(cambio->>'texto'),'categoria',upper(trim(cambio->>'categoria')));
  if cambio->>'fecha'!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or cambio->>'hora'!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Revise la fecha y el horario';end if;
  if to_char((cambio->>'fecha')::date,'YYYY-MM-DD')<>cambio->>'fecha' then raise exception 'Fecha inválida';end if;
  if cambio->>'categoria' not in ('NOVEDAD','RECORRIDO','ADICIONAL','INGRESO','EGRESO','APERTURA','CIERRE','EXTERNO','DESCANSO') then raise exception 'Categoría de novedad inválida';end if;
  if length(cambio->>'texto') not between 1 and 20000 then raise exception 'La descripción debe tener entre 1 y 20.000 caracteres';end if;
  if not exists(select 1 from jsonb_array_elements(e->'guards') x where x->>'id'=cambio->>'guardId' and not coalesce((x->>'deleted')::boolean,false) and not coalesce((x->>'corporativo')::boolean,false)) then raise exception 'Seleccione el guardia que realizó la novedad';end if;
  select x into anterior from jsonb_array_elements(e->'novedades') x where x->>'id'=registro;
  if anterior is not null then
   if anterior->>'createdBy'=ses.guardia and anterior->>'origenTipo'='panel' and not coalesce((anterior->>'deleted')::boolean,false) and anterior @> cambio then
    return jsonb_build_object('ok',true,'id',registro,'revision',doc.revision);
   end if;
   return jsonb_build_object('ok',false,'codigo','conflicto','error','Esta novedad ya fue modificada. Actualice la vista antes de continuar.');
  end if;
 end if;
$a$||ancla);
 ancla:=$a$ if accion in ('editar_asiento','eliminar_asiento') then$a$;
 if position(ancla in f)=0 then raise exception 'No se encontró la edición de novedades';end if;
 f:=replace(f,ancla,$a$
 if accion='crear_asiento' then
  col:='novedades';
  nuevo:=cambio||jsonb_build_object('id',registro,'createdBy',ses.guardia,'createdAt',instante,'updatedAt',instante,'adminUpdatedBy',ses.guardia,'origenTipo','panel','lockedAt',instante);
  e:=jsonb_set(e,'{novedades}',(e->'novedades')||jsonb_build_array(nuevo));
 elsif accion in ('editar_asiento','eliminar_asiento') then$a$);
 execute f;
end;
$migracion$;
notify pgrst,'reload schema';
