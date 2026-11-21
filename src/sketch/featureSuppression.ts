import type {ExactBody,ExactModelState} from '../kernel/types';
import {validateExactModelState} from '../kernel/model';
import type {SketchModelState,SuppressedFeatureRecord} from './types';
import {validateSketchModelState} from './model';
import {ownedSketchBodyIds} from './cutGraph';
import {suppressionFeatures,validateSuppressedFeatureRecords,type SuppressibleFeatureKind} from './suppressionValidation';
export {validateSuppressedFeatureRecords} from './suppressionValidation';
export type {SuppressibleFeatureKind} from './suppressionValidation';

export type {SuppressedFeatureRecord} from './types';
export type SuppressionEligibility={eligible:boolean;reason?:string;consumerIds:string[];bodyId?:string;kind?:SuppressibleFeatureKind};
export type SuppressionPlan={state:SketchModelState;exact:ExactModelState;records:SuppressedFeatureRecord[];reservedBodyIds:string[]};
export type ResumePlan=SuppressionPlan&{restoreOutput:{bodyId:string;name:string;color:string;visible:boolean}};

export function getFeatureSuppressionEligibility(state:SketchModelState,featureId:string):SuppressionEligibility{
 const source=validateSketchModelState(state),all=suppressionFeatures(source),feature=all.find(f=>f.id===featureId);
 if(!feature)return {eligible:false,reason:'Операция отсутствует',consumerIds:[]};
 const consumerIds=all.filter(f=>f.inputs.includes(feature.bodyId)).map(f=>f.id);
 return {eligible:consumerIds.length===0,...(consumerIds.length?{reason:'Результат используется другими сохранёнными операциями'}:{}),consumerIds,bodyId:feature.bodyId,kind:feature.kind};
}
function context(state:SketchModelState,exact:ExactModelState,records:unknown){
 const source=validateSketchModelState(state),model=validateExactModelState(exact),saved=validateSuppressedFeatureRecords(records),all=suppressionFeatures(source);
 for(const item of saved){const eligibility=getFeatureSuppressionEligibility(source,item.featureId);if(!eligibility.eligible)throw Error(eligibility.reason);if(model.bodies.some(b=>b.id===eligibility.bodyId))throw Error('Подавленный результат не должен присутствовать в активной модели');}
 const suppressed=new Set(saved.map(item=>item.featureId)),available=new Set(model.bodies.map(body=>body.id));
 for(const feature of all){if(!suppressed.has(feature.id)&&!available.has(feature.bodyId))throw Error('Активный результат операции отсутствует');for(const input of feature.inputs)if(!available.has(input))throw Error('Исходное тело отсутствует');}
 return {source,model,saved,all};
}
function requireLeaf(state:SketchModelState,featureId:string):{bodyId:string;kind:SuppressibleFeatureKind}{const e=getFeatureSuppressionEligibility(state,featureId);if(!e.eligible||!e.bodyId||!e.kind)throw Error(e.reason??'Операция недоступна');return {bodyId:e.bodyId,kind:e.kind};}

/** Remove only a leaf output; retained definitions and all output IDs stay reserved.
 * This stages no fake BREP and never commits application history. */
export function planFeatureSuppression(state:SketchModelState,exact:ExactModelState,records:unknown,featureId:string):SuppressionPlan{
 const {source,model,saved,all}=context(state,exact,records),leaf=requireLeaf(source,featureId);
 if(saved.some(r=>r.featureId===featureId))throw Error('Операция уже подавлена');
 const output=model.bodies.find(b=>b.id===leaf.bodyId);if(!output)throw Error('Результат операции отсутствует');
 const feature=all.find(f=>f.id===featureId)!,suppressed=new Set([...saved.map(r=>r.featureId),featureId]);
 const consumed=new Set(all.filter(f=>!suppressed.has(f.id)).flatMap(f=>f.inputs));
 for(const input of feature.inputs)if(!model.bodies.some(b=>b.id===input))throw Error('Исходное тело отсутствует');
 const bodies=model.bodies.filter(b=>b.id!==output.id).map(b=>feature.inputs.includes(b.id)&&!consumed.has(b.id)?{...b,visible:true}:b);
 return {state:source,exact:{...model,bodies},records:[...saved,{featureId,output:{name:output.name,color:output.color,visible:output.visible}}],reservedBodyIds:ownedSketchBodyIds(source)};
}

/** Resume is a rebuild plan, not a successful result. Caller must run real OCCT,
 * apply restoreOutput metadata and input visibility, then atomically commit.
 * If rebuild fails, discard this detached plan and retain the suppressed state. */
export function planFeatureResume(state:SketchModelState,exact:ExactModelState,records:unknown,featureId:string):ResumePlan{
 const {source,model,saved,all}=context(state,exact,records),leaf=requireLeaf(source,featureId),savedRecord=saved.find(r=>r.featureId===featureId);
 if(!savedRecord)throw Error('Операция не подавлена');
 const feature=all.find(f=>f.id===featureId)!;
 for(const input of feature.inputs)if(!model.bodies.some(b=>b.id===input))throw Error('Исходное тело отсутствует');
 const bodies=model.bodies.map((b):ExactBody=>feature.inputs.includes(b.id)?{...b,visible:false}:b);
 return {state:source,exact:{...model,bodies},records:saved.filter(r=>r.featureId!==featureId),reservedBodyIds:ownedSketchBodyIds(source),restoreOutput:{bodyId:leaf.bodyId,...savedRecord.output}};
}
