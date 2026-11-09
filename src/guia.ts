import type {IdCapturaGuia} from './guiaCapturas';

/** Contenido de consulta con capturas locales de demostración. */
export type PasoGuia={titulo:string;texto:string;captura:IdCapturaGuia;consejo?:string};
export type TemaGuia={id:string;titulo:string;descripcion:string;icono:string;pasos:PasoGuia[]};
export const TEMAS_GUIA:TemaGuia[]=[
 {id:'inicio',titulo:'Primeros pasos',descripcion:'Guardia a cargo y accesos desde Inicio.',icono:'inicio',pasos:[
  {titulo:'Confirmá quién está a cargo',texto:'Al ingresar al corporativo, elegí al vigilador que queda a cargo y presioná «Confirmar guardia». Así comienza su actividad en este teléfono.',captura:'guardia'},
  {titulo:'Ubicate en Inicio',texto:'Desde Inicio podés crear una novedad y abrir las funciones más usadas. El lápiz de «Acciones rápidas» permite elegir qué accesos ver.',captura:'inicio'},
  {titulo:'Registrá el relevo',texto:'Cuando cambie el vigilador, usá «Cambiar» en la tarjeta «Guardia a cargo» y confirmá al nuevo responsable. Securia conserva la actividad anterior.',captura:'guardia',consejo:'Revisá siempre quién está a cargo antes de registrar una novedad.'},
 ]},
 {id:'novedades',titulo:'Registrar novedades',descripcion:'Categoría, firma, horario y evidencia.',icono:'edit',pasos:[
  {titulo:'Abrí una nueva novedad',texto:'En Inicio, presioná «Nueva novedad» y elegí la categoría que corresponda al hecho.',captura:'inicio'},
  {titulo:'Completá los datos del hecho',texto:'Revisá el vigilador que firma, la fecha y la hora. Describí qué ocurrió y las acciones realizadas con datos comprobados.',captura:'novedad',consejo:'El horario del hecho puede ser diferente del momento en que lo cargás.'},
  {titulo:'Agregá evidencia y guardá',texto:'Si necesitás fotos o archivos, adjuntalos y completá el sector o la descripción que solicite el formulario. Guardá la novedad y consultala desde Libro.',captura:'evidencia'},
  {titulo:'Consultá una novedad anterior',texto:'Abrí Libro o tocá una de las últimas novedades de Inicio para ver su detalle. Los registros de turnos cerrados quedan disponibles para consulta.',captura:'libro'},
 ]},
 {id:'accesos',titulo:'Accesos y precintos',descripcion:'Aperturas, cierres e informe para CCTV.',icono:'accesos',pasos:[
  {titulo:'Entrá a Accesos',texto:'Abrí la pestaña «Accesos». En «Registros», presioná + para cargar una apertura o un cierre.',captura:'accesos'},
  {titulo:'Identificá el acceso',texto:'Elegí el acceso, indicá si es apertura o cierre y revisá la fecha, la hora y el vigilador. Completá el motivo cuando corresponda.',captura:'registroAcceso'},
  {titulo:'Completá los precintos',texto:'Cargá el número completo de cada precinto. Si hay cuatro números recordados, completá los tres restantes. Podés usar «Leer precintos con cámara» y revisar el resultado.',captura:'precintos',consejo:'Si el acceso no lleva precinto, marcá «No aplica precinto».'},
  {titulo:'Generá el informe para CCTV',texto:'Guardá el acceso. En la lista, elegí la fecha que querés informar y presioná «Generar informe para CCTV». Revisá el contenido antes de copiarlo o compartirlo.',captura:'cctv'},
 ]},
 {id:'ingresos',titulo:'Ingresos y egresos',descripcion:'Movimientos de personal y externos.',icono:'equipo',pasos:[
  {titulo:'Elegí el tipo de movimiento',texto:'Desde las acciones rápidas o Más, abrí «Ingresos/Egresos». Elegí Vigiladores, Adicionales o Externos.',captura:'ingresos'},
  {titulo:'Registrá los datos',texto:'Cargá el ingreso o el egreso con su fecha, hora y datos de la persona. Para externos, revisá también empresa, tarea, lugar y autorización.',captura:'externos'},
  {titulo:'Confirmá también la salida',texto:'Cuando la persona se retire, registrá el egreso desde el movimiento correspondiente. Revisá los datos antes de guardar para que el historial refleje lo ocurrido.',captura:'externos'},
 ]},
 {id:'recorridos',titulo:'Registrar recorridos',descripcion:'Sector, controles y observaciones.',icono:'ronda',pasos:[
  {titulo:'Abrí Recorridos',texto:'Usá el acceso «Recorridos» desde Inicio o Más. Se abrirá el formulario de novedades con la categoría Recorrido.',captura:'inicio'},
  {titulo:'Completá los controles',texto:'Elegí el tipo de recorrido y el sector. Completá los controles que muestra el formulario y registrá las observaciones verificadas.',captura:'recorrido'},
  {titulo:'Guardá y consultá el registro',texto:'Revisá firma, fecha, hora y evidencia antes de guardar. El recorrido queda disponible en el libro de novedades.',captura:'recorrido'},
 ]},
 {id:'libro',titulo:'Libro e informe general',descripcion:'Buscar registros y preparar una entrega.',icono:'libro',pasos:[
  {titulo:'Abrí el libro',texto:'Entrá desde la pestaña Libro o desde «Ver todas» en Inicio. Allí se reúnen los registros de las distintas funciones.',captura:'libro'},
  {titulo:'Revisá el período',texto:'Antes de preparar el informe general, verificá la fecha de entrega, el horario de corte y la duración de 12 o 24 horas. Los filtros y la búsqueda ayudan a encontrar un registro.',captura:'periodo',consejo:'Un registro puede quedar en otro período si el servicio cruza la medianoche.'},
  {titulo:'Prepará la entrega',texto:'Revisá los registros incluidos y completá lo que falte. Usá la vista previa y las opciones de copiar o exportar PDF para preparar la entrega al supervisor.',captura:'libro'},
 ]},
 {id:'informes',titulo:'Informes de seguridad',descripcion:'Los 16 puntos de un incidente.',icono:'informes',pasos:[
  {titulo:'Creá el informe',texto:'En Más, abrí «Informes de seguridad» y presioná +. Podés elegir una plantilla de incidente como punto de partida.',captura:'informes'},
  {titulo:'Describí el hecho',texto:'Completá la fecha y la hora del hecho y el vigilador que firma. En el punto 6, escribí el resumen. Avanzá por las secciones para completar el resto.',captura:'informe',consejo:'«Guardar borrador» permite conservar el informe para continuar después.'},
  {titulo:'Revisá la evidencia',texto:'Si agregás fotos, indicá el sector de la evidencia. La ayuda de IA es opcional: revisá su redacción y conservá sólo los hechos comprobados.',captura:'informe'},
  {titulo:'Consultá el resultado',texto:'Al generar se abre la vista previa y se agrega un resumen al libro. Si falta un dato, Securia lo indica y vuelve a la sección correspondiente. Después podés copiar el informe o compartir su PDF.',captura:'lectura'},
 ]},
 {id:'asistente',titulo:'Usar el asistente',descripcion:'Consultar, redactar y revisar respuestas.',icono:'chat',pasos:[
  {titulo:'Abrí el chat',texto:'Tocá el botón flotante del asistente. Escribí una consulta clara sobre el servicio o pedí ayuda para redactar una novedad o un informe.',captura:'chat'},
  {titulo:'Consultá las directivas',texto:'El botón del libro en el chat abre «Directivas y PDFs». Allí podés elegir el puesto de consulta y agregar documentos para consultar su contenido.',captura:'documentos',consejo:'El asistente necesita conexión y un proveedor configurado en Ajustes de IA.'},
  {titulo:'Revisá lo que responde',texto:'Leé la respuesta antes de usarla. Podés copiarla o abrir las opciones de revisión. Si pedís expresamente agregar una novedad al libro, verificá el aviso de guardado.',captura:'chat',consejo:'Que la IA redacte una respuesta no significa que haya registrado una novedad.'},
 ]},
 {id:'sincronizacion',titulo:'Sincronizar la información',descripcion:'Pendientes, conexión y turnos cerrados.',icono:'share',pasos:[
  {titulo:'Reconocé los pendientes',texto:'Los cambios se guardan en el teléfono. Si aparece «Sincronización pendiente», todavía hay información por confirmar con la nube.',captura:'sincronizacion'},
  {titulo:'Consultá el estado',texto:'Con conexión, abrí el estado de sincronización y usá «Reintentar» si es necesario. Securia también vuelve a intentarlo automáticamente en primer plano.',captura:'sincronizacion',consejo:'Cerrar un turno no impide enviar sus registros pendientes.'},
  {titulo:'Comprobá la confirmación',texto:'Esperá a que termine el envío y revisá que no queden pendientes. Si hay un error, leé el mensaje y reintentá cuando se recupere la conexión.',captura:'sincronizacion',consejo:'Si hay pendientes, conservá la aplicación y sus datos en el teléfono.'},
 ]},
 {id:'mas',titulo:'Otras herramientas',descripcion:'Directivas, contactos y avisos.',icono:'mas',pasos:[
  {titulo:'Explorá Más',texto:'La pestaña Más reúne herramientas de operación y del puesto. Allí encontrás Equipo, Contactos, Directivas, Recordatorios y Ajustes.',captura:'mas'},
  {titulo:'Consultá el puesto y el equipo',texto:'Usá Contactos para consultar los teléfonos cargados y Equipo para ver vigiladores.',captura:'puesto'},
  {titulo:'Agregá recordatorios',texto:'Abrí Recordatorios y conectá un calendario del teléfono o de Google. Elegí el calendario, tocá «Nuevo recordatorio» y completá título, fecha, hora y aviso.',captura:'recordatorios'},
  {titulo:'Tené a mano las directivas',texto:'Desde Directivas podés cargar el documento del puesto. Para consultarlo con el asistente, usá su biblioteca «Directivas y PDFs» y revisá el texto antes de guardarlo.',captura:'directivas'},
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
