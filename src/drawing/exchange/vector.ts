import type {DrawingDocument,DrawingContext,DrawingEntity,Point2,TextStyle} from '../types';
import {cloneDrawing,createDrawingDocument,createTextEntity,defaultTextStyle,drawingId,plainText,resolveStyle,runText,validateDrawingDocument} from '../model';

export function serializeDrawingSvg(svg:SVGSVGElement):string {
 const clone=svg.cloneNode(true) as SVGSVGElement;
 clone.querySelectorAll('[data-drawing-ui], [data-drawing-printable="false"], script, foreignObject').forEach(node=>node.remove());
 for(const node of [clone,...Array.from(clone.querySelectorAll('*'))])for(const attr of Array.from(node.attributes)){
  if(/^on/i.test(attr.name)||((attr.name==='href'||attr.name==='xlink:href')&&!attr.value.startsWith('#')))node.removeAttribute(attr.name);
 }
 const box=svg.viewBox.baseVal;
 if(!(box.width>0&&box.height>0))throw new Error('SVG paper viewBox must have positive dimensions');
 clone.setAttribute('xmlns','http://www.w3.org/2000/svg');clone.setAttribute('width',`${box.width}mm`);clone.setAttribute('height',`${box.height}mm`);
 clone.removeAttribute('tabindex');clone.style.removeProperty('box-shadow');clone.style.removeProperty('user-select');
 return '<?xml version="1.0" encoding="UTF-8"?>\n'+new XMLSerializer().serializeToString(clone);
}

