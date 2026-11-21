const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const m=require('./model.ts'),p=require('./featureSuppression.ts');let checks=0;
const eq=(a,b)=>{checks++;assert.deepEqual(a,b)},bad=f=>{checks++;assert.throws(f)};
const body=id=>({id,name:'Custom '+id,brep:'CASCADE Topology V1 '+id,color:'#123456',visible:false});
const exact=ids=>({version:1,kernel:'occt-wasm',kernelVersion:'5.15.0',units:'mm',bodies:ids.map(body)});
const root={version:1,units:'mm',sketches:[m.createRectangleSketch('s',2,3)],extrusions:[{id:'ext',sketchId:'s',bodyId:'root',depth:2}]};
const cases=[
 ['extrusion',root,'ext','root',[]],
 ['revolution',{...root,extrusions:[],revolutions:[{id:'rev',sketchId:'s',bodyId:'rev-body',axis:'v',offset:0,angle:360}]},'rev','rev-body',[]],
 ['cut',{...root,cuts:[{id:'cut',sketchId:'s',bodyId:'cut-body',targetBodyId:'root',depth:1}]},'cut','cut-body',['root']],
 ['fusion',{...root,fusions:[{id:'fuse',bodyId:'fused',aBodyId:'root',bBodyId:'static'}]},'fuse','fused',['root','static']],
 ['body-boolean',{...root,bodyBooleans:[{id:'common',bodyId:'common-body',aBodyId:'root',bBodyId:'static',operation:'common'}]},'common','common-body',['root','static']],
];
for(const [kind,state,id,output,inputs]of cases){
 const base=exact([...new Set([...state.extrusions.map(f=>f.bodyId),output,...inputs,'unrelated'])]);const snapshot=JSON.stringify([state,base]);
 eq(p.getFeatureSuppressionEligibility(state,id).kind,kind);eq(p.getFeatureSuppressionEligibility(state,id).eligible,true);
 const plan=p.planFeatureSuppression(state,base,[],id);
 eq(plan.exact.bodies.some(b=>b.id===output),false);eq(plan.state,state);eq(plan.records,[{featureId:id,output:{name:'Custom '+output,color:'#123456',visible:false}}]);
 eq(plan.reservedBodyIds.includes(output),true);eq(plan.exact.bodies.find(b=>b.id==='unrelated').visible,false);
 for(const input of inputs)eq(plan.exact.bodies.find(b=>b.id===input).visible,true);
 const resume=p.planFeatureResume(plan.state,plan.exact,plan.records,id);
 eq(resume.restoreOutput,{bodyId:output,name:'Custom '+output,color:'#123456',visible:false});eq(resume.records,[]);eq(resume.exact.bodies.some(b=>b.id===output),false);
 for(const input of inputs)eq(resume.exact.bodies.find(b=>b.id===input).visible,false);
 eq(JSON.stringify([state,base]),snapshot);bad(()=>p.planFeatureSuppression(state,plan.exact,plan.records,id));bad(()=>p.planFeatureResume(state,base,[],id));
 resume.state.sketches[0].name='detached';eq(state.sketches[0].name,'Прямоугольник');
}
const branch={...root,cuts:[{id:'left',sketchId:'s',bodyId:'left-body',targetBodyId:'root',depth:1},{id:'right',sketchId:'s',bodyId:'right-body',targetBodyId:'root',depth:1}]};
eq(p.getFeatureSuppressionEligibility(branch,'ext').consumerIds,['left','right']);bad(()=>p.planFeatureSuppression(branch,exact(['root','left-body','right-body']),[],'ext'));
const left=p.planFeatureSuppression(branch,exact(['root','left-body','right-body']),[],'left');eq(left.exact.bodies.find(b=>b.id==='root').visible,false,'shared input stays consumed');
const both=p.planFeatureSuppression(branch,left.exact,left.records,'right');eq(both.exact.bodies.find(b=>b.id==='root').visible,true);
bad(()=>p.planFeatureResume(branch,exact(['root']),[{featureId:'ext',output:{name:'x',color:'#123456',visible:true}}],'ext'));
bad(()=>p.planFeatureSuppression(branch,exact(['root','left-body']),[],'left'));
bad(()=>p.planFeatureSuppression(branch,exact(['left-body','right-body']),[],'left'));
eq(p.getFeatureSuppressionEligibility(root,'missing').eligible,false);
for(const invalid of [null,{},new Array(1),[{featureId:'ext',output:{name:'x',color:'red',visible:true}}],[{featureId:'ext',output:{name:'x',color:'#123456',visible:true,extra:1}}],[{featureId:'missing',output:{name:'x',color:'#123456',visible:true}}]])bad(()=>p.planFeatureResume(root,exact([]),invalid,'ext'));
const record={featureId:'ext',output:{name:'Name',color:'#123456',visible:true}},detached=p.validateSuppressedFeatureRecords([record]);detached[0].output.name='Changed';eq(record.output.name,'Name');bad(()=>p.validateSuppressedFeatureRecords([record,record]));
console.log(`PASS ${checks} leaf suppression eligibility, branch visibility, metadata, detached plans and rejection checks; native rebuild remains caller-owned`);
