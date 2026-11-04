import {useEffect,useId,useRef,useState,type ReactNode} from 'react';
import type {CadItem} from '../documents/documentModel';
import {Dialog,ParameterField,validateNumber} from '../components/dialog';
import {TechnicalIcon,type TechnicalIconKind} from '../components/icons/TechnicalIcon';
import {createModelAnnotation,resolveModelAnnotation,upsertModelAnnotation,removeModelAnnotations,validateModelAnnotationState,type ModelAnnotation,type ModelAnnotationState,type Vec3} from './model';
import './modelAnnotations.css';

export interface ModelAnnotationPanelProps {
 state:ModelAnnotationState;
 items:CadItem[];
 selectedId:string|null;
 onSelect:(id:string|null)=>void;
 onChange:(state:ModelAnnotationState)=>void;
 selectedComponentId?:string|null;
 createRequest?:number;
}
type Session={draft:ModelAnnotation;baseState:string;baseItems:string};
const copy=<T,>(value:T):T=>structuredClone(value);
const fingerprint=(value:unknown)=>JSON.stringify(value);
export const modelAnnotationDraftIsStale=(baseState:string,baseItems:string,state:ModelAnnotationState,items:CadItem[])=>baseState!==fingerprint(state)||baseItems!==fingerprint(items);

function Field({label,icon='profile',children,help}:{label:string;icon?:TechnicalIconKind;children:(id:string)=>ReactNode;help?:string}){
 const id=useId();return <div className="model-note-field"><label htmlFor={id} title={help}><span aria-hidden="true"><TechnicalIcon kind={icon} size={18}/></span>{label}</label>{children(id)}{help&&<small>{help}</small>}</div>;
}

