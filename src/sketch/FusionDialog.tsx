import {useId} from 'react';
import {Dialog} from '../components/dialog/Dialog';
import {TechnicalIcon} from '../components/icons/TechnicalIcon';
import './fusion-dialog.css';

export interface FusionBodyOption {id:string;name:string;disabled?:boolean;reason?:string}
export interface FusionDraft {a:string;b:string}
export interface FusionDialogProps {
 bodies:readonly FusionBodyOption[];
 draft:FusionDraft;
 busy:boolean;
 mode:'create'|'edit';
 onChange:(draft:FusionDraft)=>void;
 onConfirm:(draft:FusionDraft)=>void;
 onCancel:()=>void;
}

export function validateFusionDraft(bodies:readonly FusionBodyOption[],draft:FusionDraft):string[]{
 const errors:string[]=[];
 if(!draft.a||!draft.b)errors.push('Выберите два исходных тела.');
 const ids=bodies.map(body=>body.id);
 if(new Set(ids).size!==ids.length)errors.push('Список тел содержит повторяющиеся идентификаторы.');
 for(const [key,label] of [['a','Тело A'],['b','Тело B']] as const){
  if(!draft[key])continue;
  const body=bodies.find(option=>option.id===draft[key]);
  if(!body)errors.push(`${label}: выбранное тело отсутствует.`);
  else if(body.disabled)errors.push(`${label}: ${body.reason||'тело недоступно для этой операции.'}`);
 }
 if(draft.a&&draft.a===draft.b)errors.push('Выберите разные исходные тела.');
 return errors;
}

/** Controlled source selection; the caller owns the atomic kernel transaction. */
export function FusionDialog({bodies,draft,busy,mode,onChange,onConfirm,onCancel}:FusionDialogProps){
 const id=useId(),errorId=`${id}-error`,helpId=`${id}-help`;
 const errors=validateFusionDraft(bodies,draft);
 const confirm=()=>{if(!busy&&!errors.length)onConfirm({...draft});};
 return <Dialog open title="Объединение тел" onCancel={onCancel} onConfirm={confirm} confirmDisabled={busy||errors.length>0}>
  <div className="fusion-dialog" data-fusion-editor="true" aria-busy={busy}>
   <p className="fusion-mode">{mode==='edit'?'Изменение параметрического объединения':'Создание параметрического объединения'}</p>
   <fieldset disabled={busy} className="fusion-sources">
    {(['a','b'] as const).map((key,index)=>{
     const inputId=`${id}-${key}`,value=draft[key],selected=bodies.find(body=>body.id===value);
     const invalid=!value||!selected||selected.disabled||draft.a===draft.b;
     return <label className="fusion-source" key={key} htmlFor={inputId}>
      <span className="fusion-source-label"><span aria-hidden="true"><TechnicalIcon kind="profile" size={18}/></span>{index===0?'Тело A':'Тело B'}</span>
      <select id={inputId} aria-label={index===0?'Тело A':'Тело B'} value={value} required aria-invalid={Boolean(invalid)} aria-describedby={errors.length?`${helpId} ${errorId}`:helpId}
       onChange={event=>{if(!busy)onChange({...draft,[key]:event.target.value});}}>
       <option value="">Выберите тело</option>
       {value&&!selected&&<option value={value} disabled>Отсутствующее тело: {value}</option>}
       {bodies.map(body=><option key={body.id} value={body.id} disabled={body.disabled}>{body.name}{body.disabled?` — ${body.reason||'недоступно'}`:''}</option>)}
      </select>
     </label>;
    })}
   </fieldset>
   <p id={helpId}>Исходные тела сохраняются. Для разнесённых тел результат может быть составным телом (compound), содержащим несколько отдельных объёмов.</p>
   {errors.length>0&&<div id={errorId} className="fusion-errors" role="alert">{errors.map(error=><p key={error}>{error}</p>)}</div>}
   {busy&&<p role="status">Выполняется объединение… Отмена не сохраняет результат.</p>}
  </div>
 </Dialog>;
}
