-- Protocolo 2. Fotografías separadas, filas cifradas, cursor y recibos durables.
-- La copia original permanece cifrada; la migración no modifica las sesiones.
create table guardia_private.sync_originales (
 objetivo uuid primary key references guardia_private.documentos(id), cifrado bytea not null, revision bigint not null, creado timestamptz not null default now()
);
create table guardia_private.sync_filas (
 objetivo uuid not null references guardia_private.documentos(id), col text not null, id text not null,
 secuencia bigint generated always as identity, cifrado bytea not null, huella text not null,
 fecha text not null default '', turno text not null default '', telefono text not null default '', abierto boolean not null default false,
 primary key(objetivo,col,id)
);
create index sync_cursor on guardia_private.sync_filas(objetivo,secuencia);
create index sync_turno on guardia_private.sync_filas(objetivo,col,id) include(turno);
create index sync_abiertos on guardia_private.sync_filas(objetivo,telefono) where abierto;
create table guardia_private.sync_adjuntos (
 objetivo uuid not null references guardia_private.documentos(id), hash text not null,
 longitud integer not null check(longitud between 1 and 33554432), partes integer not null check(partes between 1 and 256),
 completo boolean not null default false, primary key(objetivo,hash)
);
create table guardia_private.sync_partes (
 objetivo uuid not null, hash text not null, numero integer not null check(numero between 0 and 255), cifrado bytea not null,
 primary key(objetivo,hash,numero), foreign key(objetivo,hash) references guardia_private.sync_adjuntos(objetivo,hash)
);
create table guardia_private.sync_recibos (
 objetivo uuid not null references guardia_private.documentos(id), telefono text not null, lote text not null,
 actor text not null, respuesta jsonb not null, creado timestamptz not null default now(), primary key(objetivo,telefono,lote)
);
create table guardia_private.sync_resguardos (
 id uuid primary key default gen_random_uuid(), objetivo uuid not null references guardia_private.documentos(id),
 actor text not null, telefono text not null, col text not null, registro text not null, motivo text not null,
 cifrado bytea not null, creado timestamptz not null default now()
);
create index sync_resguardos_actor on guardia_private.sync_resguardos(objetivo,actor,creado);
alter table guardia_private.sync_originales enable row level security;
alter table guardia_private.sync_filas enable row level security;
alter table guardia_private.sync_adjuntos enable row level security;
alter table guardia_private.sync_partes enable row level security;
alter table guardia_private.sync_recibos enable row level security;
alter table guardia_private.sync_resguardos enable row level security;
revoke all on guardia_private.sync_originales,guardia_private.sync_filas,guardia_private.sync_adjuntos,guardia_private.sync_partes,guardia_private.sync_recibos,guardia_private.sync_resguardos from public,anon,authenticated;

create function guardia_private.sync_cols() returns text[] language sql immutable set search_path='' as $$
 select array['posts','franjas','guards','directives','dlogs','accesses','alogs','reports','novedades','visits','rounds','rtemplates','shifts','punches','contacts','infdias','locales','recorridos','envios'];
$$;
create function guardia_private.sync_vacio() returns jsonb language sql immutable set search_path='' as $$
 select jsonb_object_agg(c,'[]'::jsonb)||jsonb_build_object('site','{}'::jsonb,'rev',0,'updatedAt',0) from unnest(guardia_private.sync_cols()) c;
$$;
create function guardia_private.sync_huella(f jsonb) returns text language sql immutable set search_path='' as $$
 select encode(extensions.digest((f-'updatedAt')::text,'sha256'),'hex');
