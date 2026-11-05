import type {ExactModelState} from '../kernel/types';
import type {SketchModelState} from './types';
import {orderedSketchCuts} from './model';
export type CutFeatureTreeProps={state:SketchModelState;exactModel:ExactModelState;selectedId?:string|null;onSelect:(featureId:string,bodyId:string)=>void;disabled?:boolean};
function FeatureIcon({kind}:{kind:'static'|'extrusion'|'cut'}){return <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" style={{verticalAlign:'middle',flexShrink:0}}><path d="M2 6l7-4 7 4v8l-7 3-7-3zM2 6l7 4 7-4M9 10v7" fill="#3286ab22" stroke="#3286ab" strokeWidth="1.2"/>{kind==='cut'?<path d="M6 4h5v8H6z" fill="#de8e3544" stroke="#de8e35"/>:kind==='extrusion'?<path d="M9 3v8M6 6l3-3 3 3" fill="none" stroke="#865ab3" strokeWidth="1.5"/>:<path d="M4 12h4" stroke="#865ab3" strokeWidth="1.5"/>}</svg>}
/** This is a view of source dependencies; all shape creation stays in the kernel workflow. */
export function CutFeatureTree({state,exactModel,selectedId=null,onSelect,disabled=false}:CutFeatureTreeProps){
 let ordered:ReturnType<typeof orderedSketchCuts>=[],graphError='';try{ordered=orderedSketchCuts(state)}catch(error){graphError=error instanceof Error?error.message:String(error)}
 const bodies=new Map(exactModel.bodies.map(body=>[body.id,body])),sketches=new Map(state.sketches.map(sketch=>[sketch.id,sketch])),cutOutputs=new Set((state.cuts??[]).map(cut=>cut.bodyId)),extrusionOutputs=new Set(state.extrusions.map(feature=>feature.bodyId));
 const levels=new Map<string,number>();for(const cut of ordered)levels.set(cut.bodyId,(levels.get(cut.targetBodyId)??-1)+1);
 const hiddenSources=[...new Set(ordered.map(cut=>cut.targetBodyId))].filter(id=>bodies.get(id)?.visible===false);
 return <section aria-label="Зависимости вырезаний" className="cut-feature-tree" style={{border:'1px solid #7c8995',borderRadius:0,padding:8,fontSize:12}}>
  <div style={{display:'flex',alignItems:'center',gap:5,fontWeight:600}}><FeatureIcon kind="cut"/>Зависимости вырезаний</div>
  {graphError&&<div role="alert" data-cut-graph-error style={{color:'var(--error,#bc4937)'}}>Граф вырезаний недоступен: {graphError}</div>}
  {!graphError&&!ordered.length&&<div>Параметрических вырезаний нет.</div>}
  {hiddenSources.length>0&&<div role="status" data-cut-hidden-sources={hiddenSources.join(' ')}>Скрытые исходные тела сохранены для перестроения ({hiddenSources.length}). Скрытие не удаляет зависимость.</div>}
  <ol aria-label="Порядок зависимостей вырезаний" style={{paddingLeft:18,margin:'6px 0 0'}}>{ordered.map(cut=>{
   const target=bodies.get(cut.targetBodyId),result=bodies.get(cut.bodyId),sketch=sketches.get(cut.sketchId),kind=cutOutputs.has(cut.targetBodyId)?'cut':extrusionOutputs.has(cut.targetBodyId)?'extrusion':'static';
   const problems=[!target?`Отсутствует целевое тело ${cut.targetBodyId}`:'',!result?`Отсутствует результат ${cut.bodyId}`:'',!sketch?`Отсутствует эскиз ${cut.sketchId}`:''].filter(Boolean);
   return <li key={cut.id} data-cut-graph-id={cut.id} data-cut-graph-target={cut.targetBodyId} data-cut-graph-body={cut.bodyId} data-cut-graph-sketch={cut.sketchId} data-cut-graph-level={levels.get(cut.bodyId)} data-cut-target-kind={kind} style={{marginBottom:6,paddingLeft:(levels.get(cut.bodyId)??0)*12}}>
    <div style={{display:'flex',alignItems:'center',gap:5,flexWrap:'wrap'}}><FeatureIcon kind={kind}/><span>{kind==='cut'?'Результат вырезания':kind==='extrusion'?'Выдавливание':'Статическое тело'}: {target?.name??cut.targetBodyId} <small>({cut.targetBodyId}){target?.visible===false?' · скрыто':''}</small></span><span aria-hidden="true">→</span><button type="button" style={{borderRadius:0,font:'inherit',textAlign:'left',border:'1px solid #7c8995',padding:'3px 5px',background:selectedId===cut.id?'#b9772426':'transparent',color:'inherit'}} disabled={disabled||problems.length>0} aria-pressed={selectedId===cut.id} aria-label={`Выбрать вырезание ${cut.id}: ${result?.name??cut.bodyId}; эскиз ${sketch?.name??cut.sketchId} (${cut.sketchId})`} onClick={()=>{if(!disabled&&!problems.length)onSelect(cut.id,cut.bodyId)}}><FeatureIcon kind="cut"/> {result?.name??cut.bodyId} <small>({cut.bodyId})</small></button></div>
    <div>Эскиз: {sketch?.name??cut.sketchId} <small>({cut.sketchId})</small> · Глубина: {cut.depth} мм · ID операции: {cut.id}</div>
    {problems.length>0&&<div role="alert" data-cut-graph-missing={cut.id} style={{color:'var(--error,#bc4937)'}}>{problems.join('; ')}</div>}
   </li>;
  })}</ol>
 </section>;
}
