-- Cada corporativo conserva su identidad operativa y usa el mismo almacén de
-- verificadores que el corporativo original. El PIN nunca forma parte del estado.
create or replace function guardia_private.cambiar_pin_corporativo(p jsonb) returns jsonb
language plpgsql set search_path='' as $$
declare
 dispositivo guardia_private.dispositivos;
 sesion guardia_private.sesiones;
 documento guardia_private.documentos;
 estado jsonb;
 puesto jsonb;
 franja jsonb;
 cuenta jsonb;
 id_corporativo text;
 sal_nueva text;
 espejo_previo text;
 crear boolean := p->>'accion'='crear_pin_corporativo';
begin
 if coalesce(p->>'nuevo','') !~ '^[0-9]{6}$' then
  return jsonb_build_object('ok',false,'error','El PIN debe tener seis números.');
 end if;
 select * into dispositivo from guardia_private.dispositivos
 where hash=guardia_private.hash(p->>'dispositivo') and not revocado for update;
 select s.* into sesion from guardia_private.sesiones s
 where s.hash=guardia_private.hash(p->>'token') and s.dispositivo=dispositivo.hash and s.vence>now();
 if sesion.hash is null then
  return jsonb_build_object('ok',false,'codigo','sesion','error','Inicie sesión como administrador.');
 end if;

 -- El bloqueo del objetivo serializa el alta y la rotación de PINs.
 select * into documento from guardia_private.documentos where id=dispositivo.objetivo for update;
 estado:=guardia_private.abrir(documento.cifrado);
 if not exists(select 1 from jsonb_array_elements(estado->'guards') g
  where g->>'id'=sesion.guardia and g->>'rol'='admin' and g->>'cuenta'='true'
    and g->>'corporativo' is distinct from 'true' and g->>'deleted' is distinct from 'true') then
  return jsonb_build_object('ok',false,'codigo','prohibido','error','Sólo administración puede gestionar los PINs corporativos.');
 end if;

 if crear or p ? 'puestoId' then
  select x into puesto from jsonb_array_elements(estado->'posts') x
  where x->>'id'=p->>'puestoId' and x->>'deleted' is distinct from 'true';
  if puesto is null then return jsonb_build_object('ok',false,'error','Seleccione un puesto activo.'); end if;
 end if;
 select g->>'id' into id_corporativo
 from jsonb_array_elements(estado->'guards') with ordinality as filas(g,orden)
 where g->>'corporativo'='true' and g->>'cuenta'='true' and g->>'deleted' is distinct from 'true'
   and (puesto is null or g->>'puestoId'=puesto->>'id')
 order by orden limit 1;
 if crear and id_corporativo is not null then
  return jsonb_build_object('ok',false,'error','Este puesto ya tiene un PIN corporativo.');
 elsif not crear and id_corporativo is null then
  return jsonb_build_object('ok',false,'error','El puesto todavía no tiene un PIN corporativo.');
 end if;

 if exists(select 1 from jsonb_array_elements(estado->'guards') g
  where (g->>'corporativo'='true' or (g->>'rol'='admin' and g->>'cuenta'='true'))
   and g->>'deleted' is distinct from 'true' and g->>'id' is distinct from id_corporativo
   and guardia_private.pin_coincide(documento.id,g->>'id',p->>'nuevo')) then
  return jsonb_build_object('ok',false,'error','Este PIN ya está en uso. Elija otro número.');
 end if;
 sal_nueva:=encode(extensions.gen_random_bytes(16),'hex');
 if crear then
  id_corporativo:=gen_random_uuid()::text;
  select f into franja from jsonb_array_elements(estado->'franjas') f
  where f->>'puestoId'=puesto->>'id' and f->>'deleted' is distinct from 'true'
  order by coalesce((f->>'orden')::integer,0),f->>'id' limit 1;
  cuenta:=jsonb_build_object(
   'id',id_corporativo,'nombre','Guardia '||(puesto->>'nombre'),'apellido','','rol','vigilador',
   'corporativo',true,'cuenta',true,'puestoId',puesto->>'id','puesto',puesto->>'nombre',
   'puestoIds',jsonb_build_array(puesto->>'id'),'franjaId',coalesce(franja->>'id',''),
   'horaIn',coalesce(franja->>'entrada',''),'horaOut',coalesce(franja->>'salida',''),
   'updatedAt',floor(extract(epoch from clock_timestamp())*1000)
  );
  perform guardia_private.validar_puestos_guardia(cuenta,estado);
  estado:=jsonb_set(estado,'{guards}',(estado->'guards')||jsonb_build_array(cuenta));
  perform guardia_private.sync_importar(documento.id,jsonb_build_object('guards',jsonb_build_array(cuenta)));
  espejo_previo:=current_setting('guardia.sync.mirror',true);
  perform set_config('guardia.sync.mirror','1',true);
  update guardia_private.documentos set cifrado=guardia_private.cifrar(estado),
   revision=documento.revision+1,actualizado=now() where id=documento.id;
  perform set_config('guardia.sync.mirror',coalesce(espejo_previo,''),true);
  insert into guardia_private.credenciales(objetivo,guardia,sal,verificador)
   values(documento.id,id_corporativo,sal_nueva,extensions.crypt(
    guardia_private.identidad(guardia_private.hash(sal_nueva||':'||(p->>'nuevo'))),extensions.gen_salt('bf',12)));
 else
  update guardia_private.credenciales set sal=sal_nueva,verificador=extensions.crypt(
    guardia_private.identidad(guardia_private.hash(sal_nueva||':'||(p->>'nuevo'))),extensions.gen_salt('bf',12))
   where objetivo=documento.id and guardia=id_corporativo;
  if not found then return jsonb_build_object('ok',false,'error','La cuenta del corporativo todavía no está preparada.'); end if;
 end if;
 insert into guardia_private.auditoria(objetivo,actor,accion,cifrado)
  values(documento.id,sesion.guardia,p->>'accion',guardia_private.cifrar(jsonb_build_object('guardia',id_corporativo,'puestoId',puesto->>'id')));
 return jsonb_build_object('ok',true);
