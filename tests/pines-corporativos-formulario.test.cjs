require('./register.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const React = require('react');
const { act, create } = require('react-test-renderer');
const { estadoVacio } = require('../src/model.ts');
global.IS_REACT_ACT_ENVIRONMENT = true;

test('el formulario ofrece puestos sin PIN, oculta los dígitos y exige que coincida la confirmación', async () => {
  const S = estadoVacio();
  S.posts = [{ id: 'paseo', nombre: 'Paseo' }, { id: 'playa', nombre: 'Playa' }, { id: 'baja', deleted: true }];
  S.guards = [{ id: 'corp-paseo', corporativo: true, cuenta: true, puestoId: 'paseo' }];
  const guardados = [];
  const st = { S, esAdmin: true, reintentarNube: async () => {} };
  const cargar = Module._load;
  Module._load = function (name, ...args) {
    if (name === 'expo-router') return { router: { back() {} } };
    if (name === '../store') return { useStore: () => st };
    if (name === '../nube') return { guardarPinCorporativoNube: async (...datos) => { guardados.push(datos); } };
    if (name === '../ui') return {
      useToast: () => () => {},
      ...Object.fromEntries(['Banner', 'Btn', 'Card', 'Empty', 'Eyebrow', 'Hint', 'Input',
        'Item', 'Pantalla', 'Selector', 'SubCabecera', 'Tag'].map(n => [n, p => React.createElement(n, p, p.children)])),
    };
    return cargar.call(this, name, ...args);
  };
  let Pantalla;
  try { Pantalla = require('../src/pantallas/CuentaCorporativo.tsx').default; }
  finally { Module._load = cargar; }
  let r;
  await act(() => { r = create(React.createElement(Pantalla)); });
  const buscar = (n, label) => r.root.findAllByType(n).find(x => x.props.label === label).props;
  await act(() => buscar('Btn', 'Crear PIN corporativo').onPress());
  const puesto = buscar('Selector', 'Puesto');
  assert.deepEqual(puesto.opciones.map(p => p.v), ['playa']);
  await act(() => puesto.onChange('playa'));
  const pin = buscar('Input', 'PIN de seis números');
  const repetir = buscar('Input', 'Repetir PIN');
  assert.ok(pin.secureTextEntry && repetir.secureTextEntry);
  await act(() => pin.onChangeText('012345'));
  await act(() => repetir.onChangeText('012344'));
  await act(() => buscar('Btn', 'Guardar PIN').onPress());
  assert.deepEqual(guardados, []);
  assert.match(r.root.findByType('Banner').props.children, /mismo PIN/);
  await act(() => repetir.onChangeText('012345'));
  await act(() => buscar('Btn', 'Guardar PIN').onPress());
  assert.deepEqual(guardados, [['playa', '012345', true]]);
  st.esAdmin = false;
  await act(() => r.update(React.createElement(Pantalla)));
  assert.equal(r.toJSON(), null);
  await act(() => r.unmount());
});
