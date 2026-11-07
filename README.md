# Securia · Desarrollo

Aplicación Android y panel administrativo para el servicio de vigilancia. Desarrollada por Franco Daniel Bevacua. Repositorio oficial privado: [FrancoBevacua/securia](https://github.com/FrancoBevacua/securia). Rama de producción: `main`. Versión móvil **2.3.2**, código **27**, identificador `ar.com.securia.app`. Web: https://securia-admin.vercel.app.

## Repositorio y producción

`main` contiene la versión estable. Los cambios nuevos se preparan en ramas `codex/<descripcion>`, se validan y se integran a `main`. El remoto `origin` apunta únicamente al repositorio oficial de Securia. El antiguo repositorio `vigelium` conserva su historial como referencia.

La validación de GitHub ejecuta TypeScript, pruebas y compilación del panel. El código móvil, web, funciones y migraciones se conserva en este repositorio. Las APK se generan como artefactos de entrega; los binarios y las claves de firma no se guardan como código fuente.

La rama de producción representa el código aprobado; el despliegue web y la compilación Android son pasos explícitos del proceso de publicación. La configuración privada permanece en el entorno autorizado y en Vercel.

## Contenido

- `app/`, `src/`, `assets/`: aplicación móvil con Expo y React Native.
- `admin/`: panel web con React, Vite y API para Vercel.
- `nube/`, `supabase/migrations/`: servicio compartido, migraciones y documentación.
- `tests/`: pruebas de dominio, PDF, autenticación, dictado y sincronización.
- Scripts PowerShell: configuración y compilación de Android.

## Instalar la actualización

Instalar la APK sobre la versión anterior, sin desinstalar ni borrar datos. Las cuentas existentes se conservan. Los teléfonos autorizados comparten las cuentas y el informe del objetivo. El ingreso utiliza únicamente el PIN de seis números del corporativo y requiere Internet. Después se selecciona el guardia a cargo.

Cada novedad permite seleccionar al vigilador que debe firmar. La cuenta que realiza la carga se conserva por separado para controlar la edición durante el turno. Inicio saluda al guardia seleccionado como responsable del corporativo. Los datos personales permanecen en las fichas de los guardias.

## Preparar y compilar el móvil

### Cambios de 2.3.2

- Respuestas del chat con títulos, listas y énfasis legibles, sin identificadores de fuentes en la respuesta, copia o texto guardado.
- Los pedidos explícitos de agregar una novedad habilitan una propuesta acotada que la aplicación valida y registra con el guardia a cargo y la actividad actuales. Las consultas no escriben; faltantes piden completar datos y un fallo de guardado reintenta el mismo registro.
- El chat conserva el campo editable, el teclado y el diseño al enviar. La ventana calcula su área segura propia para la navegación Android de tres botones.
- Apertura/Cierre separa al guardia que firma la carga del guardia que ejecutó la operación, con su nombre conservado en la descripción.

### Cambios de 2.3.1

- El chat compensa el teclado también dentro de la ventana Android y conserva el campo Mensaje visible. Placeholder centrado en una caja de altura fija.
- El asistente distingue informes de accesos para CCTV e informes de seguridad. Usa operación, fecha, hora, guardia, precintos y observaciones de los registros disponibles, e informa si falta detalle.
- Varios accesos filtra el catálogo en Portones de playa, Puertas de emergencias y Otros accesos; cambiar de grupo limpia la selección y conserva los nombres históricos al editar.

### Cambios de 2.3.0

- Cuenta compartida Guardia Paseo con PIN de seis números y selección del guardia a cargo. Franco Bevacua conserva su ficha personal y las firmas anteriores.
- Acciones rápidas configurables, iconos pequeños y Recorridos como acceso inicial. Se elimina la sección En el predio y el botón Compartir con supervisor.
- Recorrido reúne Control de locales, Playa y Ronda Nocturna. La ronda conserva cronómetro, puntos de control y asiento automático en el libro.
- Portones con Precinto y Agregar precinto, sin elegir hojas. Los registros anteriores se conservan.
- Asistente a pantalla completa, conversación desplazable y caja de texto fija durante la espera y las respuestas extensas.
- APK firmada con la clave existente, código 25, para instalar sobre la versión anterior sin desinstalar.

### Cambios de 2.2.2

- Los vigiladores pueden tener varios puestos asignados desde Equipo, el registro de cuenta y el alta rápida de firmantes. La selección no admite duplicados y conserva un puesto principal; la actividad de cada teléfono sigue registrando el puesto efectivamente cubierto.
- Bicicletero y Franquero incorporados al catálogo de instalaciones nuevas y existentes. La migración de nube publica los puestos y turnos de referencia mediante la sincronización incremental, conservando cuentas, sesiones e historial. Las instalaciones locales reciben los puestos sin duplicar los existentes.
- Compatibilidad con perfiles anteriores que sólo tienen `puestoId`. El perfil y Equipo muestran todas las asignaciones; editarlas no cambia retroactivamente los turnos registrados.
- Incluye los cambios de 2.2.1: chat adaptable con compositor fijo, CRUD del predio, caducidad de presencias después de 8 horas, historiales sin duplicados y resumen del informe con frases completas del hecho, intervención y estado.
- Entrega: `output/apk/Securia-2.2.2.apk`, código 24, actualización sobre `Securia-2.2.1.apk` conservando firma y datos. 246 pruebas automatizadas y prueba de registro, edición, sincronización y permisos en el servidor con datos ficticios y ROLLBACK.

### Cambios de 2.2.0

- Selectores con área segura inferior incluso sin botones, altura adaptable y categorías distribuidas en filas. Incluye navegación Android con tres botones y texto ampliado.
- Asistente con fuentes operativas de novedades, visitas, accesos, actividades, programación, recorridos, informes, catálogos y contactos. Calcula presencia y totales sobre todos los registros disponibles; distingue servicio actual, servicio durante el día y turnos programados. Usa proyecciones sin PIN, credenciales, documentos de identidad ni datos privados de las cuentas.
- Los documentos completos se indexan antes de seleccionar fragmentos pertinentes. Los PDFs mixtos con páginas sin texto se conservan enteros para lectura con visión; no se acepta una extracción local parcial como documento completo.
- Motivo opcional restaurado exclusivamente en Apertura/Cierre del libro, conservado al editar y cambiar la operación. Sugerencias de frases del historial para el motivo y la descripción de novedades, elegidas por el guardia.
- Filtros combinables y búsqueda en el libro. La exportación conserva todas las entradas del período, aunque la vista tenga filtros.
- Portones con Hoja de ingreso u Hoja de egreso independientes. Los registros históricos de ambas hojas se conservan.
- WhatsApp Business retirado de Ajustes. El guardia comparte el PDF mediante el selector nativo, que adjunta el archivo antes de elegir el destinatario; no se abre un chat vacío por número.
- Nueva sección En el predio, accesible desde Inicio, Ingresos/Egresos y Más: bloques por sector con razón social y tarea, búsqueda y detalle de personal. Escalera al techo siempre en rojo. Las presencias se deducen de movimientos registrados, separan ingresos en espera y advierten ingresos antiguos sin egreso; las fichas de empresas no acreditan presencia.
- APK: `output/apk/Securia-2.2.0.apk`, código 22. Firma, paquete y alineación de 16 KB verificados contra 2.1.1; instalar sobre la versión actual. 231 pruebas, TypeScript y build del panel aprobados. Los 24 módulos modificados del bundle coinciden con las fuentes finales. Falta la prueba de IA y envío real de WhatsApp desde un teléfono físico.

### Cambios de 2.1.1

- Los ingresos conservan el formato `Ingresa Gs Apellido, Nombre al puesto Puesto. Turno: HH:MM-HH:MM.` y los egresos `Se retira el Gs Apellido, Nombre.`. La redacción extensa anterior se abrevia al consultar el libro, editar o generar PDF, conservando nombres, puestos, horarios y observaciones; la consulta no modifica el historial guardado.
- La revisión con IA de novedades e informes debe conservar literalmente los ingresos y egresos que ya tienen ese formato. La validación rechaza cambios en su plantilla o datos y mantiene el original.
- Corrección compartida por móvil, panel web y reportes programados. Instalar `output/apk/Securia-2.1.1.apk` sobre la versión anterior.

### Cambios de 2.1.0

- Securia adopta el diseño elegido en azul Francia oscuro, rojo y blanco. Ingresos/Egresos agrupa vigiladores, adicionales y externos; Recorridos reúne locales y playa.
- Fichas de externos compartidas, DNI argentino, descansos, múltiples puertas y precintos, lectura revisable de fotos y autocompletado del prefijo del precinto.
- Informes de seguridad con guardado y resumen automáticos, lectura móvil y web por secciones. Asistente flotante con directivas y PDFs, consultas y borradores revisables mediante el proveedor de IA configurado.
- Migración de fichas aplicada y worker de reportes actualizado a versión 4. Panel publicado en https://securia-admin.vercel.app. La dirección anterior redirige a Securia.
- Detalles funcionales y de privacidad en [SECURIA-2026.md](SECURIA-2026.md). La APK conserva el identificador y la firma para instalarse sobre la versión anterior.

### Cambios de 2.0.0

- Nuevo protocolo de sincronización por registros con diario local cifrado, cursor incremental y recibos durables. Las fotos se guardan y transfieren separadas, por partes verificadas con SHA-256. Guardar una novedad no espera la red.
- Las actividades con cientos de notas se envían por lotes antes de confirmar su cierre. Los conflictos se respaldan por registro y no bloquean los demás pendientes. La migración de la cola anterior conserva sus datos.
- Migración aplicada en Supabase y worker de reportes desplegado como versión 3. Se verificaron los 477 registros y siete adjuntos corporativos contra el original cifrado conservado.
- Prueba HTTPS real de 500 novedades, adjunto, siguiente actividad, reinicio y respuesta perdida: cero pendientes, sin duplicados ni conflictos inesperados. 187 pruebas locales aprobadas. APK y firma verificadas.
- Instalar `output/apk/VIGELIUM-2.0.0.apk` encima de la aplicación actual en todos los teléfonos, sin desinstalar ni borrar datos. Las versiones antiguas muestran la actualización requerida y conservan sus pendientes.
- Detalles, límites y resultados en [nube/SINCRONIZACION-2.0.md](nube/SINCRONIZACION-2.0.md).

### Cambios de 1.8.6

- Los registros de Supabase mostraban `57014` en envíos de unos 8 MB: vencían los recorridos repetidos de colecciones y adjuntos. Las migraciones de guardado y recuperación usan JOIN materializados y conservan las reglas de autoría, dispositivo, historial y cifrado. Sólo `guardia_rpc` y `guardia_recuperacion` tienen `statement_timeout=45s`; los roles conservan sus límites generales.
- La app trata los vencimientos, las respuestas JSON incompletas y los errores transitorios del gateway como fallos recuperables. La cola permanece cifrada y cada reintento consulta el servidor antes de reenviar, incluso si un guardado perdió sólo su respuesta.
- En el editor del libro, la evidencia aparece en Novedad, Externos, Apertura y Cierre. **Descripción breve de las fotos (opcional)**, debajo de **Sector**, permite hasta 100 caracteres. El encabezado de evidencia usa hora, tipo y esa descripción, sin copiar la redacción completa. Hasta cuatro fotos comparten una fila con 4 puntos de separación y tamaño constante en filas incompletas. El informe ya no ofrece adjuntos generales al pie de su lista.
- El código compartido mantiene el mismo formato en el móvil, el panel y los reportes programados. Se verificaron el PDF renderizado, 172 pruebas, TypeScript, guardado y recuperación con 400 registros y más de 8 MB de evidencia sintética en el servidor, con ROLLBACK.

### Cambios de 1.8.5

- La sincronización reconoce las cancelaciones nativas de Expo (`fetch failed: Fetch request has been canceled`). Las consultas y envíos de la cola esperan hasta 60 segundos y reintentan dos veces los fallos de red, consultando primero el servidor para no duplicar escrituras cuya respuesta se perdió. Si la red sigue fallando, se conserva la copia cifrada y continúan los reintentos habituales en primer plano.
- El alta de un vigilador o acceso muestra **Aceptar** con el estilo normal de confirmación; las eliminaciones conservan su botón rojo.
- En Apertura/Cierre del libro y en Accesos, **Varios accesos** permite elegir **Portones de playa** o **Puertas de emergencias** y seleccionar elementos del catálogo. Genera el encabezado con una lista, conserva la selección al editar e incluye motivo y observaciones cuando corresponden. Accesos permite copiar el mensaje e incluirlo en CCTV; los precintos se registran en accesos individuales.
- Verificación: 161 pruebas automatizadas y TypeScript. Incluye cancelación durante la lectura, respuesta perdida luego de guardar, persistencia sin red y edición de selecciones múltiples. La comprobación en un teléfono con la conexión afectada queda pendiente.

### Cambios de 1.8.4

- El arranque abre la copia cifrada local sin esperar reintentos de red. La validación remota corre después de mostrar la app. El splash nativo usa el logo nuevo; se retira al montar React y las fuentes tienen un límite de espera. La presentación centra el nombre y el lema con altura suficiente.
- Las diferencias incompatibles y rechazos de actividad antigua disparan recuperación automática: el servidor respalda ambas versiones cifradas, incorpora las altas válidas, conserva como activos los registros corporativos existentes y mantiene las versiones distintas en Historial de recuperación. La cola se libera sólo con respaldo remoto y confirmación local. No se ocultan errores de permisos ni se descarta información ante fallos de red o disco.
- Login con puesto de trabajo por actividad del teléfono, sin la opción de vincular cuenta anterior. Cambiar de puesto al ingresar cierra la actividad propia anterior y abre la nueva; no cambia el puesto del perfil compartido ni el de otro teléfono.
- Ingreso/Egreso incluye Vigilador y Adicional policial, con horarios predefinidos por puesto y 09:00–16:00 para adicional. Los horarios personalizados siguen disponibles.
- Inicio y Fin de ronda tienen categoría y hora en negrita. Las fotos se agrupan por novedad, con descripción arriba y rótulo de fecha, hora y sector sobre cada imagen; las panorámicas ocupan una fila. Los rótulos usan datos registrados, nunca deducciones de IA. Los adjuntos históricos sin metadatos se identifican como no informados.
- Novedades permite adjuntar fotos e indicar sector. Adjuntar evidencia desde el informe exige elegir su novedad y sector. Los informes de seguridad también piden sector.
- Migración `20260926181707_altas_catalogo_operativas.sql` aplicada al corporativo con autorización del propietario. Permite agregar personas sin cuenta y accesos nuevos desde usuarios autenticados. No permite editar accesos existentes, crear cuentas ni elevar roles. Verificada mediante el RPC real con una cuenta ficticia de vigilador y transacción revertida; los datos corporativos conservaron la revisión 205.
- Validación: 151 pruebas, TypeScript, recuperación cifrada en el servidor con transacción revertida, y renderizado visual del PDF. Los módulos compartidos del panel y del worker están actualizados en los fuentes; no se publicaron esos servicios en esta entrega.

### Cambios de 1.8.3 (histórico)

- Cada teléfono mantiene su propia actividad y cola. Puede sincronizar y cerrar sesión sin que el otro esté conectado ni cierre su actividad, incluso si ambos usan la misma cuenta. El servidor valida el identificador del dispositivo contra su sesión. Una colisión de revisión se reconsulta y reintenta automáticamente hasta tres veces; los conflictos reales conservan el respaldo y la revisión de 1.8.2.
- **Recorridos** ofrece Guardia, Puesto, Novedades e imágenes. Registra **Inicio de ronda** y **Fin de ronda** automáticamente en el libro: por ejemplo, «Playa 1 inicia ronda de control. Sin novedades». El control de locales y las rondas con puntos siguen como opciones separadas. Un reintento del guardado conserva los identificadores y las fotos sin duplicar asientos.
- Migración `20260925081327_actividad_independiente_por_telefono.sql` aplicada al corporativo. Prueba del RPC con dos teléfonos simulados, misma cuenta, cierre independiente y rechazo de modificaciones desde otro dispositivo; transacción revertida íntegramente. 146 pruebas automáticas y TypeScript aprobados. La consulta descarga el estado compartido; sólo se suben registros nuevos o modificados.
- Instalar `output/apk/VIGELIUM-1.8.3.apk` sobre la versión anterior, sin desinstalar ni borrar datos. Código 15, mismo paquete y certificado que 1.8.0–1.8.2. El verificador contrasta firma y manifiesto con 1.8.2. Los pendientes antiguos se recuperan en cada teléfono con el procedimiento siguiente; no hace falta tener ambos conectados a la vez.

### Cambios de 1.8.2

- Corrige el cierre de la revisión: los reintentos automáticos desmontaban el componente cuando cambiaba `guardando`. La ventana ahora permanece montada, conserva la selección y pausa los reintentos de fondo mientras está abierta. Los detalles muestran nombres, fechas y textos en lugar de JSON e identificadores.
- **Ver → Recuperar sincronización → Respaldar y restablecer** guarda las copias completas del teléfono y del corporativo en el servidor, cifradas. Incorpora altas válidas; no reemplaza registros corporativos que ya existen. Las versiones diferentes o que no se pueden incorporar quedan consultables en **Ajustes → Sincronización → Historial de recuperación**, con imágenes y exportación de la copia completa.
- La cola sólo se limpia después de confirmar el respaldo remoto y guardar la copia corporativa en disco. Cortes de red, fallas de disco o novedades concurrentes conservan la cola. Los reintentos del mismo respaldo son idempotentes.
- **Volver a ingresar al corporativo** elimina las sesiones de ese teléfono después de recuperar los datos. Conserva la cuenta, el vínculo, la clave de cifrado y el historial; el siguiente ingreso usa el PIN del corporativo. Repetir la recuperación en cada teléfono con pendientes, sin desinstalar ni borrar almacenamiento.
- Migración `20260925005245_recuperacion_cifrada_sincronizacion.sql` aplicada con autorización expresa. 137 pruebas automáticas y TypeScript aprobados; prueba transaccional con cifrado real y ROLLBACK en el servidor. No se accedió a las colas de los teléfonos físicos: el respaldo se realiza cuando cada uno ejecuta la recuperación.

La APK `output/apk/VIGELIUM-1.8.2.apk` usa el mismo certificado y paquete que 1.8.1, con código de versión 14. El verificador compara ambos archivos antes de entregar la actualización.

### Cambios de 1.8.1

- Actualización de 1.8.0 (código 12) a 1.8.1 (código 13), con el mismo paquete y certificado. `verificar-apk.ps1` contrasta firma, paquete y código con `output/apk/VIGELIUM-1.8.0.apk` antes de entregar el archivo versionado.
- Conserva las sesiones persistentes, recuperación sin conexión y controles de fecha del código fuente 1.8.0. Una falla de red posterior a combinar novedades conserva la cola combinada y su base remota.
- La sincronización consulta primero el servidor y envía solamente registros nuevos o modificados. Requiere la migración `20260922233757_sincronizacion_incremental.sql`, aplicada al servidor. La consulta aún descarga el estado completo.
- Los conflictos pueden revisarse desde el aviso de sincronización mediante **Ver → Revisar diferencias**. No se elige una versión automáticamente; antes de aplicar la decisión se guardan copias cifradas del teléfono y de la nube.
- Libro sin el párrafo genérico de cierre. Recorridos con selección de guardia, fotos y casilla para incluirlos en el libro. El inicio y cierre de sesión administran la actividad, sin controles manuales de turno.

Instalar `output/apk/VIGELIUM-1.8.1.apk` sobre 1.8.0. No desinstalar ni borrar datos, especialmente si quedan novedades pendientes. El archivo de fuentes excluye credenciales, certificados privados y archivos locales de aprovisionamiento; conservar los originales para futuras compilaciones.

### Cambios de 1.7.0

- Sincronización de turnos completos guardados sin conexión: el servidor acepta inicio, registros y cierre juntos, conserva la autoría y sigue rechazando modificaciones de turnos ya cerrados. La migración `sincronizacion_turnos_offline` fue aplicada y verificada en Supabase el 16/09/2026 con datos ficticios, sin escribir registros de prueba.
- Checkbox **Agregar motivo** en Apertura/Cierre y Accesos. El motivo se conserva al editar y se incorpora al texto, al CCTV y a los informes. Las copias compartidas del panel web están actualizadas; su publicación se realiza con el procedimiento del panel.
- Diseño renovado de Inicio, navegación, ingreso, formularios, listas y ajustes. Nuevas instalaciones usan el tema del sistema y la paleta Acero; se respetan las preferencias guardadas. Controles táctiles de al menos 44 puntos, etiquetas accesibles y adaptación a pantallas pequeñas.
- Pruebas de la validación SQL con PGlite/PostgreSQL, cola offline, reintentos y motivo en formularios e informes.

### Cambios de 1.6.0

- Cola cifrada en SQLite propio (`vigelium-datos.db`), con transacciones atómicas y `synchronous=FULL`. Se elimina el límite de AsyncStorage Android para las novedades y evidencias. La migración verifica la copia antes de retirar el valor anterior; una escritura fallida conserva el dato previo.
- Guardado local sin demora programada. Novedades, informes, importaciones y cierre de turno esperan la escritura local; la sincronización tiene una cola independiente y reintenta cada 30 segundos en primer plano o al volver a la app. Los errores de disco quedan visibles.
- Formularios con desplazamiento automático al cursor cuando aparece el teclado, incluidos modales, ingreso y registro.
- **Más → Recordatorios** permite elegir un calendario del teléfono, crear avisos, editarlos y eliminarlos. Los cambios externos se releen al volver. Google sincroniza los eventos si se elige un calendario de esa cuenta y la sincronización está habilitada. El calendario local funciona sólo en ese teléfono. Estos recordatorios personales no se envían a la base corporativa.
- Informes de 12 o 24 horas calculados desde la fecha de entrega: 07→19, 19→07 o 19→19. El texto y el panel web incluyen los extremos del período. La hora inicial se incluye y la final pertenece al período siguiente.

Verificación automatizada: `npm test`, `npm run typecheck` y `npm --prefix admin run build`. Las pruebas ejecutan SQLite real con valores mayores a 10 MB, fallos `SQLITE_FULL`, migraciones, colas concurrentes, alarmas de calendario y límites de períodos. Los adaptadores Android/iOS de teclado y calendario requieren además una prueba en dispositivo con permisos y cuenta de calendario.

La actualización incluye módulos nativos nuevos: requiere recompilar e instalar la APK, no alcanza con actualizar JavaScript. Los cambios del panel web requieren publicar su build por el procedimiento habitual.

Requisitos: Node.js, Android SDK 36 y JDK 17.

```powershell
npm ci
# Sólo si todavía no existe el archivo de configuración local:
Copy-Item src/provisionCorporativa.example.ts src/provisionCorporativa.ts
```

Configurar el código de aprovisionamiento autorizado en `src/provisionCorporativa.ts`. El archivo real está excluido de Git. `src/nubeConfig.ts` contiene la URL y la clave pública del servicio; los permisos se comprueban en el servidor.

```powershell
npm run typecheck
npm test
powershell -ExecutionPolicy Bypass -File .\compilar.ps1
```

Expo genera el proyecto Android. `expo prebuild --no-clean` conserva sus archivos locales. Para actualizar teléfonos ya instalados, conservar el almacén de firma original; los almacenes de claves no se versionan. `verificar-apk.ps1` valida identificador, versión, firma y alineación de 16 KB. Los binarios, dependencias y cachés se generan localmente.

## Panel web

```powershell
cd admin
npm ci
npm run build
npm run dev
```

Vite permite revisar la interfaz. Para ejecutar también `/api/admin`, usar `vercel dev` con las variables privadas configuradas. Ver [admin/README.md](admin/README.md).

El administrador puede consultar, editar y eliminar novedades de cualquier día, descargar reportes generales, administrar cuentas y consultar informes de seguridad de 16 puntos. Los permisos se verifican en la base; las correcciones tienen auditoría cifrada. Eliminar una cuenta bloquea su acceso y conserva las firmas históricas.

## Base de datos y configuración privada

Para una instalación nueva, revisar y ejecutar `nube/002_servicio.sql`, después `nube/003_alta_sin_administrador.sql` y las migraciones de `supabase/migrations/` en orden cronológico. El aprovisionamiento inicial del objetivo y la primera cuenta administradora requieren al propietario. No usar los fixtures como datos iniciales.

No se incluyen claves de Vault, PIN, tokens, almacenes de firma ni credenciales de GitHub/Vercel. Los archivos de pruebas SQL contienen cuentas ficticias y usan `ROLLBACK`. El servicio cifra los registros recuperables; no es cifrado de extremo a extremo frente al propietario de PostgreSQL/Vault. Consultar los límites en [nube/README.md](nube/README.md).

La versión móvil se valida con TypeScript, 100 pruebas automatizadas y compilación Android. Las pruebas del servicio cubren dos teléfonos, firma y autor de carga, permisos administrativos, edición histórica, cuentas y revocación de sesiones. Falta la comprobación final de instalación en los teléfonos físicos.

Vercel está conectado a este repositorio privado y compila el panel desde `admin` al recibir cambios en `develop`. La publicación automática sobre la dirección principal está desactivada: revisar el build y promoverlo explícitamente. Ver el flujo en [admin/README.md](admin/README.md). Las variables privadas se conservan en Vercel.
