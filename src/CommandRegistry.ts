/** Shared declarative command metadata for search, context menus, and shortcuts. */
export type ContextArea='viewport'|'tree'|'component';
export type CommandId='sketch-model'|'exact-model'|'model-note'|'select'|'box'|'cylinder'|'pipe'|'duplicate'|'hide'|'isolate'|'showall'|'delete'|'fit'|'grid'|'wire'|'clear'|'undo'|'redo';
export type CommandContext={selected:boolean;itemCount:number;historyCount:number;futureCount:number};
type Definition={id:CommandId;label:string;hint:string;shortcut?:string;requiresSelection?:boolean;requiresItems?:boolean;requiresHistory?:'undo'|'redo'};
const definitions:Definition[]=[
{id:'sketch-model',label:'Эскизы с ограничениями',hint:'Полилинии, линейные ограничения и параметрическое выдавливание Open CASCADE'},
{id:'exact-model',label:'Точная геометрия',hint:'Open CASCADE: точные тела, булевы операции и STEP в миллиметрах'},
{id:'model-note',label:'Добавить 3D-заметку',hint:'Заметка в модели с мировой опорой или привязкой к компоненту'},
{id:'select',label:'Выбрать',hint:'Режим выбора'},
{id:'box',label:'Добавить блок',hint:'Демонстрационный примитив'},
{id:'cylinder',label:'Добавить цилиндр',hint:'Демонстрационный примитив'},
{id:'pipe',label:'Добавить трубу',hint:'Демонстрационный примитив'},
{id:'duplicate',label:'Дублировать',hint:'Создать копию компонента',requiresSelection:true},
{id:'hide',label:'Скрыть',hint:'Скрыть выбранный компонент',requiresSelection:true},
{id:'isolate',label:'Изолировать',hint:'Показать только выбранный компонент',requiresSelection:true},
{id:'showall',label:'Показать всё',hint:'Показать все компоненты',requiresItems:true},
{id:'delete',label:'Удалить',hint:'Удалить выбранный компонент',shortcut:'Delete',requiresSelection:true},
{id:'fit',label:'Вписать модель',hint:'Вписать вид',shortcut:'F'},
{id:'grid',label:'Показать / скрыть сетку',hint:'Переключить сетку',shortcut:'G'},
{id:'wire',label:'Каркас / затенение',hint:'Переключить режим отображения'},
{id:'clear',label:'Снять выделение',hint:'Сбросить выбор',requiresSelection:true},
{id:'undo',label:'Отменить',hint:'Отменить последнее изменение',shortcut:'Ctrl+Z',requiresHistory:'undo'},
{id:'redo',label:'Повторить',hint:'Повторить изменение',shortcut:'Ctrl+Y',requiresHistory:'redo'},
];
export const commandCatalog=Object.fromEntries(definitions.map(d=>[d.id,d])) as Record<CommandId,Definition>;
export function commandEnabled(id:string,ctx:CommandContext){
 const c=commandCatalog[id as CommandId];if(!c)return false;
 if(c.requiresSelection&&!ctx.selected)return false;
 if(c.requiresItems&&!ctx.itemCount)return false;
 if(c.requiresHistory==='undo'&&!ctx.historyCount)return false;
 if(c.requiresHistory==='redo'&&!ctx.futureCount)return false;
 return true;
}
export function contextCommandIds(area:ContextArea):CommandId[]{
 switch(area){case 'component':return ['model-note','duplicate','hide','isolate','showall','delete'];
 case 'tree':return ['showall','clear','duplicate','hide','delete'];
 case 'viewport':return ['model-note','fit','grid','wire','showall','clear'];}
}
