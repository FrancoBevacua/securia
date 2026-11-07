# Servicio de nube VIGELIUM 1.4.2

Proyecto Guardia App de Supabase: dqdjkxychiwcnplhytzc.

## Actualización de los teléfonos

Instalar la APK 1.4.2 sobre la aplicación existente en ambos teléfonos. No desinstalar ni borrar datos: la clave de los cambios pendientes está en SecureStore. Esta versión no ejecuta el reinicio histórico de cuentas. Se conserva la cuenta de Franco Bevacua, su PIN y su rol de administrador.

Al iniciar, Android conecta el dispositivo al objetivo corporativo existente. La capacidad de aprovisionamiento está en `src/provisionCorporativa.ts`, excluido del repositorio. No es una clave privada de Supabase. La acción `conectar` admite otro teléfono del mismo objetivo; sólo devuelve la confirmación del vínculo. El historial exige DNI/PIN o un registro válido. El código actual vence el 10/09/2027 a las 23:59 UTC. Antes de esa fecha debe renovarse el aprovisionamiento para nuevas instalaciones; los dispositivos ya vinculados conservan su vínculo.

Las cuentas se comparten entre teléfonos vinculados. Un vigilador cuya alta anterior falló debe registrarse desde la nueva versión; no se inventan cuentas ni se reemplazan credenciales. Si el servidor creó la cuenta pero se perdió la respuesta, repetir el registro intenta ingresar con ese mismo DNI/PIN. Un PIN diferente no modifica la cuenta existente.

## Corrección del incidente

- Android exige bytes en `AESSealedData.fromCombined`. Ahora se decodifica explícitamente el Base64 almacenado antes de pasar al puente Kotlin. El formato previo y su clave se conservan.
- Los errores de descifrado o de acceso a la clave son breves y no muestran el contenido cifrado ni la traza nativa.
- Se corrigió la validación de fecha de nacimiento en el RPC. Usa expresiones sin escapes ambiguos.
- Se vincula el teléfono corporativo al objetivo existente antes de mostrar el acceso. Android no recurre a una cuenta local cuando falta la conexión.
- La cola combina altas independientes y cambios compatibles de dos teléfonos. Conserva el rol y la identidad del servidor. Si ambos modifican el mismo dato de manera incompatible, conserva la copia cifrada y muestra el conflicto.
- Las colas anteriores sin base de comparación sólo recuperan altas sin colisiones; no reemplazan registros existentes diferentes.

## Despliegue y seguridad

El instalador base es `002_servicio.sql`. `003_alta_sin_administrador.sql` incorpora el alta sin administrador y la asignación privada. La migración aplicada para 1.4.2 es `supabase/migrations/20260912002623_acceso_compartido_y_registro.sql`; no borra ni reinicia las tablas.

El registro fuerza el rol vigilador. Sólo el propietario de la base puede asignar administradores con `guardia_private.asignar_administrador(uuid,text)`. No hay elevación de rol desde el cliente. La cuenta real conserva el rol admin y la revisión 2 después de las pruebas.

Las tablas privadas tienen RLS y no conceden acceso directo a anon/authenticated. El único acceso público es `guardia_rpc(jsonb)`, que valida dispositivo, sesión, identidad, autoría y revisión. Los avisos del asesor sobre tablas sin políticas y el RPC SECURITY DEFINER corresponden a esta arquitectura deliberada; no se habilitan políticas públicas para eliminarlos.

Los perfiles, registros y evidencias se cifran mediante pgcrypto PGP con AES-256; las claves viven en Vault. El DNI se busca mediante HMAC y se conserva legible dentro del documento cifrado. El PIN se verifica con bcrypt costo 12 sobre un verificador con sal individual y HMAC del servidor. Cinco intentos fallidos bloquean el dispositivo durante un minuto. Las sesiones expiran a las 24 horas. Los tokens y capacidades de dispositivo se almacenan como hashes en el servidor.

Los identificadores, revisiones y vencimientos son metadatos operativos. El propietario con acceso administrativo a PostgreSQL/Vault puede descifrar los documentos; no es cifrado de extremo a extremo frente al propietario.

