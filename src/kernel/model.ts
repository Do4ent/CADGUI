import type {ExactBody,ExactModelState} from './types';
export type {ExactBody,ExactModelState} from './types';
export const EXACT_KERNEL_VERSION='5.15.0' as const;
export const MAX_BREP_LENGTH=10_000_000;
export const MAX_EXACT_BODIES=100;
export const MAX_EXACT_DOCUMENT_LENGTH=25_000_000;
export function createExactModelState():ExactModelState{return {version:1,kernel:'occt-wasm',kernelVersion:EXACT_KERNEL_VERSION,units:'mm',bodies:[]};}
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
function keys(v:Record<string,unknown>,expected:string[]){if(Object.keys(v).length!==expected.length||expected.some(k=>!Object.hasOwn(v,k)))throw Error('Неподдерживаемые поля точной модели');}
const text=(v:unknown,max:number):v is string=>typeof v==='string'&&!!v.trim()&&v.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v);
export function validateExactModelState(value:unknown):ExactModelState{
 if(!record(value))throw Error('Некорректная точная модель');keys(value,['version','kernel','kernelVersion','units','bodies']);
 if(value.version!==1||value.kernel!=='occt-wasm'||value.kernelVersion!==EXACT_KERNEL_VERSION||value.units!=='mm')throw Error('Неподдерживаемая версия ядра, схемы или единицы точной модели');
 if(!Array.isArray(value.bodies)||value.bodies.length>MAX_EXACT_BODIES)throw Error('Допускается до 100 точных тел');
 const ids=new Set<string>();let total=0;
 const bodies=Array.from(value.bodies,(raw):ExactBody=>{
  if(!record(raw))throw Error('Некорректное точное тело');keys(raw,['id','name','brep','color','visible']);
  if(!text(raw.id,256)||!text(raw.name,200)||!text(raw.brep,MAX_BREP_LENGTH)||!/^\s*(?:DBRep_DrawableShape\s*)?CASCADE Topology V[0-9]+/.test(raw.brep)||typeof raw.color!=='string'||!/^#[\da-f]{6}$/i.test(raw.color)||typeof raw.visible!=='boolean')throw Error('Некорректные поля точного тела или формат BREP');
  if(ids.has(raw.id))throw Error('Повторный идентификатор точного тела');ids.add(raw.id);total+=raw.brep.length;
  if(total>MAX_EXACT_DOCUMENT_LENGTH)throw Error('Точная модель превышает ограничение 25 МБ');
  return {id:raw.id,name:raw.name,brep:raw.brep,color:raw.color,visible:raw.visible};
 });return {...createExactModelState(),bodies};
}
export function upsertExactBody(state:ExactModelState,body:ExactBody):ExactModelState{const next=validateExactModelState(state);const index=next.bodies.findIndex(b=>b.id===body.id);if(index<0)next.bodies.push({...body});else next.bodies[index]={...body};return validateExactModelState(next);}
export function removeExactBodies(state:ExactModelState,ids:readonly string[]):ExactModelState{const next=validateExactModelState(state);next.bodies=next.bodies.filter(b=>!ids.includes(b.id));return next;}
