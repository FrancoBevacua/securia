const {withAndroidManifest,withDangerousMod,withAndroidStyles}=require('@expo/config-plugins');
const fs=require('node:fs'),path=require('node:path');
module.exports=config=>{
 config=withAndroidManifest(config,c=>{
  const app=c.modResults.manifest.application[0];
  app.$['android:icon']='@drawable/securia_logo';app.$['android:roundIcon']='@drawable/securia_logo';return c;
 });
 config=withAndroidStyles(config,c=>{
  const splash=c.modResults.resources.style?.find(s=>s.$.name==='Theme.App.SplashScreen');
  if(splash){const item=splash.item?.find(i=>i.$.name==='windowSplashScreenAnimatedIcon');if(item)item._='@drawable/securia_logo';}
  return c;
 });
 return withDangerousMod(config,['android',async c=>{
  const dir=path.join(c.modRequest.platformProjectRoot,'app/src/main/res/drawable');fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'securia_logo.xml'),`<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">
  <path android:fillColor="#06142D" android:pathData="M0,0h108v108h-108z"/>
  <group android:translateX="22" android:translateY="22">
   <path android:fillColor="#0B183C" android:strokeColor="#F43C58" android:strokeWidth="5" android:strokeLineJoin="round" android:pathData="M32,7L53,15v16c0,12 -12,21 -21,26c-9,-5 -21,-14 -21,-26V15Z"/>
   <path android:fillColor="@android:color/transparent" android:strokeColor="#FFFFFF" android:strokeWidth="5" android:strokeLineCap="round" android:strokeLineJoin="round" android:pathData="M22,31l7,7 14,-16"/>
  </group>
 </vector>`);
  const styles=path.join(c.modRequest.platformProjectRoot,'app/src/main/res/values/styles.xml');
  if(fs.existsSync(styles))fs.writeFileSync(styles,fs.readFileSync(styles,'utf8').replace(/(<item name="windowSplashScreenAnimatedIcon">)[^<]+/, '$1@drawable/securia_logo'));
  return c;
 }]);
};
