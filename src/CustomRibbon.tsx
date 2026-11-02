import {commandEnabled,type CommandContext} from './CommandRegistry';
import React,{useEffect,useState} from 'react';
import {CadIcon,type CadIconName} from './CadIcons';
import {ChevronDown,ChevronLeft,ChevronRight,Pin,PinOff,Settings2,RotateCcw,X,Check,Grid3X3,Square,Maximize} from 'lucide-react';

type Entry={id:string;label:string;icon:CadIconName;group:string;action:string;demo?:boolean};
const catalog:Entry[]=[
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
{id:'revolve',label:'Вращение',icon:'revolve',group:'Построение',action:'revolve',demo:true},
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
'Модель':['select','box','cylinder','sketch','extrude','revolve','hole','fillet','chamfer','shell','pattern','mirror'],
'Сборка':['select','box','cylinder','pipe','duplicate','hide','isolate','showall','mate','section','pattern'],
'Эскиз':['select','sketch','dimension','mirror','pattern'],
'Чертёж':['select','sheet','draft','dimension','section'],
'Поверхности':['select','surface','loft','sweep','mirror'],
'Листовой металл':['select','sketch','extrude','fillet','chamfer','pattern'],
'Сварка':['select','weld','measure','section'],
'Трубопроводы':['select','pipe','sweep','measure','duplicate'],
'Анализ':['select','measure','section','hide','isolate'],
'Вид':['select','hide','isolate','showall','section']};
type Group={id:string;name:string;commands:string[]};
type Workspace={name:string;groups:Group[];favorites:string[];compact:boolean;hidden:string[]};
type Store={active:string;workspaces:Workspace[]};
const key='bendcore-ribbon-v4';
const unique=(a:string[])=>[...new Set(a)];
const defaultGroups=(tab:string):Group[]=>{const ids=presets[tab]||presets['Модель'];return unique(ids.map(id=>catalog.find(c=>c.id===id)?.group||'Прочее')).map((name,i)=>({id:'default-'+i+'-'+name,name,commands:ids.filter(id=>catalog.find(c=>c.id===id)?.group===name)}))};
const initial=():Store=>({active:'Стандартная',workspaces:[{name:'Стандартная',groups:defaultGroups('Сборка'),favorites:['select','box','cylinder','hide','showall'],compact:false,hidden:[]}]});
function load():Store{try{const x=JSON.parse(localStorage.getItem(key)||'null');if(x&&typeof x.active==='string'&&Array.isArray(x.workspaces)&&x.workspaces.length&&x.workspaces.every((w:Workspace)=>Array.isArray(w.groups)&&Array.isArray(w.favorites)&&Array.isArray(w.hidden)))return x}catch{}return initial()}
export function CustomRibbon({tab,action,log,wire,setWire,grid,setGrid,fit,commandContext,runCommand}:{tab:string;action:(id:string)=>void;log:(s:string)=>void;wire:boolean;setWire:React.Dispatch<React.SetStateAction<boolean>>;grid:boolean;setGrid:React.Dispatch<React.SetStateAction<boolean>>;fit:()=>void;commandContext:CommandContext;runCommand:(id:string)=>void}){
 const [store,setStore]=useState<Store>(load),[editing,setEditing]=useState(false),[query,setQuery]=useState(''),[newGroup,setNewGroup]=useState(''),[drag,setDrag]=useState<{id:string;from:string}|null>(null),[open,setOpen]=useState<string|null>(null);
 useEffect(()=>{localStorage.setItem(key,JSON.stringify(store))},[store]);
 const ws=store.workspaces.find(w=>w.name===store.active)||store.workspaces[0];
 const modify=(fn:(w:Workspace)=>Workspace)=>setStore(s=>({...s,workspaces:s.workspaces.map(w=>w.name===s.active?fn(w):w)}));
 const groups=ws.groups;
 const contextIds=presets[tab]||presets['Модель'];
 const contextCommands=contextIds.map(id=>catalog.find(c=>c.id===id)).filter((c):c is Entry=>Boolean(c));
 const execute=(id:string)=>{const c=catalog.find(x=>x.id===id);if(!c)return;setOpen(null);if(c.demo)log(c.label+': демонстрационная команда; CAD-ядро не подключено');else runCommand(c.action)};
 const move=(id:string,from:string,to:string,before?:string)=>{if(!catalog.some(c=>c.id===id))return;modify(w=>{const gs=w.groups.map(g=>({...g,commands:g.commands.filter(x=>x!==id)}));const target=gs.find(g=>g.id===to);if(!target)return w;const idx=before?target.commands.indexOf(before):-1;target.commands.splice(idx<0?target.commands.length:idx,0,id);return {...w,groups:gs,hidden:w.hidden.filter(x=>x!==id)}});setDrag(null)};
 const addGroup=()=>{const name=newGroup.trim();if(!name)return;modify(w=>({...w,groups:[...w.groups,{id:'custom-'+Date.now(),name,commands:[]}]}));setNewGroup('')};
 const saveAs=()=>{const name=prompt('Название нового рабочего пространства:','Моё пространство')?.trim();if(!name)return;if(store.workspaces.some(w=>w.name===name)){alert('Такое имя уже существует');return}setStore(s=>({active:name,workspaces:[...s.workspaces,{...ws,name,groups:ws.groups.map(g=>({...g,commands:[...g.commands]})),favorites:[...ws.favorites],hidden:[...ws.hidden]}]}));log('Создано рабочее пространство: '+name)};
 const renameWorkspace=()=>{const name=prompt('Новое название:',ws.name)?.trim();if(!name||name===ws.name)return;if(store.workspaces.some(w=>w.name===name)){alert('Имя уже занято');return}setStore(s=>({active:name,workspaces:s.workspaces.map(w=>w.name===s.active?{...w,name}:w)}))};
 const deleteWorkspace=()=>{if(store.workspaces.length===1){alert('Нельзя удалить последнее пространство');return}if(!confirm('Удалить пространство «'+ws.name+'»?'))return;setStore(s=>({active:s.workspaces.find(w=>w.name!==s.active)!.name,workspaces:s.workspaces.filter(w=>w.name!==s.active)}))};
 const toggleFavorite=(id:string)=>modify(w=>({...w,favorites:w.favorites.includes(id)?w.favorites.filter(x=>x!==id):[...w.favorites,id]}));
 const toggleHidden=(id:string)=>modify(w=>({...w,hidden:w.hidden.includes(id)?w.hidden.filter(x=>x!==id):[...w.hidden,id]}));
 const reset=()=>{if(confirm('Сбросить текущую раскладку для среды «'+tab+'»?'))modify(w=>({...w,groups:defaultGroups(tab),hidden:[],compact:false}))};
 const onDragStart=(e:React.DragEvent,id:string,from:string)=>{setDrag({id,from});e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',id)};
 const onDrop=(e:React.DragEvent,to:string,before?:string)=>{e.preventDefault();const id=drag?.id||e.dataTransfer.getData('text/plain');if(id)move(id,drag?.from||'catalog',to,before)};
 const renderTool=(id:string,groupId:string)=>{const c=catalog.find(x=>x.id===id);if(!c||ws.hidden.includes(id))return null;return <div key={id} className="ribbon-tool" draggable onDragStart={e=>onDragStart(e,id,groupId)} onDragEnd={()=>setDrag(null)} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.stopPropagation();onDrop(e,groupId,id)}}><button className="ribbon-command" disabled={!c.demo&&!commandEnabled(c.action,commandContext)} onClick={()=>execute(id)} title={c.label+(c.demo?' (демо)':'')}><CadIcon name={c.icon}/><span>{c.label}</span></button><button className="ribbon-dropdown" onClick={()=>setOpen(open===id?null:id)} aria-label={'Меню '+c.label}><ChevronDown size={11}/></button>{open===id&&<div className="ribbon-popover"><button onClick={()=>execute(id)}>Выполнить</button><button onClick={()=>{toggleFavorite(id);setOpen(null)}}>{ws.favorites.includes(id)?'Убрать из избранного':'В быстрый доступ'}</button><button onClick={()=>{toggleHidden(id);setOpen(null)}}>Скрыть</button></div>}</div>};
 return <><div className="cad-quick-access"><span>Быстрый доступ</span>{ws.favorites.map(id=>{const c=catalog.find(x=>x.id===id);return c?<button key={id} title={c.label} disabled={!c.demo&&!commandEnabled(c.action,commandContext)} onClick={()=>execute(id)}><CadIcon name={c.icon}/></button>:null})}<span className="workspace-label">{ws.name}</span><button title="Настроить Ribbon" onClick={()=>setEditing(true)}><Settings2 size={15}/></button></div>
 <div className="context-ribbon-strip" aria-label={'Контекстные команды: '+tab}><span className="context-ribbon-label">{tab} · инструменты</span>{contextCommands.map(c=><button key={c.id} className="context-ribbon-command" title={c.demo?c.label+' — демонстрация без CAD-ядра':c.label} disabled={!c.demo&&!commandEnabled(c.action,commandContext)} onClick={()=>execute(c.id)}><CadIcon name={c.icon}/><span>{c.label}</span>{c.demo&&<small>Демо</small>}</button>)}</div><section className={'ribbon ribbon-v3 '+(ws.compact?'ribbon-compact':'')}>{groups.map(g=><div key={g.id} className={'ribbon-group ribbon-group-v3 '+(drag?'ribbon-drop-ready':'')} onDragOver={e=>e.preventDefault()} onDrop={e=>onDrop(e,g.id)}>{g.commands.map(id=>renderTool(id,g.id))}<small>{g.name}</small></div>)}<div className="ribbon-group ribbon-group-v3"><div className="ribbon-tool"><button className="ribbon-command" onClick={()=>runCommand('wire')}><Square/><span>{wire?'Затенение':'Каркас'}</span></button></div><div className="ribbon-tool"><button className="ribbon-command" onClick={()=>runCommand('grid')}><Grid3X3/><span>Сетка</span></button></div><div className="ribbon-tool"><button className="ribbon-command" onClick={()=>runCommand('fit')}><Maximize/><span>Вписать</span></button></div><small>Вид</small></div><button className="ribbon-settings" onClick={()=>setEditing(true)}><Settings2 size={16}/><span>Настроить</span></button></section>
 {editing&&<div className="ribbon-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setEditing(false)}}><div className="ribbon-modal ribbon-modal-wide" role="dialog" aria-modal="true" aria-label="Настройка Ribbon"><header><strong>Редактор Ribbon · {tab}</strong><button onClick={()=>setEditing(false)} aria-label="Закрыть"><X/></button></header><div className="ribbon-modal-body"><div className="ribbon-workspace-bar"><label>Рабочее пространство <select value={ws.name} onChange={e=>setStore(s=>({...s,active:e.target.value}))}>{store.workspaces.map(w=><option key={w.name}>{w.name}</option>)}</select></label><button onClick={saveAs}>Сохранить как…</button><button onClick={renameWorkspace}>Переименовать</button><button onClick={deleteWorkspace}>Удалить</button></div><p>Перетащите команды между группами или из каталога. Изменения сохраняются автоматически в браузере.</p><label className="ribbon-check"><input type="checkbox" checked={ws.compact} onChange={e=>modify(w=>({...w,compact:e.target.checked}))}/> Компактный режим</label><div className="ribbon-editor-columns"><div><strong>Каталог команд</strong><input className="ribbon-filter" placeholder="Поиск команды..." value={query} onChange={e=>setQuery(e.target.value)}/><div className="ribbon-command-list">{catalog.filter(c=>c.label.toLowerCase().includes(query.toLowerCase())).map(c=><div key={c.id} className="ribbon-config-row" draggable onDragStart={e=>onDragStart(e,c.id,'catalog')} onDragEnd={()=>setDrag(null)}><span className="drag-grip">⠿</span><CadIcon name={c.icon}/><span>{c.label}{c.demo&&<small> · демо</small>}</span><button title="Показать/скрыть" onClick={()=>toggleHidden(c.id)}>{ws.hidden.includes(c.id)?'Скрыта':<Check size={15}/>}</button><button title="Быстрый доступ" onClick={()=>toggleFavorite(c.id)}>{ws.favorites.includes(c.id)?<Pin size={15}/>:<PinOff size={15}/>}</button></div>)}</div></div><div><strong>Группы и порядок команд</strong><div className="ribbon-groups-editor">{groups.map((g,idx)=><div key={g.id} className="ribbon-edit-group" onDragOver={e=>e.preventDefault()} onDrop={e=>onDrop(e,g.id)}><div className="ribbon-edit-group-head"><input aria-label="Имя группы" value={g.name} onChange={e=>modify(w=>({...w,groups:w.groups.map(x=>x.id===g.id?{...x,name:e.target.value}:x)}))}/><button title="Группа левее" disabled={idx===0} onClick={()=>modify(w=>{const a=[...w.groups];[a[idx-1],a[idx]]=[a[idx],a[idx-1]];return {...w,groups:a}})}><ChevronLeft size={15}/></button><button title="Группа правее" disabled={idx===groups.length-1} onClick={()=>modify(w=>{const a=[...w.groups];[a[idx+1],a[idx]]=[a[idx],a[idx+1]];return {...w,groups:a}})}><ChevronRight size={15}/></button><button title="Удалить группу" onClick={()=>modify(w=>({...w,groups:w.groups.filter(x=>x.id!==g.id)}))}><X size={15}/></button></div><div className="ribbon-edit-items">{g.commands.map(id=>{const c=catalog.find(x=>x.id===id);return c?<div key={id} draggable className="ribbon-edit-item" onDragStart={e=>onDragStart(e,id,g.id)} onDragEnd={()=>setDrag(null)} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.stopPropagation();onDrop(e,g.id,id)}}><span>⠿</span><CadIcon name={c.icon}/>{c.label}<button title="Удалить из группы" onClick={()=>modify(w=>({...w,groups:w.groups.map(x=>x.id===g.id?{...x,commands:x.commands.filter(v=>v!==id)}:x)}))}><X size={13}/></button></div>:null})}<div className="ribbon-drop-zone">Перетащите сюда команду</div></div></div>)}</div><div className="ribbon-add-group"><input placeholder="Название новой группы" value={newGroup} onChange={e=>setNewGroup(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')addGroup()}}/><button onClick={addGroup}>+ Создать группу</button></div></div></div></div><footer><button onClick={reset}><RotateCcw size={15}/> Сбросить раскладку</button><button className="ribbon-primary" onClick={()=>setEditing(false)}>Готово</button></footer></div></div>}</>;
}
