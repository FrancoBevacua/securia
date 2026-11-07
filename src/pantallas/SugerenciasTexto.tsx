import React from 'react';
import {Card,Hint,Item} from '../ui';

export default function SugerenciasTexto({opciones,onElegir}:{opciones:string[];onElegir:(texto:string)=>void}){
 if(!opciones.length)return null;
 return <><Hint>Autocompletar con una frase del historial</Hint><Card>{opciones.map((texto,i)=><Item key={texto} title={texto} tituloLineas={4} last={i===opciones.length-1} onPress={()=>onElegir(texto)}/>)}</Card></>;
}