/** DXF strings are encoded as ASCII UTF-16 escapes, never raw group-code newlines. */
export function encodeDxfText(value:string,multiline=false):string {
 let out='';for(let i=0;i<value.length;i++){const code=value.charCodeAt(i),c=value[i];if(c==='\n'&&multiline){out+='\\P';continue;}if(code>=32&&code<=126&&c!=='\\'&&c!=='{'&&c!=='}')out+=c;else out+='\\U+'+code.toString(16).toUpperCase().padStart(4,'0');}return out;
}
export function decodeDxfText(value:string,multiline=false):string {
 let out='';for(let i=0;i<value.length;){if(value.slice(i,i+3)==='\\U+'&&/^[\da-f]{4}$/i.test(value.slice(i+3,i+7))){out+=String.fromCharCode(parseInt(value.slice(i+3,i+7),16));i+=7;}else if(multiline&&value.slice(i,i+2)==='\\P'){out+='\n';i+=2;}else if(multiline&&value[i]==='\\'&&['\\','{','}'].includes(value[i+1])){out+=value[i+1];i+=2;}else out+=value[i++];}return out;
}
export type DxfExport={text:string;warnings:string[]};
export function exportDrawingDxf(doc:DrawingDocument,context:DrawingContext):DxfExport {
 validateDrawingDocument(doc);const sheet=doc.sheets.find(s=>s.id===doc.activeSheetId)!;const pairs:string[]=[];const warnings=new Set<string>();
 const put=(code:number,value:string|number)=>{if(typeof value==='number'&&!Number.isFinite(value))throw new Error('DXF coordinates must be finite');const v=String(value);if(/[\r\n]/.test(v))throw new Error('Invalid DXF group value');pairs.push(String(code),v);};
 const line=(a:Point2,b:Point2)=>{put(0,'LINE');put(100,'AcDbEntity');put(8,'0');put(100,'AcDbLine');put(10,a[0]);put(20,sheet.height-a[1]);put(30,0);put(11,b[0]);put(21,sheet.height-b[1]);put(31,0);};
 const text=(value:string,x:number,y:number,width:number,rotation:number,style:TextStyle)=>{const multi=value.includes('\n');put(0,multi?'MTEXT':'TEXT');put(100,'AcDbEntity');put(8,'0');put(100,multi?'AcDbMText':'AcDbText');put(10,x);put(20,sheet.height-y);put(30,0);put(40,style.height);if(multi){put(41,Math.max(1,width));put(71,1);}else {put(41,style.widthFactor);put(51,-style.oblique);}put(50,multi?-rotation*Math.PI/180:-rotation);const encoded=encodeDxfText(value,multi);if(multi){for(let i=0;i<encoded.length-250;i+=250)put(3,encoded.slice(i,i+250));put(1,encoded.slice(Math.floor(Math.max(0,encoded.length-1)/250)*250));}else put(1,encoded);put(7,'STANDARD');};
 put(0,'SECTION');put(2,'HEADER');put(9,'$ACADVER');put(1,'AC1015');put(9,'$INSUNITS');put(70,4);put(9,'$MEASUREMENT');put(70,1);put(9,'$EXTMIN');put(10,0);put(20,0);put(9,'$EXTMAX');put(10,sheet.width);put(20,sheet.height);put(0,'ENDSEC');put(0,'SECTION');put(2,'ENTITIES');
 for(const entity of sheet.entities){const style=resolveStyle(doc,entity);if(!style.visible||!style.printable)continue;const rad=entity.rotation*Math.PI/180;const world=(p:Point2):Point2=>[entity.x+p[0]*Math.cos(rad)-p[1]*Math.sin(rad),entity.y+p[0]*Math.sin(rad)+p[1]*Math.cos(rad)];
  if(entity.kind==='geometry'){
   if(entity.geometry?.type==='line'){const points=entity.geometry.points||[[0,0],[entity.width,entity.height]];for(let i=1;i<points.length;i++)line(world(points[i-1]),world(points[i]));}
   else if(entity.geometry?.type==='rect'){const points:Point2[]=[[0,0],[entity.width,0],[entity.width,entity.height],[0,entity.height],[0,0]];for(let i=1;i<points.length;i++)line(world(points[i-1]),world(points[i]));}
   else warnings.add('Ellipse geometry is omitted by the LINE/TEXT/MTEXT exchange subset.');
  }else if(entity.kind==='table'&&entity.rows?.length){const rh=entity.height/entity.rows.length;entity.rows.forEach((row,ri)=>{const cw=entity.width/Math.max(1,row.length);row.forEach((cell,ci)=>{const a=world([ci*cw,ri*rh]),b=world([(ci+1)*cw,ri*rh]),c=world([(ci+1)*cw,(ri+1)*rh]),d=world([ci*cw,(ri+1)*rh]);line(a,b);line(b,c);line(c,d);line(d,a);const p=world([ci*cw+1,ri*rh+style.height]);text(cell.map(p=>p.runs.map(r=>runText(r,doc,context)).join('')).join('\n'),p[0],p[1],cw-2,entity.rotation,style);});});warnings.add('Tables become independent text and lines; cell semantics are not retained.');
  }else {let value=plainText(entity,doc,context);if(entity.annotation){warnings.add('Engineering symbols become static text; symbol geometry and semantic references are not retained.');}text(value,entity.x,entity.y,entity.width,entity.rotation,style);}
  for(const branch of entity.leaders||[]){for(let i=1;i<branch.points.length;i++)line(branch.points[i-1],branch.points[i]);warnings.add('Leaders become polylines of LINE entities; arrowheads, curves and associations are not retained.');}
  if(entity.paragraphs.some(p=>p.runs.some(r=>r.field)))warnings.add('Linked fields are exported as evaluated static text.');
  if(entity.paragraphs.some(p=>p.runs.some(r=>r.format||r.script||r.stack))||style.bold||style.italic||style.frame!=='none'||style.mask||entity.arc||entity.columns)warnings.add('Rich formatting, frames, masks, columns and arc placement are flattened in DXF.');
  if(style.anchor!=='top-left'&&style.anchor!=='baseline-left')warnings.add('Text anchor alignment is reduced to an insertion point in DXF.');
 }
 warnings.add('DXF exports the active sheet in millimetres; fonts, colors and layers use receiver defaults. TEXT baselines may differ from SVG glyph placement.');if(doc.sheets.length>1)warnings.add('Only the active sheet is exported.');put(0,'ENDSEC');put(0,'EOF');return {text:pairs.join('\r\n')+'\r\n',warnings:[...warnings]};
}

