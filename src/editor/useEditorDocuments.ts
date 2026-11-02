import {useEffect,useState,type Dispatch,type SetStateAction} from 'react';
import {createDocument,parseDocument,serializeDocument,type CadDocument,type CadItem} from '../documents/documentModel';
import {type SelectionState} from '../selection/selectionModel';

type EditorTab={document:CadDocument;saved:string|null;history:CadItem[][];future:CadItem[][];selection:SelectionState};
type Workspace={tabs:EditorTab[];activeId:string;recoveryError:string|null};
const KEY='bendcore-documents-v1';
const fingerprint=(doc:CadDocument)=>JSON.stringify([doc.name,doc.items]);
const makeTab=(document:CadDocument,saved:string|null=null):EditorTab=>({document,saved,history:[],future:[],selection:{selectedIds:[],anchorId:null}});
function loadWorkspace(initial:()=>CadItem[]):Workspace{
 try{
  const raw=localStorage.getItem(KEY);
  if(raw){
   const data=JSON.parse(raw);
   if(data.version!==1||!Array.isArray(data.tabs)||!data.tabs.length)throw Error('Unsupported workspace');
   const tabs:EditorTab[]=data.tabs.map((tab:{document:unknown;saved:unknown})=>makeTab(parseDocument(JSON.stringify(tab.document)),typeof tab.saved==='string'?tab.saved:null));
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
 function setter<K extends 'history'|'future'|'selection'>(key:K):Dispatch<SetStateAction<EditorTab[K]>>{
  return value=>updateActive(tab=>({...tab,[key]:typeof value==='function'?(value as (v:EditorTab[K])=>EditorTab[K])(tab[key]):value}));
 }
 const setItems:Dispatch<SetStateAction<CadItem[]>>=value=>updateActive(tab=>({...tab,document:{...tab.document,modifiedAt:new Date().toISOString(),items:typeof value==='function'?value(tab.document.items):value}}));
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
 return {items:active.document.items,setItems,history:active.history,setHistory:setter('history'),future:active.future,setFuture:setter('future'),selection:active.selection,setSelection:setter('selection'),tabs:workspace.tabs.map(t=>({id:t.document.id,name:t.document.name,dirty:isDirty(t)})),activeId:workspace.activeId,document:active.document,recoveryError:workspace.recoveryError,activate,open,newDocument,close,exportDocument,markSaved};
}
