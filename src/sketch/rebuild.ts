import {kernelClient} from '../kernel/client';
import {validateExactModelState,upsertExactBody} from '../kernel/model';
import type {ExactModelState,KernelBodyResult,KernelRequest,KernelOutput} from '../kernel/types';
import {profilePoints,validateSketchModelState} from './model';
import type {SketchModelState} from './types';
export type SketchExecutor=(request:KernelRequest)=>Promise<KernelOutput>;
/** BREP is derived for linked extrusions. Build into a detached result and let
 * the document hook atomically commit source + every body, or neither. */
export async function rebuildSketchBodies(source:SketchModelState,base:ExactModelState,execute:SketchExecutor=request=>kernelClient.execute(request)):Promise<ExactModelState>{
 const state=validateSketchModelState(source);let exact=validateExactModelState(base);
 for(const feature of state.extrusions){
  const sketch=state.sketches.find(sketch=>sketch.id===feature.sketchId)!;
  const result=await execute({op:'extrude-sketch',points:profilePoints(sketch),plane:sketch.plane,origin:sketch.origin,depth:feature.depth});
  if(typeof result==='string'||!result.brep||result.topology.solids!==1||!Number.isFinite(result.volume)||result.volume<=0)throw Error('Ядро не вернуло корректное тело выдавливания');
  const previous=exact.bodies.find(body=>body.id===feature.bodyId);
  exact=upsertExactBody(exact,{id:feature.bodyId,name:previous?.name??`${sketch.name} · выдавливание`,color:previous?.color??'#2378e8',visible:previous?.visible??true,brep:(result as KernelBodyResult).brep});
 }
 return validateExactModelState(exact);
}