$$;
create function guardia_private.sync_externalizar(obj uuid,v jsonb) returns jsonb language plpgsql set search_path='' as $$
declare t text; h text; k text; x jsonb; r jsonb; n integer;
begin
 if jsonb_typeof(v)='string' then
  t:=v#>>'{}';
  if t ~ '^data:[a-zA-Z0-9.+/-]+;base64,[a-zA-Z0-9+/=[:space:]]+$' then
   h:=guardia_private.hash(t);n:=ceil(length(t)/131072.0);
   insert into guardia_private.sync_adjuntos values(obj,h,length(t),n,true) on conflict do nothing;
   if not exists(select 1 from guardia_private.sync_partes where objetivo=obj and hash=h) then
    for i in 0..n-1 loop
     insert into guardia_private.sync_partes values(obj,h,i,guardia_private.cifrar(to_jsonb(substr(t,i*131072+1,131072)))) on conflict do nothing;
    end loop;
   end if;
   return to_jsonb('vige://'||obj::text||'/'||h);
  end if;
  return v;
 elsif jsonb_typeof(v)='array' then
  r:='[]';for x in select value from jsonb_array_elements(v) loop r:=r||jsonb_build_array(guardia_private.sync_externalizar(obj,x));end loop;return r;
 elsif jsonb_typeof(v)='object' then
  r:='{}';for k,x in select key,value from jsonb_each(v) loop r:=r||jsonb_build_object(k,guardia_private.sync_externalizar(obj,x));end loop;return r;
 end if;
 return v;
