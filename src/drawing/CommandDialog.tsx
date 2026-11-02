import {useId, useState} from 'react';
import {Dialog, validateNumber} from '../components/dialog';
import {DrawingTextIcon, type DrawingTextIconKind} from './DrawingTextIcon';
import type {DrawingCommand} from './toolkitCatalog';
import type {DrawingCommandInput, DrawingContext, DrawingDocument, DrawingEntity, TextStyle} from './types';
import './drawing.css';

export interface CommandDialogProps {
  command: DrawingCommand;
  document: DrawingDocument;
  selection: string[];
  context: DrawingContext;
  onConfirm: (input: DrawingCommandInput) => void;
  onCancel: () => void;
}
type Values = Record<string, string|boolean>;
type Option = [string, string];
type Field = {key:string;label:string;type:'text'|'textarea'|'number'|'select'|'check'|'color';initial:string|boolean;options?:Option[];min?:number;max?:number;positive?:boolean;integer?:boolean;required?:boolean;unit?:string;icon?:DrawingTextIconKind;help?:string};
const text = (key:string,label:string,initial='',required=false):Field => ({key,label,type:'text',initial,required});
const area = (key:string,label:string,initial='',required=true):Field => ({key,label,type:'textarea',initial,required});
const num = (key:string,label:string,initial:number,min?:number,max?:number,integer=false,unit='мм'):Field => ({key,label,type:'number',initial:String(initial),min,max,integer,unit});
const choice = (key:string,label:string,options:Option[],initial=options[0]?.[0]??''):Field => ({key,label,type:'select',options,initial,required:true});
const check = (key:string,label:string,initial=false):Field => ({key,label,type:'check',initial});
const yesNo:Option[] = [['paper','На бумаге'],['model','В масштабе модели']];
const align:Option[] = [['left','Слева'],['center','По центру'],['right','Справа'],['justify','По ширине']];
const axis:Option[] = [['x','Горизонтально X'],['y','Вертикально Y']];

