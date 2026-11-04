import {useEffect,useState,type Dispatch,type SetStateAction} from 'react';
import {createDocument,parseDocument,serializeDocument,validateItems,validateSceneAnnotationReferences,type CadDocument,type CadItem} from '../documents/documentModel';
import {validateModelAnnotationState,type ModelAnnotationState} from '../modelAnnotations/model';
import {validateDrawingDocument} from '../drawing/model';
import {type DrawingDocument} from '../drawing/types';
import {type SelectionState} from '../selection/selectionModel';

type SceneSnapshot={items:CadItem[];modelAnnotations:ModelAnnotationState};
type EditorTab={document:CadDocument;saved:string|null;history:SceneSnapshot[];future:SceneSnapshot[];selection:SelectionState;drawingHistory:DrawingDocument[];drawingFuture:DrawingDocument[];drawingSelection:string[]};
type Workspace={tabs:EditorTab[];activeId:string;recoveryError:string|null};
const KEY='bendcore-documents-v1';
const fingerprint=(doc:CadDocument)=>JSON.stringify([doc.name,doc.items,doc.drawing,doc.modelAnnotations]);
const makeTab=(document:CadDocument,saved:string|null=null):EditorTab=>({document,saved,history:[],future:[],drawingHistory:[],drawingFuture:[],drawingSelection:[],selection:{selectedIds:[],anchorId:null}});

