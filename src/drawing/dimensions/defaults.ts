import type {DimensionDefinition,DimensionKind,DimensionStyle} from './types';
export function defaultDimensionStyle():DimensionStyle {
 return {id:'dim-default',name:'Стандартный размер',textHeight:3.5,fontFamily:'Arial',color:'#20252b',lineWidth:0.25,arrowSize:2.5,arrow:'closed',flipArrows:false,extensionOffset:1,extensionOvershoot:2,textGap:1,fit:'auto',textOrientation:'aligned',hideFirstExtension:false,hideSecondExtension:false,hideDimensionLine:false,textMask:true};
}
export function defaultDimensionDefinition(kind:DimensionKind='aligned'):DimensionDefinition {
 return {version:1,mode:'driven',kind,refs:[],offset:10,axisAngle:0,origin:[0,0],style:defaultDimensionStyle(),format:{unit:kind==='angle'||kind==='angle3'?'deg':'mm',precision:2,trailingZeros:false,decimalSeparator:'.',roundingIncrement:0,factor:1,alternatePrecision:3,prefix:'',suffix:''},tolerance:{type:'none',upper:0,lower:0,precision:2}};
}
