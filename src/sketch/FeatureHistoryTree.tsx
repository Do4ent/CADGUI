import {useEffect,useId,useRef,useState} from 'react';
import {TechnicalIcon,type TechnicalIconKind} from '../components/icons/TechnicalIcon';
import {getFeatureHistoryRelations,type FeatureHistory,type FeatureHistoryNode,type FeatureHistoryKind} from './featureHistory';
import './feature-history-tree.css';

export interface FeatureHistoryTreeProps {
 history:FeatureHistory;
 selectedId?:string|null;
 onSelect:(nodeId:string,bodyId?:string)=>void;
 disabled?:boolean;
}
const kindNames:Record<FeatureHistoryKind,string>={sketch:'Эскиз',body:'Статическое тело',extrusion:'Выдавливание',revolution:'Вращение',cut:'Вырезание',fusion:'Объединение','body-boolean':'Булева операция'};
const kindIcons:Record<FeatureHistoryKind,TechnicalIconKind>={sketch:'profile',body:'material',extrusion:'direction',revolution:'angle',cut:'thickness',fusion:'material','body-boolean':'thickness'};

/** Flat inspection tree: a shared DAG source occurs once, not once per consumer. */
export function FeatureHistoryTree({history,selectedId=null,onSelect,disabled=false}:FeatureHistoryTreeProps){
 const id=useId(),tree=useRef<HTMLDivElement>(null),hadFocus=useRef(false);
 // Invalid duplicate model identities must not create duplicate DOM keys/tab stops.
 const nodes=history.nodes.filter((node,index,all)=>all.findIndex(candidate=>candidate.id===node.id)===index);
 const byId=new Map(nodes.map(node=>[node.id,node]));
 const [focusedId,setFocusedId]=useState<string|null>(()=>byId.has(selectedId??'')?selectedId:nodes[0]?.id??null);
 const active=byId.get(selectedId??''),tabStop=byId.has(focusedId??'')?focusedId:active?.id??nodes[0]?.id??null;
 const relations=active?getFeatureHistoryRelations(history,active.id):{upstream:[],downstream:[]};
 const row=(nodeId:string)=>tree.current?.querySelector<HTMLButtonElement>(`[data-history-index="${nodes.findIndex(node=>node.id===nodeId)}"]`);
 useEffect(()=>{if(selectedId&&byId.has(selectedId))setFocusedId(selectedId);},[selectedId]);
 useEffect(()=>{if(focusedId&&!byId.has(focusedId)){setFocusedId(tabStop);if(!disabled&&hadFocus.current&&document.activeElement===document.body&&tabStop)row(tabStop)?.focus();}},[history,focusedId,tabStop,disabled]);
 const choose=(node:FeatureHistoryNode)=>{if(disabled)return;setFocusedId(node.id);onSelect(node.id,node.bodyId);};
 const navigate=(nodeId:string)=>{const node=byId.get(nodeId);if(!node||disabled)return;choose(node);row(nodeId)?.focus();};
 const relationList=(title:string,direct:readonly string[],all:readonly string[])=><div className="feature-history-relations"><h5>{title} <span>({all.length})</span></h5>{all.length?<ul>{all.map(nodeId=>{const target=byId.get(nodeId);return <li key={nodeId}>{target?<button type="button" disabled={disabled} onClick={()=>navigate(nodeId)}>{target.label} <small>{direct.includes(nodeId)?'прямая связь':'через другие операции'}</small></button>:<span>Источник отсутствует: {nodeId}</span>}</li>;})}</ul>:<p>Нет связей</p>}</div>;
 const issues=history.diagnostics.filter(diagnostic=>!active||!diagnostic.nodeId||diagnostic.nodeId===active.id);
 return <section className="feature-history" aria-label="История построения"><h3><span aria-hidden="true"><TechnicalIcon kind="profile" size={18}/></span>История построения</h3>
  <p id={`${id}-help`} className="feature-history-help">Объекты и зависимости. Порядок списка не означает хронологию создания. ↑/↓, Home/End — навигация; Enter/Пробел — выбрать.</p>
  {history.diagnostics.length>0&&<p role="status" className="feature-history-warning">Обнаружены проблемы связей: {history.diagnostics.length}. Выберите объект для просмотра.</p>}
  {!nodes.length?<p>История построения пуста.</p>:<div ref={tree} role="tree" aria-label="Объекты истории построения" aria-describedby={`${id}-help`} aria-disabled={disabled||undefined} onFocusCapture={()=>{hadFocus.current=true;}} onBlurCapture={event=>{if(event.relatedTarget&&!event.currentTarget.contains(event.relatedTarget as Node))hadFocus.current=false;}}>
   {nodes.map((node,index)=><button key={node.id} id={`${id}-node-${index}`} type="button" role="treeitem" aria-level={1} aria-selected={active?.id===node.id} aria-describedby={node.status==='broken'?`${id}-broken`:undefined} tabIndex={!disabled&&tabStop===node.id?0:-1} disabled={disabled} data-history-id={node.id} data-history-index={index} className="feature-history-node" onFocus={()=>setFocusedId(node.id)} onClick={()=>choose(node)} onKeyDown={event=>{if(disabled)return;const next=event.key==='Home'?0:event.key==='End'?nodes.length-1:event.key==='ArrowDown'?Math.min(nodes.length-1,index+1):event.key==='ArrowUp'?Math.max(0,index-1):-1;if(next>=0){event.preventDefault();event.stopPropagation();setFocusedId(nodes[next].id);row(nodes[next].id)?.focus();}else if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();choose(node);}}}>
    <span aria-hidden="true"><TechnicalIcon kind={kindIcons[node.kind]} size={18}/></span><span className="feature-history-label"><span>{node.label}</span><small>{kindNames[node.kind]} · {node.sourceId}</small></span>{node.status==='broken'&&<span className="feature-history-broken">Связь нарушена</span>}
   </button>)}
  </div>}
  <span id={`${id}-broken`} className="feature-history-sr">Связь с источником отсутствует или граф содержит ошибку; доступна диагностика.</span>
  <div className="feature-history-inspector" aria-label="Зависимости выбранного объекта">{active?<><h4>{active.label}</h4><dl><dt>Тип</dt><dd>{kindNames[active.kind]}</dd><dt>ID источника</dt><dd>{active.sourceId}</dd>{active.bodyId&&<><dt>Результирующее тело</dt><dd>{active.bodyId}</dd></>}</dl>{relationList('Исходные объекты',active.upstream,relations.upstream)}{relationList('Зависимые объекты',active.downstream,relations.downstream)}</>:<p>Выберите объект истории для просмотра связей.</p>}
   {issues.length>0&&<ul className="feature-history-diagnostics" aria-label="Диагностика истории">{issues.map((issue,index)=><li key={index}>{issue.message}{issue.sourceId?` (${issue.sourceId})`:''}</li>)}</ul>}
  </div>
 </section>;
}
