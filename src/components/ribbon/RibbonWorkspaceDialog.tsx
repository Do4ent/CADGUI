import {useId,useState} from 'react';
import {Dialog} from '../dialog/Dialog';
import {TechnicalIcon} from '../icons/TechnicalIcon';
import {ribbonNameError} from './ribbonModel';
export type RibbonWorkspaceOperation='save'|'rename'|'delete'|'reset';
export interface RibbonWorkspaceDialogProps{operation:RibbonWorkspaceOperation;name:string;otherNames:readonly string[];canDelete:boolean;onCancel:()=>void;onConfirm:(name?:string)=>void}
export function RibbonWorkspaceDialog({operation,name,otherNames,canDelete,onCancel,onConfirm}:RibbonWorkspaceDialogProps){
 const [value,setValue]=useState(operation==='save'?'Моё пространство':name),id=useId();
 const naming=operation==='save'||operation==='rename',error=naming?ribbonNameError(value,otherNames):operation==='delete'&&!canDelete?'Нельзя удалить последнее рабочее пространство.':undefined;
 const titles={save:'Сохранить пространство Ribbon',rename:'Переименовать пространство Ribbon',delete:'Удалить пространство Ribbon',reset:'Сбросить раскладку Ribbon'};
 return <Dialog open title={titles[operation]} onCancel={onCancel} onConfirm={()=>{if(!error)onConfirm(naming?value.trim():undefined);}} confirmDisabled={!!error}>
  <div className="ribbon-workspace-dialog">
   {naming?<label htmlFor={id} className="ribbon-editor-field"><span><span aria-hidden="true"><TechnicalIcon kind="material" size={18}/></span>Название пространства</span><input id={id} value={value} maxLength={80} required aria-invalid={!!error} aria-describedby={error?`${id}-error`:undefined} onChange={e=>setValue(e.target.value)}/></label>:<p>{operation==='delete'?`Удалить рабочее пространство «${name}» из черновика?`:`Восстановить стандартные группы, видимость команд и обычный размер Ribbon для «${name}»? Избранное сохранится.`}</p>}
   <p>Изменения будут сохранены после подтверждения редактора Ribbon.</p>
   {error&&<p id={`${id}-error`} role="alert">{error}</p>}
  </div>
 </Dialog>;
}
