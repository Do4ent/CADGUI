import type {DrawingDocument,DrawingEntity,DrawingContext,TextStyle,TextRun,Point2} from '../types';
export const PAPER_PX_PER_MM=96/25.4;
import {resolveStyle,runText as resolveRunText} from '../model';
import {layoutDimension} from '../dimensions/layout';
export function entityStyle(entity:DrawingEntity,document:DrawingDocument):TextStyle{return resolveStyle(document,entity);}
export function runText(run:TextRun,document:DrawingDocument,context:DrawingContext):string{return resolveRunText(run,document,context);}
export function anchorOffset(entity:DrawingEntity,style:TextStyle):Point2{const [vertical,horizontal]=style.anchor.split('-');return [horizontal==='center'?-entity.width/2:horizontal==='right'?-entity.width:0,vertical==='middle'?-entity.height/2:vertical==='bottom'?-entity.height:vertical==='baseline'?-style.height:0];}
/** Arc data uses local paper angles, clockwise following SVG's positive Y axis. */
export function geometryArcData(entity:DrawingEntity){
 const geometry=entity.geometry!,center=geometry.points?.[0]??[0,0],radius=geometry.radius??entity.width/2,sourceStart=geometry.startAngle??0,start=((sourceStart%360)+360)%360,end=geometry.endAngle??360,clockwise=geometry.clockwise!==false;
 const raw=end-sourceStart;let span=clockwise?((raw%360)+360)%360:-(((-raw%360)+360)%360);
 if(Math.abs(raw)>=360&&Math.abs(span)<1e-9)span=clockwise?360:-360;
 const point=(angle:number):Point2=>[center[0]+radius*Math.cos(angle*Math.PI/180),center[1]+radius*Math.sin(angle*Math.PI/180)];
 const a=point(start),b=point(start+span),sweep=clockwise?1:0;
 let d=`M ${a.join(' ')} A ${radius} ${radius} 0 ${Math.abs(span)>180?1:0} ${sweep} ${b.join(' ')}`;
 if(Math.abs(span)>=359.999999){const middle=point(start+span/2);d=`M ${a.join(' ')} A ${radius} ${radius} 0 1 ${sweep} ${middle.join(' ')} A ${radius} ${radius} 0 1 ${sweep} ${b.join(' ')}`;}
 const points=[a,b];for(let angle=-720;angle<=1080;angle+=90){const progress=span>=0?angle-start:start-angle;if(progress>=0&&progress<=Math.abs(span))points.push(point(angle));}
 return {d,points};
}
export function entityBounds(entity:DrawingEntity,document:DrawingDocument){
 if(entity.dimension){try{return layoutDimension(entity,document).bounds;}catch{const x=Number.isFinite(entity.x)?entity.x:0,y=Number.isFinite(entity.y)?entity.y:0;return {x:x-1,y:y-1,right:x+62,bottom:y+7};}}
 const style=entityStyle(entity,document),[ox,oy]=anchorOffset(entity,style),r=entity.rotation*Math.PI/180;
 // Lines may run left/up from their insertion point (including imported DXF).
 const local=entity.kind==='geometry'&&entity.geometry?.type==='arc'?geometryArcData(entity).points:entity.kind==='geometry'&&entity.geometry?.type==='line'
  ? entity.geometry.points?.length?entity.geometry.points:[[0,0],[entity.width,entity.height]]
  : [[0,0],[entity.width,0],[0,entity.height],[entity.width,entity.height]];
 const points=local.map(([x,y])=>[entity.x+(ox+x)*Math.cos(r)-(oy+y)*Math.sin(r),entity.y+(ox+x)*Math.sin(r)+(oy+y)*Math.cos(r)]);
 return {x:Math.min(...points.map(p=>p[0])),y:Math.min(...points.map(p=>p[1])),right:Math.max(...points.map(p=>p[0])),bottom:Math.max(...points.map(p=>p[1]))};
}
export function intersectingIds(entities:DrawingEntity[],document:DrawingDocument,a:Point2,b:Point2):string[]{const left=Math.min(a[0],b[0]),top=Math.min(a[1],b[1]),right=Math.max(a[0],b[0]),bottom=Math.max(a[1],b[1]);return entities.filter(e=>entityStyle(e,document).visible).filter(e=>{const box=entityBounds(e,document);return box.x<=right&&box.right>=left&&box.y<=bottom&&box.bottom>=top;}).map(e=>e.id);}
export function moveEntities(document:DrawingDocument,ids:string[],delta:Point2):DrawingDocument{
 const selected=new Set(ids),sheet=document.sheets.find(s=>s.id===document.activeSheetId);
 const moving=new Set(sheet?.entities.filter(e=>selected.has(e.id)&&!e.locked).map(e=>e.id));
 return {...document,sheets:document.sheets.map(s=>s.id!==document.activeSheetId?s:{...s,entities:s.entities.map(e=>{
  if(!moving.has(e.id))return e;
  // A rigidly moved reference set already translates its associated layout.
  // Frozen/explicit-point dimensions still need their own placement translation.
  if(e.dimension&&!e.dimension.frozen&&e.dimension.refs.length&&e.dimension.refs.every(ref=>ref.entityId&&moving.has(ref.entityId)))return e;
  return {...e,x:e.x+delta[0],y:e.y+delta[1],leaders:e.leaders?.map(branch=>({...branch,points:branch.points.map(point=>[point[0]+delta[0],point[1]+delta[1]] as Point2)}))};
 })})};
}
