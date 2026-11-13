import type {ImageSourcePropType} from 'react-native';

// Capturas locales de la interfaz con datos de demostración. Metro las incluye en la APK.
export const CAPTURAS_GUIA = {
  inicio: require('../assets/guia/inicio.png'),
  guardia: require('../assets/guia/guardia.png'),
  novedad: require('../assets/guia/novedad.png'),
  evidencia: require('../assets/guia/evidencia.png'),
  libro: require('../assets/guia/libro.png'),
  libroGs: require('../assets/guia/libro-gs.png'),
  accesos: require('../assets/guia/accesos.png'),
  registroAcceso: require('../assets/guia/registro-acceso.png'),
  precintos: require('../assets/guia/precintos.png'),
  cctv: require('../assets/guia/cctv.png'),
  ingresos: require('../assets/guia/ingresos.png'),
  externos: require('../assets/guia/externos.png'),
  egresoExterno: require('../assets/guia/egreso-externo.png'),
  recorrido: require('../assets/guia/recorrido.png'),
  periodo: require('../assets/guia/periodo.png'),
  informes: require('../assets/guia/informes.png'),
  informe: require('../assets/guia/informe.png'),
  lectura: require('../assets/guia/lectura.png'),
  chat: require('../assets/guia/chat.png'),
  documentos: require('../assets/guia/documentos.png'),
  sincronizacion: require('../assets/guia/sincronizacion.png'),
  mas: require('../assets/guia/mas.png'),
  puesto: require('../assets/guia/puesto.png'),
  directivas: require('../assets/guia/directivas.png'),
} satisfies Record<string, ImageSourcePropType>;

export type IdCapturaGuia = keyof typeof CAPTURAS_GUIA;
