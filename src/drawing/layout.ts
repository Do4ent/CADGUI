import type {DrawingContext,DrawingDocument,DrawingEntity,TextStyle,TextRun} from './types';
import {emptyContext,resolveStyle,runText} from './model';
import {resolveFontFamily} from './fontPolicy';
export type TextMeasure=(text:string,style:TextStyle)=>number;
export type PositionedTextRun={text:string;x:number;y:number;width:number;style:TextStyle;script?:TextRun['script'];stack?:TextRun['stack']};
export type TextLayoutLine={runs:PositionedTextRun[];x:number;y:number;width:number;height:number;paragraphIndex:number};
export type TextLayout={lines:TextLayoutLine[];width:number;height:number;overflow:boolean;approximate:boolean};
/** Fallback is deliberately approximate; a renderer can inject canvas/font metrics in drawing units. */
export const approximateTextMeasure:TextMeasure=(text,style)=>Array.from(text).reduce((width,c)=>width+(c===' '?0.33:/[MWЖШЩ]/u.test(c)?0.85:0.58)*style.height*style.widthFactor+style.tracking,0);
export function createCanvasTextMeasure(context:CanvasRenderingContext2D,pixelsPerUnit=96/25.4):TextMeasure {
 return (text,style)=>{context.font=`${style.italic?'italic ':''}${style.bold?'bold ':''}${style.height*pixelsPerUnit}px "${style.fontFamily}"`;return context.measureText(text).width/pixelsPerUnit*style.widthFactor+Math.max(0,Array.from(text).length-1)*style.tracking;};
}
export function layoutText(entity:DrawingEntity,doc:DrawingDocument,context:DrawingContext=emptyContext,measure:TextMeasure=approximateTextMeasure):TextLayout {
 const base=resolveStyle(doc,entity),sheet=doc.sheets.find(s=>s.entities.some(e=>e.id===entity.id))??doc.sheets.find(s=>s.id===doc.activeSheetId)!;
 const scale=base.scaleMode==='model'?sheet.scale:1;
 const styleScale=(style:TextStyle):TextStyle=>({...style,fontFamily:resolveFontFamily(doc,style.fontFamily),height:style.height*scale,tracking:style.tracking*scale,spaceBefore:style.spaceBefore*scale,spaceAfter:style.spaceAfter*scale});
 const count=entity.columns?.count??1,gap=entity.columns?.gap??0;
 const columnWidth=entity.width>0?(entity.width-gap*(count-1))/count:Infinity;
 if(columnWidth<=0)throw new Error('Column gaps exceed text container');
 const lines:TextLayoutLine[]=[];
 let y=0,column=0,maxWidth=0,overflow=false;
 entity.paragraphs.forEach((paragraph,paragraphIndex)=>{
  y+=base.spaceBefore*scale;
  const indent=(paragraph.indent??0)*scale,firstIndent=(paragraph.firstIndent??0)*scale;
  let lineRuns:PositionedTextRun[]=[],lineWidth=0,lineHeight=base.height*scale*base.lineSpacing,first=true;
  const finish=(last=false)=>{
   const prefix=first?(paragraph.list==='bullet'?'• ':paragraph.list==='number'?`${paragraph.listStart??paragraphIndex+1}. `:paragraph.list==='letter'?`${String.fromCharCode(65+((paragraph.listStart??paragraphIndex+1)-1)%26)}. `:''):'';
   const lineIndent=indent+(first?firstIndent:0);
   if(prefix){const st=styleScale(base),width=measure(prefix,st);lineRuns.unshift({text:prefix,x:0,y:0,width,style:st});lineWidth+=width;}
   if(entity.height>0&&y+lineHeight>entity.height&&column<count-1){column++;y=0;}
   if(entity.height>0&&y+lineHeight>entity.height)overflow=true;
   const align=paragraph.align??base.paragraphAlign;
   const available=columnWidth-lineIndent;
   let x=column*(Number.isFinite(columnWidth)?columnWidth+gap:0)+lineIndent+(align==='center'&&Number.isFinite(available)?(available-lineWidth)/2:align==='right'&&Number.isFinite(available)?available-lineWidth:0);
   const start=x;
   const spaces=lineRuns.reduce((n,r)=>n+(r.text.match(/ /g)?.length??0),0);
   const extra=align==='justify'&&!last&&spaces&&Number.isFinite(available)?Math.max(0,available-lineWidth)/spaces:0;
   for(const run of lineRuns){run.x=x;run.y=y;run.width+=extra*(run.text.match(/ /g)?.length??0);x+=run.width;}
   lines.push({runs:lineRuns,x:start,y,width:x-start,height:lineHeight,paragraphIndex});
   maxWidth=Math.max(maxWidth,x);if(lineWidth>available)overflow=true;
   y+=lineHeight;lineRuns=[];lineWidth=0;lineHeight=base.height*scale*base.lineSpacing;first=false;
  };
  for(const run of paragraph.runs){
   const st=styleScale({...base,...run.format}),factor=run.script&&run.script!=='normal'?0.7:1;
   st.height*=factor;
   const text=runText(run,doc,context);
   // Word wrapping preserves explicit line breaks; long unbreakable strings remain visibly overflowing.
   const tokens=text.split(/(\n|\t|[ ]+)/u).filter(Boolean);
   for(const token of tokens){
    if(token==='\n'){finish();continue;}
    const tabs=paragraph.tabs??[];
    const width=token==='\t'?Math.max(0,(tabs.find(t=>t>lineWidth)??(Math.floor(lineWidth/(st.height*4))+1)*st.height*4)-lineWidth):measure(token,st);
    if(!Number.isFinite(width)||width<0)throw new Error('Text measurement must be finite and non-negative');
    if(lineRuns.length&&lineWidth+width>columnWidth-indent-(first?firstIndent:0)&&!/^[ ]+$/.test(token))finish();
    lineRuns.push({text:token==='\t'?'':token,x:0,y:0,width,style:st,script:run.script,stack:run.stack});lineWidth+=width;
    lineHeight=Math.max(lineHeight,st.height*st.lineSpacing*(run.stack?1.7:1));
   }
  }
  finish(true);y+=base.spaceAfter*scale;
 });
 const height=lines.reduce((max,line)=>Math.max(max,line.y+line.height),0);
 const anchor=base.anchor;
 const offsetX=anchor.endsWith('center')?-maxWidth/2:anchor.endsWith('right')?-maxWidth:0;
 const offsetY=anchor.startsWith('middle')?-height/2:anchor.startsWith('bottom')?-height:anchor==='baseline-left'?-base.height*scale:0;
 for(const line of lines){line.x+=offsetX;line.y+=offsetY;for(const run of line.runs){run.x+=offsetX;run.y+=offsetY;}}
 if(!Number.isFinite(maxWidth)||!Number.isFinite(height))throw new Error('Text layout overflowed numeric range');
 return {lines,width:maxWidth,height,overflow,approximate:measure===approximateTextMeasure};
}
