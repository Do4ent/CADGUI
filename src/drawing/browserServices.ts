/// <reference types="vite/client" />
import nspell from 'nspell';
import type {Diagnostic,DrawingContext,DrawingDocument,DrawingEntity,TextParagraph} from './types';
import {cloneDrawing,defaultTextStyle,emptyContext,validateDrawingDocument,validateStyle} from './model';

type Speller=ReturnType<typeof nspell>;
const spellingCache=new Map<'ru'|'en',Promise<Speller>>();
const normalWord=(word:string)=>word.normalize('NFC').toLocaleLowerCase().replace(/’/g,"'");
function safeFont(font:string):string {validateStyle({...defaultTextStyle(),fontFamily:font});return font;}
function paragraphs(entity:DrawingEntity):TextParagraph[]{return [...entity.paragraphs,...(entity.rows??[]).flatMap(row=>row.flat())];}
/** No document text is sent over the network. Only bundled public dictionary assets are read. */
async function dictionary(language:'ru'|'en'):Promise<Speller>{
 if(language!=='ru'&&language!=='en')throw new Error('Поддерживаются локальные словари ru/en');
 let pending=spellingCache.get(language);
 if(!pending){
  pending=(async()=>{
   const base=import.meta.env.BASE_URL;
   const asset=(extension:string)=>`${base.endsWith('/')?base:base+'/'}dictionaries/${language}/index.${extension}`;
   const responses=await Promise.all([fetch(asset('aff')),fetch(asset('dic'))]);
   if(responses.some(response=>!response.ok))throw new Error('Не удалось загрузить локальный словарь '+language);
   const [aff,dic]=await Promise.all(responses.map(response=>response.text()));
   if(!/^SET UTF-8\s*$/m.test(aff)||!/^\d+[\r\n]/.test(dic))throw new Error('Неподдерживаемый формат локального Hunspell-словаря');
   return nspell({aff,dic});
  })();
  spellingCache.set(language,pending);
  pending.catch(()=>spellingCache.delete(language));
 }
 return pending;
}
export async function checkSpelling(document:DrawingDocument,context:DrawingContext=emptyContext,language:'ru'|'en'='ru'):Promise<Diagnostic[]>{
 const doc=validateDrawingDocument(document),checker=await dictionary(language),diagnostics:Diagnostic[]=[];
 const ignored=new Set(doc.dictionary.flatMap(phrase=>[normalWord(phrase),...(phrase.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu)??[]).map(normalWord)]));
 const relevant=language==='ru'?/^[\p{Script=Cyrillic}'’\-]+$/u:/^[\p{Script=Latin}'’\-]+$/u;
 for(const sheet of doc.sheets)for(const entity of sheet.entities){
  const unknown=new Map<string,{word:string;count:number}>(),repeated=new Set<string>();
  for(const paragraph of paragraphs(entity)){
   // Fields, fractions and derived values remain semantically distinct from prose.
   // Runs can split a word for formatting, so check contiguous literal run sequences.
   const chunks:string[]=[];
   for(const run of paragraph.runs){if(run.field||run.stack){chunks.push('');continue;}if(!chunks.length)chunks.push('');chunks[chunks.length-1]+=run.text;}
   for(const text of chunks){let previous:{word:string;end:number}|undefined;
    for(const match of text.matchAll(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu)){
     const word=match[0],normalized=normalWord(word),start=match.index??0;
     const skip=/\p{N}/u.test(word)||!relevant.test(word)||word.length>100||/^[A-Z]{2,}$/.test(word)||ignored.has(normalized);
     if(skip){previous=undefined;continue;}
     if(previous?.word===normalized&&/^\s+$/u.test(text.slice(previous.end,start)))repeated.add(word);
     previous={word:normalized,end:start+word.length};
     if(!checker.correct(word)&&!checker.correct(normalized)){
      const existing=unknown.get(normalized);if(existing)existing.count++;else unknown.set(normalized,{word,count:1});
     }
    }
   }
  }
  for(const {word,count} of unknown.values())diagnostics.push({severity:'warning',code:'spelling',message:`${language}: «${word}» отсутствует в локальном словаре${count>1?` (${count} вхожд.)`:''}. Проверьте термин или добавьте в инженерный словарь.`,entityId:entity.id,sheetId:sheet.id});
  for(const word of repeated)diagnostics.push({severity:'warning',code:'repeated-word',message:`Повтор соседнего слова: «${word}».`,entityId:entity.id,sheetId:sheet.id});
 }
 // Context is intentionally not interpolated: model fields and article codes are not ordinary prose.
 void context;
 return diagnostics;
}