/** Explicit field schemas map directly to typed operation arguments, never arbitrary JSON. */
export function commandDialogFields({command,document,selection,context}:Omit<CommandDialogProps,'onConfirm'|'onCancel'>, values:Values={}):Field[] {
  const n=Number(command.id.slice(4));
  const sheet=document.sheets.find(s=>s.id===document.activeSheetId)??document.sheets[0];
  const entities=document.sheets.flatMap(s=>s.entities);
  const selected=entities.find(e=>selection.includes(e.id));
  const style=document.styles.find(s=>s.id===selected?.styleId)??document.styles[0];
  const styles:Option[]=document.styles.map(s=>[s.id,s.name]);
  const sources=(filter:(e:DrawingEntity)=>boolean=()=>true):Option[]=>entities.filter(filter).map(e=>[e.id,e.name]);
  const source=(options=sources())=>choice('sourceId','Объект источника',options);
  const styleSelect=()=>choice('styleId','Стиль',styles,selected?.styleId??styles[0]?.[0]);
  const xy=()=>[num('x','X',selected?.x??20),num('y','Y',selected?.y??20)];
  const placement=()=>[...xy(),num('width','Ширина',selected?.width??60,0),num('height','Высота контейнера',selected?.height??20,0)];
  const fontFields=()=>[text('options.fontFamily','Шрифт',style?.fontFamily??'Arial',true),{...num('options.height','Высота текста',style?.height??3.5,0),positive:true},check('options.bold','Жирный',style?.bold),check('options.italic','Курсив',style?.italic)];
  switch(n){
    case 1: case 2: case 3: return [area('text','Текст',selected?.paragraphs.map(p=>p.runs.map(r=>r.text).join('')).join('\n')??''),...placement()];
    case 4:return [num('width','Ширина контейнера',selected?.width??60,0),num('height','Высота контейнера',selected?.height??20,0)];
    case 5:return [area('text','Текст выноски'),...placement()];
    case 6:return [text('value','Номер флага','1',true),area('text','Текст примечания','Примечание'),choice('options.frame','Рамка',[['rectangle','Прямоугольная'],['circle','Круглая'],['capsule','Капсула']]),...xy()];
    case 7:return [num('options.rows','Строки',3,1,100,true,''),num('options.columns','Столбцы',2,1,100,true,''),{...area('text','Данные таблицы TSV','Наименование\tКоличество\nДеталь\t1',false),help:'Ячейки разделяются табуляцией, строки — переносами. Размеры таблицы ограничивают число ячеек.'},...placement()];
    case 8:return [text('options.title','Название',document.properties.title??'',true),text('options.designation','Обозначение',document.properties.designation??'',true),text('options.author','Автор',document.properties.author??'',true),...placement()];
    case 9:return [text('fontFamily','Шрифт',style?.fontFamily??'Arial',true)];
    case 10:return [{...num('number','Высота текста',style?.height??3.5,0),positive:true}];
    case 11:return [check('options.bold','Жирный',true),check('options.italic','Курсив')];
    case 12:return [check('options.underline','Подчёркивание',true),check('options.overline','Надчёркивание'),check('options.strike','Зачёркивание')];
    case 13:return [{...text('options.color','Цвет текста','#202935'),type:'color'},...fontFields().filter(f=>f.key!=='options.height')];
    case 14:return [{...num('number','Коэффициент ширины',1,0,undefined,false,'×'),positive:true}];
    case 15:return [num('number','Наклон символов',0,-85,85,false,'°')];
    case 16:return [num('number','Межсимвольный интервал',0)];
    case 18:return [choice('options.anchor','Якорь',[['top-left','Сверху слева'],['top-center','Сверху по центру'],['top-right','Сверху справа'],['middle-left','Посередине слева'],['middle-center','Центр'],['middle-right','Посередине справа'],['bottom-left','Снизу слева'],['bottom-center','Снизу по центру'],['bottom-right','Снизу справа'],['baseline-left','Базовая линия слева']])];
    case 19:return [choice('value','Выравнивание абзаца',align)];
    case 20:return [{...num('number','Межстрочный интервал',1.2,0,undefined,false,'×'),positive:true}];
    case 21:return [num('options.spaceBefore','Интервал до абзаца',0,0),num('options.spaceAfter','Интервал после абзаца',0,0)];
    case 22:return [num('options.indent','Отступ абзаца',0),num('options.firstIndent','Отступ первой строки',0),text('text','Табуляция, мм через ;','10; 20; 30')];
    case 23:return [choice('value','Тип списка',[['none','Нет'],['bullet','Маркированный'],['number','Нумерованный'],['letter','Буквенный']],'number'),num('number','Начальный номер',1,1,1000000,true,'')];
    case 24:return [num('number','Число колонок',2,1,100,true,''),num('options.gap','Межколонник',5,0),check('options.dynamic','Динамические колонки')];
    case 25:return [choice('value','Разрыв',[['paragraph','Новый абзац'],['line','Новая строка'],['nbsp','Неразрывный пробел']]),text('text','Содержание нового абзаца')];
    case 26:return xy();
    case 27:return [num('angle','Поворот',selected?.rotation??0,undefined,undefined,false,'°')];
    case 28:return [source(sources(e=>e.geometry?.type==='line'))];
    case 29:return [...xy(),check('options.scaleHeight','Масштабировать высоту')];
    case 30:return [choice('value','Выровнять по',[['left','Левому краю'],['center','Центру по X'],['right','Правому краю'],['top','Верхнему краю'],['middle','Центру по Y'],['bottom','Нижнему краю'],['baseline','Базовой линии']])];
    case 31:case 58:return [choice('value','Ось распределения',axis,'y')];
    case 32:return [{...num('number','Радиус дуги',30,0),positive:true},num('angle','Начальный угол',0,undefined,undefined,false,'°'),check('options.clockwise','По часовой стрелке'),check('options.inside','Внутри дуги')];
    case 33:return [choice('value','Ось отражения',axis),num('number','Координата оси',0)];
    case 34:return [choice('value','Действие стиля',[['create','Создать'],['update','Изменить'],['duplicate','Дублировать'],['rename','Переименовать']]),...(values.value&&values.value!=='create'?[styleSelect()]:[]),...(values.value==='update'?[]:[text('text','Название стиля','Новый стиль',true)]),...((values.value??'create')==='create'||values.value==='update'?fontFields():[])];
    case 35:return [styleSelect()];
    case 36:return [source()];
    case 38:return [choice('value','Профиль',[['ISO','ISO'],['ГОСТ','ГОСТ'],['enterprise','Предприятие']]),text('text','Название профиля','Пользовательский профиль',true)];
    case 39:return [choice('options.scaleMode','Размеры текста',yesNo)];
    case 40:return [text('options.layer','Слой',style?.layer??'0',true),check('options.visible','Видимость',true),check('options.printable','Печатать',true),{...text('options.color','Цвет текста','#202935'),type:'color'}];
    case 42:return [check('options.mask','Маска фона',true),{...text('options.maskColor','Цвет маски','#ffffff'),type:'color'},num('options.maskPadding','Отступ маски',1,0),choice('options.frame','Рамка',[['none','Нет'],['rectangle','Прямоугольная'],['circle','Круглая'],['capsule','Капсула']])];
    case 43:return [choice('text','Символ',[['⌀','⌀ Диаметр'],['±','± Плюс-минус'],['°','° Градус'],['∠','∠ Угол'],['⊥','⊥ Перпендикулярность'],['∥','∥ Параллельность'],['µ','µ Микро'],['Ω','Ω Ом'],['\u00a0','Неразрывный пробел']])];
    case 44:return [choice('value','Индекс',[['normal','Обычный'],['super','Верхний'],['sub','Нижний']],'super')];
    case 45:case 46:return [text('options.top',n===45?'Числитель':'Верхнее отклонение','1',true),text('options.bottom',n===45?'Знаменатель':'Нижнее отклонение','2',true),...(n===45?[choice('options.kind','Тип дроби',[['fraction','Горизонтальная'],['diagonal','Диагональная']])]:[])];
    case 47:return [text('options.prefix','Префикс'),text('options.suffix','Суффикс')];
    case 48:return [choice('value','Тип обозначения',[['gdt','Геометрический допуск'],['datum','База']]),text('text','Значение обозначения','0.1',true),choice('options.symbol','Символ допуска',[['⌖','⌖ Позиция'],['⏤','⏤ Прямолинейность'],['⏥','⏥ Плоскостность'],['○','○ Круглость'],['∥','∥ Параллельность'],['⟂','⟂ Перпендикулярность'],['∠','∠ Угол']]),...xy()];
    case 49:return [choice('value','Тип обозначения',[['surface','Шероховатость'],['weld','Сварка']]),text('text','Значение обозначения','Ra 3.2',true),...xy()];
    case 51:return [choice('value','Действие ветви',[['add','Добавить'],['remove','Удалить']]),...(values.value==='remove'?[choice('sourceId','Ветвь выноски',(selected?.leaders??[]).map((b,i)=>[b.id,`Ветвь ${i+1}`]))]:xy())];
    case 52:return [choice('value','Форма выноски',[['polyline','Ломаная'],['arc','Дуга']])];
    case 53:return [choice('value','Наконечник',[['closed','Закрытая стрелка'],['open','Открытая стрелка'],['dot','Точка'],['none','Нет']]),num('number','Размер стрелки',2,0),num('options.landing','Длина полки',5,0)];
    case 54:case 55:return [source([...sources(e=>!selection.includes(e.id)),...context.modelItems.map(i=>[i.id,`Модель: ${i.name}`] as Option)])];
    case 56:return [text('value','Номер позиции','1',true),...xy()];
    case 57:return [source(sources(e=>Boolean(e.technical))),num('number','Номер пункта ТТ',1,1,1000000,true,''),...xy()];
    case 59:case 60:case 61:case 62:case 64:case 74:{
      const forced=n===60?'model':n===61?'formula':n===64?'sheet':n===74?'technical':undefined;
      const kind=String(forced??values['field.kind']??'document');
      const kinds:Option[]=[['document','Документ'],['sheet','Лист'],['model','Деталь модели'],['entity','Объект чертежа'],['formula','Числовая формула'],['technical','Пункт ТТ']];
      const targets:Option[]=kind==='sheet'?document.sheets.map(s=>[s.id,s.name]):kind==='model'?context.modelItems.map(i=>[i.id,i.name]):kind==='technical'?sources(e=>Boolean(e.technical)):sources();
      const keys:Option[]=kind==='document'?[['name','Имя документа'],['id','ID документа'],...Object.keys(document.properties).map(k=>[k,k] as Option)]:kind==='sheet'?[['name','Имя листа'],['number','Номер листа'],['count','Число листов'],['width','Ширина'],['height','Высота'],['scale','Масштаб']]:kind==='model'?[['name','Имя детали'],['kind','Тип'],['group','Группа'],['pos.x','Положение X'],['pos.y','Положение Y'],['pos.z','Положение Z'],['size.x','Размер X'],['size.y','Размер Y'],['size.z','Размер Z']]:kind==='entity'?[['name','Имя объекта'],['x','X'],['y','Y'],['width','Ширина'],['height','Высота'],['rotation','Поворот']]:[];
      return [choice('field.kind','Источник поля',forced?kinds.filter(([k])=>k===forced):kinds,kind),...(kind==='formula'?[]:kind==='document'?[]:[choice('field.targetId','Объект источника',targets,kind==='sheet'?sheet?.id:targets[0]?.[0])]),
        kind==='formula'?text('field.key','Формула','2*(3+4)',true):kind==='technical'?num('field.key','Номер пункта ТТ',1,1,1000000,true,''):choice('field.key','Свойство поля',keys),
        num('field.precision','Точность',2,0,10,true,''),text('field.prefix','Префикс'),text('field.suffix','Суффикс'),text('field.unit','Единицы поля'),text('field.fallback','Если нет источника','⟦нет источника⟧')];
    }
    case 63:case 70:case 71:return [choice('_templateMode','Действие шаблона',[['save','Сохранить выбранный объект'],['insert','Вставить шаблон']],selection.length?'save':'insert'),...(values._templateMode==='insert'||(!values._templateMode&&!selection.length)?[choice('templateId','Шаблон',document.templates.map(t=>[t.id,`${t.category}: ${t.name}`])),...xy()]:[text('text','Название шаблона',selected?.name??'Шаблон',true),text('value','Категория шаблона',n===63?'Основные надписи':'Избранное',true)])];
    case 66:return [choice('value','Действие поля',[['update','Обновить'],['freeze','Зафиксировать'],['restore','Восстановить связь']])];
    case 67:return [area('text','Технические требования','Острые кромки притупить.\nНеуказанные допуски по чертежу.'),...placement()];
    case 68:return [num('number','Пунктов на страницу',10,1,10000,true,'')];
    case 69:return [{...choice('_phrase','Фраза словаря',[['','Своя фраза'],...document.dictionary.map(p=>[p,p] as Option)]),required:false},area('text','Типовая фраза','',true),check('options.save','Сохранить в словарь')];
    case 72:return [choice('value','Целевой лист',document.sheets.filter(s=>s.id!==sheet?.id).map(s=>[s.id,s.name]))];
    case 73:return [text('find','Найти шаблон')];
    case 75:return [text('find','Найти','',true),check('_replace','Заменять совпадения'),...(values._replace?[text('replace','Заменить')]:[]),choice('scope','Область',[['selection','Выделение'],['sheet','Текущий лист'],['document','Документ']],selection.length?'selection':'sheet'),check('caseSensitive','Учитывать регистр'),check('wholeWord','Целое слово')];
    case 76:return [...fontFields(),...xy()];
    case 77:return [choice('value','Регистр',[['upper','ВЕРХНИЙ'],['lower','нижний'],['title','Начальные Прописные']])];
    case 79:return [num('number','Начальный номер',1,1,1000000,true,'')];
    case 80:return [text('find','Найти'),choice('scope','Область',[['sheet','Текущий лист'],['document','Документ']]),choice('styleId','Стиль',[['','Любой стиль'],...styles]),text('fontFamily','Шрифт'),check('caseSensitive','Учитывать регистр'),check('wholeWord','Целое слово')].map(f=>f.key==='styleId'?{...f,required:false}:f);
    case 81:return [styleSelect(),check('options.clearOverrides','Очистить переопределения')];
    case 83:case 84:return [area('text','Текст'),...(n===84?[check('options.plain','Сбросить оформление',true)]:placement())];
    case 97:return [area('text','Текст Unicode',selected?.paragraphs.map(p=>p.runs.map(r=>r.text).join('')).join('\n')??'')];
    case 100:return [choice('value','Действие ревизии',[['save','Сохранить ревизию'],['compare','Сравнить с ревизией']]),...(values.value==='compare'?[choice('sourceId','Ревизия',document.revisions.map(r=>[r.id,r.name]))]:[text('text','Название ревизии',`Ревизия ${document.revisions.length+1}`,true)])];
    default:return [];
  }
}

