import type {SketchModelState,SuppressedFeatureRecord} from './types';
import {orderedSketchBodyFeatures} from './cutGraph';

export type SuppressibleFeatureKind='extrusion'|'revolution'|'cut'|'fusion'|'body-boolean';
type Feature={id:string;bodyId:string;kind:SuppressibleFeatureKind;inputs:string[]};
export function suppressionFeatures(state:SketchModelState):Feature[]{return [
 ...state.extrusions.map(f=>({id:f.id,bodyId:f.bodyId,kind:'extrusion' as const,inputs:[]})),
 ...(state.revolutions??[]).map(f=>({id:f.id,bodyId:f.bodyId,kind:'revolution' as const,inputs:[]})),
 ...orderedSketchBodyFeatures(state).map(n=>({id:n.feature.id,bodyId:n.feature.bodyId,kind:n.kind,inputs:n.kind==='cut'?[n.feature.targetBodyId]:[n.feature.aBodyId,n.feature.bBodyId]})),
 ];}
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const keys=(v:Record<string,unknown>,expected:string[])=>Object.keys(v).length===expected.length&&expected.every(k=>Object.hasOwn(v,k));
const text=(v:unknown,max:number):v is string=>typeof v==='string'&&!!v.trim()&&v.length<=max&&!/[\u0000-\u001f\u007f]/.test(v);
const outputName=(value:unknown):value is string=>typeof value==='string'&&!!value.trim()&&value.length<=200&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);

/** Validate and detach persisted suppression records. */
export function validateSuppressedFeatureRecords(value:unknown):SuppressedFeatureRecord[]{
 if(!Array.isArray(value)||value.length>250)throw Error('Некорректный список подавленных операций');
 const ids=new Set<string>();
 return Array.from(value,raw=>{
  if(!record(raw)||!keys(raw,['featureId','output'])||!text(raw.featureId,256)||ids.has(raw.featureId)||!record(raw.output)||!keys(raw.output,['name','color','visible'])||!outputName(raw.output.name)||typeof raw.output.color!=='string'||!/^#[\da-f]{6}$/i.test(raw.output.color)||typeof raw.output.visible!=='boolean')throw Error('Некорректные метаданные подавленной операции');
  ids.add(raw.featureId);return {featureId:raw.featureId,output:{name:raw.output.name,color:raw.output.color,visible:raw.output.visible}};
 });
}
/** Runs on the already parsed source to avoid recursive validation. */
export function suppressedOutputIds(state:SketchModelState):Set<string>{
 const all=suppressionFeatures(state);
 const byId=new Map(all.map(feature=>[feature.id,feature]));
 const inputs=new Set(all.flatMap(feature=>feature.inputs));
 return new Set((state.suppressedFeatures??[]).map(record=>{
  const feature=byId.get(record.featureId);
  if(!feature||inputs.has(feature.bodyId))throw Error('Подавление требует конечную операцию без зависимых потребителей');
  return feature.bodyId;
 }));
}