end; $$;
create function guardia_private.sync_foto(obj uuid,ref text) returns text language plpgsql set search_path='' as $$
declare h text; t text;
begin
 if ref not like 'vige://%' then return ref;end if;
 if split_part(ref,'/',3)<>obj::text then raise exception 'Adjunto de otro objetivo';end if;
 h:=split_part(ref,'/',4);
 if not exists(select 1 from guardia_private.sync_adjuntos where objetivo=obj and hash=h and completo) then raise exception 'Adjunto no disponible';end if;
 select string_agg(guardia_private.abrir(cifrado)#>>'{}','' order by numero) into t from guardia_private.sync_partes where objetivo=obj and hash=h;
 return t;
end; $$;
create function guardia_private.sync_importar(obj uuid,e jsonb) returns void language plpgsql set search_path='' as $$
declare c text; f jsonb;
begin
 foreach c in array array['site']||guardia_private.sync_cols() loop
  for f in select value from jsonb_array_elements(case when c='site' then jsonb_build_array(e->'site') else e->c end) loop
   if exists(select 1 from guardia_private.sync_filas where objetivo=obj and col=c and id=case when c='site' then 'site' else f->>'id' end and huella=guardia_private.sync_huella(f)) then continue;end if;
   insert into guardia_private.sync_filas(objetivo,col,id,cifrado,huella,fecha,turno,telefono,abierto)
    values(obj,c,case when c='site' then 'site' else f->>'id' end,guardia_private.cifrar(f),guardia_private.sync_huella(f),coalesce(f->>'fecha',''),coalesce(f->>'turnoId',''),coalesce(f->>'dispositivoId',''),c='punches' and coalesce(f->>'out','')='' and coalesce(f->>'closedAt','')='' and not coalesce((f->>'deleted')::boolean,false))
    on conflict(objetivo,col,id) do update set cifrado=excluded.cifrado,huella=excluded.huella,fecha=excluded.fecha,turno=excluded.turno,telefono=excluded.telefono,abierto=excluded.abierto,secuencia=default
    where sync_filas.huella<>excluded.huella;
  end loop;
 end loop;
end; $$;
-- Compatibilidad de cuentas y panel: el documento ahora contiene sólo metadatos.
create function guardia_private.sync_documento() returns trigger language plpgsql set search_path='' as $$
declare e jsonb; compacto jsonb;
begin
 if current_setting('guardia.sync.mirror',true)='1' then return new;end if;
 e:=guardia_private.abrir(new.cifrado);
 compacto:=case when e::text like '%"data:%' then guardia_private.sync_externalizar(new.id,e) else e end;
 perform guardia_private.sync_importar(new.id,compacto);
 new.cifrado:=guardia_private.cifrar(compacto);return new;
end; $$;
do $$ declare d record; e jsonb;begin
 for d in select * from guardia_private.documentos loop
  insert into guardia_private.sync_originales(objetivo,cifrado,revision) values(d.id,d.cifrado,d.revision);
  e:=guardia_private.sync_externalizar(d.id,guardia_private.abrir(d.cifrado));
  perform guardia_private.sync_importar(d.id,e);
  update guardia_private.documentos set cifrado=guardia_private.cifrar(e) where id=d.id;
 end loop;
end; $$;
create trigger sync_documento before update of cifrado on guardia_private.documentos for each row execute function guardia_private.sync_documento();
create function guardia_private.sync_alta_documento() returns trigger language plpgsql set search_path='' as $$
begin
 update guardia_private.documentos set cifrado=new.cifrado where id=new.id;
 return new;
end; $$;
create trigger sync_alta_documento after insert on guardia_private.documentos for each row execute function guardia_private.sync_alta_documento();

create function public.guardia_sync(p_request jsonb) returns jsonb language plpgsql security definer set search_path='' set statement_timeout='20s' as $$
declare d guardia_private.dispositivos; s guardia_private.sesiones; g jsonb; a jsonb; b jsonb; delta jsonb:='{}'; f jsonb; prev jsonb;
 c text; registro text; h text; n integer; total integer; t text; lote text; res jsonb; acuses jsonb:='[]'; aceptados jsonb:='[]';
 motivo text; respaldo uuid; cursor bigint; techo bigint; pagina jsonb; correcto boolean; item jsonb; e jsonb; rev bigint;
begin
 if octet_length(p_request::text)>2000000 then raise exception 'Divida el lote en grupos menores';end if;
 select * into d from guardia_private.dispositivos where hash=guardia_private.hash(coalesce(p_request->>'dispositivo','')) and not revocado;
 select * into s from guardia_private.sesiones where hash=guardia_private.hash(coalesce(p_request->>'token','')) and dispositivo=d.hash and vence>now();
 if s.hash is null then return jsonb_build_object('ok',false,'codigo','sesion','error','Ingrese con su DNI y PIN. Los pendientes se conservan.');end if;
 select guardia_private.abrir(cifrado) into g from guardia_private.sync_filas where objetivo=d.objetivo and col='guards' and id=s.guardia;
 if g is null or coalesce((g->>'deleted')::boolean,false) or not coalesce((g->>'cuenta')::boolean,false) then return jsonb_build_object('ok',false,'codigo','sesion','error','Cuenta no disponible');end if;
 update guardia_private.sesiones set vence=now()+interval '30 days' where hash=s.hash;
 if p_request->>'accion'='adjunto' then
  h:=p_request->>'hash';n:=(p_request->>'numero')::integer;total:=(p_request->>'partes')::integer;t:=p_request->>'contenido';
  if h!~'^[a-f0-9]{64}$' or n<0 or n>=total or total>256 or total<1 or length(t)>131072 or length(t)=0 then raise exception 'Parte de adjunto inválida';end if;
  insert into guardia_private.sync_adjuntos(objetivo,hash,longitud,partes) values(d.objetivo,h,(p_request->>'longitud')::integer,total) on conflict do nothing;
  perform 1 from guardia_private.sync_adjuntos where objetivo=d.objetivo and hash=h for update;
  if exists(select 1 from guardia_private.sync_adjuntos where objetivo=d.objetivo and hash=h and completo) then return jsonb_build_object('ok',true,'completo',true,'ref','vige://'||d.objetivo||'/'||h);end if;
  if not exists(select 1 from guardia_private.sync_adjuntos where objetivo=d.objetivo and hash=h and partes=total and longitud=(p_request->>'longitud')::integer) then raise exception 'El adjunto cambió de tamaño';end if;
  insert into guardia_private.sync_partes values(d.objetivo,h,n,guardia_private.cifrar(to_jsonb(t))) on conflict(objetivo,hash,numero) do update set cifrado=excluded.cifrado;
  if (select count(*) from guardia_private.sync_partes where objetivo=d.objetivo and hash=h)=total then
   select string_agg(guardia_private.abrir(cifrado)#>>'{}','' order by numero) into t from guardia_private.sync_partes where objetivo=d.objetivo and hash=h;
   if length(t)<>(p_request->>'longitud')::integer or guardia_private.hash(t)<>h or t!~'^data:[a-zA-Z0-9.+/-]+;base64,[a-zA-Z0-9+/=[:space:]]+$' then raise exception 'El adjunto no pasó la verificación';end if;
   update guardia_private.sync_adjuntos set completo=true where objetivo=d.objetivo and hash=h;
  end if;
  return jsonb_build_object('ok',true,'completo',(select completo from guardia_private.sync_adjuntos where objetivo=d.objetivo and hash=h),'ref','vige://'||d.objetivo||'/'||h);
 elsif p_request->>'accion'='foto' then
  return jsonb_build_object('ok',true,'foto',guardia_private.sync_foto(d.objetivo,p_request->>'ref'));
 elsif p_request->>'accion'='consultar' then
  cursor:=greatest(coalesce((p_request->>'cursor')::bigint,0),0);
  select coalesce(max(secuencia),0) into techo from guardia_private.sync_filas where objetivo=d.objetivo;
  with filas as (select * from guardia_private.sync_filas where objetivo=d.objetivo and secuencia>cursor order by secuencia limit 200)
  select coalesce(jsonb_agg(jsonb_build_object('col',col,'id',id,'valor',guardia_private.abrir(cifrado),'hash',huella) order by secuencia),'[]'),coalesce(max(secuencia),cursor) into pagina,cursor from filas;
  return jsonb_build_object('ok',true,'filas',pagina,'cursor',cursor,'mas',cursor<techo,'objetivo',d.objetivo);
 elsif p_request->>'accion'='guardar' then
  lote:=p_request->>'lote';
  if lote!~'^[a-f0-9-]{16,80}$' or jsonb_typeof(p_request->'filas')<>'array' or jsonb_array_length(p_request->'filas') not between 1 and 250 then raise exception 'Lote inválido';end if;
  -- Un único escritor por objetivo; el bloqueo precede al recibo y al cursor.
  perform 1 from guardia_private.documentos where id=d.objetivo for update;
  select respuesta into res from guardia_private.sync_recibos where objetivo=d.objetivo and telefono=d.hash and actor=s.guardia and sync_recibos.lote=p_request->>'lote';
  if res is not null then return res;end if;
  a:=guardia_private.sync_vacio();
  -- Sólo las filas del lote, el catálogo de guardias y los turnos referenciados/abiertos.
  for c in select unnest(guardia_private.sync_cols()) loop
   select coalesce(jsonb_agg(guardia_private.abrir(r.cifrado) order by r.id),'[]') into f
   from guardia_private.sync_filas r where r.objetivo=d.objetivo and r.col=c and
   (c='guards' or (c='punches' and (r.abierto or r.id in (select x->'valor'->>'turnoId' from jsonb_array_elements(p_request->'filas') x))) or r.id in(select x->>'id' from jsonb_array_elements(p_request->'filas') x where x->>'col'=c));
   a:=jsonb_set(a,array[c],f);
  end loop;
  select guardia_private.abrir(cifrado) into f from guardia_private.sync_filas where objetivo=d.objetivo and col='site';a:=jsonb_set(a,'{site}',coalesce(f,'{}'));
  for item in select value from jsonb_array_elements(p_request->'filas') loop
   c:=item->>'col';registro:=item->>'id';f:=item->'valor';
   if not(c=any(guardia_private.sync_cols()||array['site'])) or length(registro) not between 1 and 200 or (c<>'site' and f->>'id' is distinct from registro) or octet_length(f::text)>300000 or f::text ~ '(data:|file:|content:|blob:)' then raise exception 'Registro o adjunto sin preparar';end if;
   -- Todas las referencias deben corresponder a un adjunto ya verificado del objetivo.
   for t in select (m)[1] from regexp_matches(f::text,'vige://([^"[:space:]]+)','g') m loop
    if split_part(t,'/',1)<>d.objetivo::text or not exists(select 1 from guardia_private.sync_adjuntos where objetivo=d.objetivo and hash=split_part(t,'/',2) and completo) then raise exception 'Referencia de adjunto inválida';end if;
   end loop;
   select guardia_private.abrir(cifrado) into prev from guardia_private.sync_filas where objetivo=d.objetivo and col=c and id=registro;
   if prev is not null and guardia_private.sync_huella(prev)=guardia_private.sync_huella(f) then
    acuses:=acuses||jsonb_build_array(jsonb_build_object('col',c,'id',registro,'valor',prev,'hash',guardia_private.sync_huella(prev),'estado','confirmado'));continue;
   end if;
   if prev is not null and (case when item ? 'baseHash' then item->>'baseHash' is distinct from guardia_private.sync_huella(prev) else item->'base' is null or guardia_private.sync_huella(item->'base') is distinct from guardia_private.sync_huella(prev) end) then
    insert into guardia_private.sync_resguardos(objetivo,actor,telefono,col,registro,motivo,cifrado) values(d.objetivo,s.guardia,d.hash,c,registro,'Cambio concurrente',guardia_private.cifrar(item)) returning id into respaldo;
    acuses:=acuses||jsonb_build_array(jsonb_build_object('col',c,'id',registro,'valor',prev,'hash',guardia_private.sync_huella(prev),'estado','resguardado','respaldo',respaldo));continue;
   end if;
   if c='site' then delta:=delta||jsonb_build_object(c,f);else delta:=jsonb_set(delta,array[c],coalesce(delta->c,'[]')||jsonb_build_array(f));end if;
   aceptados:=aceptados||jsonb_build_array(item);
  end loop;
  b:=guardia_private.aplicar_delta(a,delta);correcto:=true;
  begin
   if a->'site' is distinct from b->'site' and g->>'rol'<>'admin' then raise exception 'Configuración exclusiva de administración';end if;
   perform guardia_private.validar_cambios(a,b,s.guardia);perform guardia_private.validar_telefono(a,b,s.guardia,d.hash);
  exception when raise_exception then correcto:=false;end;
  if not correcto then
   -- Aislar el rechazo. Validar contra el inicio del lote conserva turnos offline.
   delta:='{}';
   for item in select value from jsonb_array_elements(aceptados) loop
    c:=item->>'col';f:=item->'valor';registro:=item->>'id';motivo:=null;
    b:=guardia_private.aplicar_delta(a,delta);
    -- Las novedades y el cierre viajan juntos. Un turno inválido no se incorpora.
    b:=guardia_private.aplicar_delta(b,case when c='site' then jsonb_build_object(c,f) else jsonb_build_object(c,jsonb_build_array(f)) end);
    begin
     if a->'site' is distinct from b->'site' and g->>'rol'<>'admin' then raise exception 'Configuración exclusiva de administración';end if;
     perform guardia_private.validar_cambios(a,b,s.guardia);perform guardia_private.validar_telefono(a,b,s.guardia,d.hash);
    exception when raise_exception then motivo:=sqlerrm;end;
    if motivo is null then
     if c='site' then delta:=delta||jsonb_build_object(c,f);else delta:=jsonb_set(delta,array[c],coalesce(delta->c,'[]')||jsonb_build_array(f));end if;
    else
     insert into guardia_private.sync_resguardos(objetivo,actor,telefono,col,registro,motivo,cifrado) values(d.objetivo,s.guardia,d.hash,c,registro,left(motivo,300),guardia_private.cifrar(item)) returning id into respaldo;
     select guardia_private.abrir(cifrado) into prev from guardia_private.sync_filas where objetivo=d.objetivo and col=c and id=registro;
     acuses:=acuses||jsonb_build_array(jsonb_build_object('col',c,'id',registro,'valor',prev,'hash',case when prev is null then null else guardia_private.sync_huella(prev) end,'estado','resguardado','respaldo',respaldo));
    end if;
   end loop;
  end if;
  -- Sólo los metadatos se actualizan en la vista compatible del panel.
  select guardia_private.abrir(cifrado),revision into e,rev from guardia_private.documentos where id=d.objetivo;
  if delta<>'{}' then
   e:=guardia_private.aplicar_delta(e,delta);
   update guardia_private.documentos set cifrado=guardia_private.cifrar(e),revision=rev+1,actualizado=now() where id=d.objetivo;
  end if;
  for item in select value from jsonb_array_elements(aceptados) loop
   c:=item->>'col';registro:=item->>'id';
   if not exists(select 1 from jsonb_array_elements(acuses) x where x->>'col'=c and x->>'id'=registro) then
    select guardia_private.abrir(cifrado) into f from guardia_private.sync_filas where objetivo=d.objetivo and col=c and id=registro;
    acuses:=acuses||jsonb_build_array(jsonb_build_object('col',c,'id',registro,'valor',f,'hash',guardia_private.sync_huella(f),'estado','confirmado'));
   end if;
  end loop;
  res:=jsonb_build_object('ok',true,'acuses',acuses,'revision',rev+case when delta<>'{}' then 1 else 0 end);
  insert into guardia_private.sync_recibos(objetivo,telefono,lote,actor,respuesta) values(d.objetivo,d.hash,lote,s.guardia,res);
  return res;
 elsif p_request->>'accion'='resguardos' then
  select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'creado',r.creado,'motivo',r.motivo,'col',r.col,'registro',r.registro,'dato',guardia_private.abrir(r.cifrado)) order by r.creado desc),'[]') into res
   from (select * from guardia_private.sync_resguardos where objetivo=d.objetivo and actor=s.guardia order by creado desc limit 100) r;
  return jsonb_build_object('ok',true,'resguardos',res);
 end if;
 return jsonb_build_object('ok',false,'error','Acción no disponible');
