require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {estadoVacio}=require('../src/model.ts'),{grupoDeAcceso,accesosDelGrupo}=require('../src/gruposAccesos.ts');
const {pedidoChat}=require('../src/chatbot.ts'),{contextoOperativo}=require('../src/contextoOperativo.ts');
const {redactarAsiento}=require('../src/reporte.ts');
const nombres=['Portón Oroño','Portón Ombú','Puertas E2 y E2 Bis','E1 - ADM','Puerta E8','Pecera 1','Pecera 2','Puerta bar cup',"Ventanal MC Donald’s",'Reja E8','Pecera 1 puerta chica'];
const catalogo=nombres.map((nombre,i)=>({id:String(i),nombre,tipo:i<2?'porton':'puerta'}));
test('Varios accesos separa portones, emergencias y otros por sus nombres y tipo existentes',()=>{
 assert.deepEqual(catalogo.map(grupoDeAcceso),['portones','portones','emergencias','emergencias','emergencias','otros','otros','otros','otros','otros','otros']);
 for(const grupo of ['portones','emergencias','otros'])assert.ok(accesosDelGrupo(catalogo,grupo).every(nombre=>grupoDeAcceso(catalogo.find(c=>c.nombre===nombre))===grupo));
 assert.equal(accesosDelGrupo([...catalogo,{id:'repetido',nombre:' pecera 1 ',tipo:'otro'},{id:'baja',nombre:'Retirado',deleted:true}], 'otros').filter(n=>n.toLowerCase()==='pecera 1').length,1);
 assert.ok(accesosDelGrupo(catalogo,'portones',['Portón retirado']).includes('Portón retirado'));
 assert.equal(redactarAsiento('Cierre',{grupoAccesos:'otros',accesos:['Pecera 1','Reja E8']}),'Se procede al cierre de otros accesos:\n- Pecera 1\n- Reja E8');
});
function base(){const S=estadoVacio();S.guards=[{id:'g',nombre:'Ana',apellido:'Prueba',dni:'NO_ENVIAR',pin:'NO_ENVIAR'}];S.accesses=catalogo;S.alogs=[{id:'a',fecha:'2026-11-06',hora:'06:30',tipo:'apertura',acceso:'Portón Oroño',guardId:'g',gs:'Gs Prueba, Ana',p1:'0123456',p2:'',nota:'Sin daños'},{id:'b',fecha:'2026-11-06',hora:'20:00',tipo:'cierre',acceso:'Puerta E8',guardId:'g',p1:'7654321',p2:'',nota:'Cierre verificado'},{id:'otro',fecha:'2026-11-05',hora:'20:00',tipo:'cierre',acceso:'Pecera 1',guardId:'g',p1:'1122334',p2:'',nota:''}];return S;}
test('el asistente prepara el informe de accesos con operaciones y precintos y conserva la plantilla de seguridad para incidentes',()=>{
 const S=base(),p=pedidoChat(S,[],'',[],'Prepará el informe de aperturas y cierres de accesos del 06/11/2026.','auto',new Date(2026,10,6,22));
 assert.equal(p.informeAccesos,true);assert.doesNotMatch(p.prompt,/PLANTILLA DISPONIBLE/);assert.match(p.prompt,/0123456/);assert.match(p.prompt,/Cierre verificado/);assert.match(p.sistema,/CCTV/);assert.doesNotMatch(p.prompt,/NO_ENVIAR/);
 const f=p.fuentes.find(f=>f.nombre==='Alcance del informe de accesos · 2026-11-06');assert.equal(JSON.parse(f.texto).registros,2);
 const q=pedidoChat(S,[],'',[],'Prepará un informe de seguridad por un incidente en el portón.');assert.equal(q.informeAccesos,false);assert.match(q.prompt,/PLANTILLA DISPONIBLE/);
 const memoria=pedidoChat(S,[],'',[{id:'previo',rol:'user',texto:'Revisemos los cierres de portones del 06/11/2026.',modo:'auto'}],'Ahora redactá el informe.');assert.equal(memoria.informeAccesos,true);
});
test('el contexto prioriza el día pedido y declara cuando no cabe el detalle completo',()=>{
 const S=base();S.alogs=Array.from({length:80},(_,i)=>({...S.alogs[0],id:'r'+i,acceso:'Portón '+i}));
 const c=contextoOperativo(S,'Informe de aperturas de accesos del 06/11/2026',new Date(2026,10,6));
 assert.equal(c.cobertura.detalleAccesosCompleto,false);assert.equal(c.cobertura.fechaAccesos,'2026-11-06');assert.equal(JSON.parse(c.fuentes.find(f=>f.nombre.startsWith('Alcance del informe')).texto).aperturas,80);
});
