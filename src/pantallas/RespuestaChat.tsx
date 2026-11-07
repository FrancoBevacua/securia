import React from 'react';
import {Text,View} from 'react-native';
import {FONT} from '../theme';
import {useTheme} from '../ui';
import {bloquesRespuestaChat} from '../respuestaChat';
function EnLinea({texto}:{texto:string}){
 const partes=texto.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*|_[^_\n]+_|`[^`]+`)/g);
 return <>{partes.map((p,i)=>p.startsWith('**')&&p.endsWith('**')?<Text key={i} style={{fontFamily:FONT.bodyBold}}>{p.slice(2,-2)}</Text>:p.startsWith('*')&&p.endsWith('*')?<Text key={i} style={{fontFamily:FONT.bodyBold}}>{p.slice(1,-1)}</Text>:p.startsWith('_')&&p.endsWith('_')?<Text key={i} style={{fontStyle:'italic'}}><EnLinea texto={p.slice(1,-1)}/></Text>:p.startsWith('`')&&p.endsWith('`')?<Text key={i} style={{fontFamily:FONT.mono}}>{p.slice(1,-1)}</Text>:p)}</>;
}
export default function RespuestaChat({texto}:{texto:string}){
 const t=useTheme();
 return <View style={{gap:4,minWidth:0}}>{bloquesRespuestaChat(texto).map((b,i)=>!b.texto?<View key={i} style={{height:7}}/>:b.tipo==='lista'?<View key={i} style={{flexDirection:'row',gap:8,alignItems:'flex-start'}}><Text style={{minWidth:18,color:t.text,lineHeight:25,fontFamily:FONT.body}}>{b.marca}</Text><Text selectable style={{flex:1,minWidth:0,color:t.text,fontFamily:FONT.body,fontSize:16,lineHeight:25}}><EnLinea texto={b.texto}/></Text></View>:<Text selectable key={i} accessibilityRole={b.tipo==='titulo'?'header':undefined} style={{color:t.text,fontFamily:b.tipo==='titulo'?FONT.bodyBold:FONT.body,fontSize:b.tipo==='titulo'?18:16,lineHeight:26}}><EnLinea texto={b.texto}/></Text>)}</View>;
}
