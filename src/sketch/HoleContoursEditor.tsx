import {useEffect,useMemo,useState} from 'react';
import type {Sketch,SketchModelState,SketchRegion,SketchRegionBoundary} from './types';
import {sketchRegion,validateSketchModelState} from './model';
export type HoleContoursEditorProps={sketch:Sketch;state:SketchModelState;onChange:(sketch:Sketch)=>void;onValidityChange?:(valid:boolean)=>void;disabled?:boolean};
export function regionBoundarySvg(boundary:SketchRegionBoundary):string {
 if(boundary.kind==='circle'){const [x,y]=boundary.center,r=boundary.radius;return `M ${x+r} ${-y} A ${r} ${r} 0 1 0 ${x-r} ${-y} A ${r} ${r} 0 1 0 ${x+r} ${-y} Z`}
 const point=(edge:typeof boundary.edges[number],end=false):[number,number]=>edge.kind==='line'?(end?edge.end:edge.start):[edge.center[0]+edge.radius*Math.cos(edge.startAngle+(end?edge.sweep:0)),edge.center[1]+edge.radius*Math.sin(edge.startAngle+(end?edge.sweep:0))];
 if(!boundary.edges.length)return '';const first=point(boundary.edges[0]);return `M ${first[0]} ${-first[1]} `+boundary.edges.map(edge=>{const end=point(edge,true);return edge.kind==='line'?`L ${end[0]} ${-end[1]}`:`A ${edge.radius} ${edge.radius} 0 ${Math.abs(edge.sweep)>Math.PI?1:0} ${edge.sweep>0?0:1} ${end[0]} ${-end[1]}`}).join(' ')+' Z';
}
export function regionViewBox(region:SketchRegion):[number,number,number,number]{
 const points=[region.outer,...region.holes].flatMap(boundary=>boundary.kind==='circle'?[[boundary.center[0]-boundary.radius,boundary.center[1]-boundary.radius],[boundary.center[0]+boundary.radius,boundary.center[1]+boundary.radius]]:boundary.edges.flatMap(e=>e.kind==='line'?[e.start,e.end]:[[e.center[0]-e.radius,e.center[1]-e.radius],[e.center[0]+e.radius,e.center[1]+e.radius]]));
 const minX=Math.min(...points.map(p=>p[0])),maxX=Math.max(...points.map(p=>p[0])),minY=Math.min(...points.map(p=>p[1])),maxY=Math.max(...points.map(p=>p[1]));const padding=Math.max(1,Math.max(maxX-minX,maxY-minY)*.1);
 return [minX-padding,-maxY-padding,maxX-minX+2*padding,maxY-minY+2*padding];
}
/** Validate the entire source state with the draft inserted; no BREP/cache is used. */
export function holeDraftRegion(state:SketchModelState,sketch:Sketch):{sketch:Sketch;region:SketchRegion|null;diagnostic?:string}{
 const next=structuredClone(state),draft=structuredClone(sketch),index=next.sketches.findIndex(s=>s.id===draft.id);if(index<0)next.sketches.push(draft);else next.sketches[index]=draft;
 const valid=validateSketchModelState(next),accepted=valid.sketches.find(s=>s.id===sketch.id)!;try{return {sketch:accepted,region:sketchRegion(valid,sketch.id)}}catch(error){if(accepted.holes?.length)throw error;return {sketch:accepted,region:null,diagnostic:error instanceof Error?error.message:String(error)}};
}
export function holeContourCompatibility(outer:Sketch,inner:Sketch):string {
 if(inner.id===outer.id)return 'Контур не может ссылаться на себя';if(!inner.closed)return 'Внутренний контур должен быть замкнут';if(inner.holes?.length)return 'Вложенные отверстия не поддерживаются';if(inner.plane!==outer.plane)return 'Нужна та же плоскость';const normal=outer.plane==='XY'?2:outer.plane==='XZ'?1:0;if(Math.abs(inner.origin[normal]-outer.origin[normal])>1e-7)return 'Контуры должны лежать в одной плоскости';return '';
}
function HoleIcon(){return <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" style={{verticalAlign:'middle',marginRight:4}}><path d="M2 2h14v14H2z" fill="#267da522" stroke="#267da5"/><circle cx="9" cy="9" r="3.5" fill="none" stroke="#8155ac" strokeWidth="1.5"/><path d="M9 1v4M9 13v4M1 9h4M13 9h4" stroke="#d78a35"/></svg>}
export function HoleContoursEditor({sketch,state,onChange,onValidityChange,disabled=false}:HoleContoursEditorProps){
 const [pending,setPending]=useState<string[]|null>(null),[rejected,setRejected]=useState<string|null>(null);
 useEffect(()=>{setPending(null);setRejected(null)},[sketch.id]);
 const current=useMemo(()=>{try{return {...holeDraftRegion(state,sketch),error:null}}catch(error){return {region:null,diagnostic:undefined,error:error instanceof Error?error.message:String(error)}}},[state,sketch]);
 const valid=!current.error&&!rejected&&pending===null;useEffect(()=>{onValidityChange?.(valid)},[valid,onValidityChange]);
 const ids=pending??sketch.holes??[];
 const options=[...state.sketches.filter(s=>s.id!==sketch.id&&s.closed),...ids.filter(id=>!state.sketches.some(s=>s.id===id&&s.id!==sketch.id&&s.closed)).map(id=>state.sketches.find(s=>s.id===id)??{id,name:`Не найден: ${id}`,closed:false,holes:[],plane:sketch.plane,origin:sketch.origin,points:[],constraints:[]})];
 const choose=(next:string[])=>{if(disabled)return;try{const result=holeDraftRegion(state,{...sketch,holes:[...next]});onChange(structuredClone(result.sketch));setPending(null);setRejected(null)}catch(error){setPending([...next]);setRejected(error instanceof Error?error.message:String(error))}};
 const cancel=()=>{setPending(null);setRejected(null)};
 return <fieldset disabled={disabled} className="hole-contours-editor" data-hole-editor-valid={valid} style={{borderRadius:0,padding:8,border:'1px solid #7c8995',display:'grid',gap:6}}><legend><HoleIcon/>Внутренние контуры</legend>
  <div style={{fontSize:12}}>До 8 замкнутых контуров в той же плоскости. Отверстия ссылаются на исходные эскизы; вложенные отверстия, касания и пересечения не допускаются.</div>
  <div data-hole-selection-count>{ids.length} / 8</div>
  {options.length?options.map(inner=>{const checked=ids.includes(inner.id),reason=holeContourCompatibility(sketch,inner);return <label key={inner.id} data-hole-option-id={inner.id} style={{display:'flex',alignItems:'center',gap:4}} title={reason||undefined}><input type="checkbox" aria-label={`Внутренний контур: ${inner.name}`} data-hole-source-id={inner.id} checked={checked} disabled={disabled||!checked&&(!!reason||ids.length>=8)} onChange={event=>choose(event.target.checked?[...ids,inner.id]:ids.filter(id=>id!==inner.id))}/><HoleIcon/>{inner.name} <small>({inner.id}){reason?` — ${reason}`:''}</small></label>}):<div>Нет других замкнутых эскизов. Создайте внутренний контур отдельно.</div>}
  {(rejected||current.error)&&<div role="alert" data-hole-region-error style={{color:'var(--error,#bb4736)'}}>Область не принята: {rejected??current.error}</div>}
  {pending!==null&&<div style={{display:'flex',gap:6}}><button type="button" style={{borderRadius:0}} onClick={()=>choose(pending)}>Применить выбор отверстий</button><button type="button" style={{borderRadius:0}} onClick={cancel}>Отменить выбор отверстий</button></div>}
  {current.diagnostic&&<div role="status" data-hole-preview-diagnostic>Предпросмотр области недоступен: {current.diagnostic}. Эскиз без отверстий можно сохранить.</div>}
  {current.region&&<><svg role="img" aria-label="Область с отверстиями" data-hole-preview-source="accepted-draft" viewBox={regionViewBox(current.region).join(' ')} style={{width:'100%',height:180,border:'1px solid #7c8995',background:'var(--panel,#f4f7fa)'}}><path data-sketch-region-path data-sketch-region-holes={current.region.holes.length} d={[current.region.outer,...current.region.holes].map(regionBoundarySvg).join(' ')} fill="#2682ad55" fillRule="evenodd" stroke="#287da7" strokeWidth={Math.max(...regionViewBox(current.region).slice(2))*.004}/></svg>{pending!==null&&<small>Показана последняя принятая область; отклонённый выбор не применён.</small>}</>}
 </fieldset>;
}
