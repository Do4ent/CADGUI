import {useId,useState,type ReactNode} from 'react';
import {Dialog,ParameterField,validateNumber} from '../../components/dialog';
import {TechnicalIcon,type TechnicalIconKind} from '../../components/icons/TechnicalIcon';
import type {DrawingDocument,DrawingEntity,Point2} from '../types';
import type {DimensionDefinition,DimensionEditorProps,DimensionFormat,DimensionKind,DimensionReference,DimensionStyle,DimensionTolerance} from './types';
import {defaultDimensionDefinition} from './defaults';
import {evaluateDimension,formatDimension} from './engine';
import './dimension.css';

export const dimensionKindOptions:readonly [DimensionKind,string][]=[
 ['horizontal','Горизонтальный'],['vertical','Вертикальный'],['aligned','Параллельный отрезку'],['rotated','Повёрнутый'],
 ['point-line','От точки до линии'],['parallel','Между параллельными линиями'],['radius','Радиус'],['diameter','Диаметр'],
 ['angle','Угол двух линий'],['angle3','Угол по трём точкам'],['arc-length','Длина дуги'],['ordinate-x','Координата X'],['ordinate-y','Координата Y'],['chamfer','Фаска']
];
const clone=<T,>(value:T):T=>structuredClone(value);
const linearKinds=new Set<DimensionKind>(['horizontal','vertical','aligned','rotated','chamfer']);
const circularKinds=new Set<DimensionKind>(['radius','diameter','arc-length']);
const isAngular=(kind:DimensionKind)=>kind==='angle'||kind==='angle3';
const referenceCount=(kind:DimensionKind)=>kind==='angle3'?3:circularKinds.has(kind)||kind.startsWith('ordinate-')?1:2;
const activeGeometry=(document:DrawingDocument):DrawingEntity[]=>(document.sheets.find(sheet=>sheet.id===document.activeSheetId)?.entities??[]).filter(entity=>entity.kind==='geometry'&&entity.geometry);

/** Seed only explicitly selected real geometry; never invent an associative source. */
export function createDimensionEditorDraft(document:DrawingDocument,selection:string[],entity?:DrawingEntity,kind:DimensionKind='aligned'):DimensionDefinition {
 if(entity?.dimension)return clone(entity.dimension);
 const definition=defaultDimensionDefinition(kind);
 const selected=activeGeometry(document).filter(item=>selection.includes(item.id));
 if(linearKinds.has(kind)&&selected[0]?.geometry?.type==='line')definition.refs=[{entityId:selected[0].id}];
 else if(circularKinds.has(kind))definition.refs=[selected.find(item=>kind==='arc-length'?item.geometry?.type==='arc':['ellipse','arc'].includes(item.geometry?.type??''))].map(item=>item?{entityId:item.id}:{});
 else if(kind==='angle'||kind==='parallel')definition.refs=Array.from({length:2},(_,index)=>{const line=selected.filter(item=>item.geometry?.type==='line')[index];return line?{entityId:line.id}:{};});
 else if(kind==='point-line')definition.refs=[selected[0]?{entityId:selected[0].id,anchor:'start'}:{},selected.find(item=>item.geometry?.type==='line'&&item.id!==selected[0]?.id)?{entityId:selected.find(item=>item.geometry?.type==='line'&&item.id!==selected[0]?.id)!.id}:{}];
 else definition.refs=Array.from({length:referenceCount(kind)},(_,index)=>selected[index]?{entityId:selected[index].id,anchor:'start'}:{});
 return definition;
}

function Field({label,icon='profile',children,help}:{label:string;icon?:TechnicalIconKind;children:(id:string)=>ReactNode;help?:string}){
 const id=useId();return <div className="dimension-field"><label htmlFor={id} title={help}><span aria-hidden="true"><TechnicalIcon kind={icon} size={18}/></span>{label}</label>{children(id)}{help&&<small>{help}</small>}</div>;
}
type NumberSpec={key:string;label:string;value:number;change:(value:number)=>void;unit?:string;min?:number;max?:number;integer?:boolean;positive?:boolean;icon?:TechnicalIconKind};
export function dimensionNumberError(raw:string,spec:Pick<NumberSpec,'min'|'max'|'integer'|'positive'>):string|undefined {
 return validateNumber(raw,{min:spec.min,max:spec.max,exclusiveMin:spec.positive})||(spec.integer&&!Number.isInteger(Number(raw))?'Введите целое число':undefined);
}