En Android, SecureStore protege la capacidad del dispositivo y la clave local. El estado confirmado permanece en memoria; los cambios pendientes usan AES-256-GCM en AsyncStorage. El cierre de sesión exige sincronización. La copia de seguridad automática de Android está desactivada.

## Verificación de 1.4.2

- 60 pruebas automáticas, incluidas AES-GCM real con adaptador estricto del contrato Kotlin, recuperación de cola después de un PIN incorrecto, registro repetido, combinación de dos teléfonos y escritura concurrente con respuesta perdida.
- TypeScript sin errores.
- Pruebas transaccionales en el servicio real: cifrado, permisos, DNI/PIN, bloqueo de intentos, registro, asignación privada de administrador, rechazo de elevación de rol, escritura, historial de turno cerrado, idempotencia, conflicto, cambio de PIN y segundo teléfono vinculado al mismo objetivo.
- Las pruebas SQL usan `tests/nube-servidor.sql`, fixtures ficticios y ROLLBACK. Se verificó después que permanecen un objetivo, una cuenta y un teléfono reales, con la misma revisión 2.
- No se ingresó con el PIN del usuario ni se probó esta APK en sus teléfonos físicos. Las pruebas de adaptadores y servicio no sustituyen esa comprobación final de instalación.

## Operación y límites

### Recuperación automática y altas operativas 1.8.4

El cliente abre su copia cifrada local antes de consultar la red. La sincronización en segundo plano recupera automáticamente diferencias incompatibles y rechazos de actividad histórica mediante el servicio de respaldo cifrado existente. Sólo libera la cola después de confirmar el respaldo remoto y el estado local. Los errores de permisos y fallos de red conservan los pendientes.

La migración autorizada `20260926181707_altas_catalogo_operativas.sql` está aplicada. Un vigilador autenticado puede incorporar personas sin cuenta y accesos nuevos. Se rechazan altas con credenciales o rol administrador y modificaciones de accesos existentes. No agrega permisos de ejecución ni acceso directo a tablas.

`tests/altas-catalogo-servidor.sql` verificó esas operaciones mediante el RPC real, rol `anon` y sesión corporativa ficticia. La transacción se revirtió íntegramente; el objetivo real conservó la revisión 205. Las pruebas de recuperación cifrada y de teléfonos independientes también usan datos ficticios y ROLLBACK. La APK requiere comprobación final en los dispositivos físicos.

