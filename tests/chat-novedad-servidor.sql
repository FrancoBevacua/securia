-- Datos ficticios, sin modificar cuentas ni registros del servicio.
begin;
do $prueba$
declare e jsonb:=guardia_private.sync_vacio(); obj uuid; r jsonb; n jsonb;
 tel text:=encode(extensions.gen_random_bytes(32),'hex');tok text:=encode(extensions.gen_random_bytes(32),'hex');
 fecha text:=to_char(now() at time zone 'America/Argentina/Buenos_Aires','YYYY-MM-DD');instante bigint:=floor(extract(epoch from now())*1000);
begin
 e:=jsonb_set(e,'{guards}','[{"id":"corp-chat","nombre":"Guardia Paseo","apellido":"","corporativo":true,"rol":"admin","cuenta":true},{"id":"paseo-chat","nombre":"Ana","apellido":"Prueba","rol":"vigilador"},{"id":"playa-chat","nombre":"Bruno","apellido":"Playa","rol":"vigilador"}]');
 e:=jsonb_set(e,'{punches}',jsonb_build_array(jsonb_build_object('id','actividad-chat','guardId','corp-chat','responsableId','paseo-chat','dispositivoId',guardia_private.hash(tel),'fecha',fecha,'in','00:00','out','','startedAt',instante)));
 insert into guardia_private.documentos(cifrado) values(guardia_private.cifrar(e)) returning id into obj;
 insert into guardia_private.dispositivos(hash,objetivo) values(guardia_private.hash(tel),obj);
 insert into guardia_private.sesiones(hash,dispositivo,guardia) values(guardia_private.hash(tok),guardia_private.hash(tel),'corp-chat');
 n:=jsonb_build_object('id','chat:prueba','fecha',fecha,'hora','00:10','categoria','Cierre','guardId','paseo-chat','createdBy','corp-chat','turnoId','actividad-chat','texto','Se cierra el portón. Realizó el cierre: Gs Playa, Bruno.','datos',jsonb_build_object('operacionAcceso','cierre','acceso','Portón de prueba','realizadoPorId','playa-chat','realizadoPor','Gs Playa, Bruno'));
 execute 'set local role anon';
 r:=public.guardia_sync(jsonb_build_object('accion','guardar','dispositivo',tel,'token',tok,'lote','c232abcdef012345678901','filas',jsonb_build_array(jsonb_build_object('col','novedades','id',n->>'id','valor',n))));
 if not exists(select 1 from jsonb_array_elements(r->'acuses') x where x->>'estado'='confirmado') then raise exception 'La nube rechazó la novedad del chat: %',r;end if;
 r:=public.guardia_rpc(jsonb_build_object('accion','consultar','dispositivo',tel,'token',tok));
 if not exists(select 1 from jsonb_array_elements(r#>'{estado,novedades}') x where x->>'id'='chat:prueba' and x->>'guardId'='paseo-chat' and x->>'createdBy'='corp-chat' and x#>>'{datos,realizadoPorId}'='playa-chat' and x#>>'{datos,realizadoPor}'='Gs Playa, Bruno') then raise exception 'Se perdió la autoría o el ejecutor de la operación';end if;
 execute 'reset role';
end;
$prueba$;
rollback;
select 'Novedad del chat sincronizada conservando cuenta, firma, actividad y guardia ejecutor; ROLLBACK' as resultado;
