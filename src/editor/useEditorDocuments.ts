import {angularAssemblyMateFromPoses,distanceAssemblyMateFromPoses,fixedAssemblyMateFromPoses,validateAssemblyMates,type AssemblyMate,type MateParameter} from '../documents/assemblyMates';
import {validateAssemblyInstances,type AssemblyInstance} from '../documents/assemblyInstances';
import {detachAssemblyInstance,pruneAssemblyMates,resolveAssemblyHierarchy,validateAssemblyGroups,type AssemblyGroup} from '../documents/assemblyHierarchy';
import {readWorkspaceRecovery,saveWorkspaceRecovery,resumeWorkspaceRecovery} from './workspaceRecovery';
import {createSketchModelState,validateSketchModelState,validateSketchReferences,pruneSketchExtrusions,ownedSketchBodyIds} from '../sketch/model';
import type {SketchModelState} from '../sketch/types';
import {createExactModelState,validateExactModelState,type ExactModelState} from '../kernel/model';
import {useEffect,useState,useRef,type Dispatch,type SetStateAction} from 'react';
import {createDocument,parseDocument,serializeDocument,validateItems,validateSceneAnnotationReferences,type CadDocument,type CadItem} from '../documents/documentModel';
import {validateModelAnnotationState,type ModelAnnotationState} from '../modelAnnotations/model';
import {validateDrawingDocument} from '../drawing/model';
import {type DrawingDocument} from '../drawing/types';
import {type SelectionState} from '../selection/selectionModel';

type SceneSnapshot=Pick<CadDocument,'assemblyGroups'|'assemblyFixedMates'|'assemblyInstances'|'items'|'modelAnnotations'|'exactModel'|'sketchModel'>;
type EditorTab={document:CadDocument;saved:string|null;history:SceneSnapshot[];future:SceneSnapshot[];selection:SelectionState;drawingHistory:DrawingDocument[];drawingFuture:DrawingDocument[];drawingSelection:string[]};
type Workspace={tabs:EditorTab[];activeId:string;recoveryError:string|null;recoveryCanResume:boolean};
const fingerprint=(doc:CadDocument)=>JSON.stringify([doc.name,doc.items,doc.drawing,doc.modelAnnotations,doc.exactModel,doc.sketchModel,...(doc.assemblyInstances===undefined?[]:[doc.assemblyInstances]),...(doc.assemblyFixedMates===undefined?[]:[{assemblyFixedMates:doc.assemblyFixedMates}]),...(doc.assemblyGroups===undefined?[]:[{assemblyGroups:doc.assemblyGroups}])]);
const makeTab=(document:CadDocument,saved:string|null=null):EditorTab=>({document,saved,history:[],future:[],drawingHistory:[],drawingFuture:[],drawingSelection:[],selection:{selectedIds:[],anchorId:null}});

