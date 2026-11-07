# Sincronización 2.0 — activada

El protocolo 2 se activó en Supabase el 1 de octubre de 2026, después de la autorización del usuario. Se conservaron las cuentas, sesiones y el documento original cifrado.

Migración aplicada:

`supabase/migrations/20261001071312_sincronizacion_registros_adjuntos_v2.sql`

## Cambios

- Diario local AES-GCM por registro en SQLite; guardar no espera Internet ni convierte fotografías.
- Consultas incrementales de hasta 200 filas con cursor durable.
- Lotes de hasta 250 filas, comparación de versiones por fila y recibos idempotentes.
- Fotografías/archivos cifrados separados, transferidos en partes de 128 KiB y verificados por SHA-256.
- Descargar fotografías sólo al verlas o exportarlas; caché en memoria limitada a 8 MiB.
- Envío de notas antes del cierre de una actividad, incluso con cientos de notas acumuladas.
- Conflictos conservados en respaldos cifrados consultables; no bloquean las filas válidas.
- Importación de la cola anterior. Sólo después de recibos durables se retiran las copias anteriores y los archivos internos confirmados; se compacta SQLite.

## Alcance del servidor

Mantiene Supabase y las identidades DNI/PIN existentes. No requiere cerrar o borrar sesiones.

Antes de transformar cada documento se conserva su contenido cifrado original en `guardia_private.sync_originales`. Las colecciones conservan sus IDs. La vista compatible del panel conserva el historial completo con referencias a imágenes.

Las seis tablas nuevas tienen RLS y revocación de acceso directo para `anon` y `authenticated`. `guardia_sync` es SECURITY DEFINER con acceso de `anon`, como los RPC actuales del producto: cada operación exige una capacidad de dispositivo, token vigente, cuenta activa y pertenencia al objetivo. Ningún adjunto se publica con URL abierta. Los helpers privados no pueden ejecutarse desde el cliente.

El panel administrativo resuelve una fotografía únicamente al solicitarla. El trabajador de WhatsApp está desplegado como versión 3; continúa validando `REPORT_CRON_SECRET`.

Los RPC antiguos de guardado y recuperación devolverán una indicación de actualizar a 2.0.0, conservando la cola de los teléfonos que aún tengan versiones anteriores.

## Verificación realizada

- 477 filas originales y normalizadas coinciden; configuración del objetivo conservada.
- Siete adjuntos cifrados en 21 partes; longitud y SHA-256 verificadas después de reconstruirlos.
- Documento de metadatos: 30.824 bytes frente a 1.578.146 bytes del original cifrado, que permanece respaldado.
- `tests/sync-v2-servidor.sql` pasó en el servidor real: paginación, turno cerrado offline, adjunto, aislamiento de conflicto y recibo idempotente. Los datos sintéticos se revirtieron.
- Prueba HTTPS con la clave publicable y el transporte de la aplicación: 500 novedades, turno cerrado, siguiente actividad, adjunto de varias partes y pérdida simulada de la respuesta. Resultado: cero pendientes y cero resguardos inesperados; 8,465 segundos en total. Cada guardado tardó entre 236 y 946 ms. Evidencia en `output/verificacion-api-sync-v2.json`.
- Objetivo, dispositivo y sesión de prueba HTTP eliminados después de verificar. El corporativo conserva su sesión vigente.
- La cuenta `anon` no puede acceder directamente a ninguna tabla nueva ni ejecutar sus helpers privados.
- 187 pruebas locales pasaron; APK compilada, firma y compatibilidad con la versión instalada verificadas.

## Instalación

Instalar `output/apk/VIGELIUM-2.0.0.apk` encima de la aplicación actual en cada teléfono. No desinstalar ni borrar datos: la nueva aplicación importa la cola anterior. Abrir la aplicación con Internet y esperar la confirmación de pendientes.

La instalación y la comprobación en un teléfono Android físico siguen pendientes.

## Advisors

La revisión detecta [RLS habilitado sin políticas](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) en el esquema privado y [RPC SECURITY DEFINER ejecutable por anon](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable). Son parte de este modelo de autenticación propia: tablas y helpers privados están revocados, y el RPC valida dispositivo, token, cuenta y objetivo. Se comprobó rechazo de token inválido y adjuntos de otro objetivo.

Persisten tres recomendaciones de [índices en claves foráneas](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys) de las tablas anteriores (dispositivos, invitaciones y sesiones); ninguna corresponde a las tablas nuevas.

Pruebas locales cubren caída de Internet, reinicio, respuesta perdida, edición concurrente, integridad de adjuntos, autorización, respaldo de conflictos y una actividad con 500 notas. La firma de distribución y el paquete se verifican mediante `verificar-apk.ps1`.

No se enviaron mensajes de WhatsApp a personas reales durante estas verificaciones.
