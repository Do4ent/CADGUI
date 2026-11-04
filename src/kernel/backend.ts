import {profilePoints,sketchPointToWorld,sketchNormal} from '../sketch/model';
import {OcctKernel,type ShapeHandle} from 'occt-wasm';
import {MAX_BREP_LENGTH} from './model';
import type {KernelBodyResult,KernelOutput,KernelRequest,Vec3} from './types';
const MAX_TRIANGLES=200_000,MAX_COORDINATE=1_000_000;
function number(value:unknown,positive=false):number{if(typeof value!=='number'||!Number.isFinite(value)||Math.abs(value)>MAX_COORDINATE||(positive&&value<1e-5))throw Error('Координаты должны быть конечными в пределах ±1000000 мм; размеры от 0.00001 до 1000000 мм');return value;}
function vector(value:unknown):Vec3{if(!Array.isArray(value)||value.length!==3)throw Error('Требуются координаты XYZ');return value.map(v=>number(v)) as Vec3;}
function brep(value:unknown):string{if(typeof value!=='string'||!value.trim()||value.length>MAX_BREP_LENGTH||!/^\s*(?:DBRep_DrawableShape\s*)?CASCADE Topology V[0-9]+/.test(value))throw Error('Неподдерживаемый или слишком большой BREP');return value;}
/** Every request owns a kernel arena checkpoint. Only copied mesh arrays and
 * serialized native geometry leave this adapter; WASM handles never persist. */
