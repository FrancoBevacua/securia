import React from 'react';
import {View} from 'react-native';
import {PuertaPrecintos,uid,soloDigitos} from '../model';
import {Btn,Card,Input,Row,Stack,Hint,Toggle} from '../ui';
import {inicioPrecinto,precintosPorton} from '../precintos';

export default function PuertasAcceso({valor,onChange,prefijo='',porton=false}:{valor:PuertaPrecintos[];onChange:(v:PuertaPrecintos[])=>void;prefijo?:string;porton?:boolean}){
 if(porton){const puerta=precintosPorton(valor,prefijo)[0];return <Stack gap={10}>
  {puerta.precintos.map((n,j)=><Row key={j}><View style={{flex:1}}><Input label={j===0?'Precinto':'Precinto '+(j+1)} value={n} onChangeText={v=>onChange([{...puerta,precintos:puerta.precintos.map((x,k)=>k===j?soloDigitos(v).slice(0,7):x)}])} mono keyboardType="number-pad" maxLength={7}/></View>{j>0?<Btn icon="x" accessibilityLabel={'Quitar precinto '+(j+1)} variant="ghost" onPress={()=>onChange([{...puerta,precintos:puerta.precintos.filter((_,k)=>k!==j)}])}/>:null}</Row>)}
  <Btn label="Agregar precinto" icon="plus" size="sm" disabled={puerta.precintos.length>=20} onPress={()=>onChange([{...puerta,precintos:[...puerta.precintos,inicioPrecinto(prefijo)]}])}/>
  <Hint>Ingrese los siete dígitos de cada precinto del portón.</Hint>
 </Stack>;}
 const set=(i:number,c:Partial<PuertaPrecintos>)=>onChange(valor.map((p,j)=>i===j?{...p,...c}:p));
 return <Stack gap={10}>
  {valor.map((p,i)=><Card pad key={p.id}><Stack gap={8}>
   <Row><View style={{flex:1}}><Input label={porton?'Hoja':'Puerta'} value={p.nombre} onChangeText={nombre=>set(i,{nombre})}/></View>{!porton&&valor.length>1?<Btn icon="trash" variant="ghost" onPress={()=>onChange(valor.filter((_,j)=>j!==i))}/>:null}</Row>
   <Toggle label={porton?'No aplica precinto en esta hoja':'No aplica precinto en esta puerta'} value={!!p.sinPrecinto} onChange={sinPrecinto=>set(i,{sinPrecinto})}/>
   {!p.sinPrecinto?<>
   {p.precintos.map((n,j)=><Row key={j}><View style={{flex:1}}><Input label={'Precinto '+(j+1)} value={n} onChangeText={v=>set(i,{precintos:p.precintos.map((x,k)=>j===k?soloDigitos(v).slice(0,7):x)})} mono keyboardType="number-pad" maxLength={7}/></View>{!porton?<Btn icon="x" variant="ghost" onPress={()=>set(i,{precintos:p.precintos.filter((_,k)=>k!==j)})}/>:null}</Row>)}
   {!porton?<Btn label="Agregar precinto" size="sm" disabled={p.precintos.length>=20} onPress={()=>set(i,{precintos:[...p.precintos,inicioPrecinto(prefijo)]})}/>:null}
   </>:null}
  </Stack></Card>)}
  {!porton?<Btn label="Agregar puerta" icon="plus" disabled={valor.length>=20} onPress={()=>onChange([...valor,{id:uid(),nombre:'Puerta '+(valor.length+1),precintos:[inicioPrecinto(prefijo)]}])}/>:null}
  <Hint>{inicioPrecinto(prefijo)?'Los cuatro números recordados ya están escritos. Complete los últimos tres para formar el precinto de siete dígitos; puede editar el número completo.':'Ingrese los siete dígitos del precinto. La app recordará sus cuatro primeros números al guardar.'}</Hint>
 </Stack>;
}
