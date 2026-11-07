-- Sesiones móviles: 30 días de inactividad, conservando validación, revocación y logout.
alter table guardia_private.sesiones alter column vence set default now()+interval '30 days';
do $migration$
declare original text; modificada text;
begin
 original:=pg_get_functiondef('public.guardia_rpc(jsonb)'::regprocedure);
 modificada:=replace(original,'actor:=ses.guardia;', E'actor:=ses.guardia;\n update guardia_private.sesiones set vence=now()+interval ''30 days'' where hash=ses.hash;');
 if original=modificada then raise exception 'No se encontró el punto de renovación de sesión'; end if;
 execute modificada;
end; $migration$;

create table guardia_private.whatsapp_config (
 objetivo uuid primary key references guardia_private.documentos(id),
 cifrado bytea not null,
 habilitado boolean not null default false,
 hora time not null default '18:00',
 zona text not null default 'America/Argentina/Buenos_Aires',
 canal_listo boolean not null default false
);
create table guardia_private.whatsapp_envios (
 id uuid primary key default gen_random_uuid(),
 objetivo uuid not null references guardia_private.documentos(id),
 fecha date not null,
 estado text not null default 'preparando' check (estado in ('preparando','enviando','aceptado','fallido','incierto')),
 mensaje_id text,
 detalle text,
 actualizado timestamptz not null default now(),
 unique(objetivo,fecha)
);
alter table guardia_private.whatsapp_config enable row level security;
alter table guardia_private.whatsapp_envios enable row level security;
revoke all on guardia_private.whatsapp_config,guardia_private.whatsapp_envios from public,anon,authenticated;

-- Usa la autenticación DNI/PIN del producto, ligada al dispositivo y revocable.
create function public.guardia_whatsapp_config(p_request jsonb) returns jsonb
language plpgsql security definer set search_path='' as $f$
declare ses jsonb; objetivo_id uuid; cfg jsonb; g jsonb; fila guardia_private.whatsapp_config; ultimo jsonb;
begin
 if octet_length(p_request::text)>5000 then raise exception 'Configuración demasiado grande'; end if;
 ses:=public.guardia_rpc(p_request||jsonb_build_object('accion','consultar'));
 if not coalesce((ses->>'ok')::boolean,false) then return ses; end if;
 select objetivo into objetivo_id from guardia_private.dispositivos where hash=guardia_private.hash(p_request->>'dispositivo') and not revocado;
 select x into g from jsonb_array_elements(ses->'estado'->'guards') x where x->>'id'=ses->>'guardia' and not coalesce((x->>'deleted')::boolean,false);
 if p_request->>'accion'='guardar' then
   if g->>'rol' is distinct from 'admin' then return jsonb_build_object('ok',false,'error','Sólo administración puede programar el envío al supervisor.'); end if;
   cfg:=p_request->'config';
   if coalesce(cfg->>'hora','')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$'
      or not exists(select 1 from pg_catalog.pg_timezone_names where name=cfg->>'zona')
      or length(coalesce(cfg->>'nombre',''))>100 then raise exception 'Revise el nombre, horario y zona horaria'; end if;
   if coalesce((cfg->>'habilitado')::boolean,false) and (
      coalesce(cfg->>'numero','')!~'^[1-9][0-9]{7,14}$' or trim(coalesce(cfg->>'nombre',''))=''
      or cfg->'consentimiento' is distinct from 'true'::jsonb) then raise exception 'Complete el supervisor y confirme que acepta recibir los reportes'; end if;
   cfg:=jsonb_build_object('nombre',trim(cfg->>'nombre'),'numero',cfg->>'numero','hora',cfg->>'hora',
     'zona',cfg->>'zona','habilitado',coalesce((cfg->>'habilitado')::boolean,false),'consentimiento',coalesce((cfg->>'consentimiento')::boolean,false));
   insert into guardia_private.whatsapp_config(objetivo,cifrado,habilitado,hora,zona)
     values(objetivo_id,guardia_private.cifrar(cfg),(cfg->>'habilitado')::boolean,(cfg->>'hora')::time,cfg->>'zona')
   on conflict(objetivo) do update set cifrado=excluded.cifrado,habilitado=excluded.habilitado,hora=excluded.hora,zona=excluded.zona;
 end if;
 select * into fila from guardia_private.whatsapp_config where objetivo=objetivo_id;
 cfg:=case when fila.objetivo is null then jsonb_build_object('nombre','','numero',coalesce(ses->'estado'->'site'->>'supervisorTel',''),'hora','18:00','zona','America/Argentina/Buenos_Aires','habilitado',false,'consentimiento',false) else guardia_private.abrir(fila.cifrado) end;
 select jsonb_build_object('fecha',fecha,'estado',estado,'detalle',detalle,'actualizado',actualizado) into ultimo
   from guardia_private.whatsapp_envios where objetivo=objetivo_id order by fecha desc limit 1;
 return jsonb_build_object('ok',true,'config',cfg,'listo',coalesce(fila.canal_listo,false),'ultimo',ultimo);
end; $f$;
revoke all on function public.guardia_whatsapp_config(jsonb) from public;
grant execute on function public.guardia_whatsapp_config(jsonb) to anon,authenticated;

-- Exclusiva del servidor. Una reserva por objetivo y fecha, incluso ante llamadas simultáneas.
create function public.guardia_whatsapp_trabajo(p_request jsonb) returns jsonb
language plpgsql security definer set search_path='' as $f$
declare c guardia_private.whatsapp_config; local_now timestamp; dia date; job uuid; e jsonb; fase text;
begin
 if p_request->>'accion'='reservar' then
   for c in select * from guardia_private.whatsapp_config where habilitado and canal_listo for update skip locked loop
     local_now:=now() at time zone c.zona;
     dia:=(local_now-(c.hora-time '00:00'))::date;
     if local_now < dia+c.hora or local_now >= dia+c.hora+interval '1 hour' then continue; end if;
     job:=null;
     insert into guardia_private.whatsapp_envios(objetivo,fecha) values(c.objetivo,dia) on conflict(objetivo,fecha) do nothing returning id into job;
     if job is null then continue; end if;
     select guardia_private.abrir(cifrado) into e from guardia_private.documentos where id=c.objetivo;
     return jsonb_build_object('id',job,'fecha',dia,'config',guardia_private.abrir(c.cifrado),'estado',e);
   end loop;
   return 'null'::jsonb;
 end if;
 if p_request->>'accion'='marcar' then
   fase:=p_request->>'estado';
   update guardia_private.whatsapp_envios set estado=fase,mensaje_id=left(p_request->>'mensaje_id',500),
     detalle=left(p_request->>'detalle',500),actualizado=now()
   where id=(p_request->>'id')::uuid and
     ((estado='preparando' and fase in ('enviando','fallido')) or (estado='enviando' and fase in ('aceptado','fallido','incierto')));
   if not found then raise exception 'Transición de envío no válida'; end if;
   return jsonb_build_object('ok',true);
 end if;
 raise exception 'Operación no disponible';
end; $f$;
revoke all on function public.guardia_whatsapp_trabajo(jsonb) from public,anon,authenticated;
grant execute on function public.guardia_whatsapp_trabajo(jsonb) to service_role;
