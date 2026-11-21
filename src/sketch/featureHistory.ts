import {orderedSketchBodyFeatures} from './cutGraph';
import type {SketchModelState} from './types';
import type {ExactModelState} from '../kernel/types';

export type FeatureHistoryKind='sketch'|'extrusion'|'revolution'|'cut'|'fusion'|'body-boolean'|'body';
export type FeatureHistoryNode=Readonly<{id:string;sourceId:string;kind:FeatureHistoryKind;label:string;bodyId?:string;sketchId?:string;upstream:readonly string[];downstream:readonly string[];status:'ready'|'broken'|'suppressed'}>;
export type FeatureHistoryDiagnostic=Readonly<{code:'missing-source'|'missing-result'|'duplicate-id'|'duplicate-output'|'cycle';nodeId?:string;sourceId?:string;message:string}>;
export type FeatureHistory=Readonly<{nodes:readonly FeatureHistoryNode[];diagnostics:readonly FeatureHistoryDiagnostic[]}>;
type Pending={node:Omit<FeatureHistoryNode,'upstream'|'downstream'|'status'>;sketchInputs:string[];bodyInputs:string[]};
const key=(kind:FeatureHistoryKind,id:string)=>`${kind}:${id}`;

/** A detached inspection view. Category order is not editable execution history. */
export function buildFeatureHistory(state:SketchModelState,exactModel?:ExactModelState):FeatureHistory {
 const suppressed=new Set(state.suppressedFeatures?.map(record=>record.featureId));
 const pending:Pending[]=[],diagnostics:FeatureHistoryDiagnostic[]=[],bad=new Set<string>();
 const add=(kind:FeatureHistoryKind,id:string,label:string,sketchInputs:string[]=[],bodyInputs:string[]=[],bodyId?:string,sketchId?:string)=>pending.push({node:{id:key(kind,id),sourceId:id,kind,label,...(bodyId?{bodyId}:{}),...(sketchId?{sketchId}:{})},sketchInputs:[...sketchInputs],bodyInputs:[...bodyInputs]});
 for(const s of state.sketches)add('sketch',s.id,s.name,s.holes??[]);
 for(const f of state.extrusions)add('extrusion',f.id,'Выдавливание',[f.sketchId],[],f.bodyId,f.sketchId);
 for(const f of state.revolutions??[])add('revolution',f.id,'Вращение',[f.sketchId],[],f.bodyId,f.sketchId);
 let derived;try{derived=orderedSketchBodyFeatures(state)}catch{diagnostics.push({code:'cycle',message:'Циклические зависимости операций'});derived=[...(state.cuts??[]).map(feature=>({kind:'cut' as const,feature})),...(state.fusions??[]).map(feature=>({kind:'fusion' as const,feature})),...(state.bodyBooleans??[]).map(feature=>({kind:'body-boolean' as const,feature}))];for(const n of derived)bad.add(key(n.kind,n.feature.id));}
 for(const n of derived){const f=n.feature;if(n.kind==='cut')add(n.kind,f.id,'Вырезание',[n.feature.sketchId],[n.feature.targetBodyId],f.bodyId,n.feature.sketchId);else add(n.kind,f.id,n.kind==='fusion'?'Объединение':n.feature.operation==='common'?'Пересечение':'Вычитание',[],[n.feature.aBodyId,n.feature.bBodyId],f.bodyId);}
 const outputs=new Map<string,string>(),sketches=new Map<string,string>(),identities=new Set<string>();
 for(const p of pending){const n=p.node;if(identities.has(n.id)){diagnostics.push({code:'duplicate-id',nodeId:n.id,sourceId:n.sourceId,message:'Повторный идентификатор источника'});bad.add(n.id);}identities.add(n.id);if(n.kind==='sketch')sketches.set(n.sourceId,n.id);if(n.bodyId){if(outputs.has(n.bodyId)){diagnostics.push({code:'duplicate-output',nodeId:n.id,sourceId:n.bodyId,message:'Несколько операций владеют одним телом'});bad.add(n.id);bad.add(outputs.get(n.bodyId)!);}else outputs.set(n.bodyId,n.id);}}
 if(exactModel){const actual=new Set(exactModel.bodies.map(body=>body.id));for(const p of pending)if(p.node.bodyId&&!suppressed.has(p.node.sourceId)&&!actual.has(p.node.bodyId)){diagnostics.push({code:'missing-result',nodeId:p.node.id,sourceId:p.node.bodyId,message:'Результирующее тело отсутствует'});bad.add(p.node.id);}}
 for(const body of exactModel?.bodies??[])if(!outputs.has(body.id)){add('body',body.id,body.name,[],[],body.id);outputs.set(body.id,key('body',body.id));}
 const upstream=new Map<string,string[]>(),downstream=new Map<string,string[]>();
 for(const p of pending){const refs:string[]=[];for(const [ids,map] of [[p.sketchInputs,sketches],[p.bodyInputs,outputs]] as const)for(const sourceId of ids){const target=map.get(sourceId);if(target)refs.push(target);else{diagnostics.push({code:'missing-source',nodeId:p.node.id,sourceId,message:'Исходный объект отсутствует'});bad.add(p.node.id);}}upstream.set(p.node.id,[...new Set(refs)]);for(const target of refs){const children=downstream.get(target)??[];if(!children.includes(p.node.id))children.push(p.node.id);downstream.set(target,children);}}
 const visited=new Set<string>(),stack:string[]=[];
 const visit=(id:string)=>{const at=stack.indexOf(id);if(at>=0){for(const member of stack.slice(at)){if(!bad.has(member))diagnostics.push({code:'cycle',nodeId:member,message:'Циклическая ссылка истории'});bad.add(member);}return;}if(visited.has(id))return;stack.push(id);for(const parent of upstream.get(id)??[])visit(parent);stack.pop();visited.add(id);};
 for(const p of pending)visit(p.node.id);
 // Invalid source information propagates to every consumer without changing data.
 let changed=true;while(changed){changed=false;for(const p of pending)if(!bad.has(p.node.id)&&(upstream.get(p.node.id)??[]).some(id=>bad.has(id))){bad.add(p.node.id);changed=true;}}
 return {nodes:pending.map(p=>({...p.node,upstream:[...(upstream.get(p.node.id)??[])],downstream:[...(downstream.get(p.node.id)??[])],status:bad.has(p.node.id)?'broken':p.node.bodyId&&p.node.kind!=='body'&&suppressed.has(p.node.sourceId)?'suppressed':'ready'})),diagnostics};
}

export function getFeatureHistoryRelations(history:FeatureHistory,nodeId:string):{upstream:string[];downstream:string[]} {
 const nodes=new Map(history.nodes.map(n=>[n.id,n]));
 const collect=(direction:'upstream'|'downstream')=>{const seen=new Set<string>([nodeId]),result:string[]=[],queue=[...(nodes.get(nodeId)?.[direction]??[])];while(queue.length){const id=queue.shift()!;if(seen.has(id))continue;seen.add(id);if(!nodes.has(id))continue;result.push(id);queue.push(...nodes.get(id)![direction]);}return result;};
 return {upstream:collect('upstream'),downstream:collect('downstream')};
}
