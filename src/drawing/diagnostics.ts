import {evaluateDimension} from './dimensions/engine';
import type {Diagnostic,DrawingContext,DrawingDocument} from './types';
import {emptyContext,resolveField,resolveStyle,plainText} from './model';
import {layoutText} from './layout';
export function diagnoseDrawing(doc:DrawingDocument,context:DrawingContext=emptyContext):Diagnostic[]{
 const result:Diagnostic[]=[];
 const all=doc.sheets.flatMap(s=>s.entities),ids=new Set(all.map(e=>e.id)),modelIds=new Set(context.modelItems.map(i=>i.id));
 for(const sheet of doc.sheets)for(const entity of sheet.entities){
  const add=(code:string,message:string,severity:Diagnostic['severity']='warning')=>result.push({code,message,severity,entityId:entity.id,sheetId:sheet.id});
  const style=resolveStyle(doc,entity);
  if(entity.dimension){
   try{evaluateDimension(entity.dimension,doc);}catch(error){add('dimension-source',error instanceof Error?error.message:String(error),'error');}
   if(entity.dimension.manualText!==undefined)add('dimension-manual-override','Текст размера заменён вручную; надпись может отличаться от измерения');
   if(entity.dimension.frozen)add('dimension-frozen','Значение размера зафиксировано и не обновляется по источнику');
   if(entity.dimension.refs.some(ref=>ref.point!==undefined))add('dimension-manual-reference','Ручная точка размера не связана с геометрией','info');
  }
  try{if(layoutText(entity,doc,{...context,sheetId:sheet.id}).overflow)add('text-overflow','Текст выходит за границы контейнера (приближённые метрики)');}catch(error){add('layout-error',String(error),'error');}
  if(style.height*(style.scaleMode==='model'?sheet.scale:1)<2)add('small-print-height','Высота текста на бумаге меньше 2 мм');
  if(style.direction==='rtl'||style.writingMode==='vertical')add('shaping-required','Направление/сложные глифы требуют проверки shaping-движком');
  const paragraphs=[...entity.paragraphs,...(entity.rows??[]).flatMap(row=>row.flat())];
  for(const p of paragraphs)for(const run of p.runs)if(run.field&&resolveField(run.field,doc,{...context,sheetId:sheet.id}).broken)add('broken-field','Источник поля недоступен: '+run.field.key,'error');
  for(const leader of entity.leaders??[]){if(leader.attachment?.entityId&&!ids.has(leader.attachment.entityId)||leader.attachment?.modelItemId&&!modelIds.has(leader.attachment.modelItemId))add('broken-leader','Опора выноски недоступна','error');if(leader.shape==='spline')add('spline-backend','Сплайновая выноска требует геометрического backend');}
  if(entity.reference){const ref=entity.reference;const valid=ref.kind==='model'?modelIds.has(ref.targetId):ref.kind==='sheet'?doc.sheets.some(s=>s.id===ref.targetId):ids.has(ref.targetId);if(!valid)add('broken-reference','Цель ссылки недоступна','error');}
  if(entity.annotation?.sourceId&&!ids.has(entity.annotation.sourceId)&&!modelIds.has(entity.annotation.sourceId))add('broken-annotation-source',entity.dimension?.frozen?'Исходный объект снимка недоступен; используется явно зафиксированное значение':'Источник обозначения недоступен',entity.dimension?.frozen?'info':'error');
  if(entity.annotation&&['hole','thread','bend'].includes(entity.annotation.type)&&entity.annotation.fields.mode!=='manual')add('unsupported-derived-annotation','Нет данных точного CAD-элемента для вычисленного обозначения','error');
  if(plainText(entity,doc,context).includes('\ufffd'))add('replacement-character','Найден символ замены Unicode; проверьте кодировку');
  if(entity.x<0||entity.y<0||entity.x+entity.width>sheet.width||entity.y+entity.height>sheet.height)add('outside-sheet','Контейнер выходит за границы листа');
 }
 for(const sheet of doc.sheets){const visible=sheet.entities.filter(e=>resolveStyle(doc,e).visible);for(let i=0;i<visible.length;i++)for(let j=i+1;j<visible.length;j++){const a=visible[i],b=visible[j];if(a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y)result.push({severity:'warning',code:'overlap',message:`Пересечение контейнеров: ${a.name} / ${b.name}; поворот не учитывается`,entityId:a.id,sheetId:sheet.id});}}
 return result;
}
