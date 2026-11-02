import {useEffect,useState,type Dispatch,type SetStateAction} from 'react';
import {createDocument,parseDocument,serializeDocument,type CadDocument,type CadItem} from '../documents/documentModel';
import {validateDrawingDocument} from '../drawing/model';
import {type DrawingDocument} from '../drawing/types';
import {type SelectionState} from '../selection/selectionModel';

type EditorTab={document:CadDocument;saved:string|null;history:CadItem[][];future:CadItem[][];selection:SelectionState;drawingHistory:DrawingDocument[];drawingFuture:DrawingDocument[];drawingSelection:string[]};
type Workspace={tabs:EditorTab[];activeId:string;recoveryError:string|null};
const KEY='bendcore-documents-v1';
const fingerprint=(doc:CadDocument)=>JSON.stringify([doc.name,doc.items,doc.drawing]);
const makeTab=(document:CadDocument,saved:string|null=null):EditorTab=>({document,saved,history:[],future:[],drawingHistory:[],drawingFuture:[],drawingSelection:[],selection:{selectedIds:[],anchorId:null}});

/** Upgrade old clean fingerprints while leaving old dirty tabs dirty. */
function restoreTab(raw:unknown,saved:unknown):EditorTab{
 const document=parseDocument(JSON.stringify(raw));
 let migratedSaved=typeof saved==='string'?saved:null;
 if((raw as {schemaVersion?:unknown})?.schemaVersion===1&&typeof saved==='string'){
  try{const old=JSON.parse(saved);if(Array.isArray(old)&&old.length===2)migratedSaved=JSON.stringify([...old,document.drawing]);}catch{/* Corrupt saved marker remains dirty. */}
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
 function setter<K extends 'history'|'future'|'selection'|'drawingSelection'>(key:K):Dispatch<SetStateAction<EditorTab[K]>>{
  return value=>updateActive(tab=>({...tab,[key]:typeof value==='function'?(value as (v:EditorTab[K])=>EditorTab[K])(tab[key]):value}));
 }
 const setItems:Dispatch<SetStateAction<CadItem[]>>=value=>updateActive(tab=>({...tab,document:{...tab.document,modifiedAt:new Date().toISOString(),items:typeof value==='function'?value(tab.document.items):value}}));

 const setDrawing=(next:DrawingDocument,_label?:string)=>{
  // Validate before entering React's updater: errors leave history and autosave untouched.
  const drawing=validateDrawingDocument(next);
  updateActive(tab=>JSON.stringify(tab.document.drawing)===JSON.stringify(drawing)?tab:{...tab,
   document:{...tab.document,drawing,modifiedAt:new Date().toISOString()},
   drawingHistory:[...tab.drawingHistory.slice(-49),tab.document.drawing],drawingFuture:[]});
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
 return {drawing:active.document.drawing,setDrawing,drawingUndo,drawingRedo,drawingHistoryCount:active.drawingHistory.length,drawingFutureCount:active.drawingFuture.length,drawingSelection:active.drawingSelection,setDrawingSelection:setter('drawingSelection'),items:active.document.items,setItems,history:active.history,setHistory:setter('history'),future:active.future,setFuture:setter('future'),selection:active.selection,setSelection:setter('selection'),tabs:workspace.tabs.map(t=>({id:t.document.id,name:t.document.name,dirty:isDirty(t)})),activeId:workspace.activeId,document:active.document,recoveryError:workspace.recoveryError,activate,open,newDocument,close,exportDocument,markSaved};
}