export function ModelAnnotationPanel({state,items,selectedId,onSelect,onChange,selectedComponentId,createRequest=0}:ModelAnnotationPanelProps){
 const [session,setSession]=useState<Session|null>(null);
 const [raw,setRaw]=useState<Record<string,string>>({});
 const [failure,setFailure]=useState<string|null>(null);
 const requestSeen=useRef(0);
 const selected=state.annotations.find(annotation=>annotation.id===selectedId);
 const open=(annotation:ModelAnnotation)=>{setSession({draft:copy(annotation),baseState:fingerprint(state),baseItems:fingerprint(items)});setRaw({});setFailure(null);};
 const create=()=>open(createModelAnnotation(crypto.randomUUID(),selectedComponentId&&items.some(item=>item.id===selectedComponentId)?selectedComponentId:undefined));
 useEffect(()=>{
  if(createRequest!==requestSeen.current){requestSeen.current=createRequest;if(createRequest>0)create();}
  // Requests are a caller-owned event counter; state updates must not reopen it.
 },[createRequest]);
 const patch=<K extends keyof ModelAnnotation,>(key:K,value:ModelAnnotation[K])=>{setSession(previous=>previous?{...previous,draft:{...previous.draft,[key]:value}}:null);setFailure(null);};
 const edit=()=>{if(selected)open(selected);};
 const duplicate=()=>{
  if(!selected)return;
  try{const annotation={...copy(selected),id:crypto.randomUUID(),text:`${selected.text} (копия)`};const next=upsertModelAnnotation(state,annotation);onChange(next);onSelect(annotation.id);setFailure(null);}catch(error){setFailure(error instanceof Error?error.message:String(error));}
 };
 const remove=()=>{if(selected){try{onChange(removeModelAnnotations(state,[selected.id]));onSelect(null);setFailure(null);}catch(error){setFailure(error instanceof Error?error.message:String(error));}}};
 const visibility=(annotation:ModelAnnotation,visible:boolean)=>{
  try{onChange(upsertModelAnnotation(state,{...copy(annotation),visible}));setFailure(null);}catch(error){setFailure(error instanceof Error?error.message:String(error));}
 };
 const stale=Boolean(session&&modelAnnotationDraftIsStale(session.baseState,session.baseItems,state,items));
 const draft=session?.draft;
 const errors:string[]=[];
 const numberField=(key:string,label:string,value:number,change:(value:number)=>void,min?:number,max?:number)=>{
  const valueText=raw[key]??String(value),error=validateNumber(valueText,{min,max});if(error)errors.push(`${label}: ${error}`);
  return <ParameterField key={key} label={label} icon="length" value={valueText} unit="ед. сцены" error={error} onChange={next=>{setRaw(previous=>({...previous,[key]:next}));if(!validateNumber(next,{min,max}))change(Number(next));}}/>;
 };
 const setVector=(kind:'anchor'|'offset',axis:number,value:number)=>{
  if(!draft)return;
  const point=[...(kind==='anchor'?draft.anchor.point:draft.offset)] as Vec3;point[axis]=value;
  if(kind==='anchor')patch('anchor',{...draft.anchor,point});else patch('offset',point);
 };
 let content:ReactNode;
 if(draft){
  const componentId=draft.anchor.kind==='component'?draft.anchor.componentId:'';
  if(!draft.text.trim())errors.push('Введите текст заметки');
  if(draft.text.length>10000)errors.push('Текст заметки не должен превышать 10 000 символов');
  if(!/^#[\da-f]{6}$/i.test(draft.color))errors.push('Укажите цвет в формате #RRGGBB');
  if(draft.anchor.kind==='component'&&!draft.anchor.componentId)errors.push('Выберите компонент для опоры');
  content=<>
   <Field label="Текст заметки" help="Многострочная текстовая заметка; не семантический размер или PMI.">{id=><textarea id={id} rows={4} value={draft.text} aria-invalid={!draft.text.trim()} onChange={event=>patch('text',event.target.value)}/>}</Field>
   <fieldset><legend>Опора заметки</legend>
    <Field label="Опора" icon="direction">{id=><select id={id} value={draft.anchor.kind} onChange={event=>{
     if(event.target.value==='world')patch('anchor',{kind:'world',point:[...draft.anchor.point] as Vec3});
     else patch('anchor',{kind:'component',componentId:selectedComponentId&&items.some(item=>item.id===selectedComponentId)?selectedComponentId:items[0]?.id??'',point:[...draft.anchor.point] as Vec3});
    }}><option value="world">Мировые координаты</option><option value="component">Компонент</option></select>}</Field>
    {draft.anchor.kind==='component'&&<Field label="Компонент" icon="profile">{id=><select id={id} value={componentId} onChange={event=>patch('anchor',{kind:'component',componentId:event.target.value,point:[...draft.anchor.point] as Vec3})}>
     <option value="">Выберите компонент</option>{!items.some(item=>item.id===componentId)&&componentId&&<option value={componentId}>Отсутствует: {componentId}</option>}{items.map(item=><option key={item.id} value={item.id}>{item.name}{item.visible?'':' (скрыт)'}</option>)}
    </select>}</Field>}
    <p>{draft.anchor.kind==='component'?'Координаты опоры локальны к компоненту: к ним добавляется его положение. Размеры компонента не масштабируют опору.':'Координаты опоры заданы в мировом пространстве.'}</p>
    <div className="model-note-grid">{(['X','Y','Z'] as const).map((axis,index)=>numberField(`anchor.${axis}`,`${axis} опоры`,draft.anchor.point[index],value=>setVector('anchor',index,value)))}</div>
   </fieldset>
   <fieldset><legend>Положение и оформление подписи</legend>
    <p>Смещение подписи задано в мировых условных единицах сцены относительно опоры.</p>
    <div className="model-note-grid">{(['X','Y','Z'] as const).map((axis,index)=>numberField(`offset.${axis}`,`Смещение подписи ${axis}`,draft.offset[index],value=>setVector('offset',index,value)))}</div>
    <Field label="Ориентация" icon="direction">{id=><select id={id} value={draft.orientation} onChange={event=>patch('orientation',event.target.value as ModelAnnotation['orientation'])}>
     <option value="screen">Лицом к камере</option><option value="XY">Плоскость XY</option><option value="XZ">Плоскость XZ</option><option value="YZ">Плоскость YZ</option>
    </select>}</Field>
    <small>Ориентация к камере сохраняет размер в единицах сцены; это не неподвижная экранная панель.</small>
    {numberField('fontSize','Размер шрифта',draft.fontSize,value=>patch('fontSize',value),.05,2)}
    <Field label="Цвет заметки" icon="material">{id=><input id={id} type="color" value={draft.color} onChange={event=>patch('color',event.target.value)}/>}</Field>
    <Field label="Показывать заметку" icon="preview">{id=><input id={id} type="checkbox" checked={draft.visible} onChange={event=>patch('visible',event.target.checked)}/>}</Field>
    <Field label="Выноска" icon="direction">{id=><input id={id} type="checkbox" checked={draft.leader} onChange={event=>patch('leader',event.target.checked)}/>}</Field>
   </fieldset>
  </>;
  try{validateModelAnnotationState({version:1,annotations:[draft]});}catch(error){errors.push(error instanceof Error?error.message:String(error));}
  try{resolveModelAnnotation(draft,items);}catch(error){errors.push(error instanceof Error?error.message:String(error));}
 }
 const save=(close:boolean)=>{
  if(!session||errors.length||stale)return;
  // Recheck the snapshot at the commit boundary as well as while rendering.
  if(modelAnnotationDraftIsStale(session.baseState,session.baseItems,state,items))return;
  try{
   const next=upsertModelAnnotation(state,copy(session.draft));validateModelAnnotationState(next);
   onChange(next);onSelect(session.draft.id);setFailure(null);
   if(close){setSession(null);setRaw({});}
   else setSession({draft:copy(session.draft),baseState:fingerprint(next),baseItems:fingerprint(items)});
  }catch(error){setFailure(error instanceof Error?error.message:String(error));}
 };
 return <section className="model-annotation-panel" role="region" aria-label="Аннотации модели">
  <h3>Аннотации модели</h3>
  <div className="model-note-actions">
   <button type="button" onClick={create}><span aria-hidden="true"><TechnicalIcon kind="profile" size={18}/></span>Добавить 3D-заметку</button>
   <button type="button" disabled={!selected} onClick={edit}>Редактировать заметку</button>
   <button type="button" disabled={!selected} onClick={duplicate}>Дублировать заметку</button>
   <button type="button" disabled={!selected} onClick={remove}>Удалить заметку</button>
  </div>
  {!state.annotations.length&&<p>3D-заметок пока нет.</p>}
  <ul className="model-note-list" aria-label="Список 3D-заметок">{state.annotations.map((annotation,index)=>{
   const resolved=resolveModelAnnotation(annotation,items);
   const status=resolved.status==='missing'?'Источник отсутствует':resolved.status==='hidden'?'Заметка или компонент скрыты':'Отображается';
   return <li key={annotation.id} data-model-annotation-row={annotation.id} onClick={()=>onSelect(annotation.id)}>
    <button type="button" className="model-note-select" aria-pressed={selectedId===annotation.id} onClick={()=>onSelect(annotation.id)} onDoubleClick={()=>open(annotation)}>{annotation.text.split('\n')[0]||`Заметка ${index+1}`}</button>
    <label className="model-note-visible"><input type="checkbox" aria-label={`Показывать заметку ${index+1}`} checked={annotation.visible} onChange={event=>visibility(annotation,event.target.checked)}/><TechnicalIcon kind="preview" size={16}/></label>
    <small data-model-annotation-status={resolved.status}>{status}</small>
   </li>;
  })}</ul>
  {failure&&!session&&<p role="alert" className="model-note-error">{failure}</p>}
  {session&&<Dialog open title="3D-заметка" onCancel={()=>{setSession(null);setRaw({});setFailure(null);}} onConfirm={()=>save(true)} onApply={()=>save(false)} confirmDisabled={Boolean(stale||errors.length)}>
   <div className="model-note-editor" data-model-annotation-editor="true">
    {stale&&<div role="alert" className="model-note-error">Документ или компоненты изменились после открытия заметки. Черновик не сохранён. Закройте редактор и откройте заметку повторно.</div>}
    {content}
    {draft&&(()=>{try{const resolved=resolveModelAnnotation(draft,items);return resolved.status==='missing'?<p role="status" className="model-note-warning">Источник заметки удалён. Ссылка сохраняется; выберите существующий компонент для восстановления привязки.</p>:resolved.status==='hidden'?<p role="status" className="model-note-warning">Заметка или её компонент скрыты; подпись не отображается в сцене.</p>:<p role="status">Заметка будет отображаться в 3D-сцене.</p>;}catch{return null;}})()}
    {errors.length>0&&<div role="alert" className="model-note-error"><ul>{[...new Set(errors)].map(error=><li key={error}>{error}</li>)}</ul></div>}
    {failure&&<p role="alert" className="model-note-error">{failure}</p>}
   </div>
  </Dialog>}
 </section>;
}
