/** Exercise actual workspace transaction helpers; no reimplemented geometry engine. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const cache=new Map();
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const exports={};cache.set(file,exports);const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInNewContext(js,{exports,require:name=>name.startsWith('.')?load(path.resolve(path.dirname(file),name+'.ts')):require(name),console});return exports;}
const o=load(path.join(__dirname,'operations.ts')),m=load(path.join(__dirname,'../model.ts')),d=load(path.join(__dirname,'defaults.ts')),e=load(path.join(__dirname,'engine.ts'));
const json=x=>JSON.parse(JSON.stringify(x)),equal=(a,b)=>assert.deepEqual(json(a),json(b));
const all=doc=>doc.sheets[0].entities,by=(doc,id)=>all(doc).find(x=>x.id===id);
function geometry(doc,id,type,points,x=0,y=0){const entity=m.createTextEntity('geometry','');Object.assign(entity,{id,name:id,x,y,width:10,height:10});entity.geometry={type,...(points?{points}:{})};all(doc).push(entity);return entity;}
function lineDoc(){const doc=m.createDrawingDocument();geometry(doc,'a','line',[[0,0],[10,0]]);geometry(doc,'b','line',[[0,0],[20,0]],10);return doc;}
function definition(source='a'){const def=d.defaultDimensionDefinition('horizontal');def.refs=[{entityId:source,anchor:'start'},{entityId:source,anchor:'end'}];return def;}
function saved(doc,def=definition()){return o.saveDimension(doc,def);}

// Save/edit and failed multi-edit are isolated transactions.
let doc=lineDoc(),before=json(doc),first=saved(doc);equal(doc,before);assert.equal(all(first.document).length,3);
let id=first.ids[0],edited=o.saveDimension(first.document,{...definition(),offset:22},id);assert.equal(edited.ids[0],id);assert.equal(all(edited.document).length,3);assert.equal(by(edited.document,id).dimension.offset,22);
let second=saved(first.document,definition('b')),ids=[id,second.ids[0]],snapshot=json(second.document);
assert.throws(()=>o.updateDimensions(second.document,ids,(def,entity)=>{def.offset=55;if(entity.id===ids[1])def.style.arrowSize=-1;}));equal(second.document,snapshot);
assert.throws(()=>o.saveDimension(doc,{...definition(),refs:[{entityId:'absent',anchor:'start'}]}));equal(doc,before);

// Chains share adjacent endpoints; baselines share the first stable reference.
for(const type of ['chain','baseline']){
 const source=lineDoc(),original=json(source),result=o.createDimensionGroup(source,['a','b'],type,{axisAngle:0,offset:12,spacing:7,origin:[0,0]});equal(source,original);
 const defs=result.ids.map(id=>by(result.document,id).dimension);assert.equal(defs.length,2);assert.equal(defs[0].groupId,defs[1].groupId);assert.equal(defs[0].groupType,type);
 equal(defs[0].refs,[{entityId:'a',anchor:'start'},{entityId:'a',anchor:'end'}]);
 equal(defs[1].refs,type==='chain'?[{entityId:'a',anchor:'end'},{entityId:'b',anchor:'end'}]:[{entityId:'a',anchor:'start'},{entityId:'b',anchor:'end'}]);
 equal(defs.map(def=>e.evaluateDimension(def,result.document).value),type==='chain'?[10,20]:[10,30]);
 assert.throws(()=>o.createDimensionGroup(source,['a'],type,{axisAngle:0,offset:1,spacing:0,origin:[0,0]}));equal(source,original);
}
const ordinate=o.createDimensionGroup(lineDoc(),['a','b'],'ordinate',{axisAngle:0,offset:12,spacing:7,origin:[5,0]});
equal(ordinate.ids.map(id=>e.evaluateDimension(by(ordinate.document,id).dimension,ordinate.document).value),[-5,5,25]);
assert.ok(ordinate.ids.every(id=>by(ordinate.document,id).dimension.groupType==='ordinate'));

// Freeze/detach retains all radial/arc geometry, rather than only a stale label.
for(const kind of ['radius','arc-length']){
 const source=m.createDrawingDocument(),entity=geometry(source,'round',kind==='radius'?'ellipse':'arc',kind==='radius'?undefined:[[0,0]],20,30);
 if(kind==='arc-length')Object.assign(entity.geometry,{radius:5,startAngle:10,endAngle:100,clockwise:false});
 const def=d.defaultDimensionDefinition(kind);def.refs=[{entityId:'round',anchor:'center'}];const initial=saved(source,def),did=initial.ids[0],measurement=e.evaluateDimension(by(initial.document,did).dimension,initial.document);
 const frozen=o.freezeDimensions(initial.document,[did]);equal(by(frozen,did).dimension.frozen,measurement);equal(by(initial.document,did).dimension,def);
 const changed=json(frozen);by(changed,'round').x+=40;if(kind==='radius')Object.assign(by(changed,'round'),{width:20,height:20});else by(changed,'round').geometry.radius=10;
 equal(e.evaluateDimension(by(changed,did).dimension,changed),measurement);
 const changedSource=json(by(changed,'round')),restored=o.freezeDimensions(changed,[did]);assert.equal(by(restored,did).dimension.frozen,undefined);equal(by(restored,'round'),changedSource);assert.equal(e.evaluateDimension(by(restored,did).dimension,restored).value,measurement.value*2);
 const detached=o.freezeDimensions(initial.document,[did],true);equal(by(detached,did).dimension.refs,[]);assert.equal(by(detached,did).annotation.sourceId,undefined);equal(e.evaluateDimension(by(detached,did).dimension,detached),measurement);
 const detachedBefore=json(detached);assert.throws(()=>o.freezeDimensions(detached,[did]));equal(detached,detachedBefore);
}

// Copy only visual style: measurement formats/tolerances stay target-specific.
doc=second.document;by(doc,ids[0]).dimension.style.color='#ff0000';by(doc,ids[0]).dimension.style.textHeight=6;by(doc,ids[0]).dimension.tolerance={type:'symmetric',upper:0.1,lower:-0.1,precision:2};
by(doc,ids[1]).dimension.tolerance={type:'deviation',upper:0.2,lower:-0.3,precision:3};by(doc,ids[1]).dimension.format.precision=4;before=json(doc);
const copied=o.copyDimensionStyle(doc,ids);equal(by(copied,ids[1]).dimension.style,by(doc,ids[0]).dimension.style);equal(by(copied,ids[1]).dimension.tolerance,by(doc,ids[1]).dimension.tolerance);equal(by(copied,ids[1]).dimension.format,by(doc,ids[1]).dimension.format);equal(doc,before);
const custom={...d.defaultDimensionStyle(),id:'custom',name:'Saved style',textHeight:8};const applied=o.applyDimensionStyle(doc,ids,custom);for(const did of ids)equal(by(applied,did).dimension.style,custom);
assert.throws(()=>o.applyDimensionStyle(doc,ids,{...custom,color:'url(javascript:bad)'}));equal(doc,before);
applied.dimensionStyles=[custom];by(applied,ids[0]).dimension.style.textHeight=12;const reset=o.resetDimensionStyle(applied,[ids[0]]);equal(by(reset,ids[0]).dimension.style,custom);

// Spacing preserves the first line's actual world position, including entity offset.
doc=json(second.document);by(doc,ids[0]).dimension.offset=17;by(doc,ids[0]).y=4;by(doc,ids[1]).y=9;by(doc,ids[1]).dimension.offset=80;before=json(doc);
const spaced=o.spaceDimensions(doc,ids,6);assert.equal(by(spaced,ids[0]).dimension.offset,17);assert.equal(by(spaced,ids[0]).y+by(spaced,ids[0]).dimension.offset,21);assert.equal(by(spaced,ids[1]).y+by(spaced,ids[1]).dimension.offset,27);equal(doc,before);
assert.throws(()=>o.spaceDimensions(doc,ids,-1));equal(doc,before);by(doc,ids[1]).dimension.kind='vertical';before=json(doc);assert.throws(()=>o.spaceDimensions(doc,ids,3));equal(doc,before);
const reporting=json(copied);by(reporting,ids[0]).dimension.manualText='Контроль';by(reporting,ids[1]).dimension.refs[0].entityId='missing-report-source';
const report=o.dimensionReport(reporting);assert.ok(report.some(line=>line.includes('10 mm')&&line.includes('ручная подпись')));assert.ok(report.some(line=>line.includes('missing-report-source')));
const duplicate=saved(first.document,definition());assert.ok(o.dimensionReport(duplicate.document).some(line=>line.includes('дубликат')));
console.log('PASS dimension workspace atomic edits, source groups, radial freeze/detach, visual styles, spacing and reports');
