require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module');
const {TEMAS_GUIA,normalizarLugarGuia,claveGuia}=require('../src/guia.ts');
const memoria=new Map();let fallar=false,barrera;
const load=Module._load;
Module._load=function(n,...a){
 if(n==='@react-native-async-storage/async-storage')return{getItem:async k=>memoria.get(k)||null,setItem:async(k,v)=>{if(barrera)await barrera;if(fallar)throw Error('Disco de prueba');memoria.set(k,v);}};
 return load.call(this,n,...a);
};
const {leerLugarGuia,guardarLugarGuia}=require('../src/progresoGuia.ts');

test('un marcador antiguo o inválido conserva la navegación dentro de los temas disponibles',()=>{
 for(const valor of [null,{},'texto',{tema:'eliminado',paso:100}])assert.deepEqual(normalizarLugarGuia(valor),{tema:'inicio',paso:0});
 assert.deepEqual(normalizarLugarGuia({tema:'accesos',paso:999}),{tema:'accesos',paso:3});
 assert.deepEqual(normalizarLugarGuia({tema:'accesos',paso:-1}),{tema:'accesos',paso:0});
 assert.deepEqual(normalizarLugarGuia({tema:'accesos',paso:NaN}),{tema:'accesos',paso:0});
 assert.equal(new Set(TEMAS_GUIA.map(t=>t.id)).size,TEMAS_GUIA.length);
});

test('recuerda el último paso por vigilador y conserva el orden de pulsaciones rápidas',async()=>{
 let liberar;barrera=new Promise(r=>liberar=r);
 const a=guardarLugarGuia('guardia/a',{tema:'accesos',paso:1});
 const b=guardarLugarGuia('guardia/a',{tema:'accesos',paso:2});
 const lectura=leerLugarGuia('guardia/a');liberar();await Promise.all([a,b]);barrera=undefined;
 assert.deepEqual(await lectura,{tema:'accesos',paso:2});
 assert.deepEqual(await leerLugarGuia('guardia/b'),{tema:'inicio',paso:0});
 assert.ok(memoria.has(claveGuia('guardia/a')));assert.equal(memoria.size,1);
});

test('un fallo no borra el marcador anterior ni bloquea el próximo guardado',async()=>{
 fallar=true;await assert.rejects(guardarLugarGuia('guardia/a',{tema:'libro',paso:1}),/Disco/);
 assert.deepEqual(await leerLugarGuia('guardia/a'),{tema:'accesos',paso:2});
 fallar=false;await guardarLugarGuia('guardia/a',{tema:'libro',paso:1});
 assert.deepEqual(await leerLugarGuia('guardia/a'),{tema:'libro',paso:1});
});
