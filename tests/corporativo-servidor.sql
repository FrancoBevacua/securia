-- Prueba transaccional: preparar fixture, aplicar migración y ejecutar las comprobaciones.
begin;
do $preparar$
declare e jsonb; obj uuid; tel text:=encode(extensions.gen_random_bytes(32),'hex'); otro text:=encode(extensions.gen_random_bytes(32),'hex');
 sal text:=encode(extensions.gen_random_bytes(16),'hex'); tok text:=encode(extensions.gen_random_bytes(32),'hex');
begin
 e:=guardia_private.sync_vacio();
 e:=jsonb_set(e,'{posts}','[{"id":"paseo-prueba","nombre":"Paseo","orden":0}]');
 e:=jsonb_set(e,'{franjas}','[{"id":"turno-prueba","puestoId":"paseo-prueba","nombre":"Mañana","entrada":"06:00","salida":"14:00","orden":0}]');
 e:=jsonb_set(e,'{guards}','[{"id":"franco-prueba","nombre":"Franco","apellido":"Bevacua","dni":"98765432","sexo":"masculino","fechaNac":"1990-01-01","legajo":"legajo-original","foto":"","rol":"admin","cuenta":true,"puestoId":"paseo-prueba","franjaId":"turno-prueba"}]');
 e:=jsonb_set(e,'{punches}',jsonb_build_array(jsonb_build_object('id','turno-anterior','guardId','franco-prueba','fecha','2026-11-06','in','00:00','out','','dispositivoId',guardia_private.hash(tel)),jsonb_build_object('id','otro-turno','guardId','franco-prueba','fecha','2026-11-06','in','00:00','out','','dispositivoId',guardia_private.hash(otro))));
 e:=jsonb_set(e,'{novedades}','[{"id":"nota-original","guardId":"franco-prueba","createdBy":"franco-prueba","turnoId":"turno-anterior","fecha":"2026-11-06","hora":"01:00","texto":"Registro histórico que conserva su autor"}]');
 e:=jsonb_set(e,'{rounds}',jsonb_build_array(jsonb_build_object('id','ronda-anterior','guardId','franco-prueba','createdBy','franco-prueba','dispositivoId',guardia_private.hash(tel),'fecha','2026-11-06','inicio','01:00','fin','','puntos',jsonb_build_array(jsonb_build_object('n','Paseo','hora','01:05','estado','ok','obs','')))));
 insert into guardia_private.documentos(cifrado) values(guardia_private.cifrar(e)) returning id into obj;
 insert into guardia_private.dispositivos(hash,objetivo) values(guardia_private.hash(tel),obj),(guardia_private.hash(otro),obj);
 insert into guardia_private.credenciales(objetivo,guardia,dni_hmac,sal,verificador) values(obj,'franco-prueba',guardia_private.identidad('98765432'),sal,extensions.crypt(guardia_private.identidad(guardia_private.hash(sal||':638201')),extensions.gen_salt('bf',12)));
 insert into guardia_private.sesiones(hash,dispositivo,guardia) values(guardia_private.hash(tok),guardia_private.hash(tel),'franco-prueba');
 perform set_config('securia.test_objetivo',obj::text,true);perform set_config('securia.test_telefono',tel,true);perform set_config('securia.test_token',tok,true);
end;
$preparar$;
-- APLICAR_MIGRACION_AQUI
do $prueba$
declare obj uuid:=current_setting('securia.test_objetivo')::uuid; tel text:=current_setting('securia.test_telefono');
 e jsonb; g jsonb; personal jsonb; r jsonb; token text; ahora bigint:=floor(extract(epoch from clock_timestamp())*1000); filas jsonb; rechazo boolean;
