import type {DrawingDocument,DrawingEntity,Point2} from '../types';
import type {DimensionPrimitive} from './types';
import {layoutDimension} from './layout';
export type DimensionSegments={segments:[Point2,Point2][];approximated:boolean};
/** Static DXF LINE subset: curves are tessellated with a declared 0.01mm target. */
export function flattenCircularArc(center:Point2,radius:number,start:number,end:number):[Point2,Point2][]{
 if(![...center,radius,start,end].every(Number.isFinite)||radius<=0)throw new Error('Некорректная дуга для экспорта');
 const span=(end-start)*Math.PI/180,maxStep=2*Math.acos(Math.max(-1,Math.min(1,1-.01/radius)));
 const count=Math.min(2048,Math.max(1,Math.ceil(Math.abs(span)/Math.max(1e-6,maxStep))));
 const at=(i:number):Point2=>{const a=start*Math.PI/180+span*i/count;return [center[0]+radius*Math.cos(a),center[1]+radius*Math.sin(a)]};
 return Array.from({length:count},(_,i)=>[at(i),at(i+1)] as [Point2,Point2]);
}
export function flattenDimensionPrimitives(primitives:DimensionPrimitive[]):DimensionSegments{
 const segments:[Point2,Point2][]=[],out:DimensionSegments={segments,approximated:false};
 for(const primitive of primitives){
  if(primitive.type==='line'){segments.push([primitive.a,primitive.b]);continue}
  if(primitive.type==='circle'){segments.push(...flattenCircularArc(primitive.center,primitive.radius,0,360));out.approximated=true;continue}
  let current:Point2|undefined,first:Point2|undefined;
  for(const command of primitive.d.matchAll(/([MLAZ])([^MLAZ]*)/g)){
   const kind=command[1],values=command[2].trim().split(/[\s,]+/).filter(Boolean).map(Number);if(values.some(v=>!Number.isFinite(v)))throw new Error('Неизвестный путь размерной графики');
   if(kind==='M'){if(values.length!==2)throw new Error('Некорректное начало пути');current=[values[0],values[1]];first=current;}
   else if(kind==='L'){if(!current||values.length!==2)throw new Error('Некорректная линия пути');const next:Point2=[values[0],values[1]];segments.push([current,next]);current=next;}
   else if(kind==='Z'){if(current&&first)segments.push([current,first]);}
   else if(kind==='A'){
    if(!current||values.length!==7||values[0]!==values[1]||values[2]!==0)throw new Error('Поддерживается только круговая дуга размерной графики');
    const [r,, ,large,sweep,x,y]=values,next:Point2=[x,y],dx=(current[0]-x)/2,dy=(current[1]-y)/2,d2=dx*dx+dy*dy;if(d2<1e-20){current=next;continue}
    const radius=Math.max(r,Math.sqrt(d2)),k=(large===sweep?-1:1)*Math.sqrt(Math.max(0,(radius*radius-d2)/d2)),center:Point2=[(current[0]+x)/2+k*dy,(current[1]+y)/2-k*dx];
    const start=Math.atan2(current[1]-center[1],current[0]-center[0])*180/Math.PI,finish=Math.atan2(y-center[1],x-center[0])*180/Math.PI;
    let span=((finish-start)%360+360)%360;if(!sweep)span-=360;
    segments.push(...flattenCircularArc(center,radius,start,start+span));out.approximated=true;current=next;
   }
  }
 }
 return out;
}
export function dimensionExportGeometry(entity:DrawingEntity,document:DrawingDocument){const layout=layoutDimension(entity,document);return {...flattenDimensionPrimitives(layout.primitives),layout};}
