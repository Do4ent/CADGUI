/** Stage A annotations are visual 3D notes. Component references follow translation
 * only; these records are not semantic GD&T, topology references or certified PMI. */
export type Vec3 = [number,number,number];
export type ModelAnnotation = {
 id:string;
 text:string;
 anchor:{kind:'world';point:Vec3}|{kind:'component';componentId:string;point:Vec3};
 offset:Vec3;
 orientation:'screen'|'XY'|'XZ'|'YZ';
 fontSize:number;
 color:string;
 visible:boolean;
 leader:boolean;
};
export type ModelAnnotationState = {version:1;annotations:ModelAnnotation[]};
export type ModelAnnotationItem = {id:string;name:string;pos:Vec3;visible:boolean};
export type ResolvedModelAnnotation = {status:'visible'|'hidden'|'missing';anchor:Vec3|null;position:Vec3|null};

export const MODEL_ANNOTATION_SCHEMA_VERSION=1 as const;
export const MODEL_ANNOTATION_FONT_SIZE_MIN=0.05;
export const MODEL_ANNOTATION_FONT_SIZE_MAX=2;
export const MODEL_ANNOTATION_TEXT_MAX_LENGTH=10000;
export const MODEL_ANNOTATION_MAX_COUNT=10000;
export const MODEL_ANNOTATION_ID_MAX_LENGTH=256;
export const MODEL_ANNOTATION_ORIENTATIONS=['screen','XY','XZ','YZ'] as const;
/** Public validation failures contain a field path; callers display them inline.
 * Unknown versions/keys, duplicate IDs, invalid text/coordinates/styles and
 * arithmetic overflow are rejected rather than silently repaired or dropped. */
