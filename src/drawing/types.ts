import type {DimensionDefinition,DimensionStyle} from './dimensions/types';
/** Drawing schema is independent of three-dimensional scene Item primitives. */
export type Point2 = [number, number];
export type TextAnchor = 'top-left'|'top-center'|'top-right'|'middle-left'|'middle-center'|'middle-right'|'bottom-left'|'bottom-center'|'bottom-right'|'baseline-left';
export type ParagraphAlign = 'left'|'center'|'right'|'justify';
export type TextStyle = {
 id:string;name:string;fontFamily:string;height:number;bold:boolean;italic:boolean;
 underline:boolean;overline:boolean;strike:boolean;color:string;widthFactor:number;
 oblique:number;tracking:number;lineSpacing:number;spaceBefore:number;spaceAfter:number;
 paragraphAlign:ParagraphAlign;anchor:TextAnchor;mask:boolean;maskColor:string;
 maskPadding:number;frame:'none'|'rectangle'|'circle'|'capsule';layer:string;
 printable:boolean;visible:boolean;scaleMode:'paper'|'model';direction:'ltr'|'rtl';
 writingMode:'horizontal'|'vertical';
};
export type FieldRef={kind:'document'|'sheet'|'model'|'entity'|'formula'|'technical';targetId?:string;key:string;prefix?:string;suffix?:string;precision?:number;unit?:string;fallback?:string;frozen?:string};
export type TextRun={text:string;format?:Partial<TextStyle>;field?:FieldRef;script?:'normal'|'super'|'sub';stack?:{top:string;bottom:string;kind:'fraction'|'diagonal'|'tolerance'}};
export type TextParagraph={runs:TextRun[];align?:ParagraphAlign;indent?:number;firstIndent?:number;tabs?:number[];list?:'none'|'bullet'|'number'|'letter';listStart?:number};
export type LeaderBranch={id:string;points:Point2[];attachment?:{entityId?:string;modelItemId?:string;anchor?:TextAnchor};shape:'polyline'|'arc'|'spline';arrow:'closed'|'open'|'dot'|'none';arrowSize:number;landing:number};
export type DrawingEntity={
 id:string;kind:'text'|'leader'|'table'|'symbol'|'geometry';name:string;x:number;y:number;
 width:number;height:number;rotation:number;styleId:string;overrides:Partial<TextStyle>;
 dimension?:DimensionDefinition;
 paragraphs:TextParagraph[];locked?:boolean;columns?:{count:number;gap:number;dynamic:boolean};
 arc?:{radius:number;startAngle:number;clockwise:boolean;inside:boolean};
 leaders?:LeaderBranch[];rows?:TextParagraph[][][];
 annotation?:{type:'balloon'|'flag'|'dimension'|'gdt'|'datum'|'weld'|'surface'|'hole'|'thread'|'bend';number?:string;prefix?:string;suffix?:string;fields:Record<string,string>;sourceId?:string};
 geometry?:{type:'line'|'rect'|'ellipse'|'arc';points?:Point2[];radius?:number;startAngle?:number;endAngle?:number;clockwise?:boolean};
 reference?:{kind:'model'|'note'|'sheet';targetId:string};
 technical?:boolean;sourceText?:string;
};
export type DrawingSheetModel={id:string;name:string;width:number;height:number;scale:number;entities:DrawingEntity[]};
export type TextTemplate={id:string;name:string;category:string;entity:DrawingEntity};
export type DrawingRevision={id:string;name:string;createdAt:string;sheets:DrawingSheetModel[]};
export type DrawingDocument={version:1;dimensionStyles?:DimensionStyle[];activeSheetId:string;sheets:DrawingSheetModel[];styles:TextStyle[];templates:TextTemplate[];properties:Record<string,string>;dictionary:string[];revisions:DrawingRevision[]};
export type DrawingModelItem={id:string;name:string;kind:string;pos:[number,number,number];size:[number,number,number];color:string;visible:boolean;group:string};
export type DrawingContext={documentName:string;documentId:string;modelItems:DrawingModelItem[];sheetId?:string};
export type Diagnostic={severity:'error'|'warning'|'info';code:string;message:string;entityId?:string;sheetId?:string};
export type DrawingCommandInput={text?:string;value?:string;number?:number;x?:number;y?:number;width?:number;height?:number;angle?:number;styleId?:string;fontFamily?:string;entity?:DrawingEntity;style?:TextStyle;field?:FieldRef;templateId?:string;sourceId?:string;find?:string;replace?:string;caseSensitive?:boolean;wholeWord?:boolean;pattern?:boolean;scope?:'selection'|'sheet'|'document';options?:Record<string,string|number|boolean>;payload?:unknown};
export type DrawingOperationResult={document:DrawingDocument;selection:string[];message:string;diagnostics?:Diagnostic[]};
