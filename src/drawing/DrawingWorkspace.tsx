import {useEffect,useRef,useState} from 'react';
import type {Diagnostic,DrawingCommandInput,DrawingContext,DrawingDocument,DrawingEntity} from './types';
import {activeDrawingSheet,cloneDrawing,createTextEntity,drawingId,geometryLineEndpoints,plainText,validateDrawingDocument} from './model';
import {executeDrawingCommand} from './operations';
import {diagnoseDrawing} from './diagnostics';
import {drawingCommands,drawingCommandGroups,getDrawingCommand,type DrawingCommand} from './toolkitCatalog';
import {DrawingSheet} from './DrawingSheet';
import {TextEditor} from './TextEditor';
import {CommandDialog} from './CommandDialog';
import {Dialog} from '../components/dialog';
import {TechnicalIcon} from '../components/icons/TechnicalIcon';
import {exportDrawingDxf,parseDrawingDxf,serializeDrawingSvg} from './exchange/vector';
import './drawing.css';
import './workspace.css';
export type DrawingWorkspaceProps={document:DrawingDocument;context:DrawingContext;selection:string[];onSelect:(ids:string[])=>void;onChange:(doc:DrawingDocument,label:string)=>void;onUndo:()=>void;onRedo:()=>void;historyCount:number;futureCount:number};
type Edit={command:string;entity:DrawingEntity;selection:string[]};
type Files='text'|'dxf'|'json'|'ocr'|'outlines'|'table';
function download(blob:Blob,name:string){const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
const unavailable:Record<string,string>={'TXT-050':'Нет топологических данных отверстий, резьбы и сгибов. Ручные инженерные обозначения доступны в соседних командах.','TXT-091':'Не подключён движок распознавания SHX-геометрии PDF. Доступны импорт текстового DXF и OCR растровых изображений.'};
const nativeIds=new Set(['TXT-017','TXT-102']);
const fontIds=new Set(['TXT-041','TXT-078','TXT-096']);
const readOnly=new Set(['TXT-073','TXT-082','TXT-094','TXT-095']);

/** All mutations cross the validated document hook once; editors operate on detached drafts. */
export function DrawingWorkspace(props:DrawingWorkspaceProps){
 const {document:doc,context,selection,onSelect,onChange,onUndo,onRedo,historyCount,futureCount}=props;
 const root=useRef<HTMLDivElement>(null),file=useRef<HTMLInputElement>(null),fileMode=useRef<Files>('text');
 const [query,setQuery]=useState(''),[command,setCommand]=useState<DrawingCommand|null>(null),[edit,setEdit]=useState<Edit|null>(null);
 const [error,setError]=useState(''),[status,setStatus]=useState('Готово'),[report,setReport]=useState<Diagnostic[]>([]),[reportText,setReportText]=useState('');
 const [busy,setBusy]=useState(false),[progress,setProgress]=useState(0),[zoom,setZoom]=useState(.8),[preview,setPreview]=useState<string|null>(null);
 const [special,setSpecial]=useState<'font'|'spelling'|'native'|'outlines'|'ocr'|'review'|null>(null),[specialId,setSpecialId]=useState('');
 const [choice,setChoice]=useState(''),[value,setValue]=useState(''),[image,setImage]=useState<string|null>(null),[ocrFile,setOcrFile]=useState<File|null>(null);
 const [recognized,setRecognized]=useState(''),[confidence,setConfidence]=useState<number|null>(null);
 const alive=useRef(true),latest=useRef(doc),epoch=useRef(0);latest.current=doc;
 const controller=useRef<AbortController|null>(null);
 const sheet=activeDrawingSheet(doc);
 const selected=sheet.entities.filter(e=>selection.includes(e.id));
 const svg=()=>{const element=root.current?.querySelector<SVGSVGElement>('svg[data-drawing-sheet]');if(!element)throw new Error('Лист ещё не отрисован');return element;};
 const commit=(next:DrawingDocument,label:string,ids=selection)=>{if(!alive.current||latest.current!==doc)return;const validated=validateDrawingDocument(next);onChange(validated,label);onSelect(ids);setStatus(label);setError('');};
 const fail=(reason:unknown)=>setError(reason instanceof Error?reason.message:String(reason));
 const busyTask=async(task:()=>Promise<void>)=>{const request=++epoch.current;setBusy(true);setError('');try{await task();}catch(e){if(alive.current&&epoch.current===request)fail(e);}finally{if(alive.current&&epoch.current===request)setBusy(false);}};
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;epoch.current++;controller.current?.abort();}},[]);
 useEffect(()=>()=>{if(image)URL.revokeObjectURL(image)},[image]);
 useEffect(()=>{const handler=(event:KeyboardEvent)=>{
  if(globalThis.document.querySelector('dialog[open]')||event.defaultPrevented)return;
  const target=event.target as HTMLElement;if(target.closest('input,textarea,select,[contenteditable=true]'))return;
  if((event.ctrlKey||event.metaKey)&&['z','y'].includes(event.key.toLowerCase())){event.preventDefault();event.stopImmediatePropagation();event.key.toLowerCase()==='z'?onUndo():onRedo();return;}
  if(event.key==='Delete'&&selection.length){event.preventDefault();event.stopImmediatePropagation();remove();}
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='d'&&selection.length){event.preventDefault();event.stopImmediatePropagation();duplicate();}
  if(event.key==='Escape'){onSelect([]);setCommand(null);setEdit(null);}
 };window.addEventListener('keydown',handler,true);return()=>window.removeEventListener('keydown',handler,true);});
 const remove=()=>{const next=cloneDrawing(doc);activeDrawingSheet(next).entities=sheet.entities.filter(e=>!selection.includes(e.id));commit(next,'Удалены объекты чертежа',[]);};
 const duplicate=()=>{const next=cloneDrawing(doc);const copies=selected.map(entity=>({...cloneDrawing(entity),id:drawingId(),name:entity.name+' (копия)',x:entity.x+5,y:entity.y+5,leaders:entity.leaders?.map(branch=>({...cloneDrawing(branch),id:drawingId('branch'),points:branch.points.map(([x,y])=>[x+5,y+5] as [number,number])}))}));activeDrawingSheet(next).entities.push(...copies);commit(next,'Созданы копии объектов',copies.map(e=>e.id));};
 const execute=(id:string,input:DrawingCommandInput)=>{
  try{
   let candidate=doc,ids=selection;
   if(['TXT-059','TXT-060','TXT-061','TXT-064','TXT-074'].includes(id)&&!ids.length){candidate=cloneDrawing(doc);const entity=createTextEntity('text','');activeDrawingSheet(candidate).entities.push(entity);ids=[entity.id];}
   const result=executeDrawingCommand(candidate,ids,id,input,context);
   if(JSON.stringify(result.document)!==JSON.stringify(doc))commit(result.document,getDrawingCommand(id)?.label??id,result.selection);else{onSelect(result.selection);setStatus(result.message);setError('');}
   if(result.diagnostics)setReport(result.diagnostics);
   if(readOnly.has(id)||['TXT-035','TXT-081','TXT-097','TXT-100'].includes(id))setReportText(result.message);
   setCommand(null);
  }catch(e){fail(e);}
 };
 const exportSvg=()=>{try{const text=serializeDrawingSvg(svg());download(new Blob([text],{type:'image/svg+xml'}),sheet.name+'.svg');setStatus('SVG экспортирован: текст остаётся редактируемым');}catch(e){fail(e)}};
 const exportDxf=()=>{try{const result=exportDrawingDxf(doc,context);download(new Blob([result.text],{type:'application/dxf'}),sheet.name+'.dxf');setStatus('DXF экспортирован (TEXT/MTEXT/LINE, мм)');setReport(result.warnings.map(message=>({severity:'warning',code:'dxf-loss',message})));}catch(e){fail(e)}};
 const exportPdf=()=>busyTask(async()=>{const {exportDrawingPdf}=await import('./exchange/pdf');const result=await exportDrawingPdf(svg());download(result.blob,sheet.name+'.pdf');setReport(result.warnings.map(message=>({severity:'warning',code:'pdf-font',message})));setStatus('Векторный PDF с текстом экспортирован');});
 const chooseFile=(mode:Files)=>{fileMode.current=mode;if(file.current){file.current.value='';file.current.accept=mode==='ocr'?'image/png,image/jpeg,image/webp':mode==='outlines'?'.ttf,.otf':mode==='dxf'?'.dxf':mode==='json'?'.json':mode==='table'?'.csv,.tsv,.txt':'.txt,.md';file.current.click();}};
 const handleFile=async(event:React.ChangeEvent<HTMLInputElement>)=>{const uploaded=event.currentTarget.files?.[0];if(!uploaded)return;const mode=fileMode.current;await busyTask(async()=>{
  if(uploaded.size>25*1024*1024)throw new Error('Файл превышает 25 МБ');
  if(mode==='ocr'){setOcrFile(uploaded);setImage(URL.createObjectURL(uploaded));setRecognized('');setConfidence(null);setChoice('eng+rus');setSpecial('ocr');return;}
  if(mode==='outlines'){const {drawingSvgToOutlines}=await import('./exchange/outlines');const result=await drawingSvgToOutlines(svg(),await uploaded.arrayBuffer());download(new Blob([result.text],{type:'image/svg+xml'}),sheet.name+'-контуры.svg');setReport(result.warnings.map(message=>({severity:'warning',code:'font-outline',message})));setSpecial(null);return;}
  const text=await uploaded.text();if(!alive.current||latest.current!==doc)return;
  if(mode==='json'){commit(validateDrawingDocument(JSON.parse(text)),'Импортирован чертёж JSON',[]);return;}
  if(mode==='dxf'){const result=parseDrawingDxf(text,doc);commit(result.document,'Импортированы сущности DXF',[]);setReport(result.warnings.map(message=>({severity:'warning',code:'dxf-import',message})));return;}
  if(mode==='table'){const next=cloneDrawing(doc);const lines=text.replace(/\r\n?/g,'\n').trimEnd().split('\n');const delimiter=text.includes('\t')?'\t':';';const rows=lines.map(line=>line.split(delimiter));const entity=createTextEntity('table','');entity.rows=rows.map(row=>row.map(cell=>[{runs:[{text:cell}]}]));entity.width=150;entity.height=Math.max(12,rows.length*8);activeDrawingSheet(next).entities.push(entity);commit(next,'Импортирована таблица (TSV/CSV с ;)',[entity.id]);return;}
  execute('TXT-083',{text});
 });};
 const openEditor=(id:string,existing?:DrawingEntity)=>{if(existing){setEdit({command:'TXT-003',entity:cloneDrawing(existing),selection:[existing.id]});return;}
  const kind=id==='TXT-005'?'leader':'text';const entity=createTextEntity(kind,'');entity.name=kind==='leader'?'Выноска':'Текст';entity.x=20+sheet.entities.length%8*5;entity.y=20+sheet.entities.length%8*10;
  if(kind==='leader')entity.leaders=[{id:drawingId('branch'),points:[[entity.x-12,entity.y+12],[entity.x,entity.y]],shape:'polyline',arrow:'closed',arrowSize:2,landing:5}];
  setEdit({command:id,entity,selection:[]});
 };
 const open=(id:string)=>{
  const definition=getDrawingCommand(id);if(!definition)return;
  setError('');setReportText('');
  if(unavailable[id]){setError(unavailable[id]);return;}
  if(['TXT-001','TXT-002','TXT-005'].includes(id)){openEditor(id);return;}
  if(id==='TXT-003'){if(selected[0])openEditor(id,selected[0]);return;}
  if(id==='TXT-083'){chooseFile('text');return;}
  if(id==='TXT-065'){chooseFile('table');return;}
  if(id==='TXT-087'){exportSvg();return;}if(id==='TXT-088'){void exportPdf();return;}
  if(id==='TXT-089'){setSpecialId(id);setChoice('dxf');setSpecial('outlines');return;}
  if(id==='TXT-090'){setSpecialId(id);setSpecial('outlines');return;}
  if(id==='TXT-092'){chooseFile('ocr');return;}
  if(id==='TXT-093'){setSpecial('review');return;}
  if(fontIds.has(id)){setSpecialId(id);setChoice(id==='TXT-078'?'ru':'Arial');setValue('DejaVu Sans');setSpecial(id==='TXT-078'?'spelling':'font');return;}
  if(nativeIds.has(id)){setSpecialId(id);setChoice(id==='TXT-017'?'vertical':'rtl');setSpecial('native');return;}
  if(id==='TXT-098'){try{setPreview(URL.createObjectURL(new Blob([serializeDrawingSvg(svg())],{type:'image/svg+xml'})));setReport(diagnoseDrawing(doc,context));}catch(e){fail(e)}return;}
  if(['TXT-099','TXT-101'].includes(id)){setReportText('Enter — новая строка; Ctrl+Enter — подтвердить; Escape — отменить черновик. Ctrl+Z / Ctrl+Y — история чертежа; Ctrl+D — копия; Delete — удалить. Модальный редактор удерживает фокус, лист поддерживает выделение рамкой и перенос набора.');return;}
  if(readOnly.has(id)){execute(id,{});return;}
  setCommand(definition);
 };
 const confirmSpecial=()=>{
  if(special==='native'){const next=cloneDrawing(doc);for(const entity of activeDrawingSheet(next).entities.filter(e=>selection.includes(e.id)))entity.overrides=specialId==='TXT-017'?{...entity.overrides,writingMode:choice as 'vertical'|'horizontal'}:{...entity.overrides,direction:choice as 'rtl'|'ltr'};commit(next,'Изменён режим нативной SVG-вёрстки');setSpecial(null);return;}
  if(special==='font'||special==='spelling'){void busyTask(async()=>{const request=epoch.current;const services=await import('./browserServices');if(!alive.current||request!==epoch.current)return;if(special==='spelling'){setReport(await services.checkSpelling(doc,context,choice as 'ru'|'en'));setStatus('Проверка орфографии завершена');}else{setReport(await services.diagnoseFonts(doc));if(specialId==='TXT-041'){if(!alive.current||request!==epoch.current)return;commit(services.applyFontFallback(doc,choice,value),'Сохранена явная подстановка шрифта');}}setSpecial(null);});return;}
  if(special==='ocr'){if(!ocrFile)return;void busyTask(async()=>{const request=epoch.current;const {recognizeDrawingImage}=await import('./exchange/recognition');if(!alive.current||request!==epoch.current)return;controller.current=new AbortController();setProgress(0);const result=await recognizeDrawingImage(ocrFile,choice as 'eng'|'rus'|'eng+rus',setProgress,controller.current.signal);if(!alive.current||request!==epoch.current)return;setRecognized(result.text);setConfidence(result.confidence);setReport(result.warnings.map(message=>({severity:'warning',code:'ocr-review',message})));setSpecial('review');});return;}
  if(special==='review'){execute('TXT-083',{text:recognized});setSpecial(null);return;}
  if(special==='outlines'){if(specialId==='TXT-089'){choice==='import'?chooseFile('dxf'):exportDxf();setSpecial(null);}else{chooseFile('outlines');}return;}
 };
 const addSheet=()=>{const next=cloneDrawing(doc);const id=drawingId('sheet');next.sheets.push({id,name:`Лист ${next.sheets.length+1}`,width:297,height:210,scale:1,entities:[]});next.activeSheetId=id;commit(next,'Добавлен лист',[]);};
 const addReferenceLine=()=>{const next=cloneDrawing(doc);const entity=createTextEntity('geometry','');entity.name='Опорная линия';entity.x=20;entity.y=80;entity.width=100;entity.height=1;entity.geometry={type:'line',points:[[0,0],[100,0]]};activeDrawingSheet(next).entities.push(entity);commit(next,'Создана опорная линия',[entity.id]);};
 const addDimension=()=>{try{
  const source=selected.find(e=>e.kind==='geometry'&&e.geometry?.type==='line');
  if(!source||!geometryLineEndpoints(source))throw new Error('Для размера нужна линия, содержащая ровно две точки');
  const [a,b]=source.geometry!.points!;
  const length=Math.hypot(b[0]-a[0],b[1]-a[1]);
  if(!Number.isFinite(length)||length<=0)throw new Error('Для размера нужна линия ненулевой длины');
  const next=cloneDrawing(doc),entity=createTextEntity('symbol',String(length));
  entity.name='Размер линии';entity.x=source.x;entity.y=source.y+10;
  entity.annotation={type:'dimension',sourceId:source.id,fields:{value:String(Number(length.toFixed(3)))}};
  activeDrawingSheet(next).entities.push(entity);commit(next,'Создан размер опорной линии',[entity.id]);
 }catch(e){fail(e)}};
 const filtered=(definition:DrawingCommand)=>!query||`${definition.id} ${definition.label} ${definition.description}`.toLocaleLowerCase().includes(query.toLocaleLowerCase());
 const blockReason=(definition:DrawingCommand)=>unavailable[definition.id]??((definition.requiresSelection||['TXT-009','TXT-084','TXT-097','TXT-102'].includes(definition.id))&&!selection.length&&!['TXT-063','TXT-070','TXT-071'].includes(definition.id)?'Выберите объект на листе':undefined);
 return <div className="drawing-workspace" ref={root} role="region" aria-label="Инструменты текста чертежа">
  <aside className="drawing-toolbox"><h2>Текст и аннотации</h2><label>Поиск инструмента<input aria-label="Поиск текстовых команд" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Название или TXT-001"/></label><small>{drawingCommands.length} команды · 12 групп</small>
   {drawingCommandGroups.map(group=><section key={group.id} data-drawing-group={group.id}><h3>{group.label}</h3>{group.commands.filter(filtered).map(definition=>{const reason=blockReason(definition);return <button key={definition.id} type="button" data-drawing-command={definition.id} aria-label={`${definition.id} ${definition.label}`} disabled={busy||Boolean(reason)} title={reason??definition.description} onClick={()=>open(definition.id)}><TechnicalIcon kind={definition.icon} size={18}/><span>{definition.label}<small>{definition.id}</small></span>{unavailable[definition.id]&&<span aria-label="Недоступно">⊘</span>}</button>})}</section>)}
  </aside>
  <section className="drawing-studio"><div className="drawing-toolbar" aria-label="Команды листа">
   <button onClick={()=>open('TXT-002')}>Текст</button><button onClick={()=>open('TXT-005')}>Выноска</button><button onClick={()=>open('TXT-007')}>Таблица</button><button onClick={addReferenceLine}>Опорная линия</button><button onClick={addDimension} disabled={!selected.some(e=>e.geometry?.type==='line')}>Размер линии</button>
   <button onClick={onUndo} disabled={!historyCount}>Отменить чертёж</button><button onClick={onRedo} disabled={!futureCount}>Повторить чертёж</button><button onClick={duplicate} disabled={!selection.length}>Копия</button><button onClick={remove} disabled={!selection.length}>Удалить текст</button>
   <button onClick={exportSvg}>Экспорт SVG</button><button onClick={exportDxf}>Экспорт DXF</button><button onClick={()=>void exportPdf()} disabled={busy}>Экспорт PDF</button><button onClick={()=>chooseFile('dxf')}>Импорт DXF</button>
   <button onClick={()=>download(new Blob([JSON.stringify(doc,null,2)],{type:'application/json'}),'чертёж.json')}>JSON чертежа</button><button onClick={()=>chooseFile('json')}>Импорт чертежа JSON</button>
  </div>
  <div className="drawing-sheet-tools"><label>Лист<select aria-label="Лист чертежа" value={doc.activeSheetId} onChange={e=>{commit({...doc,activeSheetId:e.target.value},'Выбран лист',[])}}>{doc.sheets.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><button onClick={addSheet}>Добавить лист</button><label>Масштаб вида<input aria-label="Масштаб вида листа" type="number" min="0.01" step="0.1" value={sheet.scale} onChange={e=>{const n=Number(e.target.value);if(n>0&&Number.isFinite(n)){const next=cloneDrawing(doc);activeDrawingSheet(next).scale=n;commit(next,'Изменён масштаб вида')}}}/></label><label>Экран<select aria-label="Масштаб экрана" value={zoom} onChange={e=>setZoom(Number(e.target.value))}>{[.5,.8,1,1.5,2].map(n=><option key={n} value={n}>{Math.round(n*100)}%</option>)}</select></label><span>мм · SVG-лист · {selection.length} выбрано</span></div>
  {error&&<div role="alert" className="drawing-error">{error}<button aria-label="Закрыть ошибку чертежа" onClick={()=>setError('')}>×</button></div>}
  {busy&&<div role="status">Обработка… {Math.round(progress*100)}% <button onClick={()=>controller.current?.abort()}>Отменить распознавание</button></div>}
  <DrawingSheet document={doc} context={context} selection={selection} onSelect={onSelect} onChange={(next,label)=>{try{commit(next,label)}catch(e){fail(e)}}} onEdit={id=>{const entity=sheet.entities.find(e=>e.id===id);if(entity)openEditor('TXT-003',entity)}} zoom={zoom}/>
  <div role="status" className="drawing-status">{status} · Компоновка и метрики шрифтов приближённые; точное CAD-ядро не подключено.</div>
  <section role="region" aria-label="Проверка чертежа" className="drawing-reports"><button onClick={()=>setReport(diagnoseDrawing(doc,context))}>Проверить чертёж</button>{reportText&&<pre>{reportText}</pre>}{report.length>0?<ul>{report.map((item,i)=><li key={i} data-severity={item.severity}><button onClick={()=>{if(item.entityId)onSelect([item.entityId])}}>{item.message}</button></li>)}</ul>:<span>Замечаний в текущем отчёте нет</span>}</section>
  </section>
  <input ref={file} type="file" hidden aria-label="Файл инструментария чертежа" onChange={e=>void handleFile(e)}/>
  {edit&&<TextEditor entity={edit.entity} styles={doc.styles} onCancel={()=>setEdit(null)} onConfirm={entity=>{try{const result=executeDrawingCommand(doc,edit.selection,edit.command,{entity},context);commit(result.document,edit.command==='TXT-003'?'Изменён текст':'Добавлен текст',result.selection);setEdit(null)}catch(e){fail(e)}}}/>}
  {command&&<CommandDialog key={command.id} command={command} document={doc} selection={selection} context={context} onCancel={()=>setCommand(null)} onConfirm={input=>execute(command.id,input)}/>}
  {special&&<Dialog open title={special==='font'?'Шрифты чертежа':special==='spelling'?'Проверка орфографии':special==='native'?'Направление текста':special==='outlines'?(specialId==='TXT-089'?'Обмен DXF / DWG':'Текст в контуры'):'Распознавание и проверка текста'} onCancel={()=>{controller.current?.abort();epoch.current++;setBusy(false);setSpecial(null)}} onConfirm={confirmSpecial} confirmDisabled={busy||(special==='review'&&!recognized.trim())} confirmLabel={special==='ocr'?'Распознать':special==='review'?'Вставить проверенный текст':'ОК'}>
   {error&&<p role="alert">{error}</p>}{busy&&<label>Распознавание <progress aria-label="Прогресс OCR" value={progress} max={1}/></label>}
   {special==='native'&&<><p>Нативная SVG-вёрстка браузера. Метрики/переносы приближённые; экспорт зависит от выбранного движка.</p><label>Направление<select aria-label="Направление текста" value={choice} onChange={e=>setChoice(e.target.value)}>{(specialId==='TXT-017'?[['horizontal','Горизонтально'],['vertical','Вертикально']]:[['ltr','Слева направо'],['rtl','Справа налево']]).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label></>}
   {special==='font'&&<><p>Исходное имя шрифта сохраняется. Проверка системного наличия и выбранная подстановка выводятся в отчёте.</p><label>Исходный шрифт<input aria-label="Исходный шрифт" value={choice} onChange={e=>setChoice(e.target.value)}/></label>{specialId==='TXT-041'&&<label>Подстановка<input aria-label="Шрифт подстановки" value={value} onChange={e=>setValue(e.target.value)}/></label>}</>}
   {special==='spelling'&&<label>Словарь<select aria-label="Язык орфографии" value={choice} onChange={e=>setChoice(e.target.value)}><option value="ru">Русский</option><option value="en">English</option></select></label>}
   {special==='outlines'&&(specialId==='TXT-089'?<><p>Поддержан DXF R2000: TEXT/MTEXT/LINE, мм. DWG недоступен без отдельного SDK. Связи и сложное оформление могут быть потеряны — экспорт выдаёт предупреждения.</p><label>Действие<select aria-label="Действие DXF" value={choice} onChange={e=>setChoice(e.target.value)}><option value="dxf">Экспорт DXF</option><option value="import">Импорт DXF</option></select></label></>:<p>Выберите лицензированный TTF/OTF-шрифт для преобразования в SVG-контуры. Оригинальный документ остаётся редактируемым. Поиск и живые поля в копии будут потеряны.</p>)}
   {(special==='ocr'||special==='review')&&<>{image&&<img src={image} alt="Исходник для проверки распознавания" style={{maxWidth:'100%',maxHeight:240}}/>}{special==='ocr'?<label>Язык<select aria-label="Язык OCR" value={choice} onChange={e=>setChoice(e.target.value)}><option value="eng+rus">Русский + English</option><option value="rus">Русский</option><option value="eng">English</option></select></label>:<><p>{confidence!==null?`Уверенность OCR: ${confidence.toFixed(1)}%. `:''}Проверьте символы перед вставкой. Исходник доступен в текущей сессии. При перезагрузке останется только подтверждённый текст.</p><label>Проверенный текст<textarea aria-label="Проверенный текст OCR" rows={8} value={recognized} onChange={e=>setRecognized(e.target.value)}/></label></>}</>}
  </Dialog>}
  {preview&&<Dialog open title="Печатный предпросмотр" onCancel={()=>{URL.revokeObjectURL(preview);setPreview(null)}} onConfirm={()=>{const page=window.open('','_blank');if(page){page.document.write(`<html><title>Чертёж</title><body style="margin:0"><img style="width:100%" src="${preview}"></body></html>`);page.document.close();page.onload=()=>page.print();}}} confirmLabel="Печать"><img src={preview} alt="Предпросмотр листа в физических единицах" style={{width:'100%',maxHeight:'70vh'}}/></Dialog>}
 </div>;
}
