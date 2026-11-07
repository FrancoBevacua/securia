import React,{useState} from 'react';
import {LBL,gsName} from '../shared/text';
import {dmy} from '../shared/model';

const grupos=[{titulo:'El hecho',campos:[6,7,8]},{titulo:'Identificación',campos:[1,2,3,4,5]},{titulo:'Intervención',campos:[9,10,11,12,13]},{titulo:'Cierre',campos:[14,15,16]}];
export default function SecurityReader({informe:r,S,onBack,evidence}){
 const [grupo,setGrupo]=useState(0);
 return <main className="security-reader">
  <header className="reader-toolbar"><a className="reader-brand" href="#" onClick={e=>{e.preventDefault();onBack();}}>SECURIA<span>Supervisión</span></a><div className="flex flex-wrap gap-2"><button onClick={onBack}>← Volver a informes</button><button onClick={()=>window.print()}>Imprimir</button></div></header>
  <section className="reader-hero"><span className="eyebrow">INFORME DE SEGURIDAD</span><h1>{r.f4||'Incidente del servicio'}</h1><p>{dmy(r.fecha)} · {r.hora||'Horario sin indicar'} · {gsName(S.guards.find(g=>g.id===(r.firmaId||r.createdBy)),S.site)}</p><div className="flex flex-wrap gap-2"><span className="reader-badge">{r.f5||'Criticidad sin indicar'}</span><span className="reader-badge">{r.estado||'Borrador'}</span></div></section>
  <div className="reader-layout"><nav aria-label="Secciones del informe" className="reader-nav">{grupos.map((g,i)=><button key={g.titulo} aria-current={grupo===i?'page':undefined} className={grupo===i?'active':''} onClick={()=>setGrupo(i)}><span>0{i+1}</span>{g.titulo}</button>)}<p>16 puntos organizados en cuatro secciones para una lectura cómoda.</p></nav>
   <article className="reader-document"><div className="reader-summary"><span className="eyebrow">RESUMEN DEL HECHO</span><p>{r.f6||'Sin resumen registrado.'}</p></div>
    {grupos.map((g,k)=><div key={g.titulo} className={'reader-group '+(grupo===k?'selected':'')}><h2>{g.titulo}</h2>{g.campos.map(i=><section className="reader-point" key={i}><h3><span>{String(i).padStart(2,'0')}</span>{LBL[i-1]}</h3><p>{String(r['f'+i]||'Sin completar')}</p></section>)}</div>)}
    <section className="reader-evidence"><h2>Evidencias</h2>{evidence}</section>
   </article>
  </div><footer className="page-footer">© 2026 Franco Daniel Bevacua · SECURIA</footer>
 </main>;
}
