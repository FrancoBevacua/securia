# VIGELIUM 2.0.0

Instalar `output/apk/VIGELIUM-2.0.0.apk` sobre la aplicación actual en cada teléfono. Código de versión 19, mismo paquete y certificado de firma. No desinstalar ni borrar datos: la aplicación importa los pendientes anteriores.

El sistema nuevo ya está activo en Supabase. Guarda cada registro en una cola local cifrada y transfiere fotos por separado, con verificación de integridad. Las consultas son incrementales y los recibos evitan duplicados después de una respuesta perdida. Los archivos internos se retiran después de su confirmación en la nube.

Abrir la aplicación con Internet y esperar a que los pendientes se confirmen. Si hace falta, usar **Ver → Recuperar sincronización → Reintentar pendientes**. Las diferencias de turnos cerrados quedan respaldadas en **Historial de recuperación** y no bloquean otros registros. Las cuentas y sesiones se conservaron.

En el editor del libro, adjuntar evidencia aparece en Novedad, Externos, Apertura y Cierre. Debajo de **Sector** se puede escribir una descripción opcional de hasta 100 caracteres. El PDF usa hora, tipo y esa descripción sin repetir el asiento completo; entran hasta cuatro imágenes por fila con margen pequeño.

Verificación: 187 pruebas locales, compilación Android, firma y compatibilidad de actualización; prueba HTTPS con 500 novedades, foto de varias partes, reinicio de la cola y pérdida simulada de una respuesta. Los 477 registros y siete adjuntos corporativos se conservaron. La comprobación en los teléfonos físicos se realiza después de instalar la actualización.

Detalles del sistema y evidencia: [nube/SINCRONIZACION-2.0.md](nube/SINCRONIZACION-2.0.md). Documentación general: [README.md](README.md).