export class ModelAnnotationValidationError extends Error {
 readonly path:string;
 constructor(path:string,reason:string){super(`${path}: ${reason}`);this.name='ModelAnnotationValidationError';this.path=path;}
}
const invalid=(path:string,reason:string):never=>{throw new ModelAnnotationValidationError(path,reason);};
function record(value:unknown,path:string):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))return invalid(path,'ожидается объект');return value as Record<string,unknown>;}
function exactKeys(value:Record<string,unknown>,expected:string[],path:string){for(const key of Object.keys(value))if(!expected.includes(key))invalid(path,`неподдерживаемое поле ${key}`);for(const key of expected)if(!Object.prototype.hasOwnProperty.call(value,key))invalid(`${path}.${key}`,'обязательное поле отсутствует');}
function id(value:unknown,path:string):string {if(typeof value!=='string'||!value.trim()||value.length>MODEL_ANNOTATION_ID_MAX_LENGTH||/[\u0000-\u001f\u007f]/.test(value))return invalid(path,'нужен непустой идентификатор до 256 символов без управляющих знаков');return value;}
function vector(value:unknown,path:string):Vec3 {if(!Array.isArray(value)||value.length!==3)return invalid(path,'требуются три координаты XYZ');return Array.from(value,(number,index)=>{if(typeof number!=='number'||!Number.isFinite(number))return invalid(`${path}[${index}]`,'координата должна быть конечным числом');return number;}) as Vec3;}
function boolean(value:unknown,path:string):boolean {if(typeof value!=='boolean')return invalid(path,'ожидается логическое значение');return value;}
function parseAnnotation(value:unknown,path:string):ModelAnnotation {
 const a=record(value,path);exactKeys(a,['id','text','anchor','offset','orientation','fontSize','color','visible','leader'],path);
 const key=id(a.id,path+'.id');
 if(typeof a.text!=='string'||!a.text.trim()||a.text.length>MODEL_ANNOTATION_TEXT_MAX_LENGTH||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(a.text))return invalid(path+'.text','нужен непустой текст до 10000 символов без управляющих знаков');
 const source=record(a.anchor,path+'.anchor');let anchor:ModelAnnotation['anchor'];
 if(source.kind==='world'){exactKeys(source,['kind','point'],path+'.anchor');anchor={kind:'world',point:vector(source.point,path+'.anchor.point')};}
 else if(source.kind==='component'){exactKeys(source,['kind','componentId','point'],path+'.anchor');anchor={kind:'component',componentId:id(source.componentId,path+'.anchor.componentId'),point:vector(source.point,path+'.anchor.point')};}
 else return invalid(path+'.anchor.kind','поддерживаются только world/component');
 if(typeof a.orientation!=='string'||!(MODEL_ANNOTATION_ORIENTATIONS as readonly string[]).includes(a.orientation))return invalid(path+'.orientation','поддерживаются screen, XY, XZ, YZ');
 if(typeof a.fontSize!=='number'||!Number.isFinite(a.fontSize)||a.fontSize<MODEL_ANNOTATION_FONT_SIZE_MIN||a.fontSize>MODEL_ANNOTATION_FONT_SIZE_MAX)return invalid(path+'.fontSize','размер шрифта должен быть от 0.05 до 2');
 if(typeof a.color!=='string'||!/^#[\da-f]{6}$/i.test(a.color))return invalid(path+'.color','ожидается цвет #RRGGBB');
 const offset=vector(a.offset,path+'.offset');
 // Catch a world note whose finite inputs would produce an infinite label position.
 if(anchor.kind==='world')sum(anchor.point,offset,path+'.position');
 return {id:key,text:a.text,anchor,offset,orientation:a.orientation as ModelAnnotation['orientation'],fontSize:a.fontSize,color:a.color,visible:boolean(a.visible,path+'.visible'),leader:boolean(a.leader,path+'.leader')};
}
function sum(a:Vec3,b:Vec3,path:string):Vec3 {return vector(a.map((number,index)=>number+b[index]),path);}
export function createModelAnnotationState():ModelAnnotationState {return {version:MODEL_ANNOTATION_SCHEMA_VERSION,annotations:[]};}
export function validateModelAnnotationState(value:unknown):ModelAnnotationState {
 const state=record(value,'modelAnnotations');exactKeys(state,['version','annotations'],'modelAnnotations');
 if(state.version!==MODEL_ANNOTATION_SCHEMA_VERSION)return invalid('modelAnnotations.version','неподдерживаемая версия схемы');
 if(!Array.isArray(state.annotations)||state.annotations.length>MODEL_ANNOTATION_MAX_COUNT)return invalid('modelAnnotations.annotations','ожидается массив до 10000 примечаний');
 const seen=new Set<string>();
 const annotations=Array.from(state.annotations,(annotation,index)=>{const path=`modelAnnotations.annotations[${index}]`,parsed=parseAnnotation(annotation,path);if(seen.has(parsed.id))invalid(path+'.id','идентификатор повторяется');seen.add(parsed.id);return parsed;});
 return {version:MODEL_ANNOTATION_SCHEMA_VERSION,annotations};
}
export function createModelAnnotation(annotationId:string,componentId?:string):ModelAnnotation {
 return parseAnnotation({id:annotationId,text:'Примечание',anchor:componentId===undefined?{kind:'world',point:[0,0,0]}:{kind:'component',componentId,point:[0,0,0]},offset:[1,1,0],orientation:'screen',fontSize:0.4,color:'#176b9c',visible:true,leader:true},'modelAnnotation');
}
export function resolveModelAnnotation(annotation:ModelAnnotation,items:readonly ModelAnnotationItem[]):ResolvedModelAnnotation {
 const parsed=parseAnnotation(annotation,'modelAnnotation');
 let anchor=parsed.anchor.point;
 if(parsed.anchor.kind==='component'){
  const componentId=parsed.anchor.componentId,matches=items.filter(item=>item.id===componentId);
  if(!matches.length)return {status:'missing',anchor:null,position:null};
  if(matches.length>1)return invalid('modelAnnotation.anchor.componentId','неоднозначный идентификатор компонента');
  const item=matches[0];anchor=sum(vector(item.pos,'component.pos'),anchor,'modelAnnotation.anchor.worldPoint');
  const position=sum(anchor,parsed.offset,'modelAnnotation.position');
  if(!parsed.visible||!boolean(item.visible,'component.visible'))return {status:'hidden',anchor,position};
  return {status:'visible',anchor,position};
 }
 const position=sum(anchor,parsed.offset,'modelAnnotation.position');return {status:parsed.visible?'visible':'hidden',anchor,position};
}
export function upsertModelAnnotation(state:ModelAnnotationState,annotation:ModelAnnotation):ModelAnnotationState {
 const next=validateModelAnnotationState(state),parsed=parseAnnotation(annotation,'modelAnnotation'),index=next.annotations.findIndex(item=>item.id===parsed.id);
 if(index<0)next.annotations.push(parsed);else next.annotations[index]=parsed;
 return validateModelAnnotationState(next);
}
export function removeModelAnnotations(state:ModelAnnotationState,ids:readonly string[]):ModelAnnotationState {
 const next=validateModelAnnotationState(state);if(!Array.isArray(ids))return invalid('modelAnnotation.ids','ожидается массив идентификаторов');const selected=new Set(Array.from(ids,value=>id(value,'modelAnnotation.ids')));next.annotations=next.annotations.filter(annotation=>!selected.has(annotation.id));return next;
}