El asesor mantiene los avisos existentes de [RLS sin políticas](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [funciones SECURITY DEFINER accesibles por anon](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) y [por authenticated](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). Las tablas privadas deniegan acceso directo; los RPC públicos validan la sesión corporativa y el alcance de cada operación.

### Actividad independiente 1.8.3

`20260925081327_actividad_independiente_por_telefono.sql` permite una actividad abierta por dispositivo. El cliente identifica el teléfono con SHA-256 de su secreto de vinculación; el secreto nunca se incluye en los registros. `guardia_rpc` contrasta ese identificador con el teléfono autenticado antes de guardar y sólo verifica su actividad al cerrar sesión. La recuperación aplica la misma validación. Las filas históricas sin dispositivo se conservan para compatibilidad.

`tests/telefonos-servidor.sql` prueba el RPC con dos dispositivos y la misma cuenta: ambos guardan, uno cierra, el otro continúa, y ninguno puede cerrar la actividad ajena. Los datos de prueba se revierten con ROLLBACK. La migración no elimina sesiones ni documentos reales y no agrega permisos públicos. Los avisos de [funciones SECURITY DEFINER accesibles por anon](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) corresponden al acceso corporativo existente con validación obligatoria de dispositivo y token. Las tablas privadas mantienen el acceso directo revocado y RLS sin políticas.

### Recuperación 1.8.2

La migración `20260925005245_recuperacion_cifrada_sincronizacion.sql` está aplicada. `guardia_recuperacion` valida la sesión corporativa mediante `guardia_rpc` antes de leer o escribir. La tabla privada `recuperaciones` guarda cifradas las dos instantáneas completas. Su acceso directo está revocado y RLS permanece habilitado. Cada guardia puede leer sus respaldos; los administradores sólo pueden leer los de su propio objetivo. No se guardan tokens de sesión en las instantáneas.

La operación `recuperar` incorpora sólo altas que pasan la validación del servicio. Conserva las versiones corporativas existentes y archiva todo el contenido local, incluidas evidencias y registros de turnos cerrados que no pueden modificarse. La huella del documento hace idempotente el reintento ante una respuesta perdida. Si falla el respaldo o la confirmación local, no se vacía la cola. `reiniciar_sesion` exige un respaldo de ese teléfono y guardia; elimina sólo las sesiones del dispositivo autenticado, sin borrar cuentas ni documentos. Cada teléfono debe ejecutar su propia recuperación porque el servidor no tiene sus datos offline.

Se verificó con PostgreSQL local y una transacción con datos ficticios, cifrado real, rol `anon` y ROLLBACK en el servidor. Se comprobó rechazo de sesión inválida, conservación de ambas versiones, idempotencia, altas válidas, reinicio de sesión y ausencia de acceso directo a la tabla. Después de la prueba permanecieron un objetivo, una sesión vigente y cero respaldos ficticios.

El asesor de Supabase señala [RLS sin políticas](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) y [función SECURITY DEFINER accesible a anon](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable). En esta arquitectura son deliberados: las tablas privadas deniegan acceso directo y el único punto de entrada usa autenticación corporativa propia, bloqueo del objetivo y validación de autoría. El nuevo RPC tiene `search_path=''`, no está concedido a `PUBLIC` ni a `authenticated`, y no omite las validaciones para publicar altas. El permiso de ejecución a `anon` y el alcance de recuperación fueron autorizados expresamente antes de desplegar.

### Actualización 1.8.1

La migración `20260922233757_sincronizacion_incremental.sql` agrega la recepción de deltas: el cliente consulta el servidor, combina los cambios compatibles y envía sólo filas nuevas o modificadas. Las filas omitidas se conservan. Se mantienen las comprobaciones de identidad, autoría y revisión, así como la compatibilidad con clientes que envían el estado completo. Esta migración ya fue aplicada al servidor del proyecto.

El cliente sigue descargando el estado completo al consultar; esta mejora reduce la carga de subida. Los conflictos reales se resuelven desde **Ver → Revisar diferencias**, con elección explícita y respaldos cifrados de las dos versiones. La cola conserva el resultado combinado si la red falla durante el envío. Una diferencia exclusivamente en `updatedAt` no se considera una edición incompatible.

Los nuevos inicios requieren Internet. Durante una sesión abierta se pueden guardar cambios pendientes; deben sincronizarse antes del relevo en ese teléfono. Nunca borrar datos ni desinstalar con cambios pendientes. Desde 1.8.3 la actividad es independiente por dispositivo: el otro teléfono puede permanecer abierto o desconectado.

No emitir una invitación inicial nueva para recuperar este objetivo: `vincular` crea otro objetivo. Un dispositivo perdido requiere revocación por el propietario. No hay recuperación automática de PIN.

El cliente consulta el objetivo completo después de autenticar. El límite por documento es 32 MB de JSON con evidencias. El archivo histórico, los respaldos externos y la rotación de claves requieren administración; no hay purga automática. Los PDF, fotos y mensajes exportados contienen el material legible que el usuario decide compartir. La versión web se usa para pruebas y guarda claves en localStorage, sin la protección SecureStore de Android.
# Corrección de sincronización con adjuntos (1.8.6)

Las migraciones `20260929213349_sincronizacion_adjuntos_sin_timeout.sql` y `20260929213903_recuperacion_adjuntos_lineal.sql` están aplicadas al proyecto. Evitan subconsultas que volvían a expandir el historial y sus fotos por cada fila. La excepción de tiempo de 45 segundos está reservada a los RPC de sincronización y recuperación; no se amplían permisos ni se modifican límites globales de roles. Conservan las validaciones corporativas y el respaldo cifrado antes de recuperar.

`tests/adjuntos-servidor.sql` genera 400 registros y más de 8 MB de datos base64 incomprimibles; prueba el guardado incremental y la recuperación bajo `anon`, verifica que la evidencia esté íntegra y que el historial cerrado no cambie, y revierte todos sus datos con ROLLBACK. Los avisos del asesor de seguridad conservan las mismas categorías documentadas para la arquitectura corporativa existente.

