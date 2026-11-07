import React from 'react';
import {Redirect} from 'expo-router';
export default function Anterior(){return <Redirect href={{pathname:'/ingresos',params:{tipo:'adicional'}}}/>;}
