import type { Estado } from './model';
export type SobreNube = { estado: Estado; guardia: string; revision: number; numero: number; enviado?: Estado; origenEnviado?:Estado; base?:Estado };
const ordenado = (v:any):any => Array.isArray(v) ? v.map(ordenado) : v && typeof v==='object' ? Object.fromEntries(Object.keys(v).sort().map(k=>[k,ordenado(v[k])])) : v;
export const mismoEstado = (a:Estado,b:Estado) => JSON.stringify(ordenado(a))===JSON.stringify(ordenado(b));

/** El disco y la red usan colas distintas: una red lenta no retrasa la copia cifrada. */
export class ColaNube {
  private disco: Promise<any> = Promise.resolve();
  private red: Promise<any> = Promise.resolve();
  private numero=0;
  constructor(private io:{
    leer:()=>Promise<SobreNube|null>; escribir:(p:SobreNube)=>Promise<void>; quitar:()=>Promise<void>;
    consultar:()=>Promise<{estado:Estado;revision:number}>;
    enviar:(p:SobreNube,remoto:Estado)=>Promise<number>; actor:()=>string; revision:()=>number;
    confirmar:(rev:number,estado?:Estado)=>void|Promise<void>;
    base?:()=>Estado|undefined;
    reconciliar?:(local:Estado,remoto:Estado,base?:Estado)=>Estado;
  }){}
  private exclusivo<T>(f:()=>Promise<T>):Promise<T>{const p=this.disco.catch(()=>{}).then(f);this.disco=p;return p;}
  guardar(estado:Estado,base?:Estado):Promise<void>{return this.encolar(estado,base).sincronizado;}
  encolar(estado:Estado,base?:Estado):{local:Promise<void>;sincronizado:Promise<void>}{
    const copia=JSON.parse(JSON.stringify(estado));const guardia=this.io.actor();
    const baseCopia=base?JSON.parse(JSON.stringify(base)):undefined;
    const listo=this.exclusivo(async()=>{
      const anterior=await this.io.leer();
      if(anterior && anterior.guardia!==guardia)throw new Error('El guardia anterior debe sincronizar sus cambios pendientes.');
      const numero=this.numero=Math.max(this.numero,anterior?.numero??0)+1;
      await this.io.escribir({estado:copia,guardia,numero,revision:anterior?.revision??this.io.revision(),enviado:anterior?.enviado,origenEnviado:anterior?.origenEnviado,base:anterior ? anterior.base : baseCopia??this.io.base?.()});
    });
    const enviado=this.red.catch(()=>{}).then(async()=>{await listo;await this.vaciar();});this.red=enviado;
    // Quien espera sólo el disco no debe producir un rechazo no manejado de red.
    enviado.catch(()=>{});
    return {local:listo,sincronizado:enviado};
  }
  reintentar():Promise<void>{const p=this.red.catch(()=>{}).then(()=>this.vaciar());this.red=p;return p;}
  async esperar(){await this.disco;await this.red;}
  /** Sólo descarta la cola después del respaldo remoto confirmado y de guardar la nueva base. */
  recuperar<T extends {estado:Estado;revision:number}>(respaldar:(p:SobreNube)=>Promise<T>):Promise<T|null>{
    const trabajo=this.red.catch(()=>{}).then(async()=>{
      const pendiente=await this.exclusivo(()=>this.io.leer());
      if(!pendiente)return null;
      if(pendiente.guardia!==this.io.actor())throw Error('Ingrese con la cuenta que tiene cambios pendientes.');
      const resultado=await respaldar(pendiente);
      await this.exclusivo(async()=>{
        const actual=await this.io.leer();
        if(!actual||actual.numero!==pendiente.numero||actual.guardia!==this.io.actor())
          throw Error('Se guardaron cambios nuevos durante la recuperación. Se conservaron; vuelva a recuperar la sincronización.');
        await this.io.confirmar(resultado.revision,resultado.estado);
        await this.io.quitar();
      });
      return resultado;
    });
    this.red=trabajo;return trabajo;
  }
  resolver(estado:Estado,base:Estado,revision:number,numero:number):Promise<void>{
    const p=this.red.catch(()=>{}).then(()=>this.exclusivo(async()=>{
      const actual=await this.io.leer();
      if(!actual||actual.numero!==numero||actual.guardia!==this.io.actor())throw Error('Hay cambios nuevos. Vuelva a revisar las diferencias.');
      await this.io.escribir({...actual,estado,base,revision,numero:actual.numero+1,enviado:undefined,origenEnviado:undefined});
    }));
    this.red=p;return p;
  }
  private async vaciar(){
    // Reconsultar antes de reenviar: una cancelación puede haber perdido sólo
    // la respuesta de un guardado ya confirmado por el servidor.
    for(let intento=0;;intento++){
      try{return await this.vaciarIntento();}
      catch(e:any){
        if(!e.sinConexion||intento>=2)throw e;
        await new Promise(resolve=>setTimeout(resolve,500*2**intento));
      }
    }
  }
  private async vaciarIntento(){
    let colisiones=0;
    for(;;){
      let p=await this.exclusivo(()=>this.io.leer());if(!p)return;
      if(!this.io.actor() || p.guardia!==this.io.actor())throw new Error('Ingrese con la cuenta que tiene cambios pendientes.');
      const servidor=await this.io.consultar();
      const origen=p.estado;
      if(mismoEstado(servidor.estado,p.estado)){
        await this.aceptar(p,servidor.revision);continue;
      }
      if(servidor.revision!==p.revision || (this.io.reconciliar&&p.base&&!mismoEstado(servidor.estado,p.base))){
        if(this.io.reconciliar || !p.enviado || !mismoEstado(servidor.estado,p.enviado)){
          if(!this.io.reconciliar)throw new Error('Hay cambios más recientes en la nube. Se conservó su copia cifrada y no se sobrescribió el historial.');
          const base=p.enviado&&mismoEstado(servidor.estado,p.enviado)?p.origenEnviado??p.enviado:p.base;
          const estado=this.io.reconciliar(p.estado,servidor.estado,base);
          const numero=p.numero;
          const actualizado=await this.exclusivo(async()=>{const actual=await this.io.leer();if(!actual||actual.numero!==numero)return false;await this.io.escribir({...actual,estado,base:servidor.estado,revision:servidor.revision,enviado:undefined});return true;});
          if(!actualizado)continue;
          p={...p,estado,base:servidor.estado,revision:servidor.revision,enviado:undefined};
        }
        p={...p,revision:servidor.revision};
      }
      const enviado=p;
      await this.exclusivo(async()=>{const actual=await this.io.leer();if(actual)await this.io.escribir({...actual,revision:enviado.revision,enviado:enviado.estado,origenEnviado:origen});});
      let revision:number;
      try{revision=await this.io.enviar(enviado,servidor.estado);}
      catch(e:any){if(e.codigo==='conflicto'&&++colisiones<=3)continue;throw e;}
      colisiones=0;
      await this.aceptar(enviado,revision,origen);
    }
  }
  private async aceptar(enviado:SobreNube,revision:number,origen:Estado=enviado.estado){
    await this.io.confirmar(revision,enviado.estado);
    await this.exclusivo(async()=>{
      const actual=await this.io.leer();
      if(actual?.numero===enviado.numero)await this.io.quitar();
      else if(actual){
        const estado=this.io.reconciliar?this.io.reconciliar(actual.estado,enviado.estado,origen):actual.estado;
        await this.io.escribir({...actual,estado,revision,enviado:undefined,origenEnviado:undefined,base:enviado.estado});
      }
    });
  }
}
