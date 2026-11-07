# Securia · Centro de control

Diseño elegido: propuesta 02. Azul Francia oscuro, rojo y blanco. El inicio móvil muestra saludo, alta de novedades, Accesos, Recorridos, Ingresos/Egresos, Descanso y cuatro registros recientes. No muestra «Turno activo». La actividad interna ligada a la sesión se conserva para proteger la autoría y la sincronización.

## Funciones

- Nombre Securia, presentación animada, logo y copyright de Franco Daniel Bevacua.
- GPT (OpenAI) en Ajustes, clave propia y modelo configurable. La clave móvil utiliza SecureStore y no se incluye en el estado sincronizado. Al cambiar de proveedor se limpia la clave del formulario para evitar enviarla a otro destino.
- DNI argentino con puntos en empleados y choferes externos.
- Ingresos/Egresos agrupa Vigiladores, Adicionales y Externos. Los accesos anteriores redirigen a esta sección. En el editor del libro, Externos es un subtipo de Ingresos/Egresos; las categorías históricas de los asientos se conservan.
- Fichas de externos por empresa, con tarea, lugar y empleados identificados por DNI. Se crean al guardar la visita o la novedad. La selección recupera los datos habituales y solicita nuevamente la autorización/documentación de cada ingreso.
- Recorridos reúne Control de locales y Playa. Cada local conserva su estado abierto/cerrado, hora y observación. Playa conserva guardia, puesto, novedades e imágenes.
- Accesos admite múltiples puertas y precintos. El texto para CCTV incluye todos los números y comprueba el servicio del firmante en la fecha y hora de cada registro. Un egreso documentado en el libro prevalece sobre una sesión abierta en el teléfono.
- Los cuatro dígitos recordados se escriben en el valor de los campos nuevos de precinto. Se puede editar el número completo. Un prefijo sin sus tres dígitos finales no se guarda como un precinto válido.
- Descanso en el libro: guardia, puesto, cobertura opcional e inicio. Se puede guardar en curso y completar la fecha y hora de fin al terminar; admite el cruce de medianoche.
- Generar informe guarda el documento y su resumen breve en una operación local, sin exigir IA. Confirma disco antes de cerrar; reintentar utiliza los mismos identificadores. La consulta móvil y web organiza los 16 puntos en cuatro secciones. En móvil se conserva edición, baja lógica y exportación PDF.
- Panel web oscuro y adaptable, tarjetas con ilustración de categoría y degradados, opción de lista persistente y página de lectura de informes fuera de un modal.

## Asistente del vigilador

El ícono de conversación aparece abajo a la derecha después de iniciar sesión. Ofrece consultas, redacción de novedades e informes de seguridad. Utiliza el proveedor y la clave configurados en Ajustes.

En «Directivas y PDFs» se selecciona el puesto de consulta. El asistente incorpora las directivas activas compartidas de ese puesto y las generales. También permite agregar PDFs generales o de un puesto, revisar su texto y conservarlos cifrados para la cuenta actual en el teléfono. Esta biblioteca adicional es local; no se sincroniza entre teléfonos ni se comparte con otras cuentas.

Los PDFs con texto legible en todas las páginas detectadas se leen localmente. Los escaneados y mixtos conservan el archivo entero y requieren un proveedor con lectura de documentos; se envían a ese proveedor al seleccionar el archivo. Una respuesta truncada se rechaza para evitar conservar una transcripción incompleta. La biblioteca mantiene el límite de 150.000 caracteres por documento y pide dividir los archivos que lo superan.

Desde 2.2.0 las consultas incorporan también fuentes operativas de todas las colecciones disponibles para la sesión: libro, visitas, accesos, actividades, programación, recorridos, informes, catálogos y contactos del servicio. Las fuentes se proyectan campo por campo: no se serializa el estado completo ni se adjuntan credenciales de las cuentas, fotos ni archivos adjuntos. Las proyecciones estructuradas omiten DNI y datos privados de los perfiles. Los textos libres de novedades, informes y documentos se utilizan como fueron redactados y pueden contener datos personales. Las fuentes operativas incluyen nombres del personal y teléfonos de los contactos del servicio; se envían al proveedor de IA configurado al realizar una consulta. Los PDFs mantienen su alcance general o por puesto.

El índice recorre el contenido completo y adjunta fragmentos pertinentes con referencias D (documentos) y O (operación), un máximo de 24.000 caracteres de cada conjunto. La cobertura indica cuando el detalle es parcial; los totales diarios se calculan antes de seleccionar fragmentos. La presencia se calcula con los movimientos locales y sincronizados disponibles, no mediante una consulta remota en vivo ni detección física. Distingue guardias actuales, guardias que prestaron servicio durante el día, turnos programados, externos confirmados y pendientes de autorización.

En el predio usa la misma proyección que el asistente: evita duplicar una visita y su asiento, admite egresos parciales y reingresos, conserva fechas reales de egreso y excluye registros eliminados o futuros. Las fichas históricas no acreditan presencia. Los ingresos antiguos sin egreso se muestran con una aclaración. Los bloques se agrupan por sector, con texto blanco sobre fondos de contraste y rojo fijo para Escalera al techo.

