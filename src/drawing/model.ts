import {validateDimensionDefinition,validateDimensionStyle} from './dimensions/validation';
import {evaluateDimension,formatDimension} from './dimensions/engine';
import {resolveFontFamily} from './fontPolicy';
import type {DrawingDocument, DrawingEntity, DrawingContext, TextStyle, FieldRef, TextParagraph, TextRun, DrawingSheetModel, Point2} from './types';

export const emptyContext: DrawingContext = {documentName: '', documentId: '', modelItems: []};
let sequence = 0;
export const drawingId = (prefix = 'text') => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${++sequence}`}`;
export const cloneDrawing = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
export function defaultTextStyle(): TextStyle {
 return {id:'default',name:'Стандартный',fontFamily:'Arial',height:3.5,bold:false,italic:false,underline:false,overline:false,strike:false,color:'#20252b',widthFactor:1,oblique:0,tracking:0,lineSpacing:1.2,spaceBefore:0,spaceAfter:0,paragraphAlign:'left',anchor:'top-left',mask:false,maskColor:'#ffffff',maskPadding:1,frame:'none',layer:'Текст',printable:true,visible:true,scaleMode:'paper',direction:'ltr',writingMode:'horizontal'};
}
export function textParagraphs(text: string): TextParagraph[] {
 return text.replace(/\r\n?/g,'\n').split('\n').map(line => ({runs:[{text:line}]}));
}
export function createTextEntity(kind: DrawingEntity['kind'] = 'text', text = '', styleId = 'default'): DrawingEntity {
 return {id:drawingId(),kind,name:kind === 'leader' ? 'Выноска' : 'Текст',x:20,y:20,width:80,height:30,rotation:0,styleId,overrides:{},paragraphs:textParagraphs(text)};
}
export function createDrawingDocument(): DrawingDocument {
 return {version:1,activeSheetId:'sheet-1',sheets:[{id:'sheet-1',name:'Лист 1',width:297,height:210,scale:1,entities:[]}],styles:[defaultTextStyle()],templates:[],properties:{title:'',designation:'',author:''},dictionary:[],revisions:[]};
}
export function resolveStyle(doc: DrawingDocument, entity: DrawingEntity): TextStyle {
 const style = doc.styles.find(s=>s.id===entity.styleId);
 if (!style) throw new Error(`Missing text style: ${entity.styleId}`);
 const resolved={...style,...entity.overrides,id:style.id};
 return {...resolved,fontFamily:resolveFontFamily(doc,resolved.fontFamily)};
}
export function activeDrawingSheet(doc: DrawingDocument): DrawingSheetModel {
 const sheet=doc.sheets.find(s=>s.id===doc.activeSheetId);
 if (!sheet) throw new Error('Active sheet is missing');
 return sheet;
}
const owns = (object:object,key:string) => Object.prototype.hasOwnProperty.call(object,key);
const forbiddenKey = (key:string) => ['__proto__','prototype','constructor'].includes(key);
/** Numeric arithmetic only. No eval, property access, function calls or executable code. */
export function evaluateDrawingFormula(source:string): number {
 if (source.length>512) throw new Error('Formula is too long');
 const tokens=source.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[()+\-*/]/g) ?? [];
 if(tokens.join('')!==source.replace(/\s/g,''))throw new Error('Formula only supports numeric arithmetic');
 let index=0;
 const atom=():number=>{const token=tokens[index++];if(token==='+'||token==='-')return (token==='-'?-1:1)*atom();if(token==='('){const value=sum();if(tokens[index++]!==')')throw new Error('Missing closing parenthesis');return value}if(token===undefined||!/^\d|^\.\d/.test(token))throw new Error('Expected number');return Number(token)};
 const product=():number=>{let value=atom();while(tokens[index]==='*'||tokens[index]==='/'){const op=tokens[index++],right=atom();value=op==='*'?value*right:value/right}return value};
 const sum=():number=>{let value=product();while(tokens[index]==='+'||tokens[index]==='-'){const op=tokens[index++],right=product();value=op==='+'?value+right:value-right}return value};
 const result=sum();if(index!==tokens.length||!Number.isFinite(result))throw new Error('Formula result must be finite');return result;
}
export function resolveField(field: FieldRef, doc: DrawingDocument, context: DrawingContext = emptyContext): {value:string;broken:boolean} {
 if(field.frozen!==undefined)return {value:field.frozen,broken:false};
 let raw:unknown;let broken=false;
 const sheet=doc.sheets.find(s=>s.id===(field.targetId ?? context.sheetId ?? doc.activeSheetId));
 try {
  if(forbiddenKey(field.key))throw new Error('Unsafe field key');
  switch(field.kind){
   case 'document': raw=field.key==='name'?context.documentName:field.key==='id'?context.documentId:owns(doc.properties,field.key)?doc.properties[field.key]:undefined;break;
   case 'sheet': raw=field.key==='number'&&sheet?doc.sheets.indexOf(sheet)+1:field.key==='count'?doc.sheets.length:sheet&&['name','id','width','height','scale'].includes(field.key)?sheet[field.key as keyof DrawingSheetModel]:undefined;break;
   case 'model': {const item=context.modelItems.find(i=>i.id===field.targetId);if(item){if(['name','id','kind','group','color','visible'].includes(field.key))raw=item[field.key as keyof typeof item];else if(/^(pos|size)\.[xyz]$/.test(field.key)){const [key,axis]=field.key.split('.');raw=item[key as 'pos'|'size'][['x','y','z'].indexOf(axis)]}}break;}
   case 'entity': {const entity=doc.sheets.flatMap(s=>s.entities).find(e=>e.id===field.targetId);if(entity&&['name','x','y','width','height','rotation'].includes(field.key))raw=entity[field.key as keyof DrawingEntity];break;}
   case 'technical': {const target=doc.sheets.flatMap(s=>s.entities).find(e=>e.id===field.targetId&&e.technical);if(target){const index=Number(field.key);if(Number.isInteger(index)&&index>=1&&index<=target.paragraphs.length)raw=target.paragraphs[index-1].listStart??index;}break;}
   case 'formula':raw=evaluateDrawingFormula(field.key);break;
  }
 }catch{broken=true;}
 if(raw===undefined||raw===null||typeof raw==='object')broken=true;
 let value=broken?(field.fallback??'⟦нет источника⟧'):typeof raw==='number'&&field.precision!==undefined?raw.toFixed(field.precision):String(raw);
 if(!broken)value=(field.prefix??'')+value+(field.unit?' '+field.unit:'')+(field.suffix??'');
 return {value,broken};
}
export function runText(run:TextRun,doc?:DrawingDocument,context:DrawingContext=emptyContext):string {
 if(run.field)return doc?resolveField(run.field,doc,context).value:run.field.frozen??run.field.fallback??run.text;
 if(run.stack)return run.stack.kind==='tolerance'?`${run.stack.top}/${run.stack.bottom}`:`${run.stack.top}/${run.stack.bottom}`;
 return run.text;
}
/** Geometry points are local to their owning sheet entity. */
export function geometryLineEndpoints(entity:DrawingEntity):[Point2,Point2]|null {
 if(entity.kind!=='geometry'||entity.geometry?.type!=='line'||entity.geometry.points?.length!==2)return null;
 const angle=entity.rotation*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
 const points=entity.geometry.points.map(([x,y])=>[entity.x+x*c-y*s,entity.y+x*s+y*c] as Point2);
 return points.every(point=>point.every(Number.isFinite))?points as [Point2,Point2]:null;
}
export function plainText(entity:DrawingEntity,doc?:DrawingDocument,context:DrawingContext=emptyContext):string {
 if(entity.dimension){try{return formatDimension(evaluateDimension(entity.dimension,doc!),entity.dimension);}catch{return '⟦нет источника⟧';}}
 const body=entity.kind==='table'&&entity.rows?entity.rows.map(row=>row.map(cell=>cell.map(p=>p.runs.map(r=>runText(r,doc,context)).join('')).join('\n')).join('\t')).join('\n'):entity.paragraphs.map(p=>p.runs.map(r=>runText(r,doc,context)).join('')).join('\n');
 if(entity.annotation){
  const a=entity.annotation;let label:string;
  if(a.type==='dimension'&&a.sourceId){
   const source=doc?.sheets.flatMap(sheet=>sheet.entities).find(source=>source.id===a.sourceId);
   const points=source?geometryLineEndpoints(source):null;
   // Rigid translation/rotation preserves length; local deltas avoid cancellation
   // when a valid source is translated far from the paper origin.
   const local=points?source!.geometry!.points!:null;
   const length=local?Math.hypot(local[1][0]-local[0][0],local[1][1]-local[0][1]):NaN;
   const precision=Number(a.fields.precision??3);
   label=Number.isFinite(length)?String(Number(length.toFixed(Number.isInteger(precision)?Math.max(0,Math.min(8,precision)):3))):'⟦нет источника⟧';
  }else {
   const values=['symbol','value','number'].map(key=>a.fields[key]).filter(Boolean);
   label=a.number??(values.length?values.join(' '):body);
  }
  return (a.prefix??'')+label+(a.suffix??'');
 }
 return body;
}

