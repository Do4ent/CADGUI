import type {ExactModelState} from '../kernel/types';
import type {SketchModelState} from './types';
import {orderedSketchCuts} from './model';
type FusionDependency={id:string;bodyId:string;aBodyId:string;bBodyId:string};
type DependencyState=SketchModelState&{fusions?:FusionDependency[]};
type DependencyRow={kind:'cut';feature:ReturnType<typeof orderedSketchCuts>[number];inputs:string[]}|{kind:'fusion';feature:FusionDependency;inputs:string[]};
/** View-only ordering; validation and native Boolean execution belong to the model. */
export function orderedDependencyRows(state:DependencyState):DependencyRow[]{
 const pending:DependencyRow[]=[...orderedSketchCuts(state).map(feature=>({kind:'cut' as const,feature,inputs:[feature.targetBodyId]})),...(state.fusions??[]).map(feature=>({kind:'fusion' as const,feature,inputs:[feature.aBodyId,feature.bBodyId]}))];
 const outputs=new Set(pending.map(row=>row.feature.bodyId)),ids=new Set(pending.map(row=>row.feature.id));if(outputs.size!==pending.length||ids.size!==pending.length)throw Error('Повторяющиеся результаты или операции');
 const done=new Set<string>(),result:DependencyRow[]=[];while(pending.length){const index=pending.findIndex(row=>row.inputs.every(id=>!outputs.has(id)||done.has(id)));if(index<0)throw Error('Циклические зависимости операций');const [row]=pending.splice(index,1);result.push(row);done.add(row.feature.bodyId)}return result;
}
export type CutFeatureTreeProps={state:DependencyState;exactModel:ExactModelState;selectedId?:string|null;onSelect:(featureId:string,bodyId:string)=>void;disabled?:boolean};
function FeatureIcon({kind}:{kind:'static'|'extrusion'|'revolution'|'cut'|'fusion'}){return <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" style={{verticalAlign:'middle',flexShrink:0}}><path d="M2 6l7-4 7 4v8l-7 3-7-3zM2 6l7 4 7-4M9 10v7" fill="#3286ab22" stroke="#3286ab" strokeWidth="1.2"/>{kind==='fusion'?<path d="M3 4h7v8H3zM8 7h7v8H8z" fill="#865ab333" stroke="#de8e35"/>:kind==='cut'?<path d="M6 4h5v8H6z" fill="#de8e3544" stroke="#de8e35"/>:kind==='revolution'?<path d="M5 6a4 4 0 1 1-1 5M5 3v4H2" fill="none" stroke="#de8e35" strokeWidth="1.5"/>:kind==='extrusion'?<path d="M9 3v8M6 6l3-3 3 3" fill="none" stroke="#865ab3" strokeWidth="1.5"/>:<path d="M4 12h4" stroke="#865ab3" strokeWidth="1.5"/>}</svg>}
/** This is a view of source dependencies; all shape creation stays in the kernel workflow. */
export function CutFeatureTree({state,exactModel,selectedId=null,onSelect,disabled=false}:CutFeatureTreeProps){
 let rows:DependencyRow[]=[],graphError='';try{rows=orderedDependencyRows(state)}catch(error){graphError=error instanceof Error?error.message:String(error)}
 const fusionOutputs=new Set((state.fusions??[]).map(f=>f.bodyId));
 const bodies=new Map(exactModel.bodies.map(body=>[body.id,body])),sketches=new Map(state.sketches.map(sketch=>[sketch.id,sketch])),cutOutputs=new Set((state.cuts??[]).map(cut=>cut.bodyId)),extrusionOutputs=new Set(state.extrusions.map(feature=>feature.bodyId)),revolutionOutputs=new Set((state.revolutions??[]).map(feature=>feature.bodyId));
 const levels=new Map<string,number>();for(const row of rows)levels.set(row.feature.bodyId,Math.max(...row.inputs.map(id=>levels.get(id)??-1))+1);
 const hiddenSources=[...new Set(rows.flatMap(row=>row.inputs))].filter(id=>bodies.get(id)?.visible===false);
 return <section aria-label="Зависимости вырезаний" className="cut-feature-tree" style={{border:'1px solid #7c8995',borderRadius:0,padding:8,fontSize:12}}>
  <div style={{display:'flex',alignItems:'center',gap:5,fontWeight:600}}><FeatureIcon kind="cut"/>Зависимости вырезаний и объединений</div>
  {graphError&&<div role="alert" data-cut-graph-error style={{color:'var(--error,#bc4937)'}}>Граф операций недоступен: {graphError}</div>}
  {!graphError&&!rows.length&&<div>Параметрических вырезаний и объединений нет.</div>}
  {hiddenSources.length>0&&<div role="status" data-cut-hidden-sources={hiddenSources.join(' ')}>Скрытые исходные тела сохранены для перестроения ({hiddenSources.length}). Скрытие не удаляет зависимость.</div>}
  <ol aria-label="Порядок зависимостей вырезаний" style={{paddingLeft:18,margin:'6px 0 0'}}>{rows.map(row=>{
   if(row.kind==='fusion'){
    const fusion=row.feature,a=bodies.get(fusion.aBodyId),b=bodies.get(fusion.bBodyId),output=bodies.get(fusion.bodyId),problems=[!a?`Отсутствует вход A: ${fusion.aBodyId}`:'',!b?`Отсутствует вход B: ${fusion.bBodyId}`:'',!output?`Отсутствует результат ${fusion.bodyId}`:''].filter(Boolean);
    return <li key={fusion.id} data-fusion-graph-id={fusion.id} data-fusion-graph-body={fusion.bodyId} data-fusion-graph-input-a={fusion.aBodyId} data-fusion-graph-input-b={fusion.bBodyId} data-fusion-graph-level={levels.get(fusion.bodyId)} style={{marginBottom:6,paddingLeft:(levels.get(fusion.bodyId)??0)*12}}>
     <div style={{display:'flex',alignItems:'center',gap:5,flexWrap:'wrap'}}><FeatureIcon kind="fusion"/><span title={`Входы: ${fusion.aBodyId}; ${fusion.bBodyId}`}>Объединение: {a?.name??fusion.aBodyId}{a?.visible===false?' · скрыто':''} + {b?.name??fusion.bBodyId}{b?.visible===false?' · скрыто':''}</span><span aria-hidden="true">→</span><button type="button" style={{borderRadius:0,font:'inherit',textAlign:'left',border:'1px solid #7c8995',padding:'3px 5px',background:selectedId===fusion.id?'#b9772426':'transparent',color:'inherit'}} disabled={disabled||problems.length>0} aria-pressed={selectedId===fusion.id} title={`Результат: ${fusion.bodyId}; операция: ${fusion.id}`} aria-label={`Выбрать объединение: ${output?.name??fusion.bodyId}; входы ${a?.name??fusion.aBodyId} и ${b?.name??fusion.bBodyId}`} onClick={()=>{if(!disabled&&!problems.length)onSelect(fusion.id,fusion.bodyId)}}><FeatureIcon kind="fusion"/> {output?.name??fusion.bodyId}</button></div>
     {problems.length>0&&<div role="alert" data-fusion-graph-missing={fusion.id} style={{color:'var(--error,#bc4937)'}}>{problems.join('; ')}</div>}
    </li>;
   }
   const cut=row.feature;
   const target=bodies.get(cut.targetBodyId),result=bodies.get(cut.bodyId),sketch=sketches.get(cut.sketchId),kind=fusionOutputs.has(cut.targetBodyId)?'fusion':cutOutputs.has(cut.targetBodyId)?'cut':extrusionOutputs.has(cut.targetBodyId)?'extrusion':revolutionOutputs.has(cut.targetBodyId)?'revolution':'static';
   const problems=[!target?`Отсутствует целевое тело ${cut.targetBodyId}`:'',!result?`Отсутствует результат ${cut.bodyId}`:'',!sketch?`Отсутствует эскиз ${cut.sketchId}`:''].filter(Boolean);
   return <li key={cut.id} data-cut-graph-id={cut.id} data-cut-graph-target={cut.targetBodyId} data-cut-graph-body={cut.bodyId} data-cut-graph-sketch={cut.sketchId} data-cut-graph-level={levels.get(cut.bodyId)} data-cut-target-kind={kind} style={{marginBottom:6,paddingLeft:(levels.get(cut.bodyId)??0)*12}}>
    <div style={{display:'flex',alignItems:'center',gap:5,flexWrap:'wrap'}}><FeatureIcon kind={kind}/><span title={`Исходное тело: ${cut.targetBodyId}`}>{kind==='fusion'?'Объединение':kind==='cut'?'Результат вырезания':kind==='extrusion'?'Выдавливание':kind==='revolution'?'Вращение':'Статическое тело'}: {target?.name??cut.targetBodyId} <small>{target?.visible===false?' · скрыто':''}</small></span><span aria-hidden="true">→</span><button type="button" style={{borderRadius:0,font:'inherit',textAlign:'left',border:'1px solid #7c8995',padding:'3px 5px',background:selectedId===cut.id?'#b9772426':'transparent',color:'inherit'}} disabled={disabled||problems.length>0} aria-pressed={selectedId===cut.id} title={`Результат: ${cut.bodyId}; операция: ${cut.id}`} aria-label={`Выбрать вырезание: ${result?.name??cut.bodyId}; эскиз ${sketch?.name??cut.sketchId}`} onClick={()=>{if(!disabled&&!problems.length)onSelect(cut.id,cut.bodyId)}}><FeatureIcon kind="cut"/> {result?.name??cut.bodyId}</button></div>
    <div title={`Эскиз: ${cut.sketchId}; операция: ${cut.id}`}>Эскиз: {sketch?.name??cut.sketchId} · Глубина: {cut.depth} мм</div>
    {problems.length>0&&<div role="alert" data-cut-graph-missing={cut.id} style={{color:'var(--error,#bc4937)'}}>{problems.join('; ')}</div>}
   </li>;
  })}</ol>
 </section>;
}