En Ajustes ya no se monta la configuración de WhatsApp Business. La acción Compartir con supervisor entrega el PDF al selector nativo de archivos de Android; el guardia elige WhatsApp, el destinatario y confirma el envío. El resultado no se interpreta como confirmación de entrega. Esta actualización no modifica la configuración ni despliega el worker del servidor.

Verificación de 2.2.0: 231 pruebas automatizadas aprobadas, TypeScript y build del panel web aprobados. Incluye pruebas con PDF multipágina y mixto, egresos parciales, reingresos, movimientos duplicados, servicios nocturnos, totales de 500 registros, fuentes al final de documentos extensos, autocompletado y PDF adjunto al selector. Revisión visual del componente real con adaptadores web y datos ficticios a 320, 390 y 768 píxeles; se abrió el detalle del personal y se seleccionó Externos en el modal de 320 píxeles sin desbordamiento horizontal. Las capturas están en `output/review-ui/`. Los 24 módulos modificados incluidos en el bundle Android coinciden con los fuentes finales, según `output/verificacion-fuentes-2.2.0.json`. La prueba con un proveedor de IA real y el envío efectivo por WhatsApp desde un teléfono físico quedan pendientes; las pruebas usan proveedores y adaptadores simulados.

La APK `output/apk/Securia-2.2.0.apk` compiló correctamente y tiene el mismo SHA-256 que `Securia.apk`. Versión 2.2.0, código 22, paquete `ar.com.securia.app`, firma de distribución conservada y alineación de 16 KB verificadas contra la APK 2.1.1, código 21. Recibo: `output/apk/verificacion-2.2.0.json`. Instalar sobre la versión anterior, sin desinstalar ni borrar datos. Esta entrega no publica el panel web ni modifica servicios productivos.

Los modos Novedad e Informe preparan borradores. «Revisar novedad» o «Revisar informe» abren los editores existentes; la generación del chat no agrega registros automáticamente. Las fechas, horarios y firmas ausentes deben completarse antes de finalizar el informe. Cancelar aborta la petición y descarta respuestas tardías. La conversación permanece en memoria durante la sesión y se descarta al cambiar de cuenta.

## Base de datos y publicación

La migración `supabase/migrations/20261025012906_securia_fichas_externos.sql` ya está aplicada en producción como `20261025021019_securia_fichas_externos`. Extiende el protocolo de filas cifradas existente con `externals`, valida la ficha en servidor y conserva los permisos privados del RPC. Los clientes anteriores pueden seguir enviando cambios sin la colección nueva. Se comprobaron la colección, la restricción de permisos y la validación de DNI y autoría en producción sin escribir registros; los avisos de seguridad existentes no cambiaron. La migración también se comprueba con PostgreSQL embebido en las pruebas de sincronización.

El panel está publicado en https://securia-admin.vercel.app y el worker `whatsapp-reportes` está desplegado como versión 6. La publicación fue solicitada expresamente. Las pruebas no modifican datos productivos y la asignación automática de dominios desde GitHub continúa desactivada.

La corrección 2.1.1 conserva «Ingresa Gs Apellido, Nombre al puesto Puesto. Turno: HH:MM-HH:MM.» y «Se retira el Gs Apellido, Nombre.». Abrevia las redacciones anteriores al consultarlas, conservando los datos y las observaciones sin modificar las filas guardadas. La revisión con IA debe conservar literalmente las frases con el formato establecido. El móvil, la web y los reportes programados comparten la corrección. Se aprobaron 23 pruebas relacionadas.

La APK 2.1.1, código 21, compiló y pasó la verificación de firma, paquete, nombre y alineación de 16 KB contra la versión 2.1.0. Se comprobó que los siete módulos modificados incluidos en el bundle Android coinciden con las fuentes finales. Artefacto: `output/apk/Securia-2.1.1.apk`; verificación: `output/apk/verificacion-2.1.1.json`; publicación: `output/securia-publicacion-2.1.1.json`. TypeScript aprobado. No se realizó una instalación en un teléfono físico.

Android 2.1.0, código 20, compiló correctamente. `output/apk/Securia-2.1.0.apk` y `Securia.apk` tienen el mismo SHA-256. Se verificaron el nombre Securia, el paquete `ar.com.securia.app`, la firma de distribución conservada desde 2.0.0 y la alineación de 16 KB. La verificación está en `output/apk/verificacion-2.1.0.json`; el recibo de publicación está en `output/securia-publicacion-2.1.0.json`. Instalar como actualización, sin desinstalar ni borrar datos. No se realizó una prueba de instalación en un teléfono físico durante esta publicación.

La lectura de precintos por cámara o galería envía la foto al proveedor de IA configurado por acción explícita del usuario. El envío fue autorizado en esta conversación. Se identifican las puertas del acceso seleccionado y los números de siete dígitos; el usuario revisa y corrige antes de incorporarlos. No se envían fotografías durante las pruebas: se utilizan datos ficticios y proveedores simulados.
