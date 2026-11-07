const fs=require('node:fs'),path=require('node:path');
const raiz=path.resolve(__dirname,'..'),destino=path.join(raiz,'supabase/functions/_shared');
fs.mkdirSync(destino,{recursive:true});
for(const nombre of ['evidencias','envioProgramado','informedia','model','text','reporte','pdfplantilla','pdfw','pdfmetrics']){
 let fuente=fs.readFileSync(path.join(raiz,'src',nombre+'.ts'),'utf8');
 fuente=fuente.replace(/from (['"])(\.\/[a-zA-Z]+)\1/g,(_,q,s)=>'from '+q+s+'.ts'+q);
 fuente=fuente.replace(/from 'jpeg-js'/g,"from 'npm:jpeg-js@0.4.4'").replace(/from 'pako'/g,"from 'npm:pako@2.2.0'");
 fs.writeFileSync(path.join(destino,nombre+'.ts'),fuente);
}
console.log('Código compartido del worker actualizado desde src.');
