import type {DrawingDocument,DrawingEntity,Point2} from '../types';
import type {DimensionDefinition,DimensionMeasurement,DimensionReference,DimensionFormat,DimensionTolerance,DimensionKind} from './types';

const kinds:DimensionKind[]=['horizontal','vertical','aligned','rotated','point-line','parallel','radius','diameter','angle','angle3','arc-length','ordinate-x','ordinate-y','chamfer'];
const EPS=Number.EPSILON*16;
const radians=(degrees:number)=>degrees*(Math.PI/180);
const degrees=(angle:number)=>angle*(180/Math.PI);
function finite(value:unknown,label:string):number {if(typeof value!=='number'||!Number.isFinite(value))throw new Error(`${label}: требуется конечное число`);return value;}
function point(value:unknown,label:string):Point2 {if(!Array.isArray(value)||value.length!==2)throw new Error(`${label}: поддерживаются только координаты XY, 3D не подключено`);return [finite(value[0],label+' X'),finite(value[1],label+' Y')];}
const add=(a:Point2,b:Point2):Point2=>point([a[0]+b[0],a[1]+b[1]],'Результат координат');
const subtract=(a:Point2,b:Point2):Point2=>point([a[0]-b[0],a[1]-b[1]],'Разность координат');
const multiply=(a:Point2,k:number):Point2=>point([a[0]*k,a[1]*k],'Масштабированные координаты');
const length=(v:Point2):number=>finite(Math.hypot(...v),'Расстояние');
function unit(v:Point2):Point2 {const size=length(v);if(size===0)throw new Error('Нулевая длина не задаёт направление');return [v[0]/size,v[1]/size];}
function dot(a:Point2,b:Point2):number {const scale=Math.max(Math.abs(a[0]),Math.abs(a[1]));if(scale===0)return 0;return finite(((a[0]/scale)*b[0]+(a[1]/scale)*b[1])*scale,'Проекция');}
const cross=(a:Point2,b:Point2):number=>a[0]*b[1]-a[1]*b[0];
const distance=(a:Point2,b:Point2)=>length(subtract(a,b));
function positive(value:number,label:string):number {finite(value,label);if(value<=0)throw new Error(`${label}: требуется положительное значение`);return value;}
const normalizeDegrees=(a:number)=>((a%360)+360)%360;
function entityFor(ref:DimensionReference,doc:DrawingDocument):DrawingEntity {
 if(!ref||typeof ref!=='object'||typeof ref.entityId!=='string'||!ref.entityId)throw new Error('Укажите устойчивую ссылку на геометрию чертежа');
 if(ref.point!==undefined)throw new Error('Ссылка должна содержать либо entityId, либо ручную точку');
 const found=doc.sheets.flatMap(s=>s.entities).filter(e=>e.id===ref.entityId);
 if(found.length!==1)throw new Error(found.length?'Неоднозначный ID геометрии':'Источник размера отсутствует: '+ref.entityId+'; 3D-элементы не поддерживаются');
 return found[0];
}
/** Matches the SVG sheet transform: entity translation, rotation, then style anchor offset. */
function transform(entity:DrawingEntity,local:Point2,doc:DrawingDocument):Point2 {
 const style=doc.styles.find(s=>s.id===entity.styleId);if(!style)throw new Error('Стиль опорного объекта отсутствует');
 const anchor=entity.overrides.anchor??style.anchor,height=entity.overrides.height??style.height;
 const [vertical,horizontal]=anchor.split('-');
 const width=finite(entity.width,'Ширина опоры'),boxHeight=finite(entity.height,'Высота опоры');
 const offset:Point2=[horizontal==='center'?-width/2:horizontal==='right'?-width:0,vertical==='middle'?-boxHeight/2:vertical==='bottom'?-boxHeight:vertical==='baseline'?-finite(height,'Высота шрифта'):0];
 const translated=add(point(local,'Локальная точка'),offset),a=radians(finite(entity.rotation,'Поворот опоры')%360),c=Math.cos(a),s=Math.sin(a);
 return add(point([entity.x,entity.y],'Точка опоры'),point([translated[0]*c-translated[1]*s,translated[0]*s+translated[1]*c],'Поворот точки'));
}
function line(ref:DimensionReference,doc:DrawingDocument):[Point2,Point2] {
 const e=entityFor(ref,doc);if(e.kind!=='geometry'||e.geometry?.type!=='line'||e.geometry.points?.length!==2)throw new Error('Для этого размера нужна настоящая линия с двумя точками');
 const a=transform(e,point(e.geometry.points[0],'Начало линии'),doc),b=transform(e,point(e.geometry.points[1],'Конец линии'),doc);unit(subtract(b,a));return [a,b];
}
function circle(ref:DimensionReference,doc:DrawingDocument):{entity:DrawingEntity;center:Point2;radius:number;rim:Point2} {
 const e=entityFor(ref,doc);if(e.kind!=='geometry'||e.geometry?.type!=='ellipse')throw new Error('Радиус/диаметр поддерживает круг, а не текст, эллипс или 3D-проекцию');
 const w=positive(e.width,'Диаметр круга'),h=positive(e.height,'Диаметр круга');if(Math.abs(w-h)>Math.max(w,h)*EPS)throw new Error('Эллипс с разными осями не является кругом');
 const radius=w/2;positive(radius,'Радиус');return {entity:e,center:transform(e,[w/2,h/2],doc),radius,rim:transform(e,[w,h/2],doc)};
}
function resolvePoint(ref:DimensionReference,doc:DrawingDocument):Point2 {
 if(!ref||typeof ref!=='object')throw new Error('Пустая ссылка размера');
 if(ref.point!==undefined){if(ref.entityId!==undefined)throw new Error('Точка и entityId взаимоисключающие');return point(ref.point,'Ручная точка');}
 const e=entityFor(ref,doc),anchor=ref.anchor??'center';if(!['start','end','mid','center'].includes(anchor))throw new Error('Неизвестная опора точки');
 if(e.geometry?.type==='line'){
  const [a,b]=line(ref,doc);if(anchor==='start')return a;if(anchor==='end')return b;return add(a,multiply(subtract(b,a),0.5));
 }
 if(e.geometry?.type==='arc'){
  const arc=arcGeometry(ref,doc);if(anchor==='center')return arc.center;
  if(anchor==='start')return arc.start;if(anchor==='end')return arc.end;
  const angle=arc.startAngle+(arc.endAngle-arc.startAngle)/2;return add(arc.center,multiply([Math.cos(radians(angle)),Math.sin(radians(angle))],arc.radius));
 }
 const local:Point2=anchor==='start'?[0,0]:anchor==='end'?[e.width,e.height]:[e.width/2,e.height/2];return transform(e,local,doc);
}
function pair(def:DimensionDefinition,doc:DrawingDocument):[Point2,Point2] {
 if(def.refs.length===1&&def.refs[0].entityId&&def.refs[0].anchor===undefined&&def.refs[0].point===undefined)return line(def.refs[0],doc);
 if(def.refs.length!==2)throw new Error('Укажите две точки или одну линию без выбранной опоры');return [resolvePoint(def.refs[0],doc),resolvePoint(def.refs[1],doc)];
}
function arcGeometry(ref:DimensionReference,doc:DrawingDocument){
 const e=entityFor(ref,doc),g=e.geometry;if(e.kind!=='geometry'||g?.type!=='arc')throw new Error('Длина дуги требует явную дугу окружности');
 const radius=positive(finite(g.radius,'Радиус дуги'),'Радиус дуги'),localCenter=g.points?.length?point(g.points[0],'Центр дуги'):[0,0] as Point2;
 const start=finite(g.startAngle,'Начальный угол дуги'),end=finite(g.endAngle,'Конечный угол дуги');if(g.clockwise!==undefined&&typeof g.clockwise!=='boolean')throw new Error('Направление дуги должно быть логическим');
 const raw=end-start;finite(raw,'Разность углов дуги');let span=(g.clockwise!==false?normalizeDegrees(raw):-normalizeDegrees(-raw));if(span===0&&raw!==0)span=g.clockwise!==false?360:-360;
 if(span===0)throw new Error('Нулевая дуга не задаёт длину');
 const a=normalizeDegrees(start)+finite(e.rotation,'Поворот дуги')%360,b=a+span,center=transform(e,localCenter,doc);
 const first=add(center,multiply([Math.cos(radians(a)),Math.sin(radians(a))],radius)),last=add(center,multiply([Math.cos(radians(b)),Math.sin(radians(b))],radius));
 return {center,radius,start:first,end:last,startAngle:a,endAngle:b};
}
function angular(a:Point2,vertex:Point2,b:Point2):DimensionMeasurement {
 const first=unit(subtract(a,vertex)),second=unit(subtract(b,vertex)),signed=degrees(Math.atan2(cross(first,second),dot(first,second))),start=degrees(Math.atan2(first[1],first[0]));
 if(Math.abs(signed)<EPS)throw new Error('Совпадающие лучи не задают ненулевой угол');
 return {value:Math.abs(signed),unit:'deg',points:[a,vertex,b],center:vertex,startAngle:start,endAngle:start+signed};
}
export function evaluateDimension(def:DimensionDefinition,doc:DrawingDocument):DimensionMeasurement {
 if(!def||def.version!==1||def.mode!=='driven'||!kinds.includes(def.kind))throw new Error('Поддерживаются только вычисляемые 2D-размеры версии 1');
 finite(def.offset,'Отступ размера');finite(def.axisAngle,'Угол оси');point(def.origin,'Начало координат');if(!Array.isArray(def.refs))throw new Error('Список опор отсутствует');
 const axisAngle=radians(def.axisAngle%360),axis:Point2=[Math.cos(axisAngle),Math.sin(axisAngle)];
 if(def.frozen){const snapshot=def.frozen;const value=finite(snapshot.value,'Значение снимка');if(!['mm','deg'].includes(snapshot.unit))throw new Error('Неизвестная единица снимка');if(value<0&&!['ordinate-x','ordinate-y'].includes(def.kind))throw new Error('Значение снимка не может быть отрицательным');if(!Array.isArray(snapshot.points)||snapshot.points.length<2)throw new Error('Снимок должен содержать точки размера');const result:DimensionMeasurement={value,unit:snapshot.unit,points:snapshot.points.map(p=>point(p,'Точка снимка'))};if(snapshot.center!==undefined)result.center=point(snapshot.center,'Центр снимка');if(snapshot.axis!==undefined){result.axis=point(snapshot.axis,'Ось снимка');unit(result.axis);}if(snapshot.radius!==undefined)result.radius=positive(finite(snapshot.radius,'Радиус снимка'),'Радиус снимка');if(snapshot.startAngle!==undefined)result.startAngle=finite(snapshot.startAngle,'Начальный угол снимка');if(snapshot.endAngle!==undefined)result.endAngle=finite(snapshot.endAngle,'Конечный угол снимка');formatDimension(result,def);return result;}
 let result:DimensionMeasurement;
 switch(def.kind){
  case 'horizontal':case 'vertical':case 'aligned':case 'rotated':case 'chamfer':{
   const [a,b]=pair(def,doc),vector=subtract(b,a);positive(length(vector),'Расстояние между точками');
   const value=def.kind==='horizontal'?Math.abs(vector[0]):def.kind==='vertical'?Math.abs(vector[1]):def.kind==='aligned'?length(vector):Math.abs(dot(vector,axis));
   if(value===0)throw new Error('Нулевая проекция размера');
   result={value,unit:'mm',points:[a,b],axis:def.kind==='horizontal'?[1,0]:def.kind==='vertical'?[0,1]:def.kind==='aligned'?unit(vector):axis};
   if(def.kind==='chamfer')result.startAngle=degrees(Math.atan2(cross(axis,unit(vector)),dot(unit(vector),axis)));
   break;
  }
  case 'point-line':{if(def.refs.length!==2)throw new Error('Нужны точка и линия');const p=resolvePoint(def.refs[0],doc),[a,b]=line(def.refs[1],doc),direction=unit(subtract(b,a)),foot=add(a,multiply(direction,dot(subtract(p,a),direction)));result={value:distance(p,foot),unit:'mm',points:[p,foot],axis:[-direction[1],direction[0]]};break;}
  case 'parallel':{if(def.refs.length!==2)throw new Error('Нужны две параллельные линии');const [a,b]=line(def.refs[0],doc),[c,d]=line(def.refs[1],doc),u=unit(subtract(b,a)),v=unit(subtract(d,c));if(Math.abs(cross(u,v))>EPS)throw new Error('Выбранные линии не параллельны');const foot=add(c,multiply(v,dot(subtract(a,c),v)));result={value:distance(a,foot),unit:'mm',points:[a,foot],axis:[-u[1],u[0]]};break;}
  case 'radius':case 'diameter':{if(def.refs.length!==1)throw new Error('Укажите один круг');const c=circle(def.refs[0],doc),opposite=add(c.center,multiply(subtract(c.rim,c.center),-1));result={value:def.kind==='radius'?c.radius:finite(c.radius*2,'Диаметр'),unit:'mm',points:def.kind==='radius'?[c.center,c.rim]:[opposite,c.rim],center:c.center,radius:c.radius};break;}
  case 'angle':{if(def.refs.length!==2)throw new Error('Укажите две пересекающиеся линии');const [a,b]=line(def.refs[0],doc),[c,d]=line(def.refs[1],doc),u=unit(subtract(b,a)),v=unit(subtract(d,c)),det=cross(u,v);if(Math.abs(det)<=EPS)throw new Error('Параллельные линии не задают вершину угла');const delta=subtract(c,a),scale=Math.max(Math.abs(delta[0]),Math.abs(delta[1])),t=scale===0?0:finite(cross([delta[0]/scale,delta[1]/scale],v)/det*scale,'Пересечение линий'),vertex=add(a,multiply(u,t));const rayLength=Math.max(1,Math.min(length(subtract(b,a)),length(subtract(d,c))));result=angular(add(vertex,multiply(u,rayLength)),vertex,add(vertex,multiply(v,rayLength)));break;}
  case 'angle3':{if(def.refs.length!==3)throw new Error('Укажите точку первого луча, вершину и точку второго луча');result=angular(resolvePoint(def.refs[0],doc),resolvePoint(def.refs[1],doc),resolvePoint(def.refs[2],doc));break;}
  case 'arc-length':{if(def.refs.length!==1)throw new Error('Укажите одну дугу окружности');const a=arcGeometry(def.refs[0],doc);result={value:finite(a.radius*Math.abs(radians(a.endAngle-a.startAngle)),'Длина дуги'),unit:'mm',points:[a.start,a.center,a.end],center:a.center,radius:a.radius,startAngle:a.startAngle,endAngle:a.endAngle};break;}
  case 'ordinate-x':case 'ordinate-y':{if(def.refs.length!==1)throw new Error('Укажите одну точку для ординаты');const p=resolvePoint(def.refs[0],doc),origin=point(def.origin,'Начало ординат'),basis:Point2=def.kind==='ordinate-x'?axis:[-axis[1],axis[0]];result={value:dot(subtract(p,origin),basis),unit:'mm',points:[origin,p],axis:basis};break;}
 }
 finite(result.value,'Измеренное значение');formatDimension(result,def);return result;
}