export function buildDrawingCommandInput(fields:Field[],values:Values):DrawingCommandInput {
  const result:Record<string,unknown>={};
  for(const field of fields){
    if(field.key.startsWith('_'))continue;
    const raw=values[field.key]??field.initial;
    const value=field.type==='number'&&field.key!=='field.key'?Number(raw):raw;
    const [group,key]=field.key.split('.');
    if(key){const target=(result[group]??={}) as Record<string,unknown>;target[key]=value;}
    else if(raw!==''||field.key==='replace')result[field.key]=value;
  }
  return result as DrawingCommandInput;
}

export function CommandDialog(props:CommandDialogProps) {
  const {command,document,selection,context,onConfirm,onCancel}=props;
  const [values,setValues]=useState<Values>({});
  const id=useId();
  const fields=commandDialogFields({command,document,selection,context},values);
  const n=Number(command.id.slice(4));
  const get=(field:Field)=>values[field.key]??field.initial;
  const fieldErrors=fields.map(field=>{
    const raw=String(get(field));
    if(field.required&&!raw.trim())return `${field.label}: заполните значение`;
    if(field.type==='select'&&field.required&&!field.options?.some(([option])=>option===raw))return `${field.label}: выберите доступный объект`;
    if(field.type==='number')return validateNumber(raw,{min:field.min,max:field.max,exclusiveMin:field.positive})?`${field.label}: ${validateNumber(raw,{min:field.min,max:field.max,exclusiveMin:field.positive})}`:field.integer&&!Number.isInteger(Number(raw))?`${field.label}: требуется целое число`:undefined;
    if(field.type==='color'&&!/^#[\da-f]{6}$/i.test(raw))return `${field.label}: требуется цвет #RRGGBB`;
    return undefined;
  });
  let specialError:string|undefined;
  if(command.requiresSelection&&!selection.length&&![63,70,71].includes(n))specialError='Сначала выберите объекты на листе';
  if(n===22){const raw=String(values.text??fields.find(f=>f.key==='text')?.initial??'');const tabs=raw.trim()?raw.split(/[ ,;]+/).map(Number):[];if(tabs.some((v,i)=>!Number.isFinite(v)||v<0||(i>0&&v<=tabs[i-1])))specialError='Позиции табуляции должны быть неотрицательными и строго возрастать';}
  if(n===7){const rows=Number(values['options.rows']??3),columns=Number(values['options.columns']??2);const raw=String(values.text??fields.find(f=>f.key==='text')?.initial??'');const data=raw.replace(/\r\n?/g,'\n').split('\n');if(data.length>rows||data.some(row=>row.split('\t').length>columns))specialError='Данные TSV превышают число строк или столбцов: увеличьте размер таблицы';}
  if(n===80&&!String(values.find??'').trim()&&!String(values.fontFamily??'').trim()&&!String(values.styleId??'').trim())specialError='Укажите текст, стиль или шрифт для поиска';
  if([63,70,71].includes(n)&&(values._templateMode??(selection.length?'save':'insert'))==='save'&&!selection.length)specialError='Для сохранения шаблона выберите объект';
  if(n===75&&String(values.scope??(selection.length?'selection':'sheet'))==='selection'&&!selection.length)specialError='Для поиска в выделении выберите объекты';
  const unavailable=command.unavailableReason;
  const errors=[...fieldErrors.filter(Boolean),specialError,unavailable].filter(Boolean) as string[];
  const confirm=()=>{
    if(errors.length)return;
    const input=buildDrawingCommandInput(fields,values);
    if(n===7)input.options={...input.options,tsv:true};
    if(n===34&&input.value==='create'&&document.styles[0])input.style={...structuredClone(document.styles[0]),...input.options,id:`style-${crypto.randomUUID()}`,name:input.text??'Новый стиль'} as TextStyle;
    onConfirm(input);
  };
  const update=(key:string,value:string|boolean)=>setValues(previous=>{
    const next={...previous,[key]:value};
    if(key==='field.kind'){delete next['field.key'];delete next['field.targetId'];}
    if(key==='_phrase'&&typeof value==='string')next.text=value;
    if(key==='styleId'&&n===34){const style=document.styles.find(s=>s.id===value);if(style){next['options.fontFamily']=style.fontFamily;next['options.height']=String(style.height);next['options.bold']=style.bold;next['options.italic']=style.italic;}}
    return next;
  });
  return <Dialog open title={command.label} onCancel={onCancel} onConfirm={confirm} confirmDisabled={Boolean(errors.length)}>
    <div className="drawing-text-editor" data-command-id={command.id}>
      <p>{command.description}</p>
      <div className="drawing-editor-grid">{fields.map((field,index)=>{
        const fieldId=`${id}-${index}`,error=fieldErrors[index];
        const icon:DrawingTextIconKind=field.icon??(field.key.startsWith('field.')?'field':field.key.includes('style')||field.key.includes('font')?'font':field.key.includes('angle')?'rotation':field.key.includes('source')?'leader':field.key.includes('rows')||field.key.includes('columns')?'paragraph':field.type==='number'?'position':field.type==='color'?'color':'text');
        return <div className="drawing-editor-field" key={field.key}>
          <label htmlFor={fieldId}><DrawingTextIcon kind={icon}/>{field.label}</label>
          {field.type==='textarea'?<textarea id={fieldId} rows={4} value={String(get(field))} aria-invalid={Boolean(error)} aria-describedby={error?`${fieldId}-error`:undefined} onChange={event=>update(field.key,event.target.value)}/>:field.type==='select'?<select id={fieldId} value={String(get(field))} aria-invalid={Boolean(error)} onChange={event=>update(field.key,event.target.value)}>{!field.options?.length&&<option value="">Нет доступных объектов</option>}{field.options?.map(([value,label])=><option value={value} key={value}>{label}</option>)}</select>:field.type==='check'?<input id={fieldId} type="checkbox" checked={Boolean(get(field))} onChange={event=>update(field.key,event.target.checked)}/>:<div className="drawing-number"><input id={fieldId} type={field.type==='color'?'color':'text'} inputMode={field.type==='number'?'decimal':undefined} value={String(get(field))} aria-invalid={Boolean(error)} aria-describedby={error?`${fieldId}-error`:undefined} onChange={event=>update(field.key,event.target.value)}/>{field.unit&&<span>{field.unit}</span>}</div>}
          {field.help&&<small>{field.help}</small>}{error&&<small id={`${fieldId}-error`} className="drawing-editor-error" role="alert">{error}</small>}
        </div>;
      })}</div>
      {!fields.length&&!unavailable&&<p>Параметры не требуются. Подтвердите выполнение команды для текущего документа.</p>}
      {[specialError,unavailable].filter(Boolean).map(error=><p key={error} role="alert" className="drawing-editor-error">{error}</p>)}
      {n===34&&<p className="drawing-editor-hint">Создание использует стандартные значения остальных параметров. Изменение сохраняет существующие параметры стиля.</p>}
      {n===8&&<p className="drawing-editor-hint">Основная надпись хранит связи с указанными свойствами документа.</p>}
      {[48,49,56].includes(n)&&<p className="drawing-editor-hint">Ручное обозначение. Геометрическая и нормативная проверка не выполняется.</p>}
    </div>
  </Dialog>;
}