/** Upgrade old clean fingerprints while leaving old dirty tabs dirty. */
function restoreTab(raw:unknown,saved:unknown):EditorTab{
 const document=parseDocument(JSON.stringify(raw));
 let migratedSaved=typeof saved==='string'?saved:null;
 const version=(raw as {schemaVersion?:unknown})?.schemaVersion;
 if((version===1||version===2||version===3||version===4)&&typeof saved==='string'){
  try{const old=JSON.parse(saved);if(Array.isArray(old)&&old.length===(version===1?2:version===2?3:version===3?4:5))migratedSaved=JSON.stringify([...old,...(version===1?[document.drawing]:[]),...(version===1||version===2?[document.modelAnnotations]:[]),...(Number(version)<4?[createExactModelState()]:[]),createSketchModelState()]);}catch{/* Corrupt saved marker remains dirty. */}
 }
 return makeTab(document,migratedSaved);
}
function decodeWorkspace(raw:string):Workspace{
 const data=JSON.parse(raw);
 if(data.version!==1||!Array.isArray(data.tabs)||!data.tabs.length)throw Error('Unsupported workspace');
 const tabs:EditorTab[]=data.tabs.map((tab:{document:unknown;saved:unknown})=>restoreTab(tab.document,tab.saved));
 if(new Set(tabs.map(t=>t.document.id)).size!==tabs.length)throw Error('Duplicate document identifiers');
 return {tabs,activeId:tabs.some(t=>t.document.id===data.activeId)?data.activeId:tabs[0].document.id,recoveryError:null,recoveryCanResume:false};
}
function loadWorkspace(initial:()=>CadItem[]):Workspace{
 const recovered=(()=>{try{return readWorkspaceRecovery(localStorage,decodeWorkspace)}catch{return {status:'unrecoverable' as const,value:null}}})();
 if(recovered.status==='primary')return recovered.value;
 if(recovered.status==='backup')return {...recovered.value,recoveryCanResume:true,recoveryError:'Вкладки восстановлены из резервной записи. Автоматическое сохранение отключено, чтобы не перезаписать исходные данные. Экспортируйте восстановленные документы в JSON.'};
 if(recovered.status==='unrecoverable'){
  const document={...createDocument(crypto.randomUUID(),'Восстановленный документ'),items:initial()};
  return {tabs:[makeTab(document)],activeId:document.id,recoveryError:'Не удалось открыть сохранённые вкладки. Исходные данные сохранены в хранилище; автоматическое сохранение вкладок отключено.',recoveryCanResume:false};
 }
 const document={...createDocument(crypto.randomUUID(),'Редуктор.asm'),items:initial()};
 const tab=makeTab(document);tab.selection={selectedIds:document.items.some(i=>i.id==='gear2')?['gear2']:[],anchorId:document.items.some(i=>i.id==='gear2')?'gear2':null};
 return {tabs:[tab],activeId:document.id,recoveryError:null,recoveryCanResume:false};
}
/** Each tab retains its own scene, selection and undo stacks during the session. */
export function useEditorDocuments(initial:()=>CadItem[]){
 const [workspace,setWorkspace]=useState(()=>loadWorkspace(initial));
 const currentWorkspace=useRef(workspace);currentWorkspace.current=workspace;
 const active=workspace.tabs.find(t=>t.document.id===workspace.activeId)!;
 const updateActive=(update:(tab:EditorTab)=>EditorTab)=>setWorkspace(w=>({...w,tabs:w.tabs.map(t=>t.document.id===w.activeId?update(t):t)}));
 function setter<K extends 'selection'|'drawingSelection'>(key:K):Dispatch<SetStateAction<EditorTab[K]>>{
  return value=>updateActive(tab=>({...tab,[key]:typeof value==='function'?(value as (v:EditorTab[K])=>EditorTab[K])(tab[key]):value}));
 }

 const sceneSnapshot=(document:CadDocument):SceneSnapshot=>({assemblyGroups:document.assemblyGroups,assemblyFixedMates:document.assemblyFixedMates,assemblyInstances:document.assemblyInstances,items:document.items,modelAnnotations:document.modelAnnotations,exactModel:document.exactModel,sketchModel:document.sketchModel});
 const guardScene=(update:(tab:EditorTab)=>EditorTab)=>setWorkspace(workspace=>{
  if(workspace.activeId!==active.document.id)return workspace;
  const source=workspace.tabs.find(tab=>tab.document.id===active.document.id);
  if(!source||Object.keys(sceneSnapshot(active.document)).some(key=>source.document[key as keyof SceneSnapshot]!==active.document[key as keyof SceneSnapshot]))return workspace;
  const next=update(source);if(next===source)return workspace;
  return {...workspace,tabs:workspace.tabs.map(tab=>tab===source?next:tab)};
 });
 const assemblySources=(exact:ExactModelState,sketch:SketchModelState)=>new Set([...exact.bodies.map(body=>body.id),...ownedSketchBodyIds(sketch)]);
 const commitScene=(items:CadItem[],modelAnnotations:ModelAnnotationState,exactModel:ExactModelState=active.document.exactModel,sketchModel:SketchModelState=active.document.sketchModel,requested=active.document.assemblyInstances,requestedMates=active.document.assemblyFixedMates,assemblyGroups=active.document.assemblyGroups)=>{
  const sources=assemblySources(exactModel,sketchModel);
  let assemblyInstances=requested?.filter(instance=>sources.has(instance.sourceBodyId));
  let assemblyFixedMates=requestedMates;
  if(assemblyFixedMates!==undefined){
   if(assemblyFixedMates===active.document.assemblyFixedMates){
    const pruned=pruneAssemblyMates(active.document.assemblyInstances??[],assemblyInstances??[],active.document.assemblyGroups??[],assemblyFixedMates);
    assemblyInstances=assemblyInstances===undefined?undefined:pruned.placements;
    assemblyFixedMates=pruned.mates;
   }
   validateAssemblyMates(assemblyFixedMates);
  }
  resolveAssemblyHierarchy(assemblyInstances??[],assemblyGroups??[],assemblyFixedMates??[]);
  const snapshot={assemblyGroups,assemblyFixedMates,assemblyInstances,items,modelAnnotations,exactModel,sketchModel};
  guardScene(tab=> JSON.stringify(sceneSnapshot(tab.document))===JSON.stringify(snapshot) ? tab :
    {...tab,document:restoreScene(tab.document,snapshot),history:[...tab.history.slice(-49),sceneSnapshot(tab.document)],future:[]});
 };
 const setAssemblyInstances=(next:AssemblyInstance[])=>{
  const {items,modelAnnotations,exactModel,sketchModel,assemblyInstances,assemblyFixedMates}=active.document;
  const validated=validateAssemblyInstances(next,assemblySources(exactModel,sketchModel));
  const followers=new Set(assemblyFixedMates?.map(mate=>mate.followerId));
  const mated=new Set(assemblyFixedMates?.flatMap(mate=>[mate.leaderId,mate.followerId]));
  for(const instance of validated){
   const previous=assemblyInstances?.find(item=>item.id===instance.id);
   if(previous&&mated.has(instance.id)&&previous.parentId!==instance.parentId)throw Error('Сначала отсоедините сопряжение вхождения');
   if(previous&&followers.has(instance.id)&&JSON.stringify([previous.position,previous.rotation])!==JSON.stringify([instance.position,instance.rotation]))throw Error('Сначала отсоедините ведомое вхождение');
  }
  commitScene(items,modelAnnotations,exactModel,sketchModel,validated);
 };
 const setAssemblyGroups=(next:AssemblyGroup[])=>{
  const {items,modelAnnotations,exactModel,sketchModel,assemblyInstances,assemblyFixedMates}=active.document;
  commitScene(items,modelAnnotations,exactModel,sketchModel,assemblyInstances,assemblyFixedMates,validateAssemblyGroups(next));
 };
 const attachAssemblyMate=(leaderId:string,followerId:string,parameter?:MateParameter)=>{
  const {items,modelAnnotations,exactModel,sketchModel,assemblyInstances,assemblyFixedMates=[]}=active.document;
  const {world}=resolveAssemblyHierarchy(assemblyInstances??[],active.document.assemblyGroups??[],assemblyFixedMates);
  const createMate = parameter?.kind === 'angular' ? angularAssemblyMateFromPoses : distanceAssemblyMateFromPoses;
  const mate = parameter ? createMate(world,leaderId,followerId,parameter.value) : fixedAssemblyMateFromPoses(world,leaderId,followerId);
  commitScene(items,modelAnnotations,exactModel,sketchModel,assemblyInstances,[...assemblyFixedMates,mate]);
 };
 const setAssemblyMateParameter=(followerId:string,parameter:MateParameter)=>{
  const {items,modelAnnotations,exactModel,sketchModel,assemblyInstances,assemblyFixedMates=[]}=active.document;
  const mate = assemblyFixedMates.find(item => item.followerId === followerId);
  if (!mate) throw Error('Сопряжение не найдено');
  const changed = parameter.kind === 'angular' && 'angle' in mate ? {...mate,angle:parameter.value}
    : parameter.kind === 'distance' && 'distance' in mate ? {...mate,distance:parameter.value} : undefined;
  if (!changed) throw Error('Неверный параметр сопряжения');
  commitScene(items,modelAnnotations,exactModel,sketchModel,assemblyInstances,assemblyFixedMates.map(item => item === mate ? changed : item));
 };
 const detachAssemblyMate=(followerId:string)=>{
  const {items,modelAnnotations,exactModel,sketchModel,assemblyInstances,assemblyFixedMates=[]}=active.document;
  if(!assemblyInstances||!assemblyFixedMates.some(mate=>mate.followerId===followerId))throw Error('Сопряжение не найдено');
  const {world}=resolveAssemblyHierarchy(assemblyInstances,active.document.assemblyGroups??[],assemblyFixedMates);
  const instances=assemblyInstances.map(instance=>instance.id===followerId?detachAssemblyInstance(instance,world):instance);
  commitScene(items,modelAnnotations,exactModel,sketchModel,instances,assemblyFixedMates.filter(mate=>mate.followerId!==followerId));
 };
 const changeScene=(nextItems:CadItem[],_label?:string)=>{
  const items=validateItems(nextItems);validateSceneAnnotationReferences(items,active.document.modelAnnotations);commitScene(items,active.document.modelAnnotations);
 };
 const setModelAnnotations=(next:ModelAnnotationState,_label?:string)=>{
  const annotations=validateModelAnnotationState(next);validateSceneAnnotationReferences(active.document.items,annotations);commitScene(active.document.items,annotations);
 };
 const setSketchModel=(next:SketchModelState,nextExact:ExactModelState,_label?:string)=>{
  const sketch=validateSketchModelState(next),exact=validateExactModelState(nextExact);
  const oldOwned=new Set(ownedSketchBodyIds(active.document.sketchModel));
  const existing=new Set(active.document.exactModel.bodies.map(body=>body.id));
  for(const bodyId of ownedSketchBodyIds(sketch))if(existing.has(bodyId)&&!oldOwned.has(bodyId))throw Error('Идентификатор результата занят независимым телом');
  validateSketchReferences(sketch,exact);commitScene(active.document.items,active.document.modelAnnotations,exact,sketch);
 };
 const bodyDependencies=(state:SketchModelState)=>[
  ...(state.cuts??[]).map(feature=>({id:feature.id,inputs:[feature.targetBodyId]})),
  ...[...(state.fusions??[]),...(state.bodyBooleans??[])].map(feature=>({id:feature.id,inputs:[feature.aBodyId,feature.bBodyId]}))
 ];
 const setExactModel=(next:ExactModelState,_label?:string)=>{
  let exact=validateExactModelState(next);
  const remaining=new Set(exact.bodies.map(body=>body.id));
  const owned=new Set(ownedSketchBodyIds(active.document.sketchModel));
  const targets=new Set(bodyDependencies(active.document.sketchModel).flatMap(feature=>feature.inputs));
  for(const body of exact.bodies){
   const previous=active.document.exactModel.bodies.find(old=>old.id===body.id);
   if((owned.has(body.id)||targets.has(body.id))&&previous&&previous.brep!==body.brep)throw Error('Тело связано с эскизом: используйте перестроение эскиза (setSketchModel)');
  }
  const removed=active.document.exactModel.bodies.filter(body=>!remaining.has(body.id)).map(body=>body.id);
  const sketch=pruneSketchExtrusions(active.document.sketchModel,removed);
  const retainedOwned=new Set(ownedSketchBodyIds(sketch));
  const retainedFeatures=new Set(bodyDependencies(sketch).map(feature=>feature.id));
  const suppressed=new Set(sketch.suppressedFeatures?.map(record=>record.featureId));
  const previouslySuppressed=new Set(active.document.sketchModel.suppressedFeatures?.map(record=>record.featureId));
  const consumedTargets=new Set(bodyDependencies(sketch).filter(feature=>!suppressed.has(feature.id)).flatMap(feature=>feature.inputs));
  const revealTargets=new Set(bodyDependencies(active.document.sketchModel).filter(feature=>!previouslySuppressed.has(feature.id)&&!retainedFeatures.has(feature.id)).flatMap(feature=>feature.inputs).filter(id=>!consumedTargets.has(id)));
  exact={...exact,bodies:exact.bodies.filter(body=>!owned.has(body.id)||retainedOwned.has(body.id)).map(body=>revealTargets.has(body.id)?{...body,visible:true}:body)};
  validateSketchReferences(sketch,exact);commitScene(active.document.items,active.document.modelAnnotations,exact,sketch);
 };
 // Compatibility for old split-history scene callers. New code uses changeScene/modelUndo/modelRedo.
 const setItems:Dispatch<SetStateAction<CadItem[]>>=value=>{
  const items=validateItems(typeof value==='function'?value(active.document.items):value);
  validateSceneAnnotationReferences(items,active.document.modelAnnotations);
  guardScene(tab=>({...tab,document:{...tab.document,items,modifiedAt:new Date().toISOString()}}));
 };
 function legacyHistorySetter(key:'history'|'future'):Dispatch<SetStateAction<CadItem[][]>>{
  return value=>guardScene(tab=>{
   const old=tab[key].map(snapshot=>snapshot.items);
   const items=typeof value==='function'?value(old):value;
   const snapshots=items.map(list=>tab[key].find(snapshot=>snapshot.items===list)??{...sceneSnapshot(tab.document),items:validateItems(list)});
   return {...tab,[key]:snapshots};
  });
 }
 const restoreScene=(document:CadDocument,snapshot:SceneSnapshot):CadDocument=>{
  const {assemblyGroups: _oldGroups,assemblyInstances: _oldInstances,assemblyFixedMates: _oldMates,...previous}=document;
  const {assemblyGroups,assemblyInstances,assemblyFixedMates,...replacement}=snapshot;
  return {...previous,...replacement,...(assemblyGroups===undefined?{}:{assemblyGroups}),...(assemblyInstances===undefined?{}:{assemblyInstances}),...(assemblyFixedMates===undefined?{}:{assemblyFixedMates}),modifiedAt:new Date().toISOString()};
 };
 const modelUndo=()=>guardScene(tab=>{
  const previous=tab.history.at(-1);if(!previous)return tab;
  return {...tab,document:restoreScene(tab.document,previous),history:tab.history.slice(0,-1),future:[...tab.future,sceneSnapshot(tab.document)],selection:{selectedIds:[],anchorId:null}};
 });
 const modelRedo=()=>guardScene(tab=>{
  const next=tab.future.at(-1);if(!next)return tab;
  return {...tab,document:restoreScene(tab.document,next),history:[...tab.history,sceneSnapshot(tab.document)],future:tab.future.slice(0,-1),selection:{selectedIds:[],anchorId:null}};
 });

 const setDrawing=(next:DrawingDocument,_label?:string)=>{
  // Validate before entering React's updater: errors leave history and autosave untouched.
  const drawing=validateDrawingDocument(next);
  const sourceId=active.document.id;
  const sourceDrawing=active.document.drawing;
  setWorkspace(workspace=>{
   // A delayed import must never target a newly active tab or overwrite newer work.
   if(workspace.activeId!==sourceId)return workspace;
   const source=workspace.tabs.find(tab=>tab.document.id===sourceId);
   if(!source||source.document.drawing!==sourceDrawing)return workspace;
   if(JSON.stringify(sourceDrawing)===JSON.stringify(drawing))return workspace;
   return {...workspace,tabs:workspace.tabs.map(tab=>tab.document.id!==sourceId?tab:{...tab,
    document:{...tab.document,drawing,modifiedAt:new Date().toISOString()},
    drawingHistory:[...tab.drawingHistory.slice(-49),sourceDrawing],drawingFuture:[]})};
  });
 };
 const drawingUndo=()=>updateActive(tab=>{
  const drawing=tab.drawingHistory.at(-1);if(!drawing)return tab;
  return {...tab,document:{...tab.document,drawing,modifiedAt:new Date().toISOString()},drawingHistory:tab.drawingHistory.slice(0,-1),drawingFuture:[...tab.drawingFuture,tab.document.drawing],drawingSelection:[]};
 });
 const drawingRedo=()=>updateActive(tab=>{
  const drawing=tab.drawingFuture.at(-1);if(!drawing)return tab;
  return {...tab,document:{...tab.document,drawing,modifiedAt:new Date().toISOString()},drawingHistory:[...tab.drawingHistory,tab.document.drawing],drawingFuture:tab.drawingFuture.slice(0,-1),drawingSelection:[]};
 });
 const resumeRecovery=()=>{
  const source=currentWorkspace.current;if(!source.recoveryCanResume||!source.recoveryError)return;
  try{
   resumeWorkspaceRecovery(localStorage,JSON.stringify({version:1,activeId:source.activeId,tabs:source.tabs.map(t=>({document:t.document,saved:t.saved}))}),decodeWorkspace);
   setWorkspace(current=>current===source?{...current,recoveryError:null,recoveryCanResume:false}:current);
  }catch(error){
   const detail=error instanceof Error?error.message:'Не удалось прочитать или сохранить архив исходных данных.';
   setWorkspace(current=>current===source?{...current,recoveryError:'Автосохранение не возобновлено. '+detail}:current);
  }
 };
 const isDirty=(tab:EditorTab)=>tab.saved!==fingerprint(tab.document);
 const dirty=workspace.tabs.some(isDirty);
 useEffect(()=>{
  if(workspace.recoveryError)return;
  try{saveWorkspaceRecovery(localStorage,JSON.stringify({version:1,activeId:workspace.activeId,tabs:workspace.tabs.map(t=>({document:t.document,saved:t.saved}))}),decodeWorkspace);}catch{setWorkspace(w=>({...w,recoveryError:'Автоматическое сохранение недоступно. Экспортируйте документы в JSON.'}))}
 },[workspace]);
 useEffect(()=>{if(!dirty)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue=''};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[dirty]);
 const activate=(id:string)=>setWorkspace(w=>w.tabs.some(t=>t.document.id===id)?{...w,activeId:id}:w);
 const open=(document:CadDocument,saved=true)=>setWorkspace(w=>{
  // Importing the same file must never replace an existing dirty tab.
  const unique=w.tabs.some(t=>t.document.id===document.id)?{...document,id:crypto.randomUUID()}:document;
  return {...w,tabs:[...w.tabs,makeTab(unique,saved?fingerprint(unique):null)],activeId:unique.id};
 });
 const newDocument=()=>open(createDocument(crypto.randomUUID(),'Без имени'),false);
 const close=(id:string)=>setWorkspace(w=>{
  const index=w.tabs.findIndex(t=>t.document.id===id);if(index<0)return w;
  const tabs=w.tabs.filter(t=>t.document.id!==id);
  if(!tabs.length){const doc=createDocument(crypto.randomUUID(),'Без имени');tabs.push(makeTab(doc));}
  return {...w,tabs,activeId:w.activeId===id?tabs[Math.min(index,tabs.length-1)].document.id:w.activeId};
 });
 const exportDocument=()=>({id:active.document.id,json:serializeDocument(active.document),fingerprint:fingerprint(active.document)});
 const markSaved=(snapshot:{id:string;fingerprint:string})=>setWorkspace(w=>({...w,tabs:w.tabs.map(t=>t.document.id===snapshot.id?{...t,saved:snapshot.fingerprint}:t)}));
 return {assemblyGroups:active.document.assemblyGroups,setAssemblyGroups,assemblyInstances:active.document.assemblyInstances,assemblyFixedMates:active.document.assemblyFixedMates,attachAssemblyMate,setAssemblyMateParameter,detachAssemblyMate,setAssemblyInstances,sketchModel:active.document.sketchModel,setSketchModel,exactModel:active.document.exactModel,setExactModel,modelAnnotations:active.document.modelAnnotations,setModelAnnotations,changeScene,modelUndo,modelRedo,modelHistoryCount:active.history.length,modelFutureCount:active.future.length,drawing:active.document.drawing,setDrawing,drawingUndo,drawingRedo,drawingHistoryCount:active.drawingHistory.length,drawingFutureCount:active.drawingFuture.length,drawingSelection:active.drawingSelection,setDrawingSelection:setter('drawingSelection'),items:active.document.items,setItems,history:active.history.map(snapshot=>snapshot.items),setHistory:legacyHistorySetter('history'),future:active.future.map(snapshot=>snapshot.items),setFuture:legacyHistorySetter('future'),selection:active.selection,setSelection:setter('selection'),tabs:workspace.tabs.map(t=>({id:t.document.id,name:t.document.name,dirty:isDirty(t)})),activeId:workspace.activeId,document:active.document,recoveryError:workspace.recoveryError,recoveryCanResume:workspace.recoveryCanResume,resumeRecovery,activate,open,newDocument,close,exportDocument,markSaved};
}