export function DimensionEditor({document,selection,entity,initialKind='aligned',onConfirm,onCancel}:DimensionEditorProps){
 const [draft,setDraft]=useState(()=>createDimensionEditorDraft(document,selection,entity,initialKind));
 const [submitError,setSubmitError]=useState('');
 const [rawNumbers,setRawNumbers]=useState<Record<string,string>>({});
 const geometry=activeGeometry(document);
 const patchStyle=<K extends keyof DimensionStyle,>(key:K,value:DimensionStyle[K])=>setDraft(previous=>({...previous,style:{...previous.style,[key]:value}}));
 const patchFormat=<K extends keyof DimensionFormat,>(key:K,value:DimensionFormat[K])=>setDraft(previous=>({...previous,format:{...previous.format,[key]:value}}));
 const patchTolerance=<K extends keyof DimensionTolerance,>(key:K,value:DimensionTolerance[K])=>setDraft(previous=>({...previous,tolerance:{...previous.tolerance,[key]:value}}));
 const patchReference=(index:number,reference:DimensionReference)=>setDraft(previous=>({...previous,refs:previous.refs.map((item,i)=>i===index?reference:item)}));
 const clearRaw=(prefix:string)=>setRawNumbers(previous=>Object.fromEntries(Object.entries(previous).filter(([key])=>!key.startsWith(prefix))));
 const numericFields:NumberSpec[]=[];
 const numberField=(spec:NumberSpec)=>{
  numericFields.push(spec);
  const raw=rawNumbers[spec.key]??String(spec.value),error=dimensionNumberError(raw,spec);
  return <ParameterField key={spec.key} label={spec.label} icon={spec.icon??'length'} value={raw} unit={spec.unit} error={error} onChange={value=>{
   setRawNumbers(previous=>({...previous,[spec.key]:value}));if(!dimensionNumberError(value,spec))spec.change(Number(value));
  }}/>;
 };
 const select=<T extends string,>(label:string,value:T,options:readonly (readonly [T,string])[],change:(value:T)=>void,icon:TechnicalIconKind='profile')=><Field label={label} icon={icon}>{id=><select id={id} value={value} onChange={event=>change(event.target.value as T)}>{options.map(([key,name])=><option key={key} value={key}>{name}</option>)}</select>}</Field>;
 const toggle=(label:string,checked:boolean,change:(value:boolean)=>void,icon:TechnicalIconKind='preview')=><Field label={label} icon={icon}>{id=><input id={id} type="checkbox" checked={checked} onChange={event=>change(event.target.checked)}/>}</Field>;
 const text=(label:string,value:string,change:(value:string)=>void,icon:TechnicalIconKind='profile')=><Field label={label} icon={icon}>{id=><input id={id} value={value} onChange={event=>change(event.target.value)}/>}</Field>;
 const styleNumber=(key:'textHeight'|'lineWidth'|'arrowSize'|'extensionOffset'|'extensionOvershoot'|'textGap',label:string,positive=false)=>numberField({key:`style.${key}`,label,value:draft.style[key],unit:'мм',min:0,positive,change:value=>patchStyle(key,value)});
 const formatNumber=(key:'precision'|'roundingIncrement'|'factor'|'alternatePrecision',label:string,integer=false)=>numberField({key:`format.${key}`,label,value:draft.format[key],unit:integer?'':key==='factor'?'×':draft.format.unit,min:0,max:integer?8:undefined,integer,positive:key==='factor',change:value=>patchFormat(key,value)});
 const singleLine=linearKinds.has(draft.kind)&&draft.refs.length===1&&!draft.refs[0].point&&!draft.refs[0].anchor;
 const sourceOptions=(index:number)=>geometry.filter(item=>{
  if(circularKinds.has(draft.kind))return draft.kind==='arc-length'?item.geometry?.type==='arc':['ellipse','arc'].includes(item.geometry?.type??'');
  if(singleLine||draft.kind==='angle'||draft.kind==='parallel'||draft.kind==='point-line'&&index===1)return item.geometry?.type==='line';
  return true;
 });
 const sourceSection=<fieldset><legend>Геометрия и источники</legend>
  {select('Тип размера',draft.kind,dimensionKindOptions,kind=>{
   const selectedIds=[...new Set([...draft.refs.flatMap(ref=>ref.entityId?[ref.entityId]:[]),...selection])];
   const next=createDimensionEditorDraft(document,selectedIds,undefined,kind);
   setDraft(previous=>({...previous,kind,refs:next.refs,format:{...previous.format,unit:isAngular(kind)?'deg':isAngular(previous.kind)?'mm':previous.format.unit,alternateUnit:isAngular(kind)?undefined:previous.format.alternateUnit}}));clearRaw('refs.');
  })}
  {linearKinds.has(draft.kind)&&toggle('Опоры по концам линии',singleLine,enabled=>{
   setDraft(previous=>({...previous,refs:enabled?[{entityId:previous.refs[0]?.entityId}]:[{...previous.refs[0],anchor:previous.refs[0]?.point?undefined:'start'},previous.refs[0]?.entityId?{entityId:previous.refs[0].entityId,anchor:'end'}:{}]}));clearRaw('refs.');
  })}
  <div className="dimension-reference-grid">{draft.refs.map((reference,index)=>{
   const letter=String.fromCharCode(65+index),manual=Boolean(reference.point),sources=sourceOptions(index);
   const pointAnchor=!singleLine&&!circularKinds.has(draft.kind)&&!['parallel','angle'].includes(draft.kind)&&!(draft.kind==='point-line'&&index===1);
   return <fieldset key={index}><legend>Опора {letter}</legend>
    {!singleLine&&select(`Способ опоры ${letter}`,manual?'point':'entity',[['entity','Объект геометрии'],['point','Ручные координаты']] as const,mode=>{patchReference(index,mode==='point'?{point:[0,0]}:{entityId:undefined,anchor:['parallel','angle'].includes(draft.kind)||draft.kind==='point-line'&&index===1?undefined:'start'});clearRaw(`refs.${index}.`);},'direction')}
    {manual?<>
     {numberField({key:`refs.${index}.x`,label:`X опоры ${letter}`,value:reference.point![0],unit:'мм',change:value=>patchReference(index,{point:[value,reference.point![1]]})})}
     {numberField({key:`refs.${index}.y`,label:`Y опоры ${letter}`,value:reference.point![1],unit:'мм',change:value=>patchReference(index,{point:[reference.point![0],value]})})}
     <small>Ручная точка не связана с геометрией.</small>
    </>:<>
     <Field label={`Источник ${letter}`} icon="direction">{id=><select id={id} value={reference.entityId??''} onChange={event=>patchReference(index,{entityId:event.target.value,anchor:reference.anchor??(pointAnchor?'start':undefined)})}>
      <option value="">Выберите источник</option>{reference.entityId&&!sources.some(item=>item.id===reference.entityId)&&<option value={reference.entityId}>Источник недоступен: {reference.entityId}</option>}{sources.map(item=><option key={item.id} value={item.id}>{item.name} · {item.id}</option>)}
     </select>}</Field>
     {pointAnchor&&select(`Якорь ${letter}`,reference.anchor??'start',[['start','Начало'],['end','Конец'],['mid','Середина'],['center','Центр']] as const,anchor=>patchReference(index,{entityId:reference.entityId,anchor}),'direction')}
    </>}
   </fieldset>;
  })}</div>
  {draft.frozen&&<div className="dimension-notice"><strong>Измерение зафиксировано: {draft.frozen.value} {draft.frozen.unit}</strong><p>Опоры сохранены; пересчёт начнётся после снятия фиксации.</p><button type="button" onClick={()=>setDraft(previous=>{const next={...previous};delete next.frozen;if(!next.refs.length)next.refs=Array.from({length:referenceCount(next.kind)},()=>({}));return next;})}>Снять фиксацию</button></div>}
  {draft.groupId&&<p>Группа: {draft.groupId} · {draft.groupType}</p>}
 </fieldset>;

 const placementSection=<fieldset><legend>Размещение</legend><div className="dimension-grid">
  {numberField({key:'offset',label:'Смещение размерной линии',value:draft.offset,unit:'мм',change:value=>setDraft(previous=>({...previous,offset:value}))})}
  {numberField({key:'axisAngle',label:'Угол оси',value:draft.axisAngle,unit:'°',icon:'angle',change:value=>setDraft(previous=>({...previous,axisAngle:value}))})}
  {numberField({key:'origin.x',label:'X начала координат',value:draft.origin[0],unit:'мм',change:value=>setDraft(previous=>({...previous,origin:[value,previous.origin[1]]}))})}
  {numberField({key:'origin.y',label:'Y начала координат',value:draft.origin[1],unit:'мм',change:value=>setDraft(previous=>({...previous,origin:[previous.origin[0],value]}))})}
  {toggle('Положение подписи вручную',Boolean(draft.textPosition),enabled=>{setDraft(previous=>({...previous,textPosition:enabled?clone(previous.origin):undefined}));clearRaw('textPosition.');})}
  {draft.textPosition&&<>
   {numberField({key:'textPosition.x',label:'X подписи',value:draft.textPosition[0],unit:'мм',change:value=>setDraft(previous=>({...previous,textPosition:[value,previous.textPosition![1]]}))})}
   {numberField({key:'textPosition.y',label:'Y подписи',value:draft.textPosition[1],unit:'мм',change:value=>setDraft(previous=>({...previous,textPosition:[previous.textPosition![0],value]}))})}
  </>}
 </div></fieldset>;
 const styleSection=<fieldset><legend>Стиль и оформление</legend><div className="dimension-grid">
  <Field label="Размерный стиль" icon="material">{id=><select id={id} value={draft.style.id} onChange={event=>{const preset=document.dimensionStyles?.find(style=>style.id===event.target.value);if(preset){setDraft(previous=>({...previous,style:clone(preset)}));clearRaw('style.');}}}>
   {!document.dimensionStyles?.some(style=>style.id===draft.style.id)&&<option value={draft.style.id}>{draft.style.name} (локальный)</option>}{document.dimensionStyles?.map(style=><option key={style.id} value={style.id}>{style.name}</option>)}
  </select>}</Field>
  {text('Название размерного стиля',draft.style.name,value=>patchStyle('name',value),'material')}
  {text('Шрифт размера',draft.style.fontFamily,value=>patchStyle('fontFamily',value),'material')}
  {styleNumber('textHeight','Высота текста размера',true)}{styleNumber('lineWidth','Толщина линий',true)}{styleNumber('arrowSize','Размер стрелок',true)}
  {select('Наконечник',draft.style.arrow,[['closed','Закрытая стрелка'],['open','Открытая стрелка'],['tick','Засечка'],['dot','Точка'],['none','Нет']] as const,value=>patchStyle('arrow',value))}
  {toggle('Развернуть стрелки',draft.style.flipArrows,value=>patchStyle('flipArrows',value),'direction')}
  {styleNumber('extensionOffset','Отступ выносных от опор')}{styleNumber('extensionOvershoot','Выступ выносных')}{styleNumber('textGap','Зазор вокруг текста')}
  {select('Размещение стрелок и текста',draft.style.fit,[['auto','Автоматически'],['inside','Внутри'],['outside','Снаружи']] as const,value=>patchStyle('fit',value),'direction')}
  {select('Ориентация текста',draft.style.textOrientation,[['aligned','По размерной линии'],['horizontal','Горизонтально']] as const,value=>patchStyle('textOrientation',value),'direction')}
  {toggle('Скрыть первую выносную',draft.style.hideFirstExtension,value=>patchStyle('hideFirstExtension',value))}
  {toggle('Скрыть вторую выносную',draft.style.hideSecondExtension,value=>patchStyle('hideSecondExtension',value))}
  {toggle('Скрыть размерную линию',draft.style.hideDimensionLine,value=>patchStyle('hideDimensionLine',value))}
  {toggle('Маска текста',draft.style.textMask,value=>patchStyle('textMask',value))}
  <Field label="Цвет размера" icon="material">{id=><input id={id} type="color" value={draft.style.color.slice(0,7)} onChange={event=>patchStyle('color',event.target.value)}/>}</Field>
 </div><small>Параметры оформления хранятся в этом размере. Источники геометрии не изменяются.</small></fieldset>;

 const valueSection=<fieldset><legend>Значение и единицы</legend><div className="dimension-grid">
  {select('Единицы',draft.format.unit,isAngular(draft.kind)?[['deg','Градусы'],['rad','Радианы']]:[['mm','Миллиметры'],['cm','Сантиметры'],['m','Метры'],['in','Дюймы']],value=>patchFormat('unit',value),'length')}
  {formatNumber('precision','Точность',true)}{toggle('Показывать конечные нули',draft.format.trailingZeros,value=>patchFormat('trailingZeros',value))}
  {select('Десятичный разделитель',draft.format.decimalSeparator,[['.','Точка'],[',','Запятая']] as const,value=>patchFormat('decimalSeparator',value))}
  {formatNumber('roundingIncrement','Шаг округления')}{formatNumber('factor','Коэффициент значения')}
  {!isAngular(draft.kind)&&select('Альтернативные единицы',draft.format.alternateUnit??'none',[['none','Нет'],['mm','Миллиметры'],['in','Дюймы']] as const,value=>patchFormat('alternateUnit',value==='none'?undefined:value),'length')}
  {!isAngular(draft.kind)&&draft.format.alternateUnit&&formatNumber('alternatePrecision','Точность альтернативных единиц',true)}
  {text('Префикс',draft.format.prefix,value=>patchFormat('prefix',value))}{text('Суффикс',draft.format.suffix,value=>patchFormat('suffix',value))}
  {toggle('Переопределить текст',draft.manualText!==undefined,enabled=>setDraft(previous=>({...previous,manualText:enabled?'':undefined})))}
  {draft.manualText!==undefined&&text('Ручная подпись',draft.manualText,value=>setDraft(previous=>({...previous,manualText:value})))}
 </div>{draft.manualText!==undefined&&<p className="dimension-notice">Ручная подпись меняет только отображение. Вычисленное значение показано отдельно.</p>}</fieldset>;
 const toleranceSection=<fieldset><legend>Допуск</legend><div className="dimension-grid">
  {select('Режим допуска',draft.tolerance.type,[['none','Без допуска'],['symmetric','Симметричный'],['deviation','Отклонения'],['limits','Предельные значения'],['basic','Базовый размер'],['reference','Справочный размер']] as const,value=>patchTolerance('type',value))}
  {['symmetric','deviation','limits'].includes(draft.tolerance.type)&&<>
   {numberField({key:'tolerance.upper',label:'Верхнее отклонение',value:draft.tolerance.upper,min:draft.tolerance.type==='symmetric'?0:undefined,unit:draft.format.unit,change:value=>patchTolerance('upper',value)})}
   {draft.tolerance.type!=='symmetric'&&numberField({key:'tolerance.lower',label:'Нижнее отклонение',value:draft.tolerance.lower,unit:draft.format.unit,change:value=>patchTolerance('lower',value)})}
   {numberField({key:'tolerance.precision',label:'Точность допуска',value:draft.tolerance.precision,min:0,max:8,integer:true,change:value=>patchTolerance('precision',value)})}
  </>}
 </div></fieldset>;
 const errors=numericFields.flatMap(spec=>{const error=dimensionNumberError(rawNumbers[spec.key]??String(spec.value),spec);return error?[`${spec.label}: ${error}`]:[];});
 if(!draft.style.name.trim())errors.push('Введите название размерного стиля');
 if(!draft.style.fontFamily.trim()||!/^[\p{L}\p{N} _.,-]{1,120}$/u.test(draft.style.fontFamily))errors.push('Введите безопасное имя шрифта');
 if(!/^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(draft.style.color))errors.push('Укажите цвет размера в формате HEX');
 if(draft.manualText!==undefined&&!draft.manualText.trim())errors.push('Введите ручную подпись или снимите переопределение текста');
 if(['deviation','limits'].includes(draft.tolerance.type)&&draft.tolerance.lower>draft.tolerance.upper)errors.push('Нижнее отклонение не может превышать верхнее');
 let computed:string|undefined,formatted:string|undefined;
 try{
  const measurement=evaluateDimension(draft,document);
  computed=`${measurement.value} ${measurement.unit==='deg'?'°':'мм'}`;
  formatted=formatDimension(measurement,draft);
 }catch(error){errors.push(error instanceof Error?error.message:String(error));}
 const confirm=()=>{if(errors.length)return;try{const measurement=evaluateDimension(draft,document);formatDimension(measurement,draft);onConfirm(clone(draft));}catch(error){setSubmitError(error instanceof Error?error.message:String(error))}};
 return <Dialog open title="Редактор размера" onCancel={onCancel} onConfirm={confirm} confirmDisabled={errors.length>0}>
  <div className="dimension-editor" data-dimension-editor="true">
   {submitError&&<p role="alert">{submitError}</p>}
   <p>Измеряющий 2D-размер: опоры → значение → оформление. Подтверждение не изменяет геометрию источников.</p>
   <section className="dimension-preview" aria-label="Предпросмотр размера">
    <span data-dimension-measurement="true">Вычисленное значение: {computed??'не определено'}</span>
    <strong data-dimension-label="true">Подпись: {formatted??'не определена'}</strong>
    {draft.manualText!==undefined&&<span>Ручное переопределение включено</span>}
   </section>
   {['point-line','parallel'].includes(draft.kind)&&<p>Опорные линии рассматриваются как бесконечные прямые.</p>}
   {['angle','angle3'].includes(draft.kind)&&<p>Измеряется меньший угол 0–180°. Выбор внешнего сектора пока недоступен.</p>}
   {sourceSection}{placementSection}{styleSection}{valueSection}{toleranceSection}
   {errors.length>0&&<div className="dimension-errors" role="alert"><strong>Проверьте параметры:</strong><ul>{[...new Set(errors)].map(error=><li key={error}>{error}</li>)}</ul></div>}
  </div>
 </Dialog>;
}