const fail=(path:string,message:string):never=>{throw new Error(`${path}: ${message}`)};
function object(value:unknown,path:string):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))return fail(path,'expected object');const v=value as Record<string,unknown>;for(const key of Object.keys(v))if(forbiddenKey(key))fail(path,'unsafe key');return v;}
function keys(v:Record<string,unknown>,allowed:string[],path:string){for(const key of Object.keys(v))if(!allowed.includes(key))fail(path,`unsupported property ${key}`);}
function string(v:unknown,path:string,nonempty=false):asserts v is string {if(typeof v!=='string'||v.length>1000000||(nonempty&&!v.trim())||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v))fail(path,'invalid text');}
function number(v:unknown,path:string,min=-Infinity,max=Infinity){if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)fail(path,'invalid finite number');}
function bool(v:unknown,path:string){if(typeof v!=='boolean')fail(path,'expected boolean');}
function one(v:unknown,options:readonly string[],path:string){if(typeof v!=='string'||!options.includes(v))fail(path,'unsupported value');}
function array(v:unknown,path:string,max=100000):unknown[]{if(!Array.isArray(v)||v.length>max)fail(path,'invalid array');return v as unknown[];}
function unique(values:string[],path:string){if(new Set(values).size!==values.length)fail(path,'duplicate IDs');}
const styleKeys=Object.keys(defaultTextStyle());
export function validateStyle(value:unknown,partial=false,path='style'): void {
 const v=object(value,path);keys(v,styleKeys,path);
 if(!partial)for(const key of styleKeys)if(v[key]===undefined)fail(path,`missing ${key}`);
 for(const [key,val] of Object.entries(v)){
  const p=path+'.'+key;
  if(['id','name','layer'].includes(key))string(val,p,true);
  else if(key==='fontFamily'){string(val,p,true);if(!/^[\p{L}\p{N} _.,-]{1,120}$/u.test(val as string))fail(p,'unsafe font family');}
  else if(['color','maskColor'].includes(key)){if(typeof val!=='string'||!/^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(val))fail(p,'expected hex color');}
  else if(['bold','italic','underline','overline','strike','mask','printable','visible'].includes(key))bool(val,p);
  else if(['height','widthFactor','lineSpacing'].includes(key))number(val,p,Number.MIN_VALUE);
  else if(['spaceBefore','spaceAfter','maskPadding'].includes(key))number(val,p,0);
  else if(key==='oblique')number(val,p,-85,85);
  else if(key==='tracking')number(val,p);
  else if(key==='paragraphAlign')one(val,['left','center','right','justify'],p);
  else if(key==='anchor')one(val,['top-left','top-center','top-right','middle-left','middle-center','middle-right','bottom-left','bottom-center','bottom-right','baseline-left'],p);
  else if(key==='frame')one(val,['none','rectangle','circle','capsule'],p);
  else if(key==='scaleMode')one(val,['paper','model'],p);
  else if(key==='direction')one(val,['ltr','rtl'],p);
  else if(key==='writingMode')one(val,['horizontal','vertical'],p);
 }
 for(const multiplier of ['widthFactor','lineSpacing'])if(v.height!==undefined&&v[multiplier]!==undefined&&!Number.isFinite((v.height as number)*(v[multiplier] as number)))fail(path,'derived text size must be finite');
 if(partial&&(v.id!==undefined||v.name!==undefined))fail(path,'run/object override cannot replace style identity');
}
function validateField(value:unknown,path:string){const f=object(value,path);keys(f,['kind','targetId','key','prefix','suffix','precision','unit','fallback','frozen'],path);one(f.kind,['document','sheet','model','entity','formula','technical'],path);string(f.key,path+'.key',true);if(forbiddenKey(f.key as string))fail(path,'unsafe field key');for(const key of ['targetId','prefix','suffix','unit','fallback','frozen'])if(f[key]!==undefined)string(f[key],path+'.'+key);if(f.precision!==undefined){number(f.precision,path+'.precision',0,20);if(!Number.isInteger(f.precision))fail(path,'precision must be integer');}}
function validateParagraph(value:unknown,path:string){const p=object(value,path);keys(p,['runs','align','indent','firstIndent','tabs','list','listStart'],path);array(p.runs,path+'.runs').forEach((run,index)=>{const r=object(run,path+index);keys(r,['text','format','field','script','stack'],path);string(r.text,path+'.text');if(r.format!==undefined)validateStyle(r.format,true,path+'.format');if(r.field!==undefined)validateField(r.field,path+'.field');if(r.script!==undefined)one(r.script,['normal','super','sub'],path);if(r.stack!==undefined){const s=object(r.stack,path);keys(s,['top','bottom','kind'],path);string(s.top,path);string(s.bottom,path);one(s.kind,['fraction','diagonal','tolerance'],path);}});if(p.align!==undefined)one(p.align,['left','center','right','justify'],path);for(const key of ['indent','firstIndent'])if(p[key]!==undefined)number(p[key],path);if(p.tabs!==undefined){const tabs=array(p.tabs,path,100);tabs.forEach(t=>number(t,path,0));if(tabs.some((t,i)=>i>0&&(t as number)<=(tabs[i-1] as number)))fail(path,'tab stops must increase');}if(p.list!==undefined)one(p.list,['none','bullet','number','letter'],path);if(p.listStart!==undefined){number(p.listStart,path,1);if(!Number.isInteger(p.listStart))fail(path,'list start must be integer');}}
function point(value:unknown,path:string){const p=array(value,path,2);if(p.length!==2)fail(path,'expected XY');p.forEach(n=>number(n,path));}
const entityKeys=['id','kind','name','x','y','width','height','rotation','styleId','overrides','paragraphs','locked','columns','arc','leaders','rows','annotation','dimension','geometry','reference','technical','sourceText'];
function validateEntity(value:unknown,path:string,styles:Set<string>){const e=object(value,path);keys(e,entityKeys,path);for(const key of ['id','styleId'])string(e[key],path+'.'+key,true);string(e.name,path+'.name');one(e.kind,['text','leader','table','symbol','geometry'],path);if(!styles.has(e.styleId as string))fail(path,'missing style');for(const key of ['x','y','rotation'])number(e[key],path+'.'+key);for(const key of ['width','height'])number(e[key],path+'.'+key,0);if(!Number.isFinite((e.x as number)+(e.width as number))||!Number.isFinite((e.y as number)+(e.height as number)))fail(path,'derived container bounds must be finite');validateStyle(e.overrides,true,path+'.overrides');array(e.paragraphs,path+'.paragraphs').forEach((p,i)=>validateParagraph(p,path+`.paragraphs[${i}]`));for(const key of ['locked','technical'])if(e[key]!==undefined)bool(e[key],path+'.'+key);if(e.sourceText!==undefined)string(e.sourceText,path);if(e.columns!==undefined){const c=object(e.columns,path);keys(c,['count','gap','dynamic'],path);number(c.count,path,1,100);if(!Number.isInteger(c.count))fail(path,'column count must be integer');number(c.gap,path,0);bool(c.dynamic,path);}if(e.arc!==undefined){const a=object(e.arc,path);keys(a,['radius','startAngle','clockwise','inside'],path);number(a.radius,path,Number.MIN_VALUE);number(a.startAngle,path);bool(a.clockwise,path);bool(a.inside,path);}if(e.leaders!==undefined){const leaders=array(e.leaders,path,100);const ids:string[]=[];leaders.forEach(l=>{const b=object(l,path);keys(b,['id','points','attachment','shape','arrow','arrowSize','landing'],path);string(b.id,path,true);ids.push(b.id as string);const points=array(b.points,path,1000);if(points.length<2)fail(path,'leader needs two points');points.forEach(p=>point(p,path));one(b.shape,['polyline','arc','spline'],path);one(b.arrow,['closed','open','dot','none'],path);number(b.arrowSize,path,0);number(b.landing,path,0);if(b.attachment!==undefined){const a=object(b.attachment,path);keys(a,['entityId','modelItemId','anchor'],path);if(a.entityId!==undefined)string(a.entityId,path,true);if(a.modelItemId!==undefined)string(a.modelItemId,path,true);if(a.anchor!==undefined)one(a.anchor,['top-left','top-center','top-right','middle-left','middle-center','middle-right','bottom-left','bottom-center','bottom-right','baseline-left'],path);}});unique(ids,path);}if(e.rows!==undefined)array(e.rows,path,1000).forEach(row=>array(row,path,1000).forEach(cell=>array(cell,path).forEach(p=>validateParagraph(p,path))));if(e.annotation!==undefined){const a=object(e.annotation,path);keys(a,['type','number','prefix','suffix','fields','sourceId'],path);one(a.type,['balloon','flag','dimension','gdt','datum','weld','surface','hole','thread','bend'],path);for(const key of ['number','prefix','suffix','sourceId'])if(a[key]!==undefined)string(a[key],path);const fields=object(a.fields,path);for(const v of Object.values(fields))string(v,path);}if(e.dimension!==undefined){validateDimensionDefinition(e.dimension);if(e.kind!=='symbol')fail(path,'dimension requires symbol entity');}if(e.geometry!==undefined){const g=object(e.geometry,path);keys(g,['type','points','radius','startAngle','endAngle','clockwise'],path);one(g.type,['line','rect','ellipse','arc'],path);if(g.type==='arc'){number(g.radius,path+'.radius',Number.MIN_VALUE);number(g.startAngle,path+'.startAngle');number(g.endAngle,path+'.endAngle');bool(g.clockwise,path+'.clockwise');}else if(['radius','startAngle','endAngle','clockwise'].some(key=>g[key]!==undefined))fail(path,'arc parameters require arc geometry');if(g.points!==undefined)array(g.points,path,10000).forEach(p=>point(p,path));}if(e.reference!==undefined){const r=object(e.reference,path);keys(r,['kind','targetId'],path);one(r.kind,['model','note','sheet'],path);string(r.targetId,path,true);}}
function validateSheets(value:unknown,path:string,styles:Set<string>):DrawingSheetModel[]{const sheets=array(value,path,1000);if(!sheets.length)fail(path,'at least one sheet required');const ids:string[]=[],entities:string[]=[];sheets.forEach((sheet,index)=>{const s=object(sheet,path+index);keys(s,['id','name','width','height','scale','entities'],path);string(s.id,path,true);ids.push(s.id as string);string(s.name,path,true);for(const key of ['width','height','scale'])number(s[key],path+'.'+key,Number.MIN_VALUE);array(s.entities,path+'.entities').forEach((e,i)=>{validateEntity(e,path+`.entities[${i}]`,styles);entities.push((e as DrawingEntity).id);});});unique(ids,path);unique(entities,path+'.entities');return value as DrawingSheetModel[];}
/** Strict v1 boundary: unknown future structures are rejected rather than silently discarded. Broken external references are retained and diagnosed. */
export function validateDrawingDocument(value:unknown):DrawingDocument {
 const d=object(value,'drawing');keys(d,['version','dimensionStyles','activeSheetId','sheets','styles','templates','properties','dictionary','revisions'],'drawing');if(d.version!==1)fail('drawing','unsupported schema version');if(d.dimensionStyles!==undefined){const dimensionStyles=array(d.dimensionStyles,'dimensionStyles',1000).map(validateDimensionStyle);unique(dimensionStyles.map(style=>style.id),'dimensionStyles');}const styles=array(d.styles,'styles',1000);if(!styles.length)fail('styles','at least one style required');styles.forEach((s,i)=>validateStyle(s,false,'styles'+i));const styleIds=styles.map(s=>(s as TextStyle).id);unique(styleIds,'styles');const sheets=validateSheets(d.sheets,'sheets',new Set(styleIds));string(d.activeSheetId,'activeSheetId',true);if(!sheets.some(s=>s.id===d.activeSheetId))fail('activeSheetId','missing sheet');const props=object(d.properties,'properties');for(const [key,value] of Object.entries(props)){string(value,'properties');if(key.startsWith('fontFallback:')){validateStyle({fontFamily:key.slice(13)},true);validateStyle({fontFamily:value},true);const visited=new Set<string>();let family=key.slice(13);while(Object.prototype.hasOwnProperty.call(props,'fontFallback:'+family)){if(visited.has(family))fail('properties','font fallback cycle');visited.add(family);family=props['fontFallback:'+family] as string;}}}array(d.dictionary,'dictionary',100000).forEach(word=>string(word,'dictionary',true));const templates=array(d.templates,'templates',10000);templates.forEach(t=>{const template=object(t,'template');keys(template,['id','name','category','entity'],'template');string(template.id,'template.id',true);string(template.name,'template.name',true);string(template.category,'template.category');validateEntity(template.entity,'template.entity',new Set(styleIds));});unique(templates.map(t=>(t as {id:string}).id),'templates');const revisions=array(d.revisions,'revisions',100);revisions.forEach(r=>{const rev=object(r,'revision');keys(rev,['id','name','createdAt','sheets'],'revision');string(rev.id,'revision.id',true);string(rev.name,'revision.name');string(rev.createdAt,'revision.createdAt',true);if(!Number.isFinite(Date.parse(rev.createdAt as string)))fail('revision','invalid date');validateSheets(rev.sheets,'revision.sheets',new Set(styleIds));});unique(revisions.map(r=>(r as {id:string}).id),'revisions');return cloneDrawing(value as DrawingDocument);
}
