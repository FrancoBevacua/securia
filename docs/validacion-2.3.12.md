# Securia 2.3.12 · Fluidez, presencia y dictado

Cambios preparados en `codex/fluidez-presencias-dictado`.

- Inicio: se elimina la consulta de catálogo previa al PIN. El acceso autenticado sigue trayendo los datos de la cuenta.
- Persistencia: lectura y recepción cifradas en lotes de hasta 20 filas. Cada escritura agrupada es una sentencia SQLite atómica, con `synchronous=FULL`. El cursor avanza únicamente después de confirmar las filas en disco. Se permite reintentar una recepción fallida sin perder la cola.
- Selectores: las hojas cerradas no montan su contenido; las opciones abiertas usan una lista virtualizada con 12 filas iniciales.
- Navegación: márgenes seguros desde el primer cuadro, barra inferior sin encogimiento y aviso de sincronización superpuesto para evitar desplazar la pantalla.
- Guardias en servicio: sólo el último ingreso/egreso del libro, con su fecha, hora, puesto y turno. La firma del asiento no identifica a quien ingresó. Administradores y cuentas corporativas quedan fuera. Se conserva la caducidad de 24 horas para ingresos sin egreso y se excluyen movimientos futuros, borrados, adicionales y externos.
- Ajustes: se retira el formulario de Supervisor. Los datos históricos se conservan.
- Salida: cierre idempotente, sin nuevas sincronizaciones durante el cierre. Una sesión ya vencida no muestra el aviso de DNI/PIN al salir; cualquier pendiente sigue impidiendo el cierre para conservarlo.
- Asistente: micrófono con reconocimiento de voz en español que completa el borrador. El envío siempre es manual. Se cancelan permisos/resultados pendientes al cerrar o cambiar de pantalla; errores y permisos denegados permiten reintentar.

## Evidencia

Se ejecutaron `npm run typecheck`, `npm test` (303 pruebas aprobadas), `npm ci --prefix admin` y `npm run build --prefix admin`. Tras agregar la comprobación de desmontaje del dictado, se repitieron TypeScript y las 14 pruebas de interfaz, chat y voz: todas aprobadas. Los módulos compartidos se generan con el script del panel.

Las pruebas nuevas comprueban escrituras atómicas y rollback con SQLite real, cifrado AES-GCM real, recuperación tras un fallo de disco, conservación de pendientes al salir, sesión vencida, relevos tardíos, administrador excluido, selectores con 2.000 opciones y el ciclo de vida del dictado. Una importación de 250 novedades más la fila de site usa 13 escrituras agrupadas en lugar de 251 escrituras individuales.

Consulta de estadísticas agregadas del servidor, sin modificar datos: 13.849 llamadas de sincronización, promedio 108,2 ms y máximo 3.324,4 ms; 21 accesos corporativos, promedio 742,8 ms y máximo 3.264,4 ms. Son estadísticas acumuladas de ejecución SQL; no miden red, transferencia ni procesamiento del teléfono. No se hicieron cambios en producción.

## Android

Versión 2.3.12, código 40; referencia anterior 2.3.11, código 39. Compilación con `compilar.ps1` y verificación de paquete/firma mediante `verificar-apk.ps1`.

Compilación finalizada el 17 de noviembre de 2026. Verificados el paquete `ar.com.securia.app`, la firma de distribución coincidente con 2.3.11, el aumento de código 39 → 40 y la alineación de 16 KB. APK local en `output/apk/Securia-2.3.12.apk`, con copia en `Securia.apk`; informe de verificación en `output/apk/verificacion-2.3.12.json`. Estos artefactos no se versionan.

Pendiente la instalación sobre la versión anterior y la prueba visual con navegación de tres botones, teclado abierto, envío y respuesta del chat, así como el reconocimiento con micrófono real. ADB no detecta un teléfono y el AVD `Medium_Phone` carece de la imagen de sistema configurada. Las pruebas automatizadas de componentes no sustituyen esa validación.
