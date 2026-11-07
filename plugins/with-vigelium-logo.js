const {withAndroidManifest,withDangerousMod,withAndroidStyles}=require('@expo/config-plugins');
const fs=require('node:fs'),path=require('node:path');
module.exports=config=>{
 config=withAndroidManifest(config,c=>{
  const app=c.modResults.manifest.application[0];
  app.$['android:icon']='@drawable/vigelium_logo';app.$['android:roundIcon']='@drawable/vigelium_logo';return c;
 });
 config=withAndroidStyles(config,c=>{
  const splash=c.modResults.resources.style?.find(s=>s.$.name==='Theme.App.SplashScreen');
  if(splash){const item=splash.item?.find(i=>i.$.name==='windowSplashScreenAnimatedIcon');if(item)item._='@drawable/vigelium_logo';}
  return c;
 });
 return withDangerousMod(config,['android',async c=>{
  const dir=path.join(c.modRequest.platformProjectRoot,'app/src/main/res/drawable');fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'vigelium_logo.xml'),`<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">
  <path android:fillColor="#102C49" android:pathData="M0,0h108v108h-108z"/>
  <group android:translateX="22" android:translateY="22">
   <path android:fillColor="#40D8CE" android:pathData="M14,17h10l9,23 7,-17h10L35,51h-7Z"/>
   <path android:fillColor="#FFFFFF" android:pathData="M38,13h12v5H38zM14,17h10l9,23 -5,11Z"/>
  </group>
 </vector>`);
  const styles=path.join(c.modRequest.platformProjectRoot,'app/src/main/res/values/styles.xml');
  if(fs.existsSync(styles))fs.writeFileSync(styles,fs.readFileSync(styles,'utf8').replace(/(<item name="windowSplashScreenAnimatedIcon">)[^<]+/, '$1@drawable/vigelium_logo'));
  return c;
 }]);
};
