-- Puestos múltiples compatibles con los perfiles anteriores y la actividad por teléfono.
create or replace function guardia_private.validar_puestos_guardia(perfil jsonb, estado jsonb) returns void
language plpgsql set search_path='' as $$
declare ids jsonb; id jsonb;
begin
 if coalesce((perfil->>'deleted')::boolean,false) or not(perfil ? 'puestoIds') then return;end if;
 ids:=perfil->'puestoIds';
 if jsonb_typeof(ids) is distinct from 'array' then raise exception 'La lista de puestos debe ser válida';end if;
 if exists(select 1 from jsonb_array_elements(ids) x where jsonb_typeof(x)<>'string' or trim(x#>>'{}')='')
   or (select count(*)<>count(distinct x#>>'{}') from jsonb_array_elements(ids) x) then raise exception 'Seleccione puestos válidos sin duplicados';end if;
 if estado is null then return;end if;
 for id in select value from jsonb_array_elements(ids) loop
  if not exists(select 1 from jsonb_array_elements(estado->'posts') p where p->>'id'=id#>>'{}' and not coalesce((p->>'deleted')::boolean,false)) then raise exception 'Un puesto asignado ya no está disponible';end if;
 end loop;
end; $$;
revoke all on function guardia_private.validar_puestos_guardia(jsonb,jsonb) from public,anon,authenticated;

create or replace function guardia_private.completar_puestos_cobertura(e jsonb) returns jsonb
language plpgsql set search_path='' as $$
declare base jsonb; f jsonb; n bigint; id text; orden integer; instante bigint:=floor(extract(epoch from clock_timestamp())*1000);
begin
 for base in select value from jsonb_array_elements($catalogo$[{"nombre":"Bicicletero","descripcion":"Control del bicicletero y resguardo de bicicletas y motos.","turnos":[{"nombre":"Mañana","entrada":"05:00","salida":"14:00"},{"nombre":"Tarde","entrada":"14:00","salida":"22:00"}]},{"nombre":"Franquero","descripcion":"Cobertura de francos y relevos en distintos puestos.","turnos":[{"nombre":"Mañana","entrada":"06:00","salida":"14:00"},{"nombre":"Tarde","entrada":"14:00","salida":"23:00"},{"nombre":"Noche","entrada":"23:00","salida":"07:00"},{"nombre":"Mañana","entrada":"10:00","salida":"22:00"},{"nombre":"Tarde","entrada":"14:00","salida":"22:00"},{"nombre":"Mañana","entrada":"05:00","salida":"14:00"}]}]$catalogo$::jsonb) loop
  -- Respetar nombres ya registrados, incluso bajas explícitas; no duplicar ni reactivar puestos.
  if exists(select 1 from jsonb_array_elements(e->'posts') p where lower(trim(p->>'nombre'))=lower(base->>'nombre')) then continue;end if;
  id:='securia:puesto:'||lower(base->>'nombre');
  if exists(select 1 from jsonb_array_elements(e->'posts') p where p->>'id'=id) then raise exception 'El identificador de cobertura ya está en uso';end if;
  select coalesce(max((p->>'orden')::integer),-1)+1 into orden from jsonb_array_elements(e->'posts') p;
  e:=jsonb_set(e,'{posts}',coalesce(e->'posts','[]')||jsonb_build_array(jsonb_build_object('id',id,'nombre',base->>'nombre','descripcion',base->>'descripcion','orden',orden,'updatedAt',instante)));
  for f,n in select value,ordinality from jsonb_array_elements(base->'turnos') with ordinality loop
   e:=jsonb_set(e,'{franjas}',coalesce(e->'franjas','[]')||jsonb_build_array(f||jsonb_build_object('id',id||':turno:'||(n-1),'puestoId',id,'orden',n-1,'updatedAt',instante)));
  end loop;
 end loop;
 return e;
end; $$;
revoke all on function guardia_private.completar_puestos_cobertura(jsonb) from public,anon,authenticated;

do $migracion$
declare f text; ancla text;
begin
 select pg_get_functiondef('guardia_private.validar_formato(jsonb)'::regprocedure) into f;
 ancla:=$a$if exists(select 1 from jsonb_array_elements(j->'guards') g where g ? 'pin') then raise exception 'No se admite un PIN dentro del perfil'; end if;$a$;
 if position(ancla in f)=0 then raise exception 'No se encontró la validación de perfiles';end if;
 f:=replace(f,ancla,ancla||$a$
 perform guardia_private.validar_puestos_guardia(fila_puesto,null) from jsonb_array_elements(j->'guards') fila_puesto;
 $a$);execute f;
 select pg_get_functiondef('guardia_private.validar_cambios(jsonb,jsonb,text)'::regprocedure) into f;
 ancla:='perform guardia_private.validar_formato(b);';
 if position(ancla in f)=0 then raise exception 'No se encontró la validación de cambios';end if;
 f:=replace(f,ancla,ancla||$a$
 perform guardia_private.validar_puestos_guardia(fila_puesto,b) from jsonb_array_elements(b->'guards') fila_puesto
 where fila_puesto is distinct from (select x from jsonb_array_elements(a->'guards') x where x->>'id'=fila_puesto->>'id');
 $a$);execute f;
 select pg_get_functiondef('public.guardia_rpc(jsonb)'::regprocedure) into f;
 ancla:=$a$perfil:=p_request->'perfil';$a$;
 if position(ancla in f)=0 then raise exception 'No se encontró el registro de cuentas';end if;
 f:=replace(f,ancla,ancla||' perform guardia_private.validar_puestos_guardia(perfil,estado);');execute f;
 select pg_get_functiondef('public.guardia_admin_rpc(jsonb)'::regprocedure) into f;
 ancla:=$a$'puestoId','franjaId'$a$;
 if position(ancla in f)=0 then raise exception 'No se encontró la lista de campos administrativos';end if;
 f:=replace(f,ancla,$a$'puestoId','puestoIds','franjaId'$a$);
 ancla:=$a$nuevo:=coalesce(anterior,'{}'::jsonb)||cambio||jsonb_build_object('id',registro,'cuenta',true,'updatedAt',instante);$a$;
 if position(ancla in f)=0 then raise exception 'No se encontró el guardado administrativo';end if;
 f:=replace(f,ancla,ancla||' perform guardia_private.validar_puestos_guardia(nuevo,e);');execute f;
end;
$migracion$;

-- El trigger de documentos publica sólo las filas nuevas al protocolo incremental de sincronización.
do $catalogos$
declare d record; anterior jsonb; nuevo jsonb;
begin
 for d in select id,cifrado from guardia_private.documentos for update loop
  anterior:=guardia_private.abrir(d.cifrado);nuevo:=guardia_private.completar_puestos_cobertura(anterior);
  if nuevo is distinct from anterior then
   perform guardia_private.validar_formato(nuevo);
   update guardia_private.documentos set cifrado=guardia_private.cifrar(nuevo),revision=revision+1,actualizado=now() where documentos.id=d.id;
  end if;
 end loop;
end;
$catalogos$;
notify pgrst,'reload schema';
