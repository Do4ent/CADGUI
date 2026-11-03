import {useEffect,useRef,useState} from 'react';
import type {DrawingDocument,DrawingEntity,Point2} from '../types';
import type {DimensionDefinition,DimensionKind,DimensionStyle} from './types';
import {Dialog,ParameterField} from '../../components/dialog';
import {TechnicalIcon} from '../../components/icons/TechnicalIcon';
import {activeDrawingSheet,cloneDrawing,drawingId,validateDrawingDocument} from '../model';
import {DimensionEditor} from './DimensionEditor';
import {defaultDimensionDefinition,defaultDimensionStyle} from './defaults';
import {evaluateDimension,formatDimension} from './engine';
import {dimensionCommandGroups,type DimensionCommand} from './catalog';
import {applyDimensionStyle,copyDimensionStyle,createDimensionGroup,dimensionReport,freezeDimensions,resetDimensionStyle,saveDimension,spaceDimensions,updateDimensions} from './operations';
type Props={document:DrawingDocument;selection:string[];onSelect:(ids:string[])=>void;onChange:(doc:DrawingDocument,label:string,ids?:string[])=>void;onError:(error:unknown)=>void;onExport:(type:'svg'|'pdf'|'dxf')=>void;onImport:()=>void;onUndo:()=>void;onRedo:()=>void;openRequest:number;editEntityId?:string;onEditorClose:()=>void};
const copy=<T,>(value:T):T=>cloneDrawing(value);
function download(doc:DrawingDocument){const url=URL.createObjectURL(new Blob([JSON.stringify(doc,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='чертёж-размеры.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
export function DimensionTools(p:Props){
 const {document:doc,selection}=p,sheet=activeDrawingSheet(doc),selected=selection.map(id=>sheet.entities.find(e=>e.id===id)).filter((e):e is DrawingEntity=>Boolean(e)),dims=selected.filter(e=>e.dimension);
 const [query,setQuery]=useState(''),[editor,setEditor]=useState<{kind:DimensionKind;entity?:DrawingEntity}|null>(null),[modal,setModal]=useState(''),[error,setError]=useState(''),[report,setReport]=useState('');
 const [axis,setAxis]=useState(0),[offset,setOffset]=useState(10),[spacing,setSpacing]=useState(10),[ox,setOx]=useState(0),[oy,setOy]=useState(0),[styleId,setStyleId]=useState(''),[styleName,setStyleName]=useState('Стиль размера'),[styleAction,setStyleAction]=useState('save'),[label,setLabel]=useState('1'),[rate,setRate]=useState(100),[filter,setFilter]=useState('all'),[stateFilter,setStateFilter]=useState('all');
 const [raw,setRaw]=useState<Record<string,string>>({});
 useEffect(()=>setRaw({}),[modal]);
 const alive=useRef(true),latest=useRef(doc);latest.current=doc;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[]);
 const seen=useRef(0);
 useEffect(()=>{if(p.openRequest&&p.openRequest!==seen.current){seen.current=p.openRequest;try{openEditor(p.editEntityId?sheet.entities.find(e=>e.id===p.editEntityId):undefined)}catch(e){setError(e instanceof Error?e.message:String(e));p.onError(e)}}},[p.openRequest]);
 const closeEditor=()=>{setEditor(null);p.onEditorClose()};
 function openEditor(entity?:DrawingEntity,kind:DimensionKind='aligned'){
  setError('');if(entity?.annotation?.type==='dimension'&&!entity.dimension){const source=entity.annotation.sourceId;if(!source)throw new Error('У старого размера нет опоры: создайте новый размер');const def=defaultDimensionDefinition('aligned');def.refs=[{entityId:source}];const precision=Number(entity.annotation.fields.precision??3);if(Number.isInteger(precision)&&precision>=0&&precision<=8)def.format.precision=precision;def.format.prefix=entity.annotation.prefix??'';def.format.suffix=entity.annotation.suffix??'';entity={...copy(entity),x:0,y:0,dimension:def};}
  setEditor({kind:entity?.dimension?.kind??kind,entity:entity?copy(entity):undefined});
 }
 const commit=(next:DrawingDocument,label:string,ids=selection)=>{p.onChange(validateDrawingDocument(next),label,ids);setError('')};
 const run=(fn:()=>void)=>{try{fn()}catch(e){setError(e instanceof Error?e.message:String(e));p.onError(e)}};
 const edit=()=>{if(!dims[0])throw new Error('Выберите размер');openEditor(dims[0])};
 const button=(command:DimensionCommand)=>run(()=>{
  const action=command.action;if(command.unavailableReason)throw new Error(command.unavailableReason);
  if(action==='create'){openEditor(undefined,command.kind??'aligned');return}
  if(action==='create-context'){const kind:DimensionKind=selected[0]?.geometry?.type==='arc'?'arc-length':selected[0]?.geometry?.type==='ellipse'?'radius':selected.filter(e=>e.geometry?.type==='line').length>=2?'angle':'aligned';openEditor(undefined,kind);return}
  if(action.startsWith('edit')||['inspect-value'].includes(action)){edit();return}
  if(action.startsWith('group-')){setModal(action);return}
  if(['inspect-source','source'].includes(action)){const ids=[...new Set(dims.flatMap(e=>e.dimension!.refs.flatMap(r=>r.entityId?[r.entityId]:[])))];p.onSelect(ids);setReport(ids.length?'Выбраны опоры размеров':'У выбранных размеров нет связанных опор');return}
  if(action==='fonts'){setReport('Проверка шрифтов…');void import('../browserServices').then(async services=>{const report=await services.diagnoseFonts(doc);if(alive.current&&latest.current===doc)setReport(report.map(item=>item.message).join('\n'))}).catch(e=>{if(alive.current&&latest.current===doc)setError(e instanceof Error?e.message:String(e))});return}
  if(action==='diagnose'){setReport(dimensionReport(doc).join('\n'));return}
  if(action==='freeze'||action==='detach'){commit(freezeDimensions(doc,selection,action==='detach'),action==='freeze'?'Изменён режим снимка размеров':'Разорваны связи размеров');return}
  if(action==='restore-value'||action==='restore'){commit(updateDimensions(doc,selection,def=>{delete def.manualText}),'Восстановлены вычисленные подписи');return}
  if(action==='copy-style'){commit(copyDimensionStyle(doc,selection),'Скопировано оформление размеров');return}
  if(action==='reset-style'){commit(resetDimensionStyle(doc,selection),'Сброшено оформление размеров');return}
  if(action==='align'){commit(spaceDimensions(doc,selection,0),'Выровнены размерные линии');return}
  if(action==='distribute'){setModal('spacing');return}
  if(action==='duplicate'){if(!dims.length)throw new Error('Выберите размер');const next=copy(doc),copies=dims.map(e=>({...copy(e),id:drawingId('dimension'),name:e.name+' (копия)',y:e.y+5}));activeDrawingSheet(next).entities.push(...copies);commit(next,'Скопированы размеры',copies.map(e=>e.id));return}
  if(action==='delete'){if(!dims.length)throw new Error('Выберите размер');const next=copy(doc);activeDrawingSheet(next).entities=sheet.entities.filter(e=>!dims.some(d=>d.id===e.id));commit(next,'Удалены размеры',[]);return}
  if(['styles','bulk-style','inspection','json','export','select'].includes(action)){setModal(action);return}
  if(action==='history'){setReport('Размеры и группы сохраняются одной транзакцией. Используйте «Отменить чертёж» / «Повторить чертёж» или Ctrl+Z / Ctrl+Y. Cancel не сохраняет черновик.');return}
  throw new Error('Команда недоступна: '+command.id);
 });
 const confirm=()=>run(()=>{
  if(Object.values(raw).some(s=>!s.trim()||!Number.isFinite(Number(s))))throw new Error('Проверьте числовые параметры');
  if(modal.startsWith('group-')&&modal!=='group-origin'){const type=modal.slice(6) as 'chain'|'baseline'|'ordinate';const result=createDimensionGroup(doc,selection,type,{axisAngle:axis,offset,spacing,origin:[ox,oy]});commit(result.document,'Создана группа размеров',result.ids);}
  else if(modal==='group-origin'){const groups=new Set(dims.map(e=>e.dimension!.groupId).filter(Boolean));if(!groups.size)throw new Error('Выберите размер координатной группы');const ids=doc.sheets.flatMap(s=>s.entities).filter(e=>e.dimension?.groupType==='ordinate'&&groups.has(e.dimension.groupId)).map(e=>e.id);commit(updateDimensions(doc,ids,def=>{def.origin=[ox,oy];def.axisAngle=axis}),'Изменён ноль координатной группы');}
  else if(modal==='spacing')commit(spaceDimensions(doc,selection,spacing),'Распределены размерные линии');
  else if(modal==='inspection'){if(!label.trim()||!Number.isFinite(rate)||rate<0||rate>100)throw new Error('Проверьте номер и частоту контроля 0–100%');commit(updateDimensions(doc,selection,def=>{def.inspection={label:label.trim(),rate}}),'Добавлены инспекционные обозначения');}
  else if(modal==='styles'){
   const next=copy(doc),styles=next.dimensionStyles??[];const style=styles.find(s=>s.id===styleId);
   if(styleAction==='save'){if(!dims[0])throw new Error('Выберите размер с нужным оформлением');if(!styleName.trim()||styles.some(s=>s.name===styleName.trim()))throw new Error('Нужно уникальное непустое имя стиля');const saved={...copy(dims[0].dimension!.style),id:drawingId('dim-style'),name:styleName.trim()};next.dimensionStyles=[...styles,saved];commit(next,'Сохранён именованный размерный стиль');setStyleId(saved.id);}
   else if(styleAction==='delete'){if(!style)throw new Error('Выберите стиль');next.dimensionStyles=styles.filter(s=>s.id!==style.id);commit(next,'Удалён стиль из библиотеки: размеры сохраняют оформление');}
   else if(styleAction==='replace'){if(!style||!dims[0])throw new Error('Выберите стиль и размер с новым оформлением');const replacement={...copy(dims[0].dimension!.style),id:style.id,name:style.name};next.dimensionStyles=styles.map(s=>s.id===style.id?replacement:s);for(const s of next.sheets)for(const e of s.entities)if(e.dimension?.style.id===style.id)e.dimension.style=copy(replacement);commit(next,'Обновлён стиль и связанные размеры');}
   else {commit(applyDimensionStyle(doc,selection,style??defaultDimensionStyle()),'Применён размерный стиль');}
  }else if(modal==='bulk-style'){const style=doc.dimensionStyles?.find(s=>s.id===styleId)??defaultDimensionStyle();commit(applyDimensionStyle(doc,selection,style),'Изменено оформление выбранных размеров');}
  else if(modal==='select'){const ids=sheet.entities.filter(e=>{const d=e.dimension;if(!d||filter!=='all'&&d.kind!==filter||styleId&&d.style.id!==styleId)return false;return stateFilter==='all'||stateFilter==='frozen'&&d.frozen||stateFilter==='manual'&&d.manualText!==undefined||stateFilter==='error'&&(()=>{try{evaluateDimension(d,doc);return false}catch{return true}})()}).map(e=>e.id);p.onSelect(ids);setReport(`Выбрано размеров: ${ids.length}`);}
  setModal('');
 });
 const num=(name:string,value:number,write:(n:number)=>void,unit='мм')=><ParameterField label={name} icon={unit==='°'?'angle':'length'} value={raw[name]??String(value)} unit={unit} error={raw[name]!==undefined&&(!raw[name].trim()||!Number.isFinite(Number(raw[name])))?'Введите конечное число':undefined} onChange={s=>{setRaw(previous=>({...previous,[name]:s}));if(s.trim()&&Number.isFinite(Number(s)))write(Number(s))}}/>;
 const unavailable=(command:DimensionCommand)=>{if(command.unavailableReason)return command.unavailableReason;if(!command.requiresSelection)return undefined;const needsGeometry=command.action.startsWith('group-')||command.action==='create-context';if(needsGeometry&&!selected.some(e=>e.kind==='geometry'))return 'Выберите геометрические опоры';if(!needsGeometry&&!dims.length)return 'Выберите размер';if(['align','distribute','copy-style'].includes(command.action)&&dims.length<2)return 'Выберите минимум два размера';return undefined};
 const selectStyle=<label>Стиль<select aria-label="Именованный размерный стиль" value={styleId} onChange={e=>setStyleId(e.target.value)}><option value="">Стандартный</option>{doc.dimensionStyles?.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></label>;
 return <div role="region" aria-label="Инструменты размеров" className="dimension-tools">
  <h2>Размеры и допуски</h2><label>Поиск размеров<input aria-label="Поиск размерных команд" value={query} onChange={e=>setQuery(e.target.value)} placeholder="DIM-001 или название"/></label><small>126 команд · 16 групп · только измерения 2D</small>
  {error&&<p role="alert">{error}</p>}{report&&<pre role="status">{report}</pre>}
  {dimensionCommandGroups.map(group=><section key={group.id} data-dimension-group={group.id}><h3>{group.label}</h3>{group.commands.filter(c=>!query||`${c.id} ${c.label}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(c=><button type="button" key={c.id} data-dimension-command={c.id} aria-label={`${c.id} ${c.label}`} disabled={Boolean(unavailable(c))} title={unavailable(c)??c.description} onClick={()=>button(c)}><TechnicalIcon kind="length" size={18}/><span>{c.label}<small>{c.id}</small></span></button>)}</section>)}
  {editor&&<DimensionEditor document={doc} selection={selection} entity={editor.entity} initialKind={editor.kind} onCancel={closeEditor} onConfirm={definition=>{const result=saveDimension(doc,definition,editor.entity?.id);commit(result.document,editor.entity?'Изменён размер':'Создан размер',result.ids);closeEditor()}}/>}
  {modal&&<Dialog open title={modal.startsWith('group-')?'Группа размеров':modal==='styles'?'Размерные стили':modal==='spacing'?'Интервалы размеров':modal==='inspection'?'Инспекционный размер':modal==='select'?'Выбор размеров':modal==='json'?'Обмен размерами JSON':modal==='export'?'Экспорт размеров':'Оформление размеров'} onCancel={()=>{setModal('');setError('')}} onConfirm={confirm}>
   {error&&<p role="alert">{error}</p>}
   {modal.startsWith('group-')&&<>{num('Угол направления группы',axis,setAxis,'°')}{num('Отступ группы',offset,setOffset)}{num('Интервал группы',spacing,setSpacing)}{num('X начала группы',ox,setOx)}{num('Y начала группы',oy,setOy)}<p>Выберите геометрические опоры на листе перед запуском. Точки сортируются вдоль заданного направления.</p></>}
   {modal==='spacing'&&num('Интервал размеров',spacing,setSpacing)}
   {modal==='inspection'&&<><label>Номер характеристики<input aria-label="Номер характеристики" value={label} onChange={e=>setLabel(e.target.value)}/></label>{num('Частота контроля',rate,setRate,'%')}<p>Это требуемая частота контроля, а не результат фактического измерения.</p></>}
   {['styles','bulk-style','select'].includes(modal)&&selectStyle}
   {modal==='styles'&&<><label>Действие со стилем<select aria-label="Действие со стилем" value={styleAction} onChange={e=>setStyleAction(e.target.value)}><option value="save">Сохранить оформление выбранного размера</option><option value="apply">Применить к выбранным размерам</option><option value="replace">Заменить стиль оформлением выбранного размера</option><option value="delete">Удалить из библиотеки</option></select></label><label>Имя стиля<input aria-label="Имя размерного стиля" value={styleName} onChange={e=>setStyleName(e.target.value)}/></label></>}
   {modal==='select'&&<><label>Вид размера<select aria-label="Фильтр вида размера" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Все</option>{['horizontal','vertical','aligned','rotated','point-line','parallel','radius','diameter','angle','angle3','arc-length','ordinate-x','ordinate-y','chamfer'].map(k=><option key={k}>{k}</option>)}</select></label><label>Состояние<select aria-label="Фильтр состояния размера" value={stateFilter} onChange={e=>setStateFilter(e.target.value)}><option value="all">Все</option><option value="frozen">Снимки</option><option value="manual">Ручная подпись</option><option value="error">Ошибка источника</option></select></label></>}
   {modal==='json'&&<><p>JSON сохраняет весь чертёж со ссылками, размерами и стилями. Импорт заменяет текущий чертёж; доступна отмена.</p><button onClick={()=>download(doc)}>Экспортировать JSON</button><button onClick={()=>{setModal('');p.onImport()}}>Импортировать JSON</button></>}
   {modal==='export'&&<><p>Экспорт активного листа. PDF/SVG — представление; DXF — статические линии и текст, без семантики DIMENSION.</p>{(['svg','pdf','dxf'] as const).map(type=><button key={type} onClick={()=>{setModal('');p.onExport(type)}}>Экспорт {type.toUpperCase()}</button>)}</>}
  </Dialog>}
 </div>;
}
