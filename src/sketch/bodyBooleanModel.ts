import type {SketchModelState} from './types';
import type {SketchBodyFeature} from './cutGraph';
import {orderedSketchBodyFeatures} from './cutGraph';
import {validateSketchModelState,pruneSketchExtrusions} from './model';
import type {BodyBooleanFeature} from './types';
export type {BodyBooleanFeature} from './types';
export type BodyBooleanNode=SketchBodyFeature|{kind:'body-boolean';feature:BodyBooleanFeature};
export type BodyBooleanDiagnostic={code:'invalid-existing'|'invalid-feature'|'invalid-body-ids'|'duplicate-feature-id'|'duplicate-output-id'|'missing-input'|'cycle';featureId?:string;bodyId?:string;message:string};
export type BodyBooleanGraphResult={status:'valid'|'invalid';order:BodyBooleanNode[];diagnostics:BodyBooleanDiagnostic[]};
export {BODY_BOOLEAN_LIMIT,validateBodyBooleanFeatures} from './bodyBooleanValidation';
import {validateBodyBooleanFeatures} from './bodyBooleanValidation';
const isId=(v:unknown):v is string=>typeof v==='string'&&!!v.trim()&&v.length<=256&&!/[\u0000-\u001f\u007f]/.test(v);
const inputs=(n:BodyBooleanNode):string[]=>n.kind==='cut'?[n.feature.targetBodyId]:[n.feature.aBodyId,n.feature.bBodyId];
function graph(existing:SketchModelState,features:unknown,availableBodyIds?:unknown):BodyBooleanGraphResult{let state:SketchModelState,bodyBooleans:BodyBooleanFeature[];try{state=validateSketchModelState(existing);}catch(error){return{status:'invalid',order:[],diagnostics:[{code:'invalid-existing',message:error instanceof Error?error.message:String(error)}]};}try{bodyBooleans=validateBodyBooleanFeatures(features);}catch(error){return{status:'invalid',order:[],diagnostics:[{code:'invalid-feature',message:error instanceof Error?error.message:String(error)}]};}
 const diagnostics:BodyBooleanDiagnostic[]=[],nodes:BodyBooleanNode[]=[...(state.cuts??[]).map(feature=>({kind:'cut' as const,feature})),...(state.fusions??[]).map(feature=>({kind:'fusion' as const,feature})),...(state.bodyBooleans??[]).map(feature=>({kind:'body-boolean' as const,feature})),...bodyBooleans.map(feature=>({kind:'body-boolean' as const,feature}))],roots=[...state.extrusions,...(state.revolutions??[])],ids=new Set<string>(),outputs=new Set<string>();for(const f of [...roots,...nodes.map(n=>n.feature)]){if(ids.has(f.id))diagnostics.push({code:'duplicate-feature-id',featureId:f.id,message:'ID операции уже используется'});ids.add(f.id);if(outputs.has(f.bodyId))diagnostics.push({code:'duplicate-output-id',featureId:f.id,bodyId:f.bodyId,message:'Выходное тело уже принадлежит другой операции'});outputs.add(f.bodyId);}
 let available:Set<string>|undefined;if(availableBodyIds!==undefined){if(!Array.isArray(availableBodyIds)||Array.from(availableBodyIds).some(id=>!isId(id))||new Set(availableBodyIds).size!==availableBodyIds.length)diagnostics.push({code:'invalid-body-ids',message:'Нужен список уникальных ID доступных тел'});else available=new Set(availableBodyIds);}
 if(available)for(const n of nodes)for(const id of inputs(n))if(!outputs.has(id)&&!available.has(id))diagnostics.push({code:'missing-input',featureId:n.feature.id,bodyId:id,message:'Исходное тело отсутствует'});
 if(diagnostics.length)return{status:'invalid',order:[],diagnostics};
 const adapted={...state,bodyBooleans:[...(state.bodyBooleans??[]),...bodyBooleans]};try{return{status:'valid',order:orderedSketchBodyFeatures(adapted),diagnostics:[]};}catch{return{status:'invalid',order:[],diagnostics:[{code:'cycle',message:'Граф зависимостей содержит цикл; порядок перестройки недоступен'}]};}}

/** Missing static inputs are checked against caller-supplied exact body IDs.
 * Derived outputs need not exist yet: the returned order is their rebuild plan. */
export function diagnoseBodyBooleanGraph(existing:SketchModelState,features:unknown,availableBodyIds:unknown):BodyBooleanGraphResult{if(availableBodyIds===undefined)return{status:'invalid',order:[],diagnostics:[{code:'invalid-body-ids',message:'Нужны ID доступных тел'}]};return graph(existing,features,availableBodyIds);}
/** Pure deletion plan. Cascades through existing cut/fusion and proposed body
 * booleans, while retaining the other operands and all unrelated source sketches. */
export function planBodyBooleanRemoval(existing:SketchModelState,features:unknown,removedBodyIds:unknown):{state:SketchModelState;features:BodyBooleanFeature[];removedBodyIds:string[]}{const result=graph(existing,features);if(result.status==='invalid')throw Error(result.diagnostics.map(d=>d.message).join('; '));if(!Array.isArray(removedBodyIds)||Array.from(removedBodyIds).some(id=>!isId(id)))throw Error('Нужны ID удаляемых тел');const removed=new Set<string>(removedBodyIds);for(const n of result.order)if(removed.has(n.feature.bodyId)||inputs(n).some(id=>removed.has(id)))removed.add(n.feature.bodyId);return{state:pruneSketchExtrusions(existing,[...removed]),features:validateBodyBooleanFeatures(features).filter(f=>!removed.has(f.bodyId)),removedBodyIds:[...removed]};}
