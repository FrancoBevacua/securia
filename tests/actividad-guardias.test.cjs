require('./register.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { actividadGuardiasDelDia, SIN_GUARDIA } = require('../src/actividadGuardias.ts');
const { estadoVacio, isoDate } = require('../src/model.ts');

const fecha = '2026-11-15';
const asiento = (id, datos = {}) => ({ id, fecha, hora: '08:00', guardId: 'ana', ...datos });
const guarda = (id, nombre) => ({ id, nombre, apellido: 'Prueba' });

test('resume el día civil por firma, aparta asientos automáticos y excluye bajas', () => {
  const S = estadoVacio();
  S.guards = [guarda('ana', 'Ana'), guarda('luis', 'Luis')];
  S.novedades = [
    asiento('temprana'), asiento('tarde', { hora: '23:58', createdBy: 'corporativo' }),
    asiento('ayer', { fecha: '2026-11-14', hora: '23:59' }),
    asiento('mañana', { fecha: '2026-11-16', hora: '00:01' }),
    asiento('baja', { deleted: true }), asiento('copia', { alogId: 'cierre' }),
    asiento('copia-sin-enlace'), asiento('copia-historica', { autoKey: 'playa:1' }), asiento('servicio-in:ana'),
  ];
  S.alogs = [asiento('cierre', { guardId: 'luis', tipo: 'cierre', novId: 'copia-sin-enlace' })];
  S.reports = [asiento('informe', { firmaId: 'luis', createdBy: 'ana' }), asiento('informe-de-baja', { deleted: true })];
  const { guardias, total } = actividadGuardiasDelDia(S, fecha);
  assert.deepEqual(total.novedades.map(n => n.id), ['tarde', 'temprana']);
  assert.deepEqual(total.accesos.map(a => a.id), ['cierre']);
  assert.deepEqual(total.informes.map(r => r.id), ['informe']);
  assert.deepEqual(guardias.map(g => g.id), ['ana', 'luis']);
  assert.equal(guardias[0].registros.informes.length, 0);
  assert.equal(guardias[0].registros.novedades.length, 2);
  assert.equal(guardias[1].registros.accesos.length, 1);
  assert.equal(guardias[1].registros.informes.length, 1);
});

test('mantiene registros previos sin firma y usa un nombre guardado aunque falte la ficha', () => {
  const S = estadoVacio();
  S.guards = [guarda('ana', 'Ana')];
  S.novedades = [asiento('sin-ficha', { guardId: 'anterior' }), asiento('sin-firma', { guardId: '' })];
  S.alogs = [asiento('acceso-viejo', { guardId: 'anterior', gs: 'Gs Guardia anterior' })];
  S.reports = [asiento('informe-viejo', { createdBy: 'ana' })];
  const guardias = new Map(actividadGuardiasDelDia(S, fecha).guardias.map(g => [g.id, g]));
  assert.equal(guardias.get('anterior').nombre, 'Gs Guardia anterior');
  assert.equal(guardias.get('anterior').registros.novedades[0].id, 'sin-ficha');
  assert.equal(guardias.get(SIN_GUARDIA).registros.novedades[0].id, 'sin-firma');
  assert.equal(guardias.get('ana').registros.informes[0].id, 'informe-viejo');
});

test('el contador de un guardia abre los registros de esa categoría, fecha y firma', async () => {
  const Module = require('node:module');
  const React = require('react');
  const { create, act } = require('react-test-renderer');
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const hoy = isoDate();
  const S = estadoVacio();
  S.guards = [guarda('ana', 'Ana'), guarda('luis', 'Luis')];
  S.novedades = [
    asiento('ana-1', { fecha: hoy, categoria: 'Novedad', texto: 'Registro de Ana' }),
    asiento('luis-1', { fecha: hoy, guardId: 'luis', categoria: 'Novedad', texto: 'Registro de Luis' }),
  ];
  S.punches = [{ id: 'turno', fecha: hoy, guardId: 'ana', in: '00:00', out: '' }];
  const perfil = { S, esAdmin: true };
  let ruta;
  const cargar = Module._load;
  Module._load = function (name, ...args) {
    if (name === 'react-native') return { View: 'View', Pressable: 'Pressable', Text: 'Text',
      AppState: { addEventListener: () => ({ remove() {} }) } };
    if (name === 'expo-router') return { router: { push: destino => { ruta = destino; } }, useLocalSearchParams: () => ruta.params };
    if (name === '../store') return { useStore: () => perfil };
    if (name === '../Imagen') return { Image: 'Image' };
    if (name === '../icons') return { Icon: 'Icon' };
    if (name === './Informes') return { ContenidoInforme: 'ContenidoInforme' };
    if (name === '../ui') return { useTheme: () => ({}), ...Object.fromEntries(
      ['Btn', 'Card', 'Chip', 'Chipbar', 'Empty', 'Hint', 'Item', 'Pantalla', 'Row', 'Selector', 'Sheet', 'Stack', 'SubCabecera', 'Tag']
        .map(n => [n, props => React.createElement(n, props, props.children)]),
    ) };
    return cargar.call(this, name, ...args);
  };
  let Resumen, Actividad;
  try {
    Resumen = require('../src/pantallas/ResumenOperativo.tsx').default;
    Actividad = require('../src/pantallas/ActividadGuardia.tsx').default;
  } finally {
    Module._load = cargar;
  }
  let r;
  await act(() => { r = create(React.createElement(Resumen)); });
  assert.ok(r.root.findAllByType('Item').some(x => x.props.title === 'Prueba, Ana'));
  await act(() => r.root.findAllByType('Pressable').find(x => x.props.accessibilityLabel === 'Novedades, 1, Ana Prueba').props.onPress());
  assert.deepEqual(ruta, { pathname: '/actividad-guardia', params: { fecha: hoy, tipo: 'novedades', guardia: 'ana' } });
  await act(() => r.update(React.createElement(Actividad)));
  const resultados = r.root.findAllByType('Item');
  assert.deepEqual(resultados.map(x => x.props.subs[1]), ['Registro de Ana']);
  await act(() => resultados[0].props.onPress());
  assert.equal(r.root.findByType('Sheet').props.visible, true);
  assert.ok(r.root.findAllByType('Hint').some(x => x.props.children.includes('Ana Prueba')));
  perfil.esAdmin = false;
  await act(() => r.update(React.createElement(Actividad)));
  assert.equal(r.toJSON(), null);
  await act(() => r.unmount());
});
