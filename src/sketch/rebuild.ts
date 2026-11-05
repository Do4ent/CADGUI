import {sketchRegion} from './region';
import {kernelClient} from '../kernel/client';
import {validateExactModelState,upsertExactBody} from '../kernel/model';
import type {ExactModelState,KernelBodyResult,KernelRequest,KernelOutput} from '../kernel/types';
import {mixedProfile,curvedProfile,profilePoints,validateSketchModelState,orderedSketchCuts,ownedSketchBodyIds} from './model';
import type {SketchModelState} from './types';
function derivedBodyName(name:string,operation:string){const suffix=` · ${operation}`;const prefix=name.trim().slice(0,200-suffix.length).replace(/[\uD800-\uDBFF]$/,'').trimEnd();return prefix+suffix;}
export type SketchExecutor=(request:KernelRequest)=>Promise<KernelOutput>;
/** BREP is derived for linked extrusions. Build into a detached result and let
 * the document hook atomically commit source + every body, or neither. */
export async function rebuildSketchBodies(source:SketchModelState,base:ExactModelState,execute:SketchExecutor=request=>kernelClient.execute(request)):Promise<ExactModelState>{
 const state=validateSketchModelState(source);let exact=validateExactModelState(base);
 const owned=new Set(ownedSketchBodyIds(state)),available=new Set(exact.bodies.map(b=>b.id));
 for(const feature of state.cuts??[])if(!owned.has(feature.targetBodyId)&&!available.has(feature.targetBodyId))throw Error('Исходное тело вырезания отсутствует');
 for(const feature of state.extrusions){
  const sketch=state.sketches.find(sketch=>sketch.id===feature.sketchId)!;
  const mixed=mixedProfile(sketch),curve=curvedProfile(sketch);
  const result=await execute(sketch.holes?.length?{op:'extrude-region',region:sketchRegion(state,sketch.id),plane:sketch.plane,origin:sketch.origin,depth:feature.depth}:mixed?{op:'extrude-mixed',edges:mixed,plane:sketch.plane,origin:sketch.origin,depth:feature.depth}:curve?{op:'extrude-curve',profile:curve,plane:sketch.plane,origin:sketch.origin,depth:feature.depth}:{op:'extrude-sketch',points:profilePoints(sketch),plane:sketch.plane,origin:sketch.origin,depth:feature.depth});
  if(typeof result==='string'||!result.brep||result.topology.solids!==1||!Number.isFinite(result.volume)||result.volume<=0)throw Error('Ядро не вернуло корректное тело выдавливания');
  const previous=exact.bodies.find(body=>body.id===feature.bodyId);
  exact=upsertExactBody(exact,{id:feature.bodyId,name:previous?.name??derivedBodyName(sketch.name,'выдавливание'),color:previous?.color??'#2378e8',visible:previous?.visible??true,brep:(result as KernelBodyResult).brep});
 }
 for(const feature of state.revolutions??[]){
  const sketch=state.sketches.find(s=>s.id===feature.sketchId)!;
  const result=await execute({op:'revolve-region',region:sketchRegion(state,sketch.id),plane:sketch.plane,origin:sketch.origin,axis:feature.axis,offset:feature.offset,angle:feature.angle});
  if(typeof result==='string'||!result.brep||result.topology.solids!==1||!Number.isFinite(result.volume)||result.volume<=0)throw Error('Ядро не вернуло корректное тело вращения');
  const previous=exact.bodies.find(b=>b.id===feature.bodyId);
  exact=upsertExactBody(exact,{id:feature.bodyId,name:previous?.name??derivedBodyName(sketch.name,'вращение'),color:previous?.color??'#2378e8',visible:previous?.visible??true,brep:result.brep});
 }
 for(const feature of orderedSketchCuts(state)){
  const sketch=state.sketches.find(s=>s.id===feature.sketchId)!,target=exact.bodies.find(b=>b.id===feature.targetBodyId);
  if(!target)throw Error('Не удалось восстановить исходное тело вырезания');
  const result=await execute({op:'cut-region',target:target.brep,region:sketchRegion(state,sketch.id),plane:sketch.plane,origin:sketch.origin,depth:feature.depth});
  if(typeof result==='string'||!result.brep||!Number.isInteger(result.topology.solids)||result.topology.solids<1||result.topology.solids>100||!Number.isFinite(result.volume)||result.volume<=0)throw Error('Ядро не вернуло корректный результат вырезания');
  const previous=exact.bodies.find(b=>b.id===feature.bodyId);
  exact=upsertExactBody(exact,{id:feature.bodyId,name:previous?.name??derivedBodyName(target.name,'вырезание'),color:previous?.color??target.color,visible:previous?.visible??true,brep:result.brep});
 }
 return validateExactModelState(exact);
}