export type FontProbe={available:boolean;method:'generic'|'canvas-width+fontfaceset';certain:false};
/** Width comparison is an availability heuristic, not a proof of glyph coverage or licensed embedding. */
export async function probeFontAvailability(fontFamily:string):Promise<FontProbe>{
 const font=safeFont(fontFamily);
 if(typeof document==='undefined'||!document.fonts)throw new Error('FontFaceSet недоступен: проверка шрифтов выполняется в браузере');
 await document.fonts.ready;
 if(['serif','sans-serif','monospace','cursive','fantasy','system-ui'].includes(font.toLowerCase()))return {available:true,method:'generic',certain:false};
 const canvas=document.createElement('canvas'),context=canvas.getContext('2d');if(!context)throw new Error('Canvas недоступен для проверки шрифтов');
 const sample='mmmmmmlliWWW@#0123456789';
 let differing=false;
 for(const fallback of ['monospace','serif','sans-serif']){
  context.font=`72px ${fallback}`;const base=context.measureText(sample).width;
  context.font=`72px "${font}", ${fallback}`;const candidate=context.measureText(sample).width;
  if(Number.isFinite(base)&&Number.isFinite(candidate)&&Math.abs(base-candidate)>0.01)differing=true;
 }
 return {available:document.fonts.check(`72px "${font}"`)&&differing,method:'canvas-width+fontfaceset',certain:false};
}
function usedFonts(doc:DrawingDocument):Set<string>{
 const fonts=new Set([...doc.styles.map(style=>style.fontFamily),...(doc.dimensionStyles??[]).map(style=>style.fontFamily)]);
 for(const sheet of doc.sheets)for(const entity of sheet.entities){if(entity.dimension)fonts.add(entity.dimension.style.fontFamily);if(entity.overrides.fontFamily)fonts.add(entity.overrides.fontFamily);for(const paragraph of paragraphs(entity))for(const run of paragraph.runs)if(run.format?.fontFamily)fonts.add(run.format.fontFamily);}
 return fonts;
}
export async function diagnoseFonts(document:DrawingDocument):Promise<Diagnostic[]>{
 const doc=validateDrawingDocument(document),diagnostics:Diagnostic[]=[];
 for(const font of usedFonts(doc)){
  const mapped=doc.properties['fontFallback:'+font];
  const selected=mapped?safeFont(mapped):font;
  const probe=await probeFontAvailability(selected);
  diagnostics.push({severity:probe.available?'info':'warning',code:probe.available?'font-available':'font-unavailable',message:`${font}${mapped?' → '+mapped:''}: ${probe.available?'шрифт вероятно доступен':'шрифт не обнаружен методом сравнения ширины'}. Это эвристика FontFaceSet/canvas, не проверка каждого глифа.`});
  if(mapped)diagnostics.push({severity:'info',code:'font-fallback-policy',message:`Выбрана явная подстановка «${font}» → «${mapped}»; исходное имя шрифта сохранено.`});
 }
 diagnostics.push({severity:'info',code:'font-coverage-unverified',message:'Полное покрытие Unicode, фактически выбранный fallback для каждого глифа, права встраивания и точность SHX не проверяются браузерным FontFaceSet/canvas API.'});
 return diagnostics;
}
/** Persist the policy separately, preserving every original style/run fontFamily. Renderer resolves the mapping explicitly. */
export function applyFontFallback(document:DrawingDocument,from:string,to:string):DrawingDocument {
 const doc=validateDrawingDocument(document);safeFont(from);safeFont(to);
 if(!usedFonts(doc).has(from))throw new Error('Исходный шрифт не используется в документе');
 if(from===to)throw new Error('Выберите другой шрифт подстановки');
 const key='fontFallback:'+from;doc.properties[key]=to;
 const seen=new Set<string>([from]);let cursor=to;
 while(cursor){if(seen.has(cursor))throw new Error('Цикл подстановки шрифтов');seen.add(cursor);cursor=doc.properties['fontFallback:'+cursor]??'';if(cursor)safeFont(cursor);}
 return cloneDrawing(doc);
}
