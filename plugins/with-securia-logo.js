const { AndroidConfig, withAndroidManifest } = require('@expo/config-plugins');

module.exports = config => withAndroidManifest(config, mod => {
  // Una actualización incremental puede conservar el drawable de versiones anteriores.
  const application = AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults);
  application.$['android:icon'] = '@mipmap/ic_launcher';
  application.$['android:roundIcon'] = '@mipmap/ic_launcher_round';
  return mod;
});
