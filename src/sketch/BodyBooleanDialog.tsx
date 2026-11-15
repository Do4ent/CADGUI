import {useId} from 'react';
import {Dialog} from '../components/dialog/Dialog';
import {TechnicalIcon} from '../components/icons/TechnicalIcon';
import './body-boolean-dialog.css';

export type BodyBooleanOperation='common'|'cut';
export interface BodyBooleanBodyOption{id:string;name:string;disabled?:boolean;reason?:string;disabledReason?:string}
export interface BodyBooleanDraft{a:string;b:string}
export interface BodyBooleanDialogProps{
 bodies:readonly BodyBooleanBodyOption[];draft:BodyBooleanDraft;operation:BodyBooleanOperation;busy:boolean;
 mode?:'create'|'edit';stale?:boolean;errors?:readonly string[];error?:string;
 onChange:(draft:BodyBooleanDraft)=>void;onOperationChange?:(operation:BodyBooleanOperation)=>void;
 onConfirm:(draft:BodyBooleanDraft)=>void;onCancel:()=>void;
}
const unavailable=(body:BodyBooleanBodyOption)=>!!body.disabled||!!body.disabledReason;
export function validateBodyBooleanDraft(bodies:readonly BodyBooleanBodyOption[],draft:BodyBooleanDraft,operation:BodyBooleanOperation='common'):string[]{
 const errors:string[]=[];
 if(operation!=='common'&&operation!=='cut')errors.push('Выберите поддерживаемую операцию.');
 if(!draft.a||!draft.b)errors.push('Выберите два исходных тела.');
 if(new Set(bodies.map(body=>body.id)).size!==bodies.length)errors.push('Список тел содержит повторяющиеся идентификаторы.');
 for(const [key,label] of [['a','Тело A'],['b','Тело B']] as const){if(!draft[key])continue;const body=bodies.find(item=>item.id===draft[key]);if(!body)errors.push(`${label}: выбранное тело отсутствует.`);else if(unavailable(body))errors.push(`${label}: ${body.disabledReason||body.reason||'тело недоступно для операции.'}`);}
 if(draft.a&&draft.a===draft.b)errors.push('Выберите разные исходные тела.');
 return errors;
}
/** Controlled UI only; the caller validates its dependency graph and owns rebuilding. */
export function BodyBooleanDialog({bodies,draft,operation,busy,mode='create',stale=false,errors:externalErrors=[],error='',onChange,onOperationChange,onConfirm,onCancel}:BodyBooleanDialogProps){
 const id=useId(),localErrors=validateBodyBooleanDraft(bodies,draft,operation),errors=[...new Set([...localErrors,...externalErrors.filter(Boolean)])],locked=busy||stale;
 const update=(next:BodyBooleanDraft)=>{if(!locked)onChange({...next});};
 return <Dialog open title={operation==='cut'?'Вычитание тел':'Пересечение тел'} onCancel={onCancel} onConfirm={()=>{if(!locked&&!errors.length)onConfirm({...draft});}} confirmDisabled={locked||errors.length>0}>
  <div className="body-boolean-dialog" data-body-boolean-editor="true" aria-busy={busy}>
   <p>{mode==='edit'?'Изменение параметрической операции':'Создание параметрической операции'}</p>
   <fieldset disabled={locked} className="body-boolean-fields">
    {onOperationChange&&<label className="body-boolean-field" htmlFor={`${id}-operation`}><span><span aria-hidden="true"><TechnicalIcon kind="profile" size={18}/></span>Операция</span><select id={`${id}-operation`} aria-label="Операция" value={operation} onChange={e=>{if(!locked)onOperationChange(e.target.value as BodyBooleanOperation);}}><option value="common">Пересечение A ∩ B</option><option value="cut">Вычитание A − B</option></select></label>}
    <div className="body-boolean-sources">{(['a','b'] as const).map((key,index)=>{
     const selected=bodies.find(body=>body.id===draft[key]),invalid=!draft[key]||!selected||unavailable(selected)||draft.a===draft.b;
     return <label className="body-boolean-field" key={key} htmlFor={`${id}-${key}`}><span><span aria-hidden="true"><TechnicalIcon kind="profile" size={18}/></span>{index===0?'Тело A':'Тело B'}</span>
      <select id={`${id}-${key}`} aria-label={index===0?'Тело A':'Тело B'} value={draft[key]} required aria-invalid={!!invalid} aria-describedby={`${id}-${key}-role ${id}-sources${errors.length?` ${id}-errors`:''}`}
       onChange={e=>update({...draft,[key]:e.target.value})}><option value="">Выберите тело</option>{draft[key]&&!selected&&<option value={draft[key]} disabled>Отсутствующее тело: {draft[key]}</option>}{bodies.map(body=><option key={body.id} value={body.id} disabled={unavailable(body)}>{body.name}{unavailable(body)?` — ${body.disabledReason||body.reason||'недоступно'}`:''}</option>)}</select>
      <small id={`${id}-${key}-role`}>{operation==='cut'?(key==='a'?'Основное тело: из него удаляется объём B.':'Инструмент: его объём удаляется из A.'):(key==='a'?'Первый источник общей области.':'Второй источник общей области.')}</small>
     </label>;
    })}</div>
    <button type="button" className="body-boolean-reverse" onClick={()=>update({a:draft.b,b:draft.a})} aria-describedby={`${id}-reverse-help`}><span aria-hidden="true"><TechnicalIcon kind="direction" size={18}/></span>Поменять A и B</button>
    <small id={`${id}-reverse-help`}>{operation==='cut'?'Обмен меняет вычитание A − B на B − A.':'Общая геометрия симметрична; роли источников A и B поменяются.'}</small>
   </fieldset>
   <p id={`${id}-sources`}>Исходные тела сохраняются. Результат создаётся отдельно; перестроение учитывает изменения источников.</p>
   <p>{operation==='cut'?'Сохраняется часть A вне B (A − B).':'Сохраняется только общий объём A и B (A ∩ B).'}</p>
   {errors.length>0&&<div id={`${id}-errors`} className="body-boolean-errors" role="alert">{errors.map(message=><p key={message}>{message}</p>)}</div>}
   {stale&&<p role="alert">Документ изменился. Закройте диалог и откройте команду повторно; черновик не сохранён.</p>}
   {error&&<p role="alert">{error}</p>}
   {busy&&<p role="status">Выполняется операция… Отмена не сохраняет результат.</p>}
  </div>
 </Dialog>;
}
