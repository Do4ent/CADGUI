import type {SketchRegion,SketchRegionBoundary} from './types';
import {validateSketchRegion} from './region';
const TAU=2*Math.PI,EPS=1e-8;
/** Exact analytic axis checks, independent of native tessellation. Axis contact
 * along lines or at arc endpoints is supported; interior curved tangencies
 * (including horn tori) are deliberately outside this first feature scope. */
export function revolutionAxis(input:SketchRegion,axis:'u'|'v',offset:number,angle:number):{point:[number,number];direction:[number,number];radians:number}{
 if(!['u','v'].includes(axis)||!Number.isFinite(offset)||Math.abs(offset)>1e6||!Number.isFinite(angle)||Math.abs(angle)<.0001||Math.abs(angle)>360)throw Error('Вращение: неверная ось, смещение или угол (0.0001…360°)');
 const region=validateSketchRegion(input),coordinate=axis==='u'?1:0;let minimum=Infinity,maximum=-Infinity;const values:number[]=[];
 const add=(v:number)=>{minimum=Math.min(minimum,v-offset);maximum=Math.max(maximum,v-offset);values.push(v-offset);};
 const boundary=(b:SketchRegionBoundary)=>{if(b.kind==='circle'){const center=b.center[coordinate]-offset,min=center-b.radius,max=center+b.radius;add(b.center[coordinate]-b.radius);add(b.center[coordinate]+b.radius);if(Math.abs(min)<=EPS||Math.abs(max)<=EPS)throw Error('Вращение: касание оси внутри окружности не поддерживается');return;}
 for(const e of b.edges){if(e.kind==='line'){add(e.start[coordinate]);add(e.end[coordinate]);continue;}const at=(a:number)=>e.center[coordinate]+e.radius*(coordinate===0?Math.cos(a):Math.sin(a));add(at(e.startAngle));add(at(e.startAngle+e.sweep));for(const a of coordinate===0?[0,Math.PI]:[Math.PI/2,3*Math.PI/2]){const delta=e.sweep>0?((a-e.startAngle)%TAU+TAU)%TAU:((e.startAngle-a)%TAU+TAU)%TAU,t=delta/Math.abs(e.sweep);if(t>1e-10&&t<1-1e-10){const v=at(a);add(v);if(Math.abs(v-offset)<=EPS)throw Error('Вращение: внутреннее касание дуги и оси не поддерживается');}}}}
 boundary(region.outer);for(const hole of region.holes)boundary(hole);if(minimum< -EPS&&maximum>EPS)throw Error('Вращение: профиль пересекает ось');if(values.every(v=>Math.abs(v)<=EPS))throw Error('Вращение: профиль вырожден на оси');return{point:axis==='u'?[0,offset]:[offset,0],direction:axis==='u'?[1,0]:[0,1],radians:angle*Math.PI/180};
}
