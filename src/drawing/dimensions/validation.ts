import type {DimensionDefinition,DimensionStyle} from './types';
const fail=(path:string,message:string):never=>{throw new Error(`${path}: ${message}`)};
function object(value:unknown,allowed:string[],path:string):Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value))return fail(path,'ожидается объект');
 for(const key of Object.keys(value))if(!allowed.includes(key))fail(path,'неподдерживаемое свойство '+key);
 return value as Record<string,unknown>;
}
function text(value:unknown,path:string,nonempty=false){if(typeof value!=='string'||value.length>100000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)||(nonempty&&!value.trim()))fail(path,'некорректный текст');}
function number(value:unknown,path:string,min=-1e12,max=1e12,integer=false){if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max||(integer&&!Number.isInteger(value)))fail(path,'некорректное конечное число');}
function one(value:unknown,values:string[],path:string){if(typeof value!=='string'||!values.includes(value))fail(path,'неподдерживаемое значение');}
function bool(value:unknown,path:string){if(typeof value!=='boolean')fail(path,'ожидается boolean');}
function point(value:unknown,path:string){if(!Array.isArray(value)||value.length!==2)fail(path,'ожидается XY');(value as unknown[]).forEach(n=>number(n,path));}
const styleKeys=['id','name','textHeight','fontFamily','color','lineWidth','arrowSize','arrow','flipArrows','extensionOffset','extensionOvershoot','textGap','fit','textOrientation','hideFirstExtension','hideSecondExtension','hideDimensionLine','textMask'];
export function validateDimensionStyle(value:unknown):DimensionStyle {
 const s=object(value,styleKeys,'dimension.style');
 for(const key of ['id','name','fontFamily'])text(s[key],'style.'+key,true);
 if(!/^[\p{L}\p{N} _.,-]+$/u.test(s.fontFamily as string))fail('style.fontFamily','небезопасное имя шрифта');
 if(typeof s.color!=='string'||!/^#[\da-f]{6}$/i.test(s.color))fail('style.color','ожидается #rrggbb');
 number(s.textHeight,'style.textHeight',.01,1000);number(s.lineWidth,'style.lineWidth',.001,100);
 for(const key of ['arrowSize','extensionOffset','extensionOvershoot','textGap'])number(s[key],'style.'+key,0,10000);
 one(s.arrow,['closed','open','tick','dot','none'],'style.arrow');one(s.fit,['auto','inside','outside'],'style.fit');one(s.textOrientation,['aligned','horizontal'],'style.textOrientation');
 for(const key of ['flipArrows','hideFirstExtension','hideSecondExtension','hideDimensionLine','textMask'])bool(s[key],'style.'+key);
 return JSON.parse(JSON.stringify(s)) as DimensionStyle;
}
export function validateDimensionDefinition(value:unknown):DimensionDefinition {
 const d=object(value,['version','mode','kind','refs','offset','axisAngle','origin','style','format','tolerance','textPosition','manualText','frozen','groupId','groupType','inspection'],'dimension');
 if(d.version!==1)fail('dimension.version','неподдерживаемая версия');one(d.mode,['driven'],'dimension.mode');
 one(d.kind,['horizontal','vertical','aligned','rotated','point-line','parallel','radius','diameter','angle','angle3','arc-length','ordinate-x','ordinate-y','chamfer'],'dimension.kind');
 if(!Array.isArray(d.refs)||(d.refs.length===0&&d.frozen===undefined)||d.refs.length>4)fail('dimension.refs','ожидаются 1–4 опоры');
 (d.refs as unknown[]).forEach((value,index)=>{const path='dimension.refs.'+index,r=object(value,['entityId','anchor','point'],path);
  if((r.entityId!==undefined)===(r.point!==undefined))fail(path,'укажите только entityId или point');
  if(r.entityId!==undefined){text(r.entityId,path+'.entityId',true);if(r.anchor!==undefined)one(r.anchor,['start','end','mid','center'],path+'.anchor');}
  else {point(r.point,path+'.point');if(r.anchor!==undefined)fail(path,'ручная точка не имеет anchor');}
 });
 number(d.offset,'dimension.offset');number(d.axisAngle,'dimension.axisAngle',-360000,360000);point(d.origin,'dimension.origin');validateDimensionStyle(d.style);
 const f=object(d.format,['unit','precision','trailingZeros','decimalSeparator','roundingIncrement','factor','alternateUnit','alternatePrecision','prefix','suffix'],'dimension.format');
 one(f.unit,['mm','cm','m','in','deg','rad'],'format.unit');
 const angular=d.kind==='angle'||d.kind==='angle3';if(angular!==['deg','rad'].includes(f.unit as string))fail('format.unit','единица не соответствует виду размера');
 number(f.precision,'format.precision',0,8,true);number(f.alternatePrecision,'format.alternatePrecision',0,8,true);bool(f.trailingZeros,'format.trailingZeros');one(f.decimalSeparator,['.',','],'format.decimalSeparator');number(f.roundingIncrement,'format.roundingIncrement',0,1e9);number(f.factor,'format.factor',Number.MIN_VALUE,1e9);
 if(f.alternateUnit!==undefined){one(f.alternateUnit,['mm','in'],'format.alternateUnit');if(angular)fail('format.alternateUnit','линейные альтернативные единицы не подходят углу');}
 text(f.prefix,'format.prefix');text(f.suffix,'format.suffix');
 const t=object(d.tolerance,['type','upper','lower','precision'],'dimension.tolerance');one(t.type,['none','symmetric','deviation','limits','basic','reference'],'tolerance.type');number(t.upper,'tolerance.upper');number(t.lower,'tolerance.lower');number(t.precision,'tolerance.precision',0,8,true);
 if(t.type==='symmetric'&&(t.upper as number)<0)fail('tolerance.upper','симметричный допуск неотрицателен');
 if(['deviation','limits'].includes(t.type as string)&&(t.lower as number)>(t.upper as number))fail('tolerance','нижнее отклонение превышает верхнее');
 if(d.textPosition!==undefined)point(d.textPosition,'dimension.textPosition');if(d.manualText!==undefined)text(d.manualText,'dimension.manualText',true);
 if(d.groupId!==undefined)text(d.groupId,'dimension.groupId',true);if(d.groupType!==undefined){one(d.groupType,['chain','baseline','ordinate'],'dimension.groupType');if(d.groupId===undefined)fail('dimension.groupType','нужен groupId');}
 if(d.inspection!==undefined){const i=object(d.inspection,['label','rate'],'dimension.inspection');text(i.label,'inspection.label',true);number(i.rate,'inspection.rate',0,100);}
 if(d.frozen!==undefined){const frozen=object(d.frozen,['value','unit','points','center','radius','startAngle','endAngle','axis'],'dimension.frozen');number(frozen.value,'frozen.value');one(frozen.unit,['mm','deg'],'frozen.unit');if((frozen.unit==='deg')!==angular)fail('frozen.unit','единица не соответствует размеру');if(!Array.isArray(frozen.points)||frozen.points.length<2||frozen.points.length>16)fail('frozen.points','нужны точки');(frozen.points as unknown[]).forEach(p=>point(p,'frozen.points'));for(const key of ['center','axis'])if(frozen[key]!==undefined)point(frozen[key],'frozen.'+key);if(frozen.radius!==undefined)number(frozen.radius,'frozen.radius',Number.MIN_VALUE);for(const key of ['startAngle','endAngle'])if(frozen[key]!==undefined)number(frozen[key],'frozen.'+key);}
 return JSON.parse(JSON.stringify(d)) as DimensionDefinition;
}
