import type {IdCapturaGuia} from './guiaCapturas';

/** Contenido de consulta con capturas locales de demostración. */
export type ToqueGuia=readonly [accion:string,x:number,y:number];
export type PasoGuia={titulo:string;texto:string;captura:IdCapturaGuia;toques:readonly ToqueGuia[];consejo?:string};
export type TemaGuia={id:string;titulo:string;descripcion:string;icono:string;pasos:PasoGuia[]};
export const TEMAS_GUIA:TemaGuia[]=[
 {id:'inicio',titulo:'Primeros pasos',descripcion:'Guardia a cargo y accesos desde Inicio.',icono:'inicio',pasos:[
  {titulo:'Confirmá quién está a cargo',texto:'Al ingresar al corporativo, elegí al vigilador que queda a cargo y presioná «Confirmar guardia». Así comienza su actividad en este teléfono.',captura:'guardia',toques:[['Elegí al vigilador',43,44],['Confirmar guardia',50,77]]},
  {titulo:'Ubicate en Inicio',texto:'Desde Inicio podés crear una novedad y abrir las funciones más usadas. El lápiz de «Acciones rápidas» permite elegir qué accesos ver.',captura:'inicio',toques:[['Nueva novedad',50,49],['Recorridos',62,91]]},
  {titulo:'Registrá el relevo',texto:'Cuando cambie el vigilador, usá «Cambiar» en la tarjeta «Guardia a cargo» y confirmá al nuevo responsable. Securia conserva la actividad anterior.',captura:'inicio',toques:[['Cambiar guardia',80,63]],consejo:'Revisá siempre quién está a cargo antes de registrar una novedad.'},
 ]},
 {id:'novedades',titulo:'Registrar novedades',descripcion:'Categoría, firma, horario y evidencia.',icono:'edit',pasos:[
  {titulo:'Abrí una nueva novedad',texto:'En Inicio, presioná «Nueva novedad» y elegí la categoría que corresponda al hecho.',captura:'inicio',toques:[['Nueva novedad',50,49]]},
  {titulo:'Completá los datos del hecho',texto:'Revisá el vigilador que firma, la fecha y la hora. Describí qué ocurrió y las acciones realizadas con datos comprobados.',captura:'novedad',toques:[['Elegí la firma',48,21],['Elegí la categoría',13,33],['Revisá fecha y horario',51,51],['Describí lo ocurrido',51,69]],consejo:'El horario del hecho puede ser diferente del momento en que lo cargás.'},
  {titulo:'Agregá evidencia y guardá',texto:'Si necesitás fotos o archivos, adjuntalos y completá el sector o la descripción que solicite el formulario. Guardá la novedad y consultala desde Libro.',captura:'evidencia',toques:[['Indicá el sector',50,14],['Adjuntá imágenes',48,72],['Guardá la novedad',50,90]]},
  {titulo:'Consultá una novedad anterior',texto:'Abrí Libro o tocá una de las últimas novedades de Inicio para ver su detalle. Los registros de turnos cerrados quedan disponibles para consulta.',captura:'libro',toques:[['Buscá en el Libro',49,44],['Elegí una categoría',36,49]]},
 ]},
 {id:'accesos',titulo:'Accesos y precintos',descripcion:'Aperturas, cierres e informe para CCTV.',icono:'accesos',pasos:[
  {titulo:'Entrá a Accesos',texto:'Abrí la pestaña «Accesos». En «Registros», presioná + para cargar una apertura o un cierre.',captura:'accesos',toques:[['Abrí Registros',26,31],['Tocá el botón +',91,10]]},
  {titulo:'Identificá el acceso',texto:'Indicá si es apertura o cierre, elegí la categoría del catálogo y seleccioná un acceso. Revisá la hora y el vigilador.',captura:'registroAcceso',toques:[['Elegí Apertura o Cierre',30,19],['Seleccioná un acceso',48,50],['Revisá la hora y el vigilador',50,80]]},
  {titulo:'Completá los precintos',texto:'El formulario empieza con un precinto. Cargá su número completo y agregá más si hace falta. Si hay cuatro números recordados, completá los tres restantes. Podés usar «Leer precintos con cámara» y revisar el resultado.',captura:'precintos',toques:[['Completá el número del precinto',38,56],['Leé con la cámara',49,93]],consejo:'Si el acceso no lleva precinto, marcá «No aplica precinto».'},
  {titulo:'Generá el informe para CCTV',texto:'Guardá el acceso. En la lista, elegí la fecha que querés informar y presioná «Generar informe para CCTV». Revisá el contenido antes de copiarlo o compartirlo.',captura:'cctv',toques:[['Elegí qué incluir',49,36],['Revisá la vista previa',52,76],['Copiá el informe',50,94]]},
 ]},
 {id:'ingresos',titulo:'Ingresos y egresos',descripcion:'Movimientos de personal y externos.',icono:'equipo',pasos:[
  {titulo:'Elegí el tipo de movimiento',texto:'Desde las acciones rápidas o Más, abrí «Ingresos/Egresos». Elegí Vigiladores, Adicionales o Externos.',captura:'ingresos',toques:[['Elegí el tipo de personal',49,33],['Registrá el movimiento',49,51]]},
  {titulo:'Registrá los datos',texto:'Para un ingreso de Externos, completá la razón social, la tarea, el lugar y la autorización. Revisá el horario antes de guardar.',captura:'externos',toques:[['Abrí Externos',81,26],['Registrá el ingreso',51,55]]},
  {titulo:'Confirmá también la salida',texto:'En Externos, presioná «Egreso» en un ingreso vigente. Para cargar una salida por razón social, usá «Registrar egreso» y completá las observaciones si corresponde.',captura:'externos',toques:[['Consultá el historial',73,41]]},
 ]},
 {id:'recorridos',titulo:'Registrar recorridos',descripcion:'Sector, controles y observaciones.',icono:'ronda',pasos:[
  {titulo:'Abrí Recorridos',texto:'Usá el acceso «Recorridos» desde Inicio o Más. Se abrirá el formulario de novedades con la categoría Recorrido.',captura:'inicio',toques:[['Recorridos',62,91]]},
  {titulo:'Completá los controles',texto:'Elegí el tipo de recorrido y el sector. Completá los controles que muestra el formulario y registrá las observaciones verificadas.',captura:'recorrido',toques:[['Elegí el tipo de recorrido',48,51],['Completá los controles',50,61],['Escribí las observaciones',48,73]]},
  {titulo:'Guardá y consultá el registro',texto:'Revisá firma, fecha, hora y evidencia antes de guardar. Al cerrar una ronda nocturna, el Libro muestra las novedades junto a sus puntos y los horarios de inicio y fin al pie.',captura:'recorrido',toques:[['Escribí las observaciones',48,73],['Guardá el recorrido',51,96]]},
 ]},
 {id:'libro',titulo:'Libro e informe general',descripcion:'Buscar registros y preparar una entrega.',icono:'libro',pasos:[
  {titulo:'Abrí el libro',texto:'Entrá desde la pestaña Libro o desde «Ver todas» en Inicio. Las novedades se separan por día y por Gs. Usá «Filtrar por Gs» para ver las de un vigilador.',captura:'libro',toques:[['Buscá en el Libro',49,44],['Elegí una categoría',36,49]]},
  {titulo:'Revisá el período',texto:'Antes de preparar el informe general, verificá la fecha de entrega, el horario de corte y la duración de 12 o 24 horas. Los filtros y la búsqueda ayudan a encontrar un registro.',captura:'periodo',toques:[['Elegí 12 o 24 horas',32,47],['Revisá la fecha de entrega',49,55],['Elegí la hora de corte',49,82]],consejo:'Un registro puede quedar en otro período si el servicio cruza la medianoche.'},
  {titulo:'Prepará la entrega',texto:'Revisá los registros incluidos y completá lo que falte. Usá la vista previa y las opciones de copiar o exportar PDF para preparar la entrega al supervisor.',captura:'libro',toques:[['Ver informe',75,88]]},
 ]},
 {id:'informes',titulo:'Informes de seguridad',descripcion:'Los 16 puntos de un incidente.',icono:'informes',pasos:[
  {titulo:'Creá el informe',texto:'En Más, abrí «Informes de seguridad» y presioná +. Podés elegir una plantilla de incidente como punto de partida.',captura:'informes',toques:[['Creá un informe con +',89,7]]},
  {titulo:'Describí el hecho',texto:'Completá la fecha y la hora del hecho y el vigilador que firma. En el punto 6, escribí el resumen. Avanzá por las secciones para completar el resto.',captura:'informe',toques:[['Elegí una plantilla',49,33],['Revisá fecha y hora',50,64],['Avanzá a la siguiente sección',72,93]],consejo:'«Guardar borrador» permite conservar el informe para continuar después.'},
  {titulo:'Revisá la evidencia',texto:'Si agregás fotos, indicá el sector de la evidencia. La ayuda de IA es opcional: revisá su redacción y conservá sólo los hechos comprobados.',captura:'informe',toques:[['Avanzá a la siguiente sección',72,93]]},
  {titulo:'Consultá el resultado',texto:'Al generar se abre la vista previa y se agrega un resumen al libro. Si falta un dato, Securia lo indica y vuelve a la sección correspondiente. Después podés copiar el informe o compartir su PDF.',captura:'lectura',toques:[['Revisá el resumen',50,29],['Copiá el informe',20,83],['Compartí el PDF',62,83]]},
 ]},
 {id:'asistente',titulo:'Usar el asistente',descripcion:'Consultar, redactar y revisar respuestas.',icono:'chat',pasos:[
  {titulo:'Abrí el chat',texto:'Tocá el botón flotante del asistente. Escribí una consulta clara sobre el servicio o pedí ayuda para redactar una novedad o un informe.',captura:'chat',toques:[['Escribí tu consulta',35,91],['Enviá la consulta',86,93]]},
  {titulo:'Consultá las directivas',texto:'El botón del libro en el chat abre «Directivas y PDFs». Allí podés elegir el puesto de consulta y agregar documentos para consultar su contenido.',captura:'documentos',toques:[['Elegí el puesto de consulta',49,34],['Agregá un PDF',50,49]],consejo:'El asistente necesita conexión y un proveedor configurado en Ajustes de IA.'},
  {titulo:'Revisá lo que responde',texto:'Leé la respuesta antes de usarla. Podés copiarla o abrir las opciones de revisión. Si pedís expresamente agregar una novedad al libro, verificá el aviso de guardado.',captura:'chat',toques:[['Revisá los datos en el chat',50,29]],consejo:'Que la IA redacte una respuesta no significa que haya registrado una novedad.'},
 ]},
 {id:'sincronizacion',titulo:'Sincronizar la información',descripcion:'Pendientes, conexión y turnos cerrados.',icono:'share',pasos:[
  {titulo:'Reconocé los pendientes',texto:'Los cambios se guardan en el teléfono. Si aparece «Sincronización pendiente», todavía hay información por confirmar con la nube.',captura:'sincronizacion',toques:[['Revisá el estado',10,27]]},
  {titulo:'Consultá el estado',texto:'Con conexión, abrí el estado de sincronización y usá «Reintentar» si es necesario. Securia también vuelve a intentarlo automáticamente en primer plano.',captura:'sincronizacion',toques:[['Revisá el estado',10,27],['Sincronizá ahora',49,55]],consejo:'Cerrar un turno no impide enviar sus registros pendientes.'},
  {titulo:'Comprobá la confirmación',texto:'Esperá a que termine el envío y revisá que no queden pendientes. Si hay un error, leé el mensaje y reintentá cuando se recupere la conexión.',captura:'sincronizacion',toques:[['Revisá el estado',10,27],['Consultá el historial de recuperación',49,77]],consejo:'Si hay pendientes, conservá la aplicación y sus datos en el teléfono.'},
 ]},
 {id:'mas',titulo:'Otras herramientas',descripcion:'Directivas, contactos y avisos.',icono:'mas',pasos:[
  {titulo:'Explorá Más',texto:'La pestaña Más reúne herramientas de operación y del puesto. Allí encontrás Equipo, Contactos, Directivas, Recordatorios y Ajustes.',captura:'mas',toques:[['Abrí el Libro',48,17],['Encontrá las herramientas de operación',48,43],['Abrí Directivas',48,94]]},
  {titulo:'Consultá el puesto y el equipo',texto:'Usá Contactos para consultar los teléfonos cargados y Equipo para ver vigiladores.',captura:'puesto',toques:[['Abrí Equipo',26,60],['Abrí Contactos',75,60]]},
  {titulo:'Agregá recordatorios',texto:'Abrí Recordatorios y conectá un calendario del teléfono o de Google. Elegí el calendario, tocá «Nuevo recordatorio» y completá título, fecha, hora y aviso.',captura:'recordatorios',toques:[['Conectá un calendario',50,56]]},
  {titulo:'Tené a mano las directivas',texto:'Desde Directivas podés cargar el documento del puesto. Para consultarlo con el asistente, usá su biblioteca «Directivas y PDFs» y revisá el texto antes de guardarlo.',captura:'directivas',toques:[['Consultá las directivas de hoy',25,23],['Cargá el documento',50,65]]},
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
