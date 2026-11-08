/** Contenido de consulta: los ejemplos son ilustrativos y no crean registros. */
export type PasoGuia={titulo:string;texto:string;vista:string;filas:string[];accion:string;consejo?:string};
export type TemaGuia={id:string;titulo:string;descripcion:string;icono:string;pasos:PasoGuia[]};
export const TEMAS_GUIA:TemaGuia[]=[
 {id:'inicio',titulo:'Primeros pasos',descripcion:'Guardia a cargo y accesos desde Inicio.',icono:'inicio',pasos:[
  {titulo:'Confirmá quién está a cargo',texto:'Al ingresar al corporativo, elegí al vigilador que queda a cargo y presioná «Confirmar guardia». Así comienza su actividad en este teléfono.',vista:'Guardia a cargo',filas:['Seleccionar vigilador','Ana · ejemplo'],accion:'Confirmar guardia'},
  {titulo:'Ubicate en Inicio',texto:'Desde Inicio podés crear una novedad y abrir las funciones más usadas. El lápiz de «Acciones rápidas» permite elegir qué accesos ver.',vista:'Inicio',filas:['Nueva novedad','Acciones rápidas','Accesos · Ingresos · Recorridos'],accion:'Personalizar accesos rápidos'},
  {titulo:'Registrá el relevo',texto:'Cuando cambie el vigilador, usá «Cambiar» en la tarjeta «Guardia a cargo» y confirmá al nuevo responsable. Securia conserva la actividad anterior.',vista:'Inicio',filas:['Guardia a cargo','Ana · ejemplo'],accion:'Cambiar',consejo:'Revisá siempre quién está a cargo antes de registrar una novedad.'},
 ]},
 {id:'novedades',titulo:'Registrar novedades',descripcion:'Categoría, firma, horario y evidencia.',icono:'edit',pasos:[
  {titulo:'Abrí una nueva novedad',texto:'En Inicio, presioná «Nueva novedad» y elegí la categoría que corresponda al hecho.',vista:'Inicio',filas:['Cada novedad, bajo control.','Guardia a cargo confirmado'],accion:'Nueva novedad'},
  {titulo:'Completá los datos del hecho',texto:'Revisá el vigilador que firma, la fecha y la hora. Describí qué ocurrió y las acciones realizadas con datos comprobados.',vista:'Nueva novedad',filas:['Categoría: Novedad','Vigilador: Ana · ejemplo','Fecha y hora del hecho'],accion:'Descripción del hecho',consejo:'El horario del hecho puede ser diferente del momento en que lo cargás.'},
  {titulo:'Agregá evidencia y guardá',texto:'Si necesitás fotos o archivos, adjuntalos y completá el sector o la descripción que solicite el formulario. Guardá la novedad y consultala desde Libro.',vista:'Nueva novedad',filas:['Descripción completada','Evidencia del sector · opcional','Firma y horario revisados'],accion:'Guardar'},
  {titulo:'Consultá una novedad anterior',texto:'Abrí Libro o tocá una de las últimas novedades de Inicio para ver su detalle. Los registros de turnos cerrados quedan disponibles para consulta.',vista:'Libro',filas:['Novedades registradas','Fecha · hora · categoría','Detalle del registro'],accion:'Abrir novedad'},
 ]},
 {id:'accesos',titulo:'Accesos y precintos',descripcion:'Aperturas, cierres e informe para CCTV.',icono:'accesos',pasos:[
  {titulo:'Entrá a Accesos',texto:'Abrí la pestaña «Accesos». En «Registros», presioná + para cargar una apertura o un cierre.',vista:'Accesos',filas:['Registros · Catálogo','Fecha de los registros','Aperturas y cierres'],accion:'Agregar registro (+)'},
  {titulo:'Identificá el acceso',texto:'Elegí el acceso, indicá si es apertura o cierre y revisá la fecha, la hora y el vigilador. Completá el motivo cuando corresponda.',vista:'Registro de acceso',filas:['Portón de ejemplo','Tipo: cierre','Firma · fecha · hora'],accion:'Seleccionar acceso'},
  {titulo:'Completá los precintos',texto:'Cargá el número completo de cada precinto. Si hay cuatro números recordados, completá los tres restantes. Podés usar «Leer precintos con cámara» y revisar el resultado.',vista:'Precintos',filas:['Portón de ejemplo','Precinto: 0123456','Número ilustrativo'],accion:'Leer precintos con cámara',consejo:'Si el acceso no lleva precinto, marcá «No aplica precinto».'},
  {titulo:'Generá el informe para CCTV',texto:'Guardá el acceso. En la lista, elegí la fecha que querés informar y presioná «Generar informe para CCTV». Revisá el contenido antes de copiarlo o compartirlo.',vista:'Accesos',filas:['Cierre · Portón de ejemplo','Precinto N°: 0123456','Registro guardado'],accion:'Generar informe para CCTV'},
 ]},
 {id:'ingresos',titulo:'Ingresos y egresos',descripcion:'Movimientos de personal y externos.',icono:'equipo',pasos:[
  {titulo:'Elegí el tipo de movimiento',texto:'Desde las acciones rápidas o Más, abrí «Ingresos/Egresos». Elegí Vigiladores, Adicionales o Externos.',vista:'Ingresos/Egresos',filas:['Vigiladores','Adicionales','Externos'],accion:'Elegir categoría'},
  {titulo:'Registrá los datos',texto:'Cargá el ingreso o el egreso con su fecha, hora y datos de la persona. Para externos, revisá también empresa, tarea, lugar y autorización.',vista:'Movimiento',filas:['Persona de ejemplo','Fecha y hora del movimiento','Empresa y tarea · si corresponde'],accion:'Revisar datos del movimiento'},
  {titulo:'Confirmá también la salida',texto:'Cuando la persona se retire, registrá el egreso desde el movimiento correspondiente. Revisá los datos antes de guardar para que el historial refleje lo ocurrido.',vista:'Ingresos/Egresos',filas:['Ingreso registrado','Persona de ejemplo','Salida del establecimiento'],accion:'Registrar egreso'},
 ]},
 {id:'recorridos',titulo:'Registrar recorridos',descripcion:'Sector, controles y observaciones.',icono:'ronda',pasos:[
  {titulo:'Abrí Recorridos',texto:'Usá el acceso «Recorridos» desde Inicio o Más. Se abrirá el formulario de novedades con la categoría Recorrido.',vista:'Inicio',filas:['Acciones rápidas','Accesos · Ingresos','Recorridos'],accion:'Recorridos'},
  {titulo:'Completá los controles',texto:'Elegí el tipo de recorrido y el sector. Completá los controles que muestra el formulario y registrá las observaciones verificadas.',vista:'Recorrido',filas:['Tipo de recorrido','Sector controlado','Observaciones del control'],accion:'Completar recorrido'},
  {titulo:'Guardá y consultá el registro',texto:'Revisá firma, fecha, hora y evidencia antes de guardar. El recorrido queda disponible en el libro de novedades.',vista:'Recorrido',filas:['Controles revisados','Firma · fecha · hora','Evidencia · si corresponde'],accion:'Guardar'},
 ]},
 {id:'libro',titulo:'Libro e informe general',descripcion:'Buscar registros y preparar una entrega.',icono:'libro',pasos:[
  {titulo:'Abrí el libro',texto:'Entrá desde la pestaña Libro o desde «Ver todas» en Inicio. Allí se reúnen los registros de las distintas funciones.',vista:'Libro de novedades',filas:['Novedades','Ingresos y egresos','Accesos y recorridos'],accion:'Consultar el libro'},
  {titulo:'Revisá el período',texto:'Antes de preparar el informe general, verificá la fecha de entrega, el horario de corte y la duración de 12 o 24 horas. Los filtros y la búsqueda ayudan a encontrar un registro.',vista:'Informe general',filas:['Fecha de entrega','Período: 12 o 24 horas','Horario de corte'],accion:'Ajustar período',consejo:'Un registro puede quedar en otro período si el servicio cruza la medianoche.'},
  {titulo:'Prepará la entrega',texto:'Revisá los registros incluidos y completá lo que falte. Usá la vista previa y las opciones de copiar o exportar PDF para preparar la entrega al supervisor.',vista:'Informe general',filas:['Registros del período','Contenido y evidencia revisados','Vista previa'],accion:'Copiar o exportar PDF'},
 ]},
 {id:'informes',titulo:'Informes de seguridad',descripcion:'Los 16 puntos de un incidente.',icono:'informes',pasos:[
  {titulo:'Creá el informe',texto:'En Más, abrí «Informes de seguridad» y presioná +. Podés elegir una plantilla de incidente como punto de partida.',vista:'Informes',filas:['Informe de seguridad','16 puntos','Plantillas de incidente'],accion:'Nuevo informe (+)'},
  {titulo:'Describí el hecho',texto:'Completá la fecha y la hora del hecho y el vigilador que firma. En el punto 6, escribí el resumen. Avanzá por las secciones para completar el resto.',vista:'Informe de seguridad',filas:['Vigilador que realizó la novedad','Fecha y hora del hecho','6. Resumen del hecho'],accion:'Siguiente',consejo:'«Guardar borrador» permite conservar el informe para continuar después.'},
  {titulo:'Revisá la evidencia',texto:'Si agregás fotos, indicá el sector de la evidencia. La ayuda de IA es opcional: revisá su redacción y conservá sólo los hechos comprobados.',vista:'Cierre del informe',filas:['Evidencia fotográfica','Sector de la evidencia','Fotos revisadas'],accion:'Generar informe'},
  {titulo:'Consultá el resultado',texto:'Al generar se abre la vista previa y se agrega un resumen al libro. Si falta un dato, Securia lo indica y vuelve a la sección correspondiente. Después podés copiar el informe o compartir su PDF.',vista:'Vista previa',filas:['Informe generado','Resumen agregado al libro','16 puntos disponibles'],accion:'Copiar o compartir PDF'},
 ]},
 {id:'asistente',titulo:'Usar el asistente',descripcion:'Consultar, redactar y revisar respuestas.',icono:'chat',pasos:[
  {titulo:'Abrí el chat',texto:'Tocá el botón flotante del asistente. Escribí una consulta clara sobre el servicio o pedí ayuda para redactar una novedad o un informe.',vista:'Asistente Securia',filas:['Consulta de ejemplo','¿Cómo preparo un informe?','Mensaje para el asistente'],accion:'Enviar'},
  {titulo:'Consultá las directivas',texto:'El botón del libro en el chat abre «Directivas y PDFs». Allí podés elegir el puesto de consulta y agregar documentos para consultar su contenido.',vista:'Directivas y PDFs',filas:['Puesto de consulta','Documentos disponibles','Texto del documento para revisar'],accion:'Agregar PDF de directivas',consejo:'El asistente necesita conexión y un proveedor configurado en Ajustes de IA.'},
  {titulo:'Revisá lo que responde',texto:'Leé la respuesta antes de usarla. Podés copiarla o abrir las opciones de revisión. Si pedís expresamente agregar una novedad al libro, verificá el aviso de guardado.',vista:'Asistente Securia',filas:['Respuesta del asistente','Hechos y datos por revisar','Aviso de guardado · si lo pediste'],accion:'Copiar o revisar',consejo:'Que la IA redacte una respuesta no significa que haya registrado una novedad.'},
 ]},
 {id:'sincronizacion',titulo:'Sincronizar la información',descripcion:'Pendientes, conexión y turnos cerrados.',icono:'share',pasos:[
  {titulo:'Reconocé los pendientes',texto:'Los cambios se guardan en el teléfono. Si aparece «Sincronización pendiente», todavía hay información por confirmar con la nube.',vista:'Inicio',filas:['Cambios guardados en el teléfono','Sincronización pendiente','Estado de sincronización'],accion:'Ver'},
  {titulo:'Consultá el estado',texto:'Con conexión, abrí el estado de sincronización y usá «Reintentar» si es necesario. Securia también vuelve a intentarlo automáticamente en primer plano.',vista:'Estado de sincronización',filas:['Estado de la conexión','Cambios pendientes','Mensaje de la sincronización'],accion:'Reintentar',consejo:'Cerrar un turno no impide enviar sus registros pendientes.'},
  {titulo:'Comprobá la confirmación',texto:'Esperá a que termine el envío y revisá que no queden pendientes. Si hay un error, leé el mensaje y reintentá cuando se recupere la conexión.',vista:'Sincronización',filas:['Última sincronización','Sin cambios pendientes','Información confirmada'],accion:'Al día',consejo:'Si hay pendientes, conservá la aplicación y sus datos en el teléfono.'},
 ]},
 {id:'mas',titulo:'Otras herramientas',descripcion:'Directivas, turnos, contactos y avisos.',icono:'mas',pasos:[
  {titulo:'Explorá Más',texto:'La pestaña Más reúne herramientas de operación y del puesto. Allí encontrás Equipo, Contactos, Directivas, Turnos y francos, Recordatorios y Ajustes.',vista:'Más',filas:['Operación','Puesto','Cuenta y Ajustes'],accion:'Elegir herramienta'},
  {titulo:'Consultá el puesto y el equipo',texto:'Usá Contactos para consultar los teléfonos cargados y Equipo para ver vigiladores. En Turnos y francos podés revisar el diagrama disponible del equipo.',vista:'Más',filas:['Equipo','Contactos','Turnos y francos'],accion:'Consultar información'},
  {titulo:'Agregá recordatorios',texto:'Abrí Recordatorios y conectá un calendario del teléfono o de Google. Elegí el calendario, tocá «Nuevo recordatorio» y completá título, fecha, hora y aviso.',vista:'Recordatorios',filas:['Calendario elegido','Título · fecha · hora','Anticipación del aviso'],accion:'Guardar en calendario'},
  {titulo:'Tené a mano las directivas',texto:'Desde Directivas podés cargar el documento del puesto. Para consultarlo con el asistente, usá su biblioteca «Directivas y PDFs» y revisá el texto antes de guardarlo.',vista:'Directivas',filas:['Documento del puesto','Puesto correspondiente','Contenido revisado'],accion:'Consultar directivas'},
 ]},
];

export type LugarGuia={tema:string;paso:number};
export const lugarInicialGuia=():LugarGuia=>({tema:TEMAS_GUIA[0].id,paso:0});
export function normalizarLugarGuia(valor:unknown):LugarGuia{
 const v=valor as Partial<LugarGuia>|null,tema=TEMAS_GUIA.find(t=>t.id===v?.tema);
 if(!tema)return lugarInicialGuia();
 const paso=typeof v?.paso==='number'&&Number.isInteger(v.paso)?Math.max(0,Math.min(v.paso,tema.pasos.length-1)):0;
 return {tema:tema.id,paso};
}
export const claveGuia=(guardia:string)=>'securia.guia.v1/'+encodeURIComponent(guardia);
