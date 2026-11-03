import type {DrawingDocument,DrawingEntity,Point2} from '../types';
import type {DimensionDefinition,DimensionStyle,DimensionKind} from './types';
import {activeDrawingSheet,cloneDrawing,createTextEntity,drawingId,validateDrawingDocument} from '../model';
import {evaluateDimension,formatDimension} from './engine';
import {defaultDimensionDefinition,defaultDimensionStyle} from './defaults';
import {validateDimensionDefinition} from './validation';
import {dimensionLabelLines,layoutDimension} from './layout';
const dimensions=(doc:DrawingDocument,ids:string[])=>ids.map(id=>doc.sheets.flatMap(s=>s.entities).find(e=>e.id===id)).filter((e):e is DrawingEntity=>Boolean(e?.dimension));
export function createDimensionEntity(document:DrawingDocument,definition:DimensionDefinition,existing?:DrawingEntity):DrawingEntity{
 const def=validateDimensionDefinition(definition);evaluateDimension(def,document);
 const entity=existing?cloneDrawing(existing):createTextEntity('symbol','',document.styles.find(s=>s.id==='default')?.id??document.styles[0].id);
 if(!existing)Object.assign(entity,{x:0,y:0,width:0,height:0,name:'Размер'});
 else if(!existing.dimension)Object.assign(entity,{x:0,y:0,width:0,height:0});
 entity.kind='symbol';entity.dimension=def;
 entity.annotation={type:'dimension',fields:{mode:'driven-2d'},prefix:def.format.prefix,suffix:def.format.suffix};
 const source=def.refs.find(ref=>ref.entityId)?.entityId;if(source)entity.annotation.sourceId=source;
 return entity;
}
export function saveDimension(document:DrawingDocument,definition:DimensionDefinition,editId?:string):{document:DrawingDocument;ids:string[]}{
 const next=cloneDrawing(document),sheet=activeDrawingSheet(next),old=editId?sheet.entities.find(e=>e.id===editId):undefined;
 if(editId&&!old)throw new Error('Редактируемый размер не найден');
 const entity=createDimensionEntity(next,definition,old);
 if(old)sheet.entities=sheet.entities.map(e=>e.id===old.id?entity:e);else sheet.entities.push(entity);
 return {document:validateDrawingDocument(next),ids:[entity.id]};
}
export function updateDimensions(document:DrawingDocument,ids:string[],update:(definition:DimensionDefinition,entity:DrawingEntity)=>void):DrawingDocument{
 const next=cloneDrawing(document),selected=dimensions(next,ids);if(!selected.length)throw new Error('Выберите размер');
 for(const entity of selected){update(entity.dimension!,entity);entity.dimension=validateDimensionDefinition(entity.dimension);if(!entity.dimension.frozen)evaluateDimension(entity.dimension,next);if(entity.annotation){entity.annotation.prefix=entity.dimension.format.prefix;entity.annotation.suffix=entity.dimension.format.suffix;}}
 return validateDrawingDocument(next);
}
export function freezeDimensions(document:DrawingDocument,ids:string[],detach=false):DrawingDocument{
 const restore=!detach&&dimensions(document,ids).every(e=>e.dimension!.frozen);
 return updateDimensions(document,ids,(def,entity)=>{if(restore){delete def.frozen;}else {def.frozen=cloneDrawing(evaluateDimension(def,document));if(detach){def.refs=[];if(entity.annotation)delete entity.annotation.sourceId;}}});
}
export function copyDimensionStyle(document:DrawingDocument,ids:string[]):DrawingDocument{
 const selected=dimensions(document,ids);if(selected.length<2)throw new Error('Выберите источник оформления первым, затем другие размеры');
 const source=cloneDrawing(selected[0].dimension!.style);return updateDimensions(document,ids.slice(1),def=>{def.style=cloneDrawing(source)});
}
export function applyDimensionStyle(document:DrawingDocument,ids:string[],style:DimensionStyle):DrawingDocument{return updateDimensions(document,ids,def=>{def.style=cloneDrawing(style)});}
export function resetDimensionStyle(document:DrawingDocument,ids:string[]):DrawingDocument{return updateDimensions(document,ids,def=>{def.style=cloneDrawing(document.dimensionStyles?.find(s=>s.id===def.style.id)??defaultDimensionStyle())});}
function pointFor(document:DrawingDocument,entity:DrawingEntity,anchor:'start'|'end'|'center'):Point2{
 const def=defaultDimensionDefinition('ordinate-x');def.refs=[{entityId:entity.id,anchor}];return evaluateDimension(def,document).points[1];
}
export function createDimensionGroup(document:DrawingDocument,ids:string[],type:'chain'|'baseline'|'ordinate',options:{axisAngle:number;offset:number;spacing:number;origin:Point2}):{document:DrawingDocument;ids:string[]}{
 if(![options.axisAngle,options.offset,options.spacing,...options.origin].every(Number.isFinite)||options.spacing<=0)throw new Error('Проверьте угол, отступ, начало и положительный интервал');
 const sheet=activeDrawingSheet(document),sources=ids.map(id=>sheet.entities.find(e=>e.id===id)).filter((e):e is DrawingEntity=>e?.kind==='geometry');if(!sources.length)throw new Error('Выберите геометрические опоры группы');
 const refs:SourcePoint[]=[];
 function add(entity:DrawingEntity,anchor:'start'|'end'|'center'){const point=pointFor(document,entity,anchor);if(!refs.some(r=>Math.hypot(r.point[0]-point[0],r.point[1]-point[1])<1e-8))refs.push({entityId:entity.id,anchor,point});}
 for(const entity of sources){if(entity.geometry?.type==='line'){add(entity,'start');add(entity,'end')}else if(entity.geometry?.type==='ellipse'||entity.geometry?.type==='arc')add(entity,'center');}
 const a=options.axisAngle*Math.PI/180,u:Point2=[Math.cos(a),Math.sin(a)];refs.sort((a,b)=>(a.point[0]-b.point[0])*u[0]+(a.point[1]-b.point[1])*u[1]);
 if(refs.length<(type==='ordinate'?1:2))throw new Error('Недостаточно различных опор для группы');
 const next=cloneDrawing(document),groupId=drawingId('dimension-group'),created:DrawingEntity[]=[];
 const ref=(r:SourcePoint)=>({entityId:r.entityId,anchor:r.anchor});
 for(let i=type==='ordinate'?0:1;i<refs.length;i++){
  const def=defaultDimensionDefinition(type==='ordinate'?'ordinate-x':'rotated');def.refs=type==='ordinate'?[ref(refs[i])]:[ref(refs[type==='chain'?i-1:0]),ref(refs[i])];
  Object.assign(def,{axisAngle:options.axisAngle,origin:options.origin,offset:options.offset+(type==='baseline'?i-1:i)*options.spacing,groupId,groupType:type});
  created.push(createDimensionEntity(next,def));
 }
 activeDrawingSheet(next).entities.push(...created);return {document:validateDrawingDocument(next),ids:created.map(e=>e.id)};
}
type SourcePoint={entityId:string;anchor:'start'|'end'|'center';point:Point2};
export function spaceDimensions(document:DrawingDocument,ids:string[],spacing:number):DrawingDocument{
 const selected=dimensions(document,ids);if(selected.length<2)throw new Error('Выберите минимум два размера');if(!Number.isFinite(spacing)||spacing<0)throw new Error('Интервал должен быть неотрицательным');
 const measured=selected.map(entity=>{const def=entity.dimension!;if(!['horizontal','vertical','aligned','rotated'].includes(def.kind))throw new Error('Разместите только совместимые линейные размеры');const m=evaluateDimension(def,document),a=def.kind==='horizontal'?0:def.kind==='vertical'?Math.PI/2:def.kind==='rotated'?def.axisAngle*Math.PI/180:Math.atan2(m.points[1][1]-m.points[0][1],m.points[1][0]-m.points[0][0]);const u:Point2=[Math.cos(a),Math.sin(a)],n:Point2=[-u[1],u[0]];return {entity,m,u,n};});
 const base=measured[0],dot=(a:Point2,b:Point2)=>a[0]*b[0]+a[1]*b[1];if(measured.some(x=>Math.abs(dot(base.u,x.u))<1-1e-8))throw new Error('Размерные линии должны быть параллельны');
 const target=dot(base.m.points[0],base.n)+base.entity.dimension!.offset+dot([base.entity.x,base.entity.y],base.n);
 const targets=new Map(measured.map((x,i)=>[x.entity.id,(target+i*spacing)*dot(x.n,base.n)-dot(x.m.points[0],x.n)-dot([x.entity.x,x.entity.y],x.n)]));
 return updateDimensions(document,ids,(def,entity)=>{def.offset=targets.get(entity.id)!});
}
export function dimensionReport(document:DrawingDocument):string[]{
 const result:string[]=[],seen=new Map<string,string>(),labels:{id:string;x:number;y:number;right:number;bottom:number}[]=[];
 for(const sheet of document.sheets)for(const entity of sheet.entities)if(entity.dimension){const def=entity.dimension;
  try{const m=evaluateDimension(def,document);result.push(`${entity.name}: ${formatDimension(m,def)} (${m.value} ${m.unit})${def.manualText!==undefined?' — ручная подпись':''}${def.frozen?' — снимок':''}`);
   const key=JSON.stringify([def.kind,[...new Set(def.refs.flatMap(ref=>ref.entityId?[ref.entityId]:[]))].sort(),m.points,def.origin,def.axisAngle]);if(!def.frozen&&seen.has(key))result.push(`Возможный дубликат: ${entity.name} / ${seen.get(key)}`);else seen.set(key,entity.name);
   const layout=layoutDimension(entity,document),lines=dimensionLabelLines(def,layout.label),h=def.style.textHeight*1.2*Math.max(1,lines.length),w=Math.max(1,...lines.map(line=>Array.from(line).length))*def.style.textHeight*.6,a=layout.text.rotation*Math.PI/180;const corners=[[-w/2,-h/2],[-w/2,h/2],[w/2,-h/2],[w/2,h/2]].map(([x,y])=>[layout.text.x+x*Math.cos(a)-y*Math.sin(a),layout.text.y+x*Math.sin(a)+y*Math.cos(a)]);labels.push({id:entity.id,x:Math.min(...corners.map(p=>p[0])),y:Math.min(...corners.map(p=>p[1])),right:Math.max(...corners.map(p=>p[0])),bottom:Math.max(...corners.map(p=>p[1]))});
  }catch(error){result.push(`${entity.name}: ${error instanceof Error?error.message:String(error)}`)}
 }
 if(labels.length>1000)result.push('Проверка пересечений ограничена первыми 1000 подписями');
 for(let i=0;i<Math.min(labels.length,1000);i++)for(let j=i+1;j<Math.min(labels.length,1000);j++){const a=labels[i],b=labels[j];if(a.x<b.right&&a.right>b.x&&a.y<b.bottom&&a.bottom>b.y)result.push(`Возможное пересечение подписей: ${a.id} / ${b.id} (приближённые метрики)`)}
 return result.length?result:['Размеры не найдены'];
}
