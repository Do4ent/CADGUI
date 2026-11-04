/** Integration tests: execute the shipped backend against the actual OCCT WASM. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
function load(file,dependencies){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:name=>{if(name in dependencies)return dependencies[name];throw Error('Unexpected dependency '+name);},Float32Array,Int32Array,Uint32Array});return exports;}
(async()=>{
 const occt=await import('occt-wasm'),kernel=await occt.OcctKernel.init();
 const model=load('model.ts',{}),{ExactKernelBackend}=load('backend.ts',{'occt-wasm':occt,'./model':model,'../sketch/model':load('../sketch/model.ts',{})}),backend=new ExactKernelBackend(kernel);let checks=0;
 const ok=(v)=>{checks++;assert.ok(v);},equal=(a,b)=>{checks++;assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)));},near=(a,b)=>{checks++;assert.ok(Math.abs(a-b)<=1e-6*Math.max(1,Math.abs(b)),`${a} != ${b}`);};
 const request=input=>{const count=kernel.shapeCount;try{return backend.execute(input);}finally{equal(kernel.shapeCount,count);}};
 const reject=input=>{checks++;assert.throws(()=>request(input));};
 function mesh(body){const m=body.mesh;ok(body.volume>0&&body.area>0);ok(m.positions.length>0&&m.positions.length===m.normals.length);ok(m.indices.length>0&&m.indices.length%3===0);ok(m.positions.every(Number.isFinite)&&m.normals.every(Number.isFinite));ok(m.indices.every(i=>i>=0&&i<m.positions.length/3));ok(m.faceGroups.length>0&&m.faceGroups.length%3===0);let covered=0;for(let i=0;i<m.faceGroups.length;i+=3){const start=m.faceGroups[i],count=m.faceGroups[i+1];ok(start>=0&&start%3===0&&count>0&&count%3===0&&start+count<=m.indices.length);covered+=count;}equal(covered,m.indices.length);ok(body.lines.length>0&&body.lines.length%6===0&&body.lines.every(Number.isFinite));}
 try{
 const box=request({op:'box',size:[2,3,4],origin:[0,0,0]});near(box.volume,24);near(box.area,52);equal(box.topology.solids,1);equal(box.topology.faces,6);for(let i=0;i<3;i++){near(box.bounds[0][i],0);near(box.bounds[1][i],[2,3,4][i]);}mesh(box);
 const cylinder=request({op:'cylinder',radius:2,height:5,origin:[0,0,0]});near(cylinder.volume,20*Math.PI);for(let i=0;i<3;i++){near(cylinder.bounds[0][i],[-2,-2,0][i]);near(cylinder.bounds[1][i],[2,2,5][i]);}mesh(cylinder);
 const tool=request({op:'cylinder',radius:1,height:5,origin:[0,0,0]}),bore=request({op:'boolean',kind:'cut',a:cylinder.brep,b:tool.brep});near(bore.volume,15*Math.PI);equal(bore.topology.solids,1);ok(bore.topology.faces>=4);mesh(bore);
 const shifted=request({op:'box',size:[2,3,4],origin:[1,0,0]});for(const [kind,value] of [['fuse',36],['common',12],['cut',12]]){const result=request({op:'boolean',kind,a:box.brep,b:shifted.brep});near(result.volume,value);mesh(result);}
 const distant=request({op:'box',size:[2,3,4],origin:[10,0,0]}),disjoint=request({op:'boolean',kind:'fuse',a:box.brep,b:distant.brep});near(disjoint.volume,48);equal(disjoint.topology.solids,2);mesh(disjoint);
 const restored=request({op:'inspect',brep:bore.brep});near(restored.volume,bore.volume);equal(restored.bounds,bore.bounds);mesh(restored);
 const step=request({op:'export-step',brep:bore.brep});ok(typeof step==='string'&&step.includes('ISO-10303-21'));const imported=request({op:'import-step',text:step});near(imported.volume,bore.volume);mesh(imported);
 // Independent real kernel STEP writer creates both mm and inch inputs; no simulated geometry.
 const handle=kernel.makeBox(25.4,12.7,5.08);try{for(const unit of ['mm','inch']){const input=kernel.exportStep(handle,{unit,schema:'AP214'}),result=request({op:'import-step',text:input});near(result.bounds[1][0],25.4);near(result.bounds[1][1],12.7);near(result.bounds[1][2],5.08);near(result.volume,25.4*12.7*5.08);}}finally{kernel.release(handle);}
 for(const input of [{op:'box',size:[0,3,4],origin:[0,0,0]},{op:'box',size:[NaN,3,4],origin:[0,0,0]},{op:'cylinder',radius:0,height:5,origin:[0,0,0]},{op:'cylinder',radius:2,height:Infinity,origin:[0,0,0]},{op:'inspect',brep:'bad'},{op:'inspect',brep:'CASCADE Topology V3\nmalformed'},{op:'import-step',text:'bad'},{op:'import-step',text:'ISO-10303-21;\nnot a STEP file\nEND-ISO-10303-21;'},{op:'boolean',kind:'common',a:box.brep,b:distant.brep}])reject(input);
 // Repeated deserialize/tessellate requests must not retain temporary native handles.
 for(let i=0;i<12;i++){const result=request({op:'inspect',brep:box.brep});near(result.volume,24);}equal(kernel.shapeCount,0);
 console.log(`PASS: ${checks} actual OCCT WASM backend analytic geometry, booleans, mesh ranges, BREP/STEP and arena cleanup checks`);
 }finally{kernel[Symbol.dispose]();}
})().catch(error=>{console.error(error);process.exitCode=1;});
