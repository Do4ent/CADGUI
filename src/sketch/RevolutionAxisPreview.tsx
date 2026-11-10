import {useEffect,useId,useMemo} from 'react';
import type {Sketch,SketchModelState,SketchRegion} from './types';
import {revolutionAxis,sketchRegion,validateSketchModelState} from './model';
import {regionBoundarySvg,regionViewBox} from './HoleContoursEditor';
export type RevolutionAxisPreviewProps={sketch:Sketch;state:SketchModelState;axis:'u'|'v';offset:number;angle:number;disabled?:boolean;onValidityChange?:(valid:boolean)=>void};
type AxisResult=ReturnType<typeof revolutionAxis>;
export function revolutionPreviewSource(sketch:Sketch,state:SketchModelState,axis:'u'|'v',offset:number,angle:number):{region:SketchRegion;axis:AxisResult}{
 const next=structuredClone(state),draft=structuredClone(sketch),index=next.sketches.findIndex(s=>s.id===draft.id);if(index<0)next.sketches.push(draft);else next.sketches[index]=draft;
 const valid=validateSketchModelState(next),region=sketchRegion(valid,draft.id);return {region,axis:revolutionAxis(region,axis,offset,angle)};
}
/** Include the perpendicular offset, without adding a huge proportional margin. */
export function revolutionDiagramBounds(region:SketchRegion,axis:AxisResult):[number,number,number,number]{
 const [x,y,width,height]=regionViewBox(region);let minX=x,maxX=x+width,minY=y,maxY=y+height;
 if(Math.abs(axis.direction[0])>Math.abs(axis.direction[1])){minY=Math.min(minY,-axis.point[1]);maxY=Math.max(maxY,-axis.point[1])}else{minX=Math.min(minX,axis.point[0]);maxX=Math.max(maxX,axis.point[0])}
 const pad=Math.max(.5,Math.min(20,Math.max(maxX-minX,maxY-minY)*.04));return [minX-pad,minY-pad,maxX-minX+2*pad,maxY-minY+2*pad];
}
export function revolutionDiagramAxis(view:readonly number[],axis:AxisResult):[number,number,number,number]{
 const [x,y,w,h]=view;if(Math.abs(axis.direction[0])>Math.abs(axis.direction[1]))return axis.direction[0]>0?[x,-axis.point[1],x+w,-axis.point[1]]:[x+w,-axis.point[1],x,-axis.point[1]];
 return axis.direction[1]>0?[axis.point[0],y+h,axis.point[0],y]:[axis.point[0],y,axis.point[0],y+h];
}
export function RevolutionAxisPreview({sketch,state,axis,offset,angle,disabled=false,onValidityChange}:RevolutionAxisPreviewProps){
 const marker=useId().replace(/:/g,'')+'axis';
 const result=useMemo(()=>{try{return {...revolutionPreviewSource(sketch,state,axis,offset,angle),error:null}}catch(error){return {region:null,axis:null,error:error instanceof Error?error.message:String(error)}}},[sketch,state,axis,offset,angle]);
 const valid=!result.error;useEffect(()=>{onValidityChange?.(valid)},[valid,onValidityChange]);
 const view=result.region&&result.axis?revolutionDiagramBounds(result.region,result.axis):null,line=view&&result.axis?revolutionDiagramAxis(view,result.axis):null;
 return <section aria-label="Схема оси вращения" aria-disabled={disabled} data-revolve-preview-valid={valid} style={{border:'1px solid #7c8995',borderRadius:0,padding:8,display:'grid',gap:5,fontSize:12}}>
  <div style={{display:'flex',alignItems:'center',gap:5,fontWeight:600}}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18"><path d="M3 4h6v10H3z" fill="#2c83ab33" stroke="#2c83ab"/><path d="M13 16V2m-3 3 3-3 3 3" fill="none" stroke="#dc8b36" strokeWidth="1.5"/><path d="M2 9h14" stroke="#8556b0" strokeDasharray="2 1"/></svg>Ось вращения в плоскости эскиза</div>
  <div>Двумерная схема исходного профиля и оси; это не предпросмотр трёхмерного тела.</div>
  {result.error&&<div role="alert" data-revolve-axis-error style={{color:'var(--error,#bb4736)'}}>Вращение недоступно: {result.error}</div>}
  {result.region&&result.axis&&view&&line&&<svg role="img" aria-label="Ось вращения эскиза" data-revolve-axis={axis} data-revolve-offset={offset} data-revolve-angle={angle} data-revolve-axis-point={result.axis.point.join(' ')} data-revolve-axis-direction={result.axis.direction.join(' ')} data-revolve-radians={result.axis.radians} viewBox={view.join(' ')} style={{width:'100%',height:200,border:'1px solid #7c8995',background:'var(--panel,#f4f7fa)',opacity:disabled?.65:1}}>
   <defs><marker id={marker} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto" markerUnits="strokeWidth"><path d="M0 0L7 3.5 0 7" fill="none" stroke="#d88a35"/></marker></defs>
   <path data-revolve-profile-path d={[result.region.outer,...result.region.holes].map(regionBoundarySvg).join(' ')} fill="#2682ad55" fillRule="evenodd" stroke="#287da7" strokeWidth={Math.max(view[2],view[3])*.004}/>
   <line data-revolve-axis-line x1={line[0]} y1={line[1]} x2={line[2]} y2={line[3]} stroke="#d88a35" strokeWidth={Math.max(view[2],view[3])*.004} strokeDasharray={`${Math.max(view[2],view[3])*.025} ${Math.max(view[2],view[3])*.012}`} markerEnd={`url(#${marker})`}/>
  </svg>}
  {result.axis&&<div data-revolve-direction-label>Локальная ось +{axis.toUpperCase()}: {axis==='u'?'v':'u'} = {offset} мм. Угол {angle}° ({angle>0?'положительное':'отрицательное'} вращение по правилу правой руки вокруг +{axis.toUpperCase()}). Плоскость {sketch.plane}; ось лежит в ней, а не по её нормали.</div>}
 </section>;
}