export class ExactKernelBackend{
 constructor(private kernel:OcctKernel){}
 private solidOnly(shape:ShapeHandle,depth=0):number{
  if(depth>30)throw Error('Слишком глубокая структура геометрии');
  const k=this.kernel,type=k.getShapeType(shape);
  if(type==='solid')return 1;
  if(type!=='compound'&&type!=='compsolid')throw Error('Поддерживаются только замкнутые объёмные тела; свободные поверхности и кривые не импортируются');
  const children=k.iterShapes(shape);if(children.length>1000)throw Error('Слишком много объектов в геометрии');
  return children.reduce((total,child)=>total+this.solidOnly(child,depth+1),0);
 }
 private read(data:string):ShapeHandle{return this.kernel.fromBREP(brep(data));}
 execute(request:KernelRequest):KernelOutput{
  const k=this.kernel,mark=k.checkpoint();
  try{
   if(!request||typeof request!=='object')throw Error('Некорректный запрос ядра');
   let shape:ShapeHandle;
   switch(request.op){
    case 'extrude-sketch':{
     const origin=vector(request.origin),depth=number(request.depth);if(Math.abs(depth)<1e-5)throw Error('Глубина выдавливания должна быть ненулевой');
     if(!Array.isArray(request.points)||request.points.length>32)throw Error('Поддерживается один замкнутый профиль до 32 точек');
     const profile=profilePoints({id:'profile',name:'Профиль',plane:request.plane,origin,closed:true,constraints:[],points:request.points.map((p,i)=>({id:'p'+i,x:p?.[0],y:p?.[1]}))});
     const world=profile.map(point=>sketchPointToWorld(request.plane,origin,point));
     const edges=world.map((p,i)=>{const q=world[(i+1)%world.length];return k.makeLineEdge({x:p[0],y:p[1],z:p[2]},{x:q[0],y:q[1],z:q[2]});});
     const face=k.makeFace(k.makeWire(edges)),normal=sketchNormal(request.plane);shape=k.extrude(face,normal[0]*depth,normal[1]*depth,normal[2]*depth);break;
    }
    case 'box':{const size=vector(request.size);size.forEach(v=>number(v,true));const origin=vector(request.origin);shape=k.makeBox(...size);if(origin.some(Boolean))shape=k.translate(shape,...origin);break;}
    case 'cylinder':{const radius=number(request.radius,true),height=number(request.height,true),origin=vector(request.origin);shape=k.makeCylinder(radius,height);if(origin.some(Boolean))shape=k.translate(shape,...origin);break;}
    case 'boolean':{const a=this.read(request.a),b=this.read(request.b);if(!k.isValid(a)||!k.isValid(b))throw Error('Некорректный источник булевой операции');this.solidOnly(a);this.solidOnly(b);if(!['fuse','cut','common'].includes(request.kind))throw Error('Неизвестная булева операция');shape=k[request.kind](a,b);break;}
    case 'inspect':shape=this.read(request.brep);break;
    case 'import-step':{if(typeof request.text!=='string'||request.text.length>MAX_BREP_LENGTH||!/^\s*ISO-10303-21\s*;/i.test(request.text))throw Error('Нужен STEP-файл ISO-10303-21 размером до 10 МБ');shape=k.importStep(request.text);break;}
    case 'export-step':{shape=this.read(request.brep);if(!k.isValid(shape)||!this.solidOnly(shape))throw Error('Некорректная геометрия STEP');return k.exportStep(shape,{unit:'mm',schema:'AP214'});}
    default:throw Error('Неизвестная операция геометрического ядра');
   }
   if(k.isNull(shape)||!k.isValid(shape))throw Error('Ядро отклонило некорректное тело');
   const solids=this.solidOnly(shape);if(!solids||solids>100)throw Error('Операция должна содержать от 1 до 100 объёмных тел');
   const volume=k.getVolume(shape),area=k.getSurfaceArea(shape),bounds=k.getBoundingBox(shape,{precise:true,useTriangulation:false}),center=k.getCenterOfMass(shape);
   if(!Number.isFinite(volume)||volume<=0||!Number.isFinite(area)||area<=0||!Object.values(bounds).every(v=>Number.isFinite(v)&&Math.abs(v)<=MAX_COORDINATE)||!Object.values(center).every(Number.isFinite))throw Error('Не удалось получить корректные свойства объёмной геометрии');
   const native=k.toBREP(shape);brep(native);
   const mesh=k.meshShape(shape,{linearDeflection:.05,angularDeflection:.2,relative:false});
   if(!mesh.triangleCount||mesh.triangleCount>MAX_TRIANGLES||mesh.positions.length!==mesh.normals.length||mesh.positions.length%3||mesh.indices.length!==mesh.triangleCount*3||!mesh.positions.every(Number.isFinite)||!mesh.normals.every(Number.isFinite)||!mesh.indices.every(index=>index<mesh.positions.length/3))throw Error('Неподдерживаемая или слишком сложная сетка отображения');
   const groups=mesh.faceGroups??new Int32Array();
   if(groups.length%3)throw Error('Некорректные группы граней');
   for(let i=0;i<groups.length;i+=3)if(groups[i]<0||groups[i+1]<=0||groups[i]+groups[i+1]>mesh.indices.length||groups[i]%3||groups[i+1]%3)throw Error('Некорректные диапазоны граней');
   const outline=k.wireframe(shape,{source:'triangulation',deflection:.05}),lines:number[]=[];
   for(let i=0;i<outline.edgeGroups.length;i+=3){const start=outline.edgeGroups[i],end=start+outline.edgeGroups[i+1];for(let j=start;j+5<end;j+=3){lines.push(...outline.points.slice(j,j+3),...outline.points.slice(j+3,j+6));if(lines.length>3_000_000)throw Error('Слишком много рёбер отображения');}}
   if(!lines.every(Number.isFinite))throw Error('Некорректные рёбра отображения');
   return {brep:native,mesh:{positions:mesh.positions,normals:mesh.normals,indices:mesh.indices,faceGroups:groups},lines:new Float32Array(lines),volume,area,bounds:[[bounds.xmin,bounds.ymin,bounds.zmin],[bounds.xmax,bounds.ymax,bounds.zmax]],center:[center.x,center.y,center.z],topology:{solids,faces:k.subShapeCount(shape,'face'),edges:k.subShapeCount(shape,'edge'),vertices:k.subShapeCount(shape,'vertex')}} satisfies KernelBodyResult;
  }finally{k.releaseSince(mark);}
 }
}
