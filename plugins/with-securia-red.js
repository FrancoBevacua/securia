const { withMainApplication } = require('@expo/config-plugins');

module.exports = config => withMainApplication(config, mod => {
  const carga = '    loadReactNative(this)';
  const instalar = '    ar.com.securia.red.PoliticaRed.instalar(this)';
  const { contents } = mod.modResults;
  if (!contents.includes(instalar)) {
    if (!contents.includes(carga)) throw new Error('No se encontró el inicio nativo para instalar la política de red.');
    mod.modResults.contents = contents.replace(carga, instalar + '\n' + carga);
  }
  return mod;
});
