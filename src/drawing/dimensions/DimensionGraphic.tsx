import React from 'react';
import type {DrawingDocument,DrawingEntity} from '../types';
import {resolveFontFamily} from '../fontPolicy';
import {dimensionLabelLines,layoutDimension} from './layout';
export function DimensionGraphic({entity,document}:{entity:DrawingEntity;document:DrawingDocument}){
 try{
  const layout=layoutDimension(entity,document),def=entity.dimension!,style=def.style,lines=dimensionLabelLines(def,layout.label),width=Math.max(1,...lines.map(line=>Array.from(line).length))*.6*style.textHeight,height=lines.length*style.textHeight*1.2,pad=style.textGap;
  return <g data-dimension-text-metrics="approximate" data-dimension-kind={def.kind} data-dimension-value={layout.measurement.value} data-dimension-label={layout.label} stroke={style.color} fill="none" strokeWidth={style.lineWidth}>
   <title>{[entity.name,...layout.warnings].join(' · ')}</title>
   {layout.primitives.map((p,i)=>p.type==='line'?<line key={i} data-dimension-primitive="true" x1={p.a[0]} y1={p.a[1]} x2={p.b[0]} y2={p.b[1]}/>:p.type==='circle'?<circle key={i} data-dimension-primitive="true" cx={p.center[0]} cy={p.center[1]} r={p.radius} fill={p.fill?style.color:'none'}/>:<path key={i} data-dimension-primitive="true" d={p.d} fill={/Z\s*$/i.test(p.d)?style.color:'none'}/>)}
   <g transform={`translate(${layout.text.x} ${layout.text.y}) rotate(${layout.text.rotation})`}>
    {style.textMask&&<rect x={-width/2-pad} y={-height/2-pad} width={width+pad*2} height={height+pad*2} fill="white" stroke="none"/>}
    {def.tolerance.type==='basic'&&<rect data-dimension-basic-frame="true" x={-width/2-pad} y={-height/2-pad} width={width+pad*2} height={height+pad*2} fill="none"/>}
    <text data-dimension-text="true" textAnchor={layout.text.anchor} dominantBaseline="central" fontFamily={resolveFontFamily(document,style.fontFamily)} fontSize={layout.text.height} fill={style.color} stroke="none">{lines.map((line,i)=><tspan key={i} x={0} y={(i-(lines.length-1)/2)*layout.text.height*1.2}>{line}</tspan>)}</text>
   </g>
  </g>;
 }catch(error){const x=Number.isFinite(entity.x)?entity.x:0,y=Number.isFinite(entity.y)?entity.y:0;return <g data-dimension-error="true" stroke="#bc2525" fill="#bc2525"><title>{error instanceof Error?error.message:String(error)}</title><path d={`M ${x} ${y} l 3 3 m -3 0 l 3 -3`} strokeWidth={.5}/><text x={x+4} y={y+3} fontSize={3} stroke="none">Размер: ошибка источника</text></g>;}
}
