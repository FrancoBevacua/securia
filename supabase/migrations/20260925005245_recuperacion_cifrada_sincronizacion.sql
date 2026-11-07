-- Respaldo durable de ambos lados antes de restablecer una cola incompatible.
create table guardia_private.recuperaciones (
 id uuid primary key default gen_random_uuid(),
 objetivo uuid not null references guardia_private.documentos(id),
 dispositivo text not null,
 guardia text not null,
 huella text not null,
 creado timestamptz not null default now(),
 cifrado bytea not null,
 incorporados integer not null default 0,
 resguardados integer not null default 0,
 unique(objetivo,dispositivo,guardia,huella)
);
create index recuperaciones_objetivo_fecha on guardia_private.recuperaciones(objetivo,creado desc);
alter table guardia_private.recuperaciones enable row level security;
revoke all on guardia_private.recuperaciones from public,anon,authenticated;

create or replace function public.guardia_recuperacion(p_request jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 sesion jsonb; remoto jsonb; telefono jsonb; candidato jsonb; intento jsonb;
 objetivo_id uuid; dispositivo_hash text; actor text; administrador boolean;
 respaldo guardia_private.recuperaciones; c text; fila jsonb; existente jsonb;
 cantidad integer:=0; total_resguardados integer:=0; rev bigint; listado jsonb;
 colecciones text[]:=array['posts','franjas','guards','directives','accesses','rtemplates','shifts','punches','dlogs','alogs','reports','novedades','visits','rounds','contacts','infdias','locales','recorridos','envios'];
begin
 if p_request is null or octet_length(p_request::text)>35000000 then raise exception 'Solicitud demasiado grande'; end if;
 -- Reutiliza la autenticación corporativa, el control de revocación y el bloqueo del objetivo.
 sesion:=public.guardia_rpc(jsonb_build_object('accion','consultar','dispositivo',p_request->>'dispositivo','token',p_request->>'token'));
 if not coalesce((sesion->>'ok')::boolean,false) then return sesion; end if;
 actor:=sesion->>'guardia';remoto:=sesion->'estado';rev:=(sesion->>'revision')::bigint;
 dispositivo_hash:=guardia_private.hash(p_request->>'dispositivo');
 select d.objetivo into objetivo_id from guardia_private.dispositivos d where d.hash=dispositivo_hash and not d.revocado;
 if objetivo_id is null then raise exception 'Teléfono no disponible'; end if;
 administrador:=exists(select 1 from jsonb_array_elements(remoto->'guards') g where g->>'id'=actor and g->>'rol'='admin');
 if p_request->>'accion'='listar' then
  select coalesce(jsonb_agg(x order by x.creado desc,x.id),'[]'::jsonb) into listado from (
   select r.id,r.creado,r.incorporados,r.resguardados from guardia_private.recuperaciones r
   where r.objetivo=objetivo_id and (r.guardia=actor or administrador)
   order by r.creado desc,r.id limit 20 offset greatest(0,coalesce((p_request->>'desde')::integer,0))
  ) x;
  return jsonb_build_object('ok',true,'respaldos',listado);
 elsif p_request->>'accion'='leer' then
  select * into respaldo from guardia_private.recuperaciones r where r.id=(p_request->>'id')::uuid and r.objetivo=objetivo_id and (r.guardia=actor or administrador);
  if not found then return jsonb_build_object('ok',false,'error','Respaldo no disponible para esta cuenta'); end if;
  return jsonb_build_object('ok',true,'respaldo',guardia_private.abrir(respaldo.cifrado));
 elsif p_request->>'accion'='reiniciar_sesion' then
  if not exists(select 1 from guardia_private.recuperaciones r where r.objetivo=objetivo_id and r.dispositivo=dispositivo_hash and r.guardia=actor) then
   return jsonb_build_object('ok',false,'error','Primero respalde y restablezca la sincronización');
  end if;
  delete from guardia_private.sesiones where dispositivo=dispositivo_hash;
  return jsonb_build_object('ok',true);
 elsif p_request->>'accion' is distinct from 'recuperar' then
  return jsonb_build_object('ok',false,'error','Operación no disponible');
 end if;
 telefono:=p_request->'estado';
 -- Se respalda incluso una fila histórica que ya no cumple la validación de edición.
 if jsonb_typeof(telefono) is distinct from 'object' then raise exception 'Falta la copia del teléfono'; end if;
 foreach c in array colecciones loop
  if jsonb_typeof(telefono->c) is distinct from 'array' then raise exception 'Copia incompleta: %',c; end if;
 end loop;
 select * into respaldo from guardia_private.recuperaciones r where r.objetivo=objetivo_id and r.dispositivo=dispositivo_hash and r.guardia=actor and r.huella=guardia_private.hash(telefono::text);
 if found then
  -- Respuesta perdida: no repetir altas ni sobreescribir el respaldo original.
  return jsonb_build_object('ok',true,'id',respaldo.id,'creado',respaldo.creado,'incorporados',respaldo.incorporados,'resguardados',respaldo.resguardados,'estado',remoto,'revision',rev);
 end if;
 insert into guardia_private.recuperaciones(objetivo,dispositivo,guardia,huella,cifrado)
 values(objetivo_id,dispositivo_hash,actor,guardia_private.hash(telefono::text),guardia_private.cifrar(jsonb_build_object('telefono',telefono,'nube',remoto))) returning * into respaldo;
 candidato:=remoto;
 foreach c in array colecciones loop
  select coalesce(jsonb_agg(x),'[]'::jsonb) into fila from jsonb_array_elements(telefono->c) x
   where coalesce(x->>'id','')<>'' and not exists(select 1 from jsonb_array_elements(remoto->c) z where z->>'id'=x->>'id');
  candidato:=jsonb_set(candidato,array[c],(candidato->c)||fila);
  cantidad:=cantidad+jsonb_array_length(fila);
 end loop;
 begin
  perform guardia_private.validar_cambios(remoto,candidato,actor);
 exception when raise_exception or invalid_text_representation or numeric_value_out_of_range then
  -- Aislar altas rechazadas; siempre validar contra la base original para admitir turnos completos offline.
  candidato:=remoto;cantidad:=0;
  foreach c in array colecciones loop
   for fila in select x from jsonb_array_elements(telefono->c) x where coalesce(x->>'id','')<>'' loop
    if exists(select 1 from jsonb_array_elements(candidato->c) z where z->>'id'=fila->>'id') then continue; end if;
    intento:=jsonb_set(candidato,array[c],(candidato->c)||jsonb_build_array(fila));
    begin
     perform guardia_private.validar_cambios(remoto,intento,actor);
     candidato:=intento;cantidad:=cantidad+1;
    exception when raise_exception or invalid_text_representation or numeric_value_out_of_range then
     null; -- La fila íntegra permanece en el respaldo cifrado y consultable.
    end;
   end loop;
  end loop;
 end;
 foreach c in array colecciones loop
  for fila in select x from jsonb_array_elements(telefono->c) x loop
   select z into existente from jsonb_array_elements(candidato->c) z where z->>'id'=fila->>'id';
   if (fila-'updatedAt') is distinct from (existente-'updatedAt') then total_resguardados:=total_resguardados+1; end if;
  end loop;
 end loop;
 if telefono->'site' is distinct from candidato->'site' then total_resguardados:=total_resguardados+1; end if;
 if candidato is distinct from remoto then
  update guardia_private.documentos set cifrado=guardia_private.cifrar(candidato),revision=revision+1,actualizado=now() where id=objetivo_id returning revision into rev;
 end if;
 update guardia_private.recuperaciones set incorporados=cantidad,resguardados=total_resguardados where id=respaldo.id;
 return jsonb_build_object('ok',true,'id',respaldo.id,'creado',respaldo.creado,'incorporados',cantidad,'resguardados',total_resguardados,'estado',candidato,'revision',rev);
end;
$$;
revoke all on function public.guardia_recuperacion(jsonb) from public,anon,authenticated;
grant execute on function public.guardia_recuperacion(jsonb) to anon;
notify pgrst,'reload schema';
