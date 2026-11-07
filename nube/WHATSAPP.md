# Reportes de Vigelium por WhatsApp Business Platform

La APK permite guardar supervisor, número, hora (18:00 por defecto) y consentimiento. La programación se guarda cifrada en el servidor y sólo administración puede modificarla. El canal permanece pendiente hasta completar la conexión con Meta.

Estado al 19/09/2026: migración y Edge Function desplegadas. La función responde 401 ante peticiones sin el secreto de cron. No hay canales activos ni mensajes de prueba enviados a terceros. Quedan pendientes los secretos de Meta, la plantilla aprobada y el cron de producción.

El libro conserva el corte de las 19:00. Si se envía a las 18:00, el PDF y el mensaje dicen que es un avance hasta las 18:00. Para enviar el período completo, elegir las 19:00 o más tarde. Sólo se incluyen registros sincronizados antes del envío.

## Activación

1. Habilitar el número remitente en WhatsApp Business Platform. El número de destino es el del supervisor.
2. Crear y obtener aprobación de una plantilla con encabezado **DOCUMENT** y este cuerpo (cinco variables posicionales):

   {{1}}, {{2}}. Adjunto el reporte del servicio de {{3}}, correspondiente al {{4}}. {{5}} Enviado automáticamente desde Vigelium.

   Ejemplos: Buenas tardes / Ana / Libertad Rosario / 19-09-2026 / Avance hasta las 18:00; el período finaliza a las 19:00.

3. Configurar secretos de la Edge Function: WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_GRAPH_VERSION (versión vigente de Graph), WHATSAPP_TEMPLATE, WHATSAPP_LANGUAGE (idioma exacto aprobado), REPORT_CRON_SECRET (aleatorio, al menos 32 bytes).
4. Ejecutar `node scripts/preparar-worker.cjs` y desplegar `whatsapp-reportes`. El JWT de Supabase está desactivado exclusivamente en esta función porque comprueba el secreto propio de cron antes de cualquier lectura o envío. No exponer ese secreto en el teléfono.
5. Guardar en Vault el mismo secreto como `vigelium_report_cron` y la URL del proyecto como `vigelium_project_url`. Habilitar pg_cron y pg_net.
6. Tras verificar la plantilla y el remitente, habilitar `canal_listo` en `guardia_private.whatsapp_config` únicamente para el objetivo autorizado. Guardar la programación desde una cuenta administradora.
7. Programar esta llamada cada minuto con Supabase Cron:

```sql
select cron.schedule('vigelium-reportes','* * * * *',$cron$
 select net.http_post(
   url:=(select decrypted_secret from vault.decrypted_secrets where name='vigelium_project_url')||'/functions/v1/whatsapp-reportes',
   headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='vigelium_report_cron')),
   body:='{}'::jsonb
 );
$cron$);
```

## Entrega y recuperación

Una reserva única por objetivo y día evita envíos duplicados, incluso con llamadas simultáneas. El planificador admite hasta una hora de retraso. No envía días históricos al activar una cuenta.

`aceptado` significa que Meta devolvió un identificador; no confirma recepción ni lectura. `incierto` significa que hubo un problema después de iniciar el envío: revisar Meta antes de autorizar cualquier reintento. No se reenvía automáticamente. Si queda `preparando` o `enviando` después de una interrupción, revisar ese intento antes de intervenir. Los errores al preparar evidencia impiden enviar un PDF incompleto.

Los tokens y permisos de Meta, la aprobación de la plantilla y la activación final están pendientes del alta de la cuenta. Las pruebas locales usan respuestas simuladas; no envían mensajes reales.

Referencias: [plantillas de WhatsApp](https://whatsappbusiness.com/blog/manage-message-templates-whatsapp-business-api/) y [programación de funciones en Supabase](https://supabase.com/docs/guides/functions/schedule-functions).