end; $$;
revoke all on function public.guardia_sync(jsonb) from public,authenticated;
grant execute on function public.guardia_sync(jsonb) to anon;
-- Helpers privados: no capacidades expuestas por accidente.
revoke all on function guardia_private.sync_cols(),guardia_private.sync_vacio(),guardia_private.sync_huella(jsonb),guardia_private.sync_externalizar(uuid,jsonb),guardia_private.sync_foto(uuid,text),guardia_private.sync_importar(uuid,jsonb),guardia_private.sync_documento(),guardia_private.sync_alta_documento() from public,anon,authenticated;

-- El panel sigue recibiendo una foto únicamente cuando la solicita explícitamente.
do $$ declare f text;antes text;begin
 f:=pg_get_functiondef('public.guardia_admin_rpc(jsonb)'::regprocedure);
 antes:=$s$case when col='guards' then anterior->'foto' else anterior->'fotos'->coalesce((p_request->>'indice')::integer,0) end$s$;
 if position(antes in f)=0 then raise exception 'No se encontró la lectura del panel';end if;
 execute replace(f,antes,'to_jsonb(guardia_private.sync_foto(doc.id,('||antes||')#>>''{}''))');
 -- El trabajador tiene acceso de servicio; la foto queda limitada al objetivo de su trabajo.
 f:=pg_get_functiondef('public.guardia_whatsapp_trabajo(jsonb)'::regprocedure);
 antes:=$s$if p_request->>'accion'='reservar' then$s$;
 execute replace(f,antes,$s$if p_request->>'accion'='foto' then
  select objetivo into c.objetivo from guardia_private.whatsapp_envios where id=(p_request->>'id')::uuid;
  if c.objetivo is null then raise exception 'Trabajo no disponible';end if;
  return jsonb_build_object('foto',guardia_private.sync_foto(c.objetivo,p_request->>'ref'));
 end if;
 $s$||antes);
end; $$;
-- Los teléfonos anteriores conservan su cola y muestran la actualización requerida.
-- Se detiene el bucle de recuperación que descomprimía todo el historial.
do $$ declare nombre text;f text;ancla integer;aviso text;begin
 foreach nombre in array array['public.guardia_rpc(jsonb)','public.guardia_recuperacion(jsonb)'] loop
  f:=replace(pg_get_functiondef(nombre::regprocedure),chr(13),'');
  ancla:=position(E'begin\n' in f);
  if ancla=0 then raise exception 'No se encontró el inicio del RPC %',nombre;end if;
  aviso:=case when nombre='public.guardia_rpc(jsonb)' then 'guardar' else 'recuperar' end;
  f:=overlay(f placing E'begin\n if p_request->>''accion''='''||aviso||E''' then return jsonb_build_object(''ok'',false,''codigo'',''actualizar'',''error'',''Instale VIGELIUM 2.0.0 para sincronizar. Los pendientes se conservan; no desinstale la aplicación.'');end if;\n' from ancla for 6);
  execute f;
 end loop;
end; $$;
notify pgrst,'reload schema';
