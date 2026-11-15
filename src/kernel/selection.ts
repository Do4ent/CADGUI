import {GeometryReferenceSession} from './references';
import type {GeometryReference,ReferenceResolution} from './references';
import type {ExactBody,ExactModelState,ExactSelection,KernelBodyResult,KernelOutput,KernelRequest} from './types';
export type CanonicalInspection={bodyId:string;sourceBrep:string;bodyRevision:number;generation:number;status:'loading'|'ready'|'error';result?:KernelBodyResult;error?:string};
export function validateInspectionMesh(result:KernelBodyResult):void {
 const {positions,normals,indices}=result.mesh;
 if(!positions.length||positions.length%3||normals.length!==positions.length||!indices.length||indices.length%3||!positions.every(Number.isFinite)||!normals.every(Number.isFinite)||!indices.every(index=>Number.isSafeInteger(index)&&index>=0&&index<positions.length/3))throw Error('Некорректная сетка BREP');
}
/** One committed document lifetime. Payloads are pinned here, never in selection.
 * The sole bindInspection owner prevents independent viewports replacing tokens. */
export class ExactSelectionRuntime {
 readonly session:GeometryReferenceSession;
 private state:ExactModelState|null=null;private records=new Map<string,CanonicalInspection>();private generation=0;private version=0;private closed=false;private listeners=new Set<()=>void>();
 constructor(readonly documentId:string,private execute:(request:KernelRequest)=>Promise<KernelOutput>){this.session=new GeometryReferenceSession(documentId)}
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener)}};
 getSnapshot=()=>this.version;
 private publish(){this.version++;for(const listener of this.listeners)listener()}
 /** Only call in a commit phase; discarded React renders must not advance revisions. */
 commit(state:ExactModelState):void {
  if(this.closed)return;this.session.sync(state);this.state=state;
  for(const [id,record] of this.records){const body=state.bodies.find(b=>b.id===id);if(!body||this.session.captureBody(id).bodyRevision!==record.bodyRevision)this.records.delete(id)}
  this.publish();
 }
 matches(body:ExactBody):boolean{return !this.closed&&!!this.state?.bodies.some(current=>current.id===body.id&&current.brep===body.brep)}
 inspection(body:ExactBody):CanonicalInspection|undefined{return this.matches(body)?this.records.get(body.id):undefined}
 ensureInspection(body:ExactBody):void {
  if(!this.matches(body)||!body.visible||this.records.has(body.id))return;
  const reference=this.session.captureBody(body.id),record:CanonicalInspection={bodyId:body.id,sourceBrep:body.brep,bodyRevision:reference.bodyRevision,generation:++this.generation,status:'loading'};
  this.records.set(body.id,record);this.publish();
  const current=()=>!this.closed&&this.records.get(body.id)===record&&this.session.resolve(reference).status==='valid';
  Promise.resolve().then(()=>{if(!current())throw Error('Инспекция отменена');return this.execute({op:'inspect',brep:record.sourceBrep})}).then(result=>{
   if(!current())return;if(typeof result==='string')throw Error('Ядро не вернуло сетку BREP');validateInspectionMesh(result);
   if(!this.session.bindInspection(body.id,record.sourceBrep,result))return;
   this.records.set(body.id,{...record,status:'ready',result});this.publish();
  }).catch(error=>{if(current()){this.records.set(body.id,{...record,status:'error',error:error instanceof Error?error.message:String(error)});this.publish()}});
 }
 invalidateInspections(error?:string):void {
  if(this.closed)return;this.records.clear();this.generation++;this.session.invalidateInspections();
  // A failed worker must not enter an automatic restart/failure loop. Offer an
  // explicit per-body retry after notifying every viewport of the lost payload.
  if(error&&this.state)for(const body of this.state.bodies)if(body.visible)this.records.set(body.id,{bodyId:body.id,sourceBrep:body.brep,bodyRevision:this.session.captureBody(body.id).bodyRevision,generation:++this.generation,status:'error',error});
  this.publish();
 }
 retryInspection(body:ExactBody):void {if(this.matches(body)&&this.records.get(body.id)?.status==='error'){this.records.delete(body.id);this.publish()}}
 dispose():void {if(this.closed)return;this.closed=true;this.records.clear();this.session.sync({bodies:[]} as unknown as ExactModelState);this.session.invalidateInspections();this.publish();this.listeners.clear()}
 captureBody(bodyId:string):ExactSelection|null {if(this.closed||!this.state?.bodies.some(b=>b.id===bodyId))return null;return {reference:this.session.captureBody(bodyId),renderScope:null}}
 captureFace(body:ExactBody,record:CanonicalInspection,triangleIndex:number,renderScope:string):ExactSelection|null {
  // A late pointer from a replaced viewport/mesh cannot reinterpret its triangle
  // against a newer group's ranges. Never bind a rendered payload on click.
  if(!this.matches(body)||this.records.get(body.id)!==record||record.status!=='ready')return null;
  try{const reference=this.session.captureFace(body.id,triangleIndex);return {reference,renderScope}}catch{return null}
 }
 resolve(selection:ExactSelection|null,state?:ExactModelState):ReferenceResolution|null {
  if(!selection||this.closed)return null;const body=(state??this.state)?.bodies.find(b=>b.id===selection.reference.bodyId);if(!body||!this.matches(body))return null;
  if(!body.visible&&selection.reference.kind==='face')return {status:'broken',code:'body-hidden',message:'Исходное тело скрыто'};
  try{return this.session.resolve(selection.reference)}catch{return null}
 }
 validate(selection:ExactSelection|null,state?:ExactModelState):ExactSelection|null{return this.resolve(selection,state)?.status==='valid'?selection:null}
 reconcile(selection:ExactSelection|null,state?:ExactModelState):ExactSelection|null {
  if(!selection||selection.reference.documentId!==this.documentId||selection.reference.sessionId!==this.session.sessionId)return null;
  const resolved=this.resolve(selection,state);if(resolved?.status==='valid')return selection;
  const body=(state??this.state)?.bodies.find(b=>b.id===selection.reference.bodyId);return body&&this.matches(body)?this.captureBody(body.id):null;
 }
 selectedFace(body:ExactBody,record:CanonicalInspection,selection:ExactSelection|null):Extract<ReferenceResolution,{kind:'face'}>|null {
  if(!this.matches(body)||this.records.get(body.id)!==record||!selection||selection.reference.bodyId!==body.id)return null;
  const result=this.resolve(selection);return result?.status==='valid'&&result.kind==='face'?result:null;
 }
}
export function referenceBodyId(selection:ExactSelection|null):string|null{return selection?.reference.bodyId??null}
export type {GeometryReference};