function validateFormat(format:DimensionFormat,tolerance:DimensionTolerance){
 if(!format||!['mm','cm','m','in','deg','rad'].includes(format.unit))throw new Error('Неизвестная единица форматирования');
 for(const [label,value] of [['Точность',format.precision],['Точность альтернативной единицы',format.alternatePrecision],['Точность допуска',tolerance?.precision]] as const){finite(value,label);if(!Number.isInteger(value)||value<0||value>8)throw new Error(label+': целое число от 0 до 8');}
 positive(finite(format.factor,'Масштаб значения'),'Масштаб значения');if(finite(format.roundingIncrement,'Шаг округления')<0)throw new Error('Шаг округления не может быть отрицательным');
 if(typeof format.trailingZeros!=='boolean'||!['.',','].includes(format.decimalSeparator))throw new Error('Некорректные параметры десятичной записи');
 if(format.alternateUnit!==undefined&&!['mm','in'].includes(format.alternateUnit))throw new Error('Альтернативные единицы: mm/in');
 for(const value of [format.prefix,format.suffix])if(typeof value!=='string'||/[\u0000-\u001f]/.test(value))throw new Error('Префикс и суффикс должны быть безопасным текстом');
 if(!tolerance||!['none','symmetric','deviation','limits','basic','reference'].includes(tolerance.type))throw new Error('Неизвестный тип допуска');finite(tolerance.upper,'Верхний допуск');finite(tolerance.lower,'Нижний допуск');if(tolerance.type==='symmetric'&&tolerance.upper<0)throw new Error('Симметричный допуск должен быть неотрицательным');if(['deviation','limits'].includes(tolerance.type)&&tolerance.lower>tolerance.upper)throw new Error('Нижний допуск превышает верхний');
}
const linearUnitFactor={mm:1,cm:0.1,m:0.001,in:1/25.4};
function unitFactor(base:'mm'|'deg',unit:DimensionFormat['unit']):number {if(base==='mm'){if(unit==='deg'||unit==='rad')throw new Error('Линейный размер нельзя форматировать угловой единицей');return linearUnitFactor[unit];}if(unit!=='deg'&&unit!=='rad')throw new Error('Угловой размер требует deg/rad');return unit==='rad'?Math.PI/180:1;}
function decimal(value:number,precision:number,format:DimensionFormat):string {
 finite(value,'Форматируемое значение');const step=format.roundingIncrement;
 if(step>0){const quotient=value/step;if(!Number.isFinite(quotient))throw new Error('Шаг округления слишком мал для значения');value=finite(Math.round(quotient)*step,'Результат округления');}
 if(Object.is(value,-0)||Math.abs(value)<0.5*10**(-precision))value=0;
 let text=value.toFixed(precision);if(!format.trailingZeros&&text.includes('.'))text=text.replace(/0+$/,'').replace(/\.$/,'');if(format.decimalSeparator===',')text=text.replace('.',',');return text;
}
function withTolerance(base:number,multiplier:number,format:DimensionFormat,tolerance:DimensionTolerance,precision:number):string {
 const value=finite(base*multiplier,'Отображаемое значение'),number=decimal(value,precision,format),tol=(n:number)=>decimal(finite(n*multiplier,'Отображаемый допуск'),tolerance.precision,format),signed=(n:number)=>(n>=0?'+':'')+tol(n);
 switch(tolerance.type){case 'none':return number;case 'symmetric':return number+' ±'+tol(tolerance.upper);case 'deviation':return number+' '+signed(tolerance.upper)+'/'+signed(tolerance.lower);case 'limits':return decimal(finite((base+tolerance.upper)*multiplier,'Верхний предел'),precision,format)+' / '+decimal(finite((base+tolerance.lower)*multiplier,'Нижний предел'),precision,format);case 'basic':return number;case 'reference':return '('+number+')';}
}
/** Values remain measured data; manual text is an explicit display override. <> inserts the formatted measured value. */
export function formatDimension(measurement:DimensionMeasurement,definition:DimensionDefinition):string {
 const f=definition.format,t=definition.tolerance;validateFormat(f,t);finite(measurement.value,'Измеренное значение');if(!['mm','deg'].includes(measurement.unit))throw new Error('Неизвестная единица измерения');
 const multiplier=finite(f.factor*unitFactor(measurement.unit,f.unit),'Коэффициент единиц');
 let body=withTolerance(measurement.value,multiplier,f,t,f.precision);
 if(definition.kind==='radius')body='R'+body;else if(definition.kind==='diameter')body='⌀'+body;
 if(f.unit==='deg')body+='°';else if(f.unit==='rad')body+=' rad';
 if(definition.kind==='chamfer'){const angle=finite(measurement.startAngle,'Угол фаски');body+=' × '+decimal(Math.abs(angle),f.precision,{...f,roundingIncrement:0})+'°';}
 if(f.alternateUnit){if(measurement.unit!=='mm')throw new Error('Альтернативная линейная единица неприменима к углу');const alt=withTolerance(measurement.value,finite(f.factor*linearUnitFactor[f.alternateUnit],'Альтернативная единица'),{...f,roundingIncrement:0},t,f.alternatePrecision);body+=` [${alt} ${f.alternateUnit}]`;}
 let text=f.prefix+body+f.suffix;
 if(definition.manualText!==undefined){if(typeof definition.manualText!=='string'||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(definition.manualText))throw new Error('Некорректный ручной текст размера');text=definition.manualText.split('<>').join(text);}
 return text;
}