/** Upgrade old clean fingerprints while leaving old dirty tabs dirty. */
function restoreTab(raw:unknown,saved:unknown):EditorTab{
 const document=parseDocument(JSON.stringify(raw));
 let migratedSaved=typeof saved==='string'?saved:null;
 const version=(raw as {schemaVersion?:unknown})?.schemaVersion;
 if((version===1||version===2)&&typeof saved==='string'){
  try{const old=JSON.parse(saved);if(Array.isArray(old)&&old.length===(version===1?2:3))migratedSaved=JSON.stringify(version===1?[...old,document.drawing,document.modelAnnotations]:[...old,document.modelAnnotations]);}catch{/* Corrupt saved marker remains dirty. */}
 }
 return makeTab(document,migratedSaved);
}
function loadWorkspace(initial:()=>CadItem[]):Workspace{
 try{
  const raw=localStorage.getItem(KEY);
  if(raw){
   const data=JSON.parse(raw);
   if(data.version!==1||!Array.isArray(data.tabs)||!data.tabs.length)throw Error('Unsupported workspace');
   const tabs:EditorTab[]=data.tabs.map((tab:{document:unknown;saved:unknown})=>restoreTab(tab.document,tab.saved));
   if(new Set(tabs.map(t=>t.document.id)).size!==tabs.length)throw Error('Duplicate document identifiers');
   return {tabs,activeId:tabs.some(t=>t.document.id===data.activeId)?data.activeId:tabs[0].document.id,recoveryError:null};
  }
 }catch{
  const document={...createDocument(crypto.randomUUID(),'Восстановленный документ'),items:initial()};
  return {tabs:[makeTab(document)],activeId:document.id,recoveryError:'Не удалось открыть сохранённые вкладки. Исходные данные сохранены в хранилище; автоматическое сохранение вкладок отключено.'};
 }
 const document={...createDocument(crypto.randomUUID(),'Редуктор.asm'),items:initial()};
 const tab=makeTab(document);tab.selection={selectedIds:document.items.some(i=>i.id==='gear2')?['gear2']:[],anchorId:document.items.some(i=>i.id==='gear2')?'gear2':null};
 return {tabs:[tab],activeId:document.id,recoveryError:null};
}
/** Each tab retains its own scene, selection and undo stacks during the session. */
export function useEditorDocuments(initial:()=>CadItem[]){
 const [workspace,setWorkspace]=useState(()=>loadWorkspace(initial));
 const active=workspace.tabs.find(t=>t.document.id===workspace.activeId)!;
 const updateActive=(update:(tab:EditorTab)=>EditorTab)=>setWorkspace(w=>({...w,tabs:w.tabs.map(t=>t.document.id===w.activeId?update(t):t)}));
 function setter<K extends 'selection'|'drawingSelection'>(key:K):Dispatch<SetStateAction<EditorTab[K]>>{
  return value=>updateActive(tab=>({...tab,[key]:typeof value==='function'?(value as (v:EditorTab[K])=>EditorTab[K])(tab[key]):value}));
 }

 const sceneSnapshot=(document:CadDocument):SceneSnapshot=>({items:document.items,modelAnnotations:document.modelAnnotations});
 const guardScene=(update:(tab:EditorTab)=>EditorTab)=>setWorkspace(workspace=>{
  if(workspace.activeId!==active.document.id)return workspace;
  const source=workspace.tabs.find(tab=>tab.document.id===active.document.id);
  if(!source||source.document.items!==active.document.items||source.document.modelAnnotations!==active.document.modelAnnotations)return workspace;
  const next=update(source);if(next===source)return workspace;
  return {...workspace,tabs:workspace.tabs.map(tab=>tab===source?next:tab)};
 });
 const commitScene=(items:CadItem[],modelAnnotations:ModelAnnotationState)=>guardScene(tab=>{
  if(JSON.stringify([tab.document.items,tab.document.modelAnnotations])===JSON.stringify([items,modelAnnotations]))return tab;
  return {...tab,document:{...tab.document,items,modelAnnotations,modifiedAt:new Date().toISOString()},history:[...tab.history.slice(-49),sceneSnapshot(tab.document)],future:[]};
 });
 const changeScene=(nextItems:CadItem[],_label?:string)=>{
  const items=validateItems(nextItems);validateSceneAnnotationReferences(items,active.document.modelAnnotations);commitScene(items,active.document.modelAnnotations);
 };
 const setModelAnnotations=(next:ModelAnnotationState,_label?:string)=>{
  const annotations=validateModelAnnotationState(next);validateSceneAnnotationReferences(active.document.items,annotations);commitScene(active.document.items,annotations);
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
   const snapshots=items.map(list=>tab[key].find(snapshot=>snapshot.items===list)??{items:validateItems(list),modelAnnotations:tab.document.modelAnnotations});
   return {...tab,[key]:snapshots};
  });
 }
 const modelUndo=()=>guardScene(tab=>{
  const previous=tab.history.at(-1);if(!previous)return tab;
  return {...tab,document:{...tab.document,...previous,modifiedAt:new Date().toISOString()},history:tab.history.slice(0,-1),future:[...tab.future,sceneSnapshot(tab.document)],selection:{selectedIds:[],anchorId:null}};
 });
 const modelRedo=()=>guardScene(tab=>{
  const next=tab.future.at(-1);if(!next)return tab;
  return {...tab,document:{...tab.document,...next,modifiedAt:new Date().toISOString()},history:[...tab.history,sceneSnapshot(tab.document)],future:tab.future.slice(0,-1),selection:{selectedIds:[],anchorId:null}};
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
 const isDirty=(tab:EditorTab)=>tab.saved!==fingerprint(tab.document);
 const dirty=workspace.tabs.some(isDirty);
 useEffect(()=>{
  if(workspace.recoveryError)return;
  try{localStorage.setItem(KEY,JSON.stringify({version:1,activeId:workspace.activeId,tabs:workspace.tabs.map(t=>({document:t.document,saved:t.saved}))}));}catch{setWorkspace(w=>({...w,recoveryError:'Автоматическое сохранение недоступно. Экспортируйте документы в JSON.'}))}
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
 return {modelAnnotations:active.document.modelAnnotations,setModelAnnotations,changeScene,modelUndo,modelRedo,modelHistoryCount:active.history.length,modelFutureCount:active.future.length,drawing:active.document.drawing,setDrawing,drawingUndo,drawingRedo,drawingHistoryCount:active.drawingHistory.length,drawingFutureCount:active.drawingFuture.length,drawingSelection:active.drawingSelection,setDrawingSelection:setter('drawingSelection'),items:active.document.items,setItems,history:active.history.map(snapshot=>snapshot.items),setHistory:legacyHistorySetter('history'),future:active.future.map(snapshot=>snapshot.items),setFuture:legacyHistorySetter('future'),selection:active.selection,setSelection:setter('selection'),tabs:workspace.tabs.map(t=>({id:t.document.id,name:t.document.name,dirty:isDirty(t)})),activeId:workspace.activeId,document:active.document,recoveryError:workspace.recoveryError,activate,open,newDocument,close,exportDocument,markSaved};
}
