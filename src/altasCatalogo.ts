import {uid} from './model';
import {normalizarNombre} from './horarios';
export const mismoNombre=(a:string,b:string)=>normalizarNombre(a)===normalizarNombre(b);
export const nuevoVigilador=(apellido:string,nombre:string)=>({id:uid(),apellido:apellido.trim(),nombre:nombre.trim(),cuenta:false,rol:'vigilador' as const,legajo:'',puestoId:'',franjaId:'',updatedAt:Date.now()});
export const nuevoAcceso=(nombre:string)=>({id:uid(),nombre:nombre.trim(),tipo:/port[oó]n/i.test(nombre)?'porton':/puerta/i.test(nombre)?'puerta':'acceso',precintos:0,orden:Date.now(),updatedAt:Date.now()});