type Pair={code:number;value:string};
export function parseDrawingDxf(source:string,baseDoc?:DrawingDocument):{document:DrawingDocument;warnings:string[]} {
 if(source.length>20_000_000)throw new Error('DXF exceeds 20 MB limit');
 if(source.includes('\0')||source.startsWith('AutoCAD Binary DXF')||/^AC10\d\d/.test(source))throw new Error('Binary DXF/DWG is unsupported; provide an ASCII DXF file');
 const lines=source.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').split('\n');while(lines.at(-1)==='')lines.pop();if(lines.length%2)throw new Error('Malformed DXF group pair');
 const pairs:Pair[]=[];for(let i=0;i<lines.length;i+=2){if(!/^\s*\d{1,4}\s*$/.test(lines[i]))throw new Error('Invalid DXF group code');pairs.push({code:Number(lines[i]),value:lines[i+1]});}
 if(!pairs.some(p=>p.code===0&&p.value==='SECTION')||pairs.at(-1)?.code!==0||pairs.at(-1)?.value!=='EOF')throw new Error('Not a complete ASCII DXF document');
 const warnings=new Set<string>(),doc=baseDoc?cloneDrawing(baseDoc):createDrawingDocument();if(baseDoc)validateDrawingDocument(doc);
 const sheet=doc.sheets.find(s=>s.id===doc.activeSheetId)!;sheet.entities=[];
 let entities=false,found=false,width=sheet.width,height=sheet.height;let units:number|undefined;
 const records:Pair[][]=[];let record:Pair[]=[];
 for(let i=0;i<pairs.length;i++){const p=pairs[i];if(p.code===9&&p.value==='$INSUNITS')units=Number(pairs[i+1]?.value);
 if(p.code===9&&p.value==='$EXTMAX'){const x=pairs.slice(i+1,i+4).find(p=>p.code===10),y=pairs.slice(i+1,i+4).find(p=>p.code===20);if(x)width=Number(x.value);if(y)height=Number(y.value);}
 if(p.code===0&&p.value==='SECTION'){entities=pairs[i+1]?.value==='ENTITIES';if(entities)found=true;continue;}
 if(p.code===0&&p.value==='ENDSEC'){if(entities&&record.length)records.push(record);record=[];entities=false;continue;}
 if(entities&&p.code!==2){if(p.code===0){if(record.length)records.push(record);record=[];}record.push(p);}}
 if(!found)throw new Error('DXF has no ENTITIES section');if(units!==undefined&&units!==0&&units!==4)throw new Error('Only millimetre DXF units are supported; convert source units before import');if(units!==4)warnings.add('Missing/unitless DXF units interpreted as millimetres.');
 if(!(Number.isFinite(width)&&width>0&&width<=1e6&&Number.isFinite(height)&&height>0&&height<=1e6)){width=sheet.width;height=sheet.height;warnings.add('Invalid DXF extents ignored; original paper dimensions retained.');}sheet.width=width;sheet.height=height;
 if(!doc.styles.some(s=>s.id==='default'))doc.styles.push(defaultTextStyle());
 for(const record of records){const kind=record[0]?.value;const get=(code:number,fallback='')=>record.find(p=>p.code===code)?.value??fallback;const number=(code:number,fallback=0)=>{const value=Number(get(code,String(fallback)));if(!Number.isFinite(value)||Math.abs(value)>1e9)throw new Error(`Invalid ${kind} numeric group ${code}`);return value;};
  if(kind==='TEXT'||kind==='MTEXT'){
   let raw=(kind==='MTEXT'?record.filter(p=>p.code===3).map(p=>p.value).join(''):'')+get(1);if(kind==='MTEXT'&&/\\[A-OQ-TV-Za-z]|[{}]/.test(raw.replace(/\\U\+[\da-f]{4}/gi,'')))warnings.add('Unsupported MTEXT formatting retained as literal text; full CAD text formatting is not supported.');
   const value=decodeDxfText(raw,kind==='MTEXT');if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))throw new Error('DXF text contains unsupported control characters');const entity=createTextEntity('text',value);entity.name='DXF '+kind;entity.x=number(10);entity.y=height-number(20);entity.rotation=kind==='MTEXT'?-number(50)*180/Math.PI:-number(50);const textHeight=number(40,3.5);if(textHeight<=0)throw new Error('DXF text height must be positive');entity.height=textHeight*Math.max(1,value.split('\n').length)*1.2;entity.width=kind==='MTEXT'?number(41,80):Math.max(textHeight,[...value].length*textHeight*.6);entity.overrides={height:textHeight,anchor:kind==='TEXT'?'baseline-left':'top-left'};if(kind==='TEXT'){const widthFactor=number(41,1);if(widthFactor<=0)throw new Error('DXF width factor must be positive');entity.overrides.widthFactor=widthFactor;entity.overrides.oblique=-number(51);}if(entity.width<=0)throw new Error('DXF text width must be positive');sheet.entities.push(entity);
  }else if(kind==='LINE'){const x=number(10),y=height-number(20),end:Point2=[number(11)-x,height-number(21)-y];const entity=createTextEntity('geometry');Object.assign(entity,{name:'DXF LINE',x,y,width:Math.max(.1,Math.abs(end[0])),height:Math.max(.1,Math.abs(end[1])),geometry:{type:'line',points:[[0,0],end]},paragraphs:[]});sheet.entities.push(entity);
  }else warnings.add(`Unsupported DXF entity ${kind||'unknown'} omitted.`);
 }
 validateDrawingDocument(doc);warnings.add('Imported subset: TEXT, MTEXT and LINE only. Original CAD styles, references, handles and annotation semantics are not reconstructed.');return {document:doc,warnings:[...warnings]};
}