end;
$$;
revoke all on function guardia_private.cambiar_pin_corporativo(jsonb) from public,anon,authenticated;

do $migracion$
declare f text; ancla text; desde integer; hasta integer;
begin
 f:=replace(pg_get_functiondef('public.guardia_corporativo_rpc(jsonb)'::regprocedure),chr(13),'');
 ancla:=$a$if p_request->>'accion'='cambiar_pin_corporativo' then$a$;
 if strpos(f,ancla)=0 then raise exception 'No se encontró la gestión de PIN corporativo';end if;
 f:=replace(f,ancla,$a$if p_request->>'accion' in ('crear_pin_corporativo','cambiar_pin_corporativo') then$a$);
 desde:=strpos(f,' select x into g from jsonb_array_elements');
 hasta:=strpos(f,' if not coalesce(correcto,false) then');
 if desde=0 or hasta<=desde then raise exception 'No se encontró la selección de cuenta por PIN';end if;
 f:=substring(f,1,desde-1)||$b$
 select x into g from jsonb_array_elements(e->'guards') x
 where x->>'id'='administrador-pin' and x->>'rol'='admin' and x->>'cuenta'='true'
   and x->>'deleted' is distinct from 'true' and guardia_private.pin_coincide(doc.id,x->>'id',p_request->>'pin');
 if g is null and p_request->>'solo_admin' is distinct from 'true' then
  select x into g from jsonb_array_elements(e->'guards') x
  where x->>'corporativo'='true' and x->>'cuenta'='true' and x->>'deleted' is distinct from 'true'
   and exists(select 1 from jsonb_array_elements(e->'posts') p where p->>'id'=x->>'puestoId' and p->>'deleted' is distinct from 'true')
   and guardia_private.pin_coincide(doc.id,x->>'id',p_request->>'pin');
 end if;
 correcto:=g is not null;
 actor:=g->>'id';
$b$||substring(f,hasta);
 execute f;

 f:=replace(pg_get_functiondef('guardia_private.validar_corporativo(jsonb,jsonb,text)'::regprocedure),chr(13),'');
 ancla:=$a$'puestoId','puestoIds','puesto','franjaId'$a$;
 if strpos(f,ancla)=0 then raise exception 'No se encontró la protección del puesto corporativo';end if;
 f:=replace(f,ancla,$a$'puesto','franjaId'$a$);
 ancla:=$a$if not exists(select 1 from jsonb_array_elements(b->'guards') x where x->>'id'=nuevo->>'responsableId'$a$;
 if strpos(f,ancla)=0 then raise exception 'No se encontró la validación del responsable corporativo';end if;
 f:=replace(f,ancla,$b$if nuevo->>'puestoId' is distinct from cuenta->>'puestoId'
    or not exists(select 1 from jsonb_array_elements(a->'posts') p where p->>'id'=cuenta->>'puestoId' and p->>'deleted' is distinct from 'true')
    or not exists(select 1 from jsonb_array_elements(a->'guards') x where x->>'id'=nuevo->>'responsableId'
     and (x->>'puestoId'=cuenta->>'puestoId' or (x->'puestoIds') ? (cuenta->>'puestoId'))$b$);
 execute f;

 -- El validador incremental recibe un recorte del estado. Incluir el puesto
 -- del corporativo en ese recorte permite verificar que siga activo.
 f:=replace(pg_get_functiondef('public.guardia_sync(jsonb)'::regprocedure),chr(13),'');
 ancla:=$a$(c='guards' or (c='punches'$a$;
 if strpos(f,ancla)=0 then raise exception 'No se encontró el contexto de los lotes de guardia';end if;
 execute replace(f,ancla,$b$(c='guards' or (c='posts' and g->>'corporativo'='true' and r.id=g->>'puestoId') or (c='punches'$b$);
end;
$migracion$;
notify pgrst,'reload schema';
