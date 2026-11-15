import {commandEnabled,type CommandContext} from './CommandRegistry';
import React,{useEffect,useId,useRef,useState} from 'react';
import {CadIcon,type CadIconName} from './CadIcons';
import {ChevronDown,Settings2,Grid3X3,Square,Maximize} from 'lucide-react';
import {RibbonEditor} from './components/ribbon/RibbonEditor';
import type {RibbonGroup as Group,RibbonStore as Store,RibbonWorkspace as Workspace} from './components/ribbon/ribbonModel';

type Entry={id:string;label:string;icon:CadIconName;group:string;action:string;demo?:boolean};
const catalog:Entry[]=[
{id:'sketch-model',label:'Эскизы с ограничениями',icon:'sketch',group:'Точное моделирование',action:'sketch-model'},
{id:'exact-model',label:'Точная геометрия',icon:'box',group:'Точное моделирование',action:'exact-model'},
{id:'model-note',label:'3D-заметка',icon:'dimension',group:'Аннотации',action:'model-note'},
{id:'select',label:'Выбрать',icon:'select',group:'Общие',action:'select'},
{id:'box',label:'Блок',icon:'box',group:'Создание',action:'box'},
{id:'cylinder',label:'Цилиндр',icon:'cylinder',group:'Создание',action:'cylinder'},
{id:'pipe',label:'Труба',icon:'pipe',group:'Создание',action:'pipe'},
{id:'duplicate',label:'Копировать',icon:'duplicate',group:'Правка',action:'duplicate'},
{id:'hide',label:'Скрыть',icon:'hide',group:'Правка',action:'hide'},
{id:'isolate',label:'Изолировать',icon:'isolate',group:'Правка',action:'isolate'},
{id:'showall',label:'Показать всё',icon:'showall',group:'Правка',action:'showall'},
{id:'delete',label:'Удалить',icon:'delete',group:'Правка',action:'delete'},
{id:'sketch',label:'Эскиз',icon:'sketch',group:'Построение',action:'sketch',demo:true},
{id:'extrude',label:'Выдавливание',icon:'extrude',group:'Построение',action:'extrude',demo:true},
{id:'revolve',label:'Вращение эскиза',icon:'revolve',group:'Построение',action:'sketch-revolve'},
{id:'common',label:'Пересечение тел',icon:'extrude',group:'Построение',action:'sketch-common'},
{id:'subtract',label:'Вычитание тел',icon:'extrude',group:'Построение',action:'sketch-subtract'},
{id:'fusion',label:'Объединение тел',icon:'extrude',group:'Построение',action:'sketch-fuse'},
{id:'hole',label:'Отверстие',icon:'hole',group:'Построение',action:'hole',demo:true},
{id:'fillet',label:'Скругление',icon:'fillet',group:'Построение',action:'fillet',demo:true},
{id:'chamfer',label:'Фаска',icon:'chamfer',group:'Построение',action:'chamfer',demo:true},
{id:'shell',label:'Оболочка',icon:'shell',group:'Построение',action:'shell',demo:true},
{id:'pattern',label:'Массив',icon:'pattern',group:'Построение',action:'pattern',demo:true},
{id:'mirror',label:'Зеркало',icon:'mirror',group:'Построение',action:'mirror',demo:true},
{id:'mate',label:'Сопряжение',icon:'mate',group:'Сборка',action:'mate',demo:true},
{id:'section',label:'Сечение',icon:'section',group:'Сборка',action:'section',demo:true},
{id:'dimension',label:'Размер',icon:'dimension',group:'Эскиз',action:'dimension',demo:true},
{id:'sheet',label:'Лист',icon:'sheet',group:'Чертёж',action:'sheet',demo:true},
{id:'draft',label:'Виды',icon:'draft',group:'Чертёж',action:'draft',demo:true},
{id:'surface',label:'Поверхность',icon:'surface',group:'Поверхности',action:'surface',demo:true},
{id:'loft',label:'Лофт',icon:'loft',group:'Поверхности',action:'loft',demo:true},
{id:'sweep',label:'По траектории',icon:'sweep',group:'Поверхности',action:'sweep',demo:true},
{id:'weld',label:'Сварной шов',icon:'weld',group:'Сварка',action:'weld',demo:true},
{id:'measure',label:'Измерить',icon:'measure',group:'Анализ',action:'measure',demo:true},
];
const presets:Record<string,string[]>={
'Модель':['select','sketch-model','exact-model','model-note','box','cylinder','sketch','extrude','revolve','fusion','common','subtract','hole','fillet','chamfer','shell','pattern','mirror'],
'Сборка':['select','sketch-model','exact-model','model-note','box','cylinder','pipe','duplicate','hide','isolate','showall','mate','section','pattern'],
'Эскиз':['select','sketch-model','sketch','dimension','mirror','pattern'],
'Чертёж':['select','sheet','draft','dimension','section'],
'Поверхности':['select','surface','loft','sweep','mirror'],
'Листовой металл':['select','sketch','extrude','fillet','chamfer','pattern'],
'Сварка':['select','weld','measure','section'],
'Трубопроводы':['select','pipe','sweep','measure','duplicate'],
'Анализ':['select','measure','section','hide','isolate'],
'Вид':['select','sketch-model','exact-model','model-note','hide','isolate','showall','section']};
const key='bendcore-ribbon-v4';
const unique=(a:string[])=>[...new Set(a)];
const defaultGroups=(tab:string):Group[]=>{const ids=presets[tab]||presets['Модель'];return unique(ids.map(id=>catalog.find(c=>c.id===id)?.group||'Прочее')).map((name,i)=>({id:'default-'+i+'-'+name,name,commands:ids.filter(id=>catalog.find(c=>c.id===id)?.group===name)}))};
const initial=():Store=>({active:'Стандартная',workspaces:[{name:'Стандартная',groups:defaultGroups('Сборка'),favorites:['select','box','cylinder','hide','showall'],compact:false,hidden:[]}]});
function load():Store{try{const x=JSON.parse(localStorage.getItem(key)||'null');if(x&&typeof x.active==='string'&&Array.isArray(x.workspaces)&&x.workspaces.length&&x.workspaces.every((w:Workspace)=>Array.isArray(w.groups)&&Array.isArray(w.favorites)&&Array.isArray(w.hidden)))return x}catch{}return initial()}
export interface RibbonDropdownProps {label:string;open:boolean;disabled:boolean;favorite:boolean;onOpenChange:(open:boolean)=>void;onExecute:()=>void;onToggleFavorite:()=>void;onHide:()=>void}
/** Native menu-button semantics; layout classes deliberately match the existing Ribbon. */
export function RibbonDropdown({label,open,disabled,favorite,onOpenChange,onExecute,onToggleFavorite,onHide}:RibbonDropdownProps){
 const id=useId(),trigger=useRef<HTMLButtonElement>(null),menu=useRef<HTMLDivElement>(null),lastOnOpen=useRef(false);
 const items=()=>Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')??[]);
 const close=(restore=true)=>{if(restore)trigger.current?.focus();onOpenChange(false);};
 useEffect(()=>{if(!open)return;const controls=items();(lastOnOpen.current?controls.at(-1):controls[0])?.focus();
  const outside=(event:Event)=>{const target=event.target as Node|null;if(target&&!trigger.current?.contains(target)&&!menu.current?.contains(target))onOpenChange(false);};
  document.addEventListener('pointerdown',outside,true);document.addEventListener('focusin',outside,true);
  return()=>{document.removeEventListener('pointerdown',outside,true);document.removeEventListener('focusin',outside,true);};
 },[open]);
 const hide=()=>{const tool=trigger.current?.closest('.ribbon-tool'),ribbon=tool?.closest('.ribbon'),controls=Array.from(ribbon?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')??[]),index=trigger.current?controls.indexOf(trigger.current):-1;
  const next=controls.slice(index+1).find(control=>!tool?.contains(control))??controls.slice(0,index).reverse().find(control=>!tool?.contains(control));next?.focus();onOpenChange(false);onHide();};
 return <><button ref={trigger} type="button" id={`${id}-trigger`} className="ribbon-dropdown" aria-label={'Меню '+label} aria-haspopup="menu" aria-expanded={open} aria-controls={open?`${id}-menu`:undefined}
  onClick={()=>{lastOnOpen.current=false;if(open)close();else onOpenChange(true);}}
  onKeyDown={event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();event.stopPropagation();lastOnOpen.current=event.key==='ArrowUp';if(open){const controls=items();(lastOnOpen.current?controls.at(-1):controls[0])?.focus();}else onOpenChange(true);}else if(event.key==='Escape'&&open){event.preventDefault();event.stopPropagation();close();}}}><ChevronDown size={11} aria-hidden="true"/></button>
 {open&&<div ref={menu} id={`${id}-menu`} role="menu" aria-labelledby={`${id}-trigger`} className="ribbon-popover"
  onKeyDown={event=>{event.stopPropagation();const controls=items(),index=controls.indexOf(document.activeElement as HTMLButtonElement);if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?controls.length-1:event.key==='ArrowDown'?(index+1)%controls.length:(index-1+controls.length)%controls.length;controls[next]?.focus();}else if(event.key==='Escape'){event.preventDefault();close();}else if(event.key==='Tab')close();}}>
  <button type="button" role="menuitem" tabIndex={-1} disabled={disabled} onClick={()=>{if(disabled)return;close();onExecute();}}>Выполнить</button>
  <button type="button" role="menuitemcheckbox" aria-checked={favorite} tabIndex={-1} onClick={()=>{close();onToggleFavorite();}}>{favorite?'Убрать из избранного':'В быстрый доступ'}</button>
  <button type="button" role="menuitem" tabIndex={-1} onClick={hide}>Скрыть</button>
 </div>}</>;
}
export function CustomRibbon({tab,action,log,wire,setWire,grid,setGrid,fit,commandContext,runCommand}:{tab:string;action:(id:string)=>void;log:(s:string)=>void;wire:boolean;setWire:React.Dispatch<React.SetStateAction<boolean>>;grid:boolean;setGrid:React.Dispatch<React.SetStateAction<boolean>>;fit:()=>void;commandContext:CommandContext;runCommand:(id:string)=>void}){
 const [store,setStore]=useState<Store>(load),[editing,setEditing]=useState(false),[drag,setDrag]=useState<{id:string;from:string}|null>(null),[open,setOpen]=useState<string|null>(null);
 useEffect(()=>{localStorage.setItem(key,JSON.stringify(store))},[store]);
 useEffect(()=>setOpen(null),[tab,store.active,editing]);
 const ws=store.workspaces.find(w=>w.name===store.active)||store.workspaces[0];
 const modify=(fn:(w:Workspace)=>Workspace)=>setStore(s=>({...s,workspaces:s.workspaces.map(w=>w.name===s.active?fn(w):w)}));
 const groups=ws.groups;
 const contextIds=presets[tab]||presets['Модель'];
 const contextCommands=contextIds.map(id=>catalog.find(c=>c.id===id)).filter((c):c is Entry=>Boolean(c));
 const execute=(id:string)=>{const c=catalog.find(x=>x.id===id);if(!c)return;setOpen(null);if(c.demo)log(c.label+': демонстрационная команда; CAD-ядро не подключено');else runCommand(c.action)};
 const move=(id:string,from:string,to:string,before?:string)=>{if(!catalog.some(c=>c.id===id))return;modify(w=>{const gs=w.groups.map(g=>({...g,commands:g.commands.filter(x=>x!==id)}));const target=gs.find(g=>g.id===to);if(!target)return w;const idx=before?target.commands.indexOf(before):-1;target.commands.splice(idx<0?target.commands.length:idx,0,id);return {...w,groups:gs,hidden:w.hidden.filter(x=>x!==id)}});setDrag(null)};
 const toggleFavorite=(id:string)=>modify(w=>({...w,favorites:w.favorites.includes(id)?w.favorites.filter(x=>x!==id):[...w.favorites,id]}));
 const toggleHidden=(id:string)=>modify(w=>({...w,hidden:w.hidden.includes(id)?w.hidden.filter(x=>x!==id):[...w.hidden,id]}));
 const onDragStart=(e:React.DragEvent,id:string,from:string)=>{setDrag({id,from});e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',id)};
 const onDrop=(e:React.DragEvent,to:string,before?:string)=>{e.preventDefault();const id=drag?.id||e.dataTransfer.getData('text/plain');if(id)move(id,drag?.from||'catalog',to,before)};
 const renderTool=(id:string,groupId:string)=>{const c=catalog.find(x=>x.id===id);if(!c||ws.hidden.includes(id))return null;return <div key={id} className="ribbon-tool" draggable onDragStart={e=>onDragStart(e,id,groupId)} onDragEnd={()=>setDrag(null)} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.stopPropagation();onDrop(e,groupId,id)}}><button className="ribbon-command" disabled={!c.demo&&!commandEnabled(c.action,commandContext)} onClick={()=>execute(id)} title={c.label+(c.demo?' (демо)':'')}><CadIcon name={c.icon}/><span>{c.label}</span></button><RibbonDropdown label={c.label} open={open===groupId+':'+id} disabled={!c.demo&&!commandEnabled(c.action,commandContext)} favorite={ws.favorites.includes(id)} onOpenChange={value=>setOpen(value?groupId+':'+id:null)} onExecute={()=>execute(id)} onToggleFavorite={()=>toggleFavorite(id)} onHide={()=>toggleHidden(id)}/></div>};
 return <><div className="cad-quick-access"><span>Быстрый доступ</span>{ws.favorites.map(id=>{const c=catalog.find(x=>x.id===id);return c?<button key={id} title={c.label} disabled={!c.demo&&!commandEnabled(c.action,commandContext)} onClick={()=>execute(id)}><CadIcon name={c.icon}/></button>:null})}<span className="workspace-label">{ws.name}</span><button title="Настроить Ribbon" onClick={()=>setEditing(true)}><Settings2 size={15}/></button></div>
 <div className="context-ribbon-strip" aria-label={'Контекстные команды: '+tab}><span className="context-ribbon-label">{tab} · инструменты</span>{contextCommands.map(c=><button key={c.id} className="context-ribbon-command" title={c.demo?c.label+' — демонстрация без CAD-ядра':c.label} disabled={!c.demo&&!commandEnabled(c.action,commandContext)} onClick={()=>execute(c.id)}><CadIcon name={c.icon}/><span>{c.label}</span>{c.demo&&<small>Демо</small>}</button>)}</div><section className={'ribbon ribbon-v3 '+(ws.compact?'ribbon-compact':'')}>{groups.map(g=><div key={g.id} className={'ribbon-group ribbon-group-v3 '+(drag?'ribbon-drop-ready':'')} onDragOver={e=>e.preventDefault()} onDrop={e=>onDrop(e,g.id)}>{g.commands.map(id=>renderTool(id,g.id))}<small>{g.name}</small></div>)}<div className="ribbon-group ribbon-group-v3"><div className="ribbon-tool"><button className="ribbon-command" onClick={()=>runCommand('wire')}><Square/><span>{wire?'Затенение':'Каркас'}</span></button></div><div className="ribbon-tool"><button className="ribbon-command" onClick={()=>runCommand('grid')}><Grid3X3/><span>Сетка</span></button></div><div className="ribbon-tool"><button className="ribbon-command" onClick={()=>runCommand('fit')}><Maximize/><span>Вписать</span></button></div><small>Вид</small></div><button className="ribbon-settings" onClick={()=>setEditing(true)}><Settings2 size={16}/><span>Настроить</span></button></section>
 {editing&&<RibbonEditor initial={store} tab={tab} catalog={catalog} defaultGroups={defaultGroups(tab)} onCancel={()=>setEditing(false)} onConfirm={next=>{setStore(next);setEditing(false);log('Настройки Ribbon сохранены');}}/>}</>;
}