begin
 select guardia_private.abrir(cifrado) into e from guardia_private.documentos where id=obj;
 select x into g from jsonb_array_elements(e->'guards') x where coalesce((x->>'corporativo')::boolean,false);
 select x into personal from jsonb_array_elements(e->'guards') x where x->>'id'='franco-prueba';
 if g is null or g->>'nombre'<>'Guardia Paseo' or g->>'rol'<>'admin' or g ?| array['dni','sexo','fechaNac','legajo','pin'] then raise exception 'Perfil del corporativo incorrecto';end if;
 if personal->>'rol'<>'vigilador' or personal->>'dni'<>'98765432' or personal->>'legajo'<>'legajo-original' or personal->>'fechaNac'<>'1990-01-01' then raise exception 'Se modificó el perfil personal original';end if;
 if e#>>'{novedades,0,guardId}'<>'franco-prueba' or e#>>'{novedades,0,createdBy}'<>'franco-prueba' then raise exception 'Se alteró la autoría del historial';end if;
 execute 'set local role anon';
 r:=public.guardia_corporativo_rpc(jsonb_build_object('accion','ingresar','dispositivo',tel,'pin','12345'));
 if (r->>'ok')::boolean then raise exception 'Aceptó un PIN de cinco números';end if;
 r:=public.guardia_corporativo_rpc(jsonb_build_object('accion','ingresar','dispositivo',tel,'pin','111111'));
 if (r->>'ok')::boolean then raise exception 'Aceptó un PIN incorrecto';end if;
 execute 'reset role';
 if exists(select 1 from guardia_private.documentos d cross join lateral jsonb_array_elements(guardia_private.abrir(d.cifrado)->'punches') p where d.id=obj and coalesce(p->>'out','')<>'') then raise exception 'Un PIN incorrecto cerró actividad';end if;
 -- La sesión anterior puede terminar de confirmar sus pendientes antes del cambio de cuenta.
 execute 'set local role anon';
 r:=public.guardia_sync(jsonb_build_object('accion','guardar','dispositivo',tel,'token',current_setting('securia.test_token'),'lote','c0123456789abcdef000001','filas',jsonb_build_array(jsonb_build_object('col','novedades','id','pendiente-anterior','valor',jsonb_build_object('id','pendiente-anterior','guardId','franco-prueba','createdBy','franco-prueba','turnoId','turno-anterior','fecha','2026-11-06','hora','01:01','texto','Pendiente conservado')))));
 if not exists(select 1 from jsonb_array_elements(r->'acuses') x where x->>'estado'='confirmado') then raise exception 'No permitió confirmar el pendiente anterior: %',r;end if;
 r:=public.guardia_corporativo_rpc(jsonb_build_object('accion','ingresar','dispositivo',tel,'pin','638201'));
 execute 'reset role';
 if not coalesce((r->>'ok')::boolean,false) or r->>'guardia'<>g->>'id' then raise exception 'Falló el acceso con el PIN original';end if;
 token:=r->>'token';e:=r->'estado';
 if not exists(select 1 from jsonb_array_elements(e->'punches') x where x->>'id'='turno-anterior' and coalesce(x->>'out','')<>'') or not exists(select 1 from jsonb_array_elements(e->'punches') x where x->>'id'='otro-turno' and coalesce(x->>'out','')='') then raise exception 'El traspaso no aisló la actividad de cada teléfono';end if;
 if not exists(select 1 from jsonb_array_elements(e->'rounds') x where x->>'id'='ronda-anterior' and x->>'createdBy'=g->>'id' and x->>'guardId'='franco-prueba' and x#>>'{puntos,0,hora}'='01:05') then raise exception 'No conservó la ronda activa y sus puntos';end if;
 filas:=jsonb_build_array(jsonb_build_object('col','punches','id','actividad-corporativo','valor',jsonb_build_object('id','actividad-corporativo','guardId',g->>'id','responsableId','franco-prueba','fecha','2026-11-06','in','01:10','out','','startedAt',ahora,'dispositivoId',guardia_private.hash(tel))));
 filas:=filas||jsonb_build_array(jsonb_build_object('col','novedades','id','nota-corporativo','valor',jsonb_build_object('id','nota-corporativo','guardId','franco-prueba','createdBy',g->>'id','turnoId','actividad-corporativo','fecha','2026-11-06','hora','01:12','texto','Firma personal desde cuenta compartida')));
 execute 'set local role anon';
 r:=public.guardia_sync(jsonb_build_object('accion','guardar','dispositivo',tel,'token',token,'lote','c0123456789abcdef000002','filas',filas));
 execute 'reset role';
 if (select count(*) from jsonb_array_elements(r->'acuses') x where x->>'estado'='confirmado')<>2 then raise exception 'No guardó actividad y firma personal: %',r;end if;
 rechazo:=false;
 begin perform public.guardia_rpc(jsonb_build_object('accion','cambiar_pin','dispositivo',tel,'token',token,'actual','638201','nuevo','12345'));exception when others then rechazo:=true;end;
 if not rechazo then raise exception 'Permitió cambiar el PIN del corporativo a cinco números';end if;
 execute 'set local role anon';
 r:=public.guardia_admin_rpc(jsonb_build_object('accion','ingresar','dispositivo',tel,'pin','638201'));
 if not coalesce((r->>'ok')::boolean,false) or coalesce(r->>'token','')='' then raise exception 'El panel no permite ingresar sólo con el PIN';end if;
 r:=public.guardia_admin_rpc(jsonb_build_object('accion','consultar','dispositivo',tel,'token',r->>'token'));
 execute 'reset role';
 if not coalesce((r->>'ok')::boolean,false) or r->>'guardia'<>g->>'id' then raise exception 'El panel no reconoce al administrador del corporativo';end if;
 if has_function_privilege('anon','guardia_private.validar_corporativo(jsonb,jsonb,text)','EXECUTE') then raise exception 'La validación privada quedó expuesta';end if;
end;
$prueba$;
rollback;
select 'Corporativo, PIN de seis números, pendientes, firmas, autoría y aislamiento por teléfono verificados; ROLLBACK' as resultado;
