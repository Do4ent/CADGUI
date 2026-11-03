const fs=require('node:fs'),ts=require('typescript'),assert=require('node:assert/strict');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {validateDimensionDefinition:validate,validateDimensionStyle}=require('./validation.ts');
const style={id:'default',name:'Размерный',textHeight:3.5,fontFamily:'DejaVu Sans',color:'#112233',lineWidth:.25,arrowSize:2,arrow:'closed',flipArrows:false,extensionOffset:1,extensionOvershoot:2,textGap:1,fit:'auto',textOrientation:'aligned',hideFirstExtension:false,hideSecondExtension:false,hideDimensionLine:false,textMask:true};
const definition={version:1,mode:'driven',kind:'aligned',refs:[{entityId:'line',anchor:'start'},{entityId:'line',anchor:'end'}],offset:10,axisAngle:0,origin:[0,0],style,format:{unit:'mm',precision:3,trailingZeros:false,decimalSeparator:'.',roundingIncrement:0,factor:1,alternatePrecision:2,prefix:'L=',suffix:' мм'},tolerance:{type:'none',upper:0,lower:0,precision:2}};
const copy=value=>JSON.parse(JSON.stringify(value));
assert.deepEqual(validate(definition),definition);
const detached=validate(definition);detached.refs[0].entityId='changed';detached.style.name='Changed';detached.origin[0]=123;assert.equal(definition.refs[0].entityId,'line');assert.equal(style.name,'Размерный');assert.equal(definition.origin[0],0);
for(const patch of [{version:2},{mode:'driving'},{kind:'future'},{offset:NaN},{axisAngle:Infinity},{origin:[0]},{extra:true},{refs:[]},{refs:[{entityId:'line',point:[0,0]}]},{refs:[{}]},{refs:[{point:[0,0],anchor:'start'}]},{refs:[{entityId:'line',anchor:'future'}]},{manualText:''},{groupType:'chain'},{frozen:{value:1,unit:'deg',points:[[0,0]]}}])assert.throws(()=>validate({...definition,...patch}));
for(const patch of [{precision:-1},{precision:1.5},{precision:100},{unit:'px'},{unit:'deg'},{factor:0},{roundingIncrement:-1},{decimalSeparator:';'},{trailingZeros:'false'},{alternateUnit:'cm'},{extra:true}])assert.throws(()=>validate({...definition,format:{...definition.format,...patch}}));
for(const patch of [{textHeight:0},{fontFamily:'Arial; url(x)'},{color:'red'},{lineWidth:0},{arrowSize:-1},{arrow:'triangle'},{flipArrows:1},{fit:'future'},{extra:1}])assert.throws(()=>validateDimensionStyle({...style,...patch}));
assert.throws(()=>validate({...definition,tolerance:{...definition.tolerance,type:'symmetric',upper:-1}}));
assert.throws(()=>validate({...definition,tolerance:{...definition.tolerance,type:'deviation',lower:2,upper:1}}));
assert.throws(()=>validate({...definition,tolerance:{...definition.tolerance,type:'future'}}));
const angle={...definition,kind:'angle',format:{...definition.format,unit:'deg'}};assert.deepEqual(validate(angle),angle);assert.throws(()=>validate({...angle,format:{...angle.format,alternateUnit:'in'}}));
const manual={...definition,refs:[{point:[1,2]},{point:[3,4]}],manualText:'Контроль ±0,1',inspection:{label:'А',rate:100},frozen:{value:3,unit:'mm',points:[[1,2],[3,4]]}};assert.deepEqual(validate(manual),manual);
console.log('PASS strict detached dimension definitions/styles, typed references, unit compatibility and tolerance validation');

const frozenArc={...definition,kind:'arc-length',refs:[{entityId:'arc'}],frozen:{value:12,unit:'mm',points:[[0,0],[1,2]],center:[2,3],radius:4,startAngle:0,endAngle:90,axis:[1,0]}};assert.deepEqual(validate(frozenArc),frozenArc);assert.throws(()=>validate({...frozenArc,frozen:{...frozenArc.frozen,radius:0}}));assert.throws(()=>validate({...frozenArc,frozen:{...frozenArc.frozen,axis:[NaN,0]}}));

assert.deepEqual(validate({...manual,refs:[]}),{...manual,refs:[]});assert.throws(()=>validate({...definition,refs:[]}));
