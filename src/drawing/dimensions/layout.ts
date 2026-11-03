import type {DrawingDocument,DrawingEntity,Point2} from '../types';
import type {DimensionLayout,DimensionPrimitive,DimensionStyle} from './types';
import {evaluateDimension,formatDimension} from './engine';
const add=(a:Point2,b:Point2):Point2=>[a[0]+b[0],a[1]+b[1]];
const sub=(a:Point2,b:Point2):Point2=>[a[0]-b[0],a[1]-b[1]];
const mul=(a:Point2,s:number):Point2=>[a[0]*s,a[1]*s];
const dot=(a:Point2,b:Point2)=>a[0]*b[0]+a[1]*b[1];
const unit=(a:Point2):Point2=>{const n=Math.hypot(...a);return n>1e-10?mul(a,1/n):[1,0];};
const polar=(center:Point2,r:number,angle:number):Point2=>add(center,[r*Math.cos(angle*Math.PI/180),r*Math.sin(angle*Math.PI/180)]);
const readable=(angle:number)=>{let a=((angle+180)%360+360)%360-180;if(a>90)a-=180;if(a< -90)a+=180;return a;};
/** Display tolerance stacks while retaining the formatter's complete semantic label. */
export function dimensionLabelLines(def:NonNullable<DrawingEntity['dimension']>,label:string):string[]{
 if(def.manualText!==undefined||def.format.alternateUnit)return label.split('\n');
 if(def.tolerance.type==='limits')return label.split(' / ');
 if(def.tolerance.type==='deviation'){
  const match=label.match(/^(.*?) ([+-][^/]+)\/([+-].*)$/);
  if(match)return [match[1],match[2],match[3]];
 }
 return label.split('\n');
}
/** World-paper layout; entity x/y is a placement delta, never a source transform. */
export function layoutDimension(entity:DrawingEntity,document:DrawingDocument):DimensionLayout{
 const def=entity.dimension;if(!def)throw new Error('Отсутствует определение размера');
 const measurement=evaluateDimension(def,document),label=formatDimension(measurement,def),style=def.style;
 const primitives:DimensionPrimitive[]=[],extent:Point2[]=[],warnings:string[]=[];
 const delta:Point2=[entity.x,entity.y];
 const h=style.textHeight,lines=dimensionLabelLines(def,label),textWidth=Math.max(1,...lines.map(line=>Array.from(line).length))*.6*h,textHeight=Math.max(1,lines.length)*h*1.2;
 let text:DimensionLayout['text']={x:0,y:0,rotation:0,height:h,anchor:'middle'};
 const line=(a:Point2,b:Point2)=>{primitives.push({type:'line',a,b});extent.push(a,b);};
 const path=(d:string,points:Point2[])=>{primitives.push({type:'path',d});extent.push(...points);};
 const circle=(center:Point2,radius:number,fill=false)=>{primitives.push({type:'circle',center,radius,fill});extent.push(add(center,[-radius,-radius]),add(center,[radius,radius]));};
 const arrow=(tip:Point2,inward:Point2,outside:boolean)=>{
  if(style.arrow==='none'||style.arrowSize<=0)return;const size=style.arrowSize,dir=mul(unit(inward),outside!==style.flipArrows?-1:1),normal:Point2=[-dir[1],dir[0]];
  if(style.arrow==='dot'){circle(tip,size*.22,true);return;}
  if(style.arrow==='tick'){const a=add(tip,mul(add(dir,normal),-size*.45)),b=add(tip,mul(add(dir,normal),size*.45));line(a,b);return;}
  const a=add(add(tip,mul(dir,size)),mul(normal,size*.33)),b=add(add(tip,mul(dir,size)),mul(normal,-size*.33));
  path(`M ${a.join(' ')} L ${tip.join(' ')} L ${b.join(' ')}${style.arrow==='closed'?' Z':''}`,[tip,a,b]);
 };
 const extension=(source:Point2,end:Point2,hidden:boolean)=>{if(hidden)return;const direction=unit(sub(end,source));if(Math.hypot(...sub(end,source))<1e-9)return;line(add(source,mul(direction,style.extensionOffset)),add(end,mul(direction,style.extensionOvershoot)));};
 const arc=(center:Point2,r:number,start:number,span:number)=>{
  start=((start%360)+360)%360;
  const a=polar(center,r,start),b=polar(center,r,start+span),sweep=span>=0?1:0;
  const samples=[a,b];for(let angle=-720;angle<=1080;angle+=90){const progress=span>=0?angle-start:start-angle;if(progress>=0&&progress<=Math.abs(span))samples.push(polar(center,r,angle));}
  if(Math.abs(span)>=359.999999){const middle=polar(center,r,start+span/2);path(`M ${a.join(' ')} A ${r} ${r} 0 1 ${sweep} ${middle.join(' ')} A ${r} ${r} 0 1 ${sweep} ${b.join(' ')}`,samples);}
  else path(`M ${a.join(' ')} A ${r} ${r} 0 ${Math.abs(span)>180?1:0} ${sweep} ${b.join(' ')}`,samples);
 };
 const position=(fallback:Point2,rotation:number)=>{const p=def.textPosition?add(def.textPosition,delta):fallback;text={x:p[0],y:p[1],rotation:style.textOrientation==='horizontal'?0:readable(rotation),height:h,anchor:'middle'};};
 const fitOutside=(available:number)=>style.fit==='outside'||style.fit==='auto'&&available<textWidth+style.textGap*2+style.arrowSize*4;
 const segmentWithTextGap=(a:Point2,b:Point2)=>{
  if(style.hideDimensionLine)return;const axis=unit(sub(b,a)),distance=Math.hypot(...sub(b,a)),normal:Point2=[-axis[1],axis[0]],textPoint:Point2=[text.x,text.y];
  const relative=sub(textPoint,a),along=dot(relative,axis),across=Math.abs(dot(relative,normal));
  const relativeAngle=(text.rotation-Math.atan2(axis[1],axis[0])*180/Math.PI)*Math.PI/180;
  const gap=(Math.abs(Math.cos(relativeAngle))*textWidth+Math.abs(Math.sin(relativeAngle))*textHeight)/2+style.textGap;
  if(across<=textHeight/2+style.textGap&&along>0&&along<distance){const before=Math.max(0,along-gap),after=Math.min(distance,along+gap);if(before>0)line(a,add(a,mul(axis,before)));if(after<distance)line(add(a,mul(axis,after)),b);}
  else line(a,b);
 };
 const points=measurement.points;if(points.length<2)throw new Error('Недостаточно опорных точек размера');
 if(['angle','angle3','arc-length'].includes(def.kind)){
  const center=measurement.center??points[1];if(!center||measurement.startAngle===undefined||measurement.endAngle===undefined)throw new Error('Нет центра/углов для дугового размера');
  const start=measurement.startAngle,span=measurement.endAngle-start,mid=start+span/2,radial:Point2=[Math.cos(mid*Math.PI/180),Math.sin(mid*Math.PI/180)];
  if(!Number.isFinite(span)||Math.abs(span)>360+1e-8||Math.abs(span)<1e-8)throw new Error('Некорректный угловой диапазон размера');
  const sourceRadius=measurement.radius??Math.max(1,Math.hypot(...sub(points[0],center)));
  const radius=def.kind==='arc-length'?sourceRadius+def.offset+dot(delta,radial):Math.abs(def.offset)+dot(delta,radial);
  if(!(radius>1e-8))throw new Error('Радиус размещения размера должен быть положительным');
  const a=polar(center,radius,start),b=polar(center,radius,start+span),outside=fitOutside(radius*Math.abs(span)*Math.PI/180);
  const sourceA=def.kind==='arc-length'?polar(center,sourceRadius,start):points[0],sourceB=def.kind==='arc-length'?polar(center,sourceRadius,start+span):points.at(-1)!;
  extension(sourceA,a,style.hideFirstExtension);extension(sourceB,b,style.hideSecondExtension);
  const textRadius=radius+(outside?h+style.textGap:0),fallback=add(polar(center,textRadius,mid),mul([-radial[1],radial[0]],dot(delta,[-radial[1],radial[0]])));
  position(fallback,mid+90);
  if(!style.hideDimensionLine){const gap=(textWidth/2+style.textGap)/radius*180/Math.PI;if(!outside&&Math.abs(span)>2*gap){const sign=Math.sign(span)||1;arc(center,radius,start,span/2-sign*gap);arc(center,radius,mid+sign*gap,span/2-sign*gap);}else arc(center,radius,start,span);}
  const sign=Math.sign(span)||1;arrow(a,[-Math.sin(start*Math.PI/180)*sign,Math.cos(start*Math.PI/180)*sign],outside);arrow(b,[Math.sin((start+span)*Math.PI/180)*sign,-Math.cos((start+span)*Math.PI/180)*sign],outside);
 }else if(def.kind==='radius'||def.kind==='diameter'){
  const a=points[0],b=points[1],axis=unit(sub(b,a)),normal:Point2=[-axis[1],axis[0]],distance=Math.hypot(...sub(b,a)),outside=fitOutside(distance);
  const fallback=def.kind==='radius'?add(add(b,mul(axis,Math.max(def.offset,style.arrowSize*2)+textWidth/2+style.textGap)),delta):add(add(mul(add(a,b),.5),mul(normal,def.offset)),delta);
  position(fallback,Math.atan2(axis[1],axis[0])*180/Math.PI);
  segmentWithTextGap(a,b);arrow(b,mul(axis,-1),outside);if(def.kind==='diameter')arrow(a,axis,outside);
  if(!style.hideDimensionLine){const near=add([text.x,text.y],mul(axis,-textWidth/2-style.textGap));if(def.kind==='radius'||outside||Math.abs(dot(sub([text.x,text.y],b),normal))>style.textGap)line(b,near);}
 }else if(def.kind==='ordinate-x'||def.kind==='ordinate-y'){
  const origin=points[0],target=points[1],axis:Point2=measurement.axis??(def.kind==='ordinate-x'?[1,0]:[0,1]),normal:Point2=[-axis[1],axis[0]];
  const elbow=add(target,mul(normal,def.offset+dot(delta,normal))),end=add(elbow,mul(axis,textWidth/2+style.textGap+dot(delta,axis)));
  position(add(end,mul(axis,textWidth/2)),0);if(!style.hideDimensionLine){line(target,elbow);line(elbow,end);}arrow(target,sub(elbow,target),false);
 }else{
  const a=points[0],b=points[1];let axis:Point2=def.kind==='horizontal'?[1,0]:def.kind==='vertical'?[0,1]:measurement.axis??unit(sub(b,a));axis=unit(axis);
  const normal:Point2=[-axis[1],axis[0]],offset=def.offset+dot(delta,normal),start=add(a,mul(normal,offset)),end=add(start,mul(axis,dot(sub(b,a),axis))),distance=Math.hypot(...sub(end,start)),direction=unit(sub(end,start)),outside=fitOutside(distance);
  extension(a,start,style.hideFirstExtension);extension(b,end,style.hideSecondExtension);
  const fallback=outside?add(end,mul(direction,textWidth/2+style.textGap+style.arrowSize*2+dot(delta,axis))):add(mul(add(start,end),.5),mul(axis,dot(delta,axis)));
  position(fallback,Math.atan2(direction[1],direction[0])*180/Math.PI);segmentWithTextGap(start,end);arrow(start,direction,outside);arrow(end,mul(direction,-1),outside);
  if(outside&&!style.hideDimensionLine)line(end,add([text.x,text.y],mul(direction,-textWidth/2-style.textGap)));
 }
 const padding=style.textGap+(def.tolerance.type==='basic'?.8:0),w=textWidth/2+padding,th=textHeight/2+padding,r=text.rotation*Math.PI/180;
 for(const [x,y] of [[-w,-th],[w,-th],[-w,th],[w,th]])extent.push([text.x+x*Math.cos(r)-y*Math.sin(r),text.y+x*Math.sin(r)+y*Math.cos(r)]);
 if(!extent.length||extent.some(point=>point.some(value=>!Number.isFinite(value))))throw new Error('Невозможно вычислить конечные координаты размера');
 const margin=Math.max(style.lineWidth,style.arrowSize*.05);const bounds={x:Math.min(...extent.map(p=>p[0]))-margin,y:Math.min(...extent.map(p=>p[1]))-margin,right:Math.max(...extent.map(p=>p[0]))+margin,bottom:Math.max(...extent.map(p=>p[1]))+margin};
 if(def.frozen)warnings.push('Замороженное измерение: связь с источником отключена');
 return {measurement,label,primitives,bounds,text,warnings};
}
