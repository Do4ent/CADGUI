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
  if(!record(raw)||!keys(raw,Object.hasOwn(raw,'groupId')?['featureId','groupId','output']:['featureId','output'])||!text(raw.featureId,256)||ids.has(raw.featureId)||!record(raw.output)||!keys(raw.output,['name','color','visible'])||!outputName(raw.output.name)||typeof raw.output.color!=='string'||!/^#[\da-f]{6}$/i.test(raw.output.color)||typeof raw.output.visible!=='boolean')throw Error('Некорректные метаданные подавленной операции');
  if(Object.hasOwn(raw,'groupId')&&!text(raw.groupId,256))throw Error('Некорректная группа подавления');
  ids.add(raw.featureId);return {featureId:raw.featureId,...(typeof raw.groupId==='string'?{groupId:raw.groupId}:{}),output:{name:raw.output.name,color:raw.output.color,visible:raw.output.visible}};
 });
}
/** Runs on the already parsed source to avoid recursive validation. */
export function suppressedOutputIds(state:SketchModelState):Set<string>{
 const all=suppressionFeatures(state);
 const byId=new Map(all.map(feature=>[feature.id,feature]));
 const records=state.suppressedFeatures??[];
 const byFeature=new Map(records.map(item=>[item.featureId,item]));
 const groupOutputs=new Map<string,Set<string>>();
 const groupedBodies=new Set(records.flatMap(item=>item.groupId&&byId.has(item.featureId)?[byId.get(item.featureId)!.bodyId]:[]));
 const suppressed=new Set(records.map(record=>{
  const feature=byId.get(record.featureId);
  if(!feature)throw Error('Подавленная операция отсутствует');
  return feature.bodyId;
 }));
 for(const feature of all){
  const item=byFeature.get(feature.id);
  if(item?.groupId){
   let outputs=groupOutputs.get(item.groupId);
   if(!outputs){
    if(item.groupId!==item.featureId)throw Error('Корневая операция группы подавления отсутствует');
    outputs=new Set();
    groupOutputs.set(item.groupId,outputs);
   }else if(!feature.inputs.some(outputs.has,outputs)){
    throw Error('Операция не принадлежит подавленной ветви');
   }
   outputs.add(feature.bodyId);
  }
  for(const input of feature.inputs){
   if(!suppressed.has(input))continue;
   if(!item?.groupId||!groupOutputs.get(item.groupId)?.has(input)){
    if(!groupedBodies.has(input)){
     throw Error('Подавление требует конечную операцию без зависимых потребителей');
    }
    throw Error('Подавленный результат используется за пределами своей ветви');
   }
  }
 }
 return suppressed;
}
