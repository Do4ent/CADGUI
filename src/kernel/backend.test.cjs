/** Integration tests: execute the shipped backend against the actual OCCT WASM. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
function load(file,dependencies){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:name=>{if(name in dependencies)return dependencies[name];if(name.startsWith('.'))return load(path.relative(__dirname,path.resolve(path.dirname(path.join(__dirname,file)),name+'.ts')),{});throw Error('Unexpected dependency '+name);},Float32Array,Int32Array,Uint32Array});return exports;}
(async()=>{
 const occt=await import('occt-wasm'),kernel=await occt.OcctKernel.init();
 const model=load('model.ts',{}),{ExactKernelBackend}=load('backend.ts',{'occt-wasm':occt,'./model':model,'../sketch/model':load('../sketch/model.ts',{'./nonlinear':load('../sketch/nonlinear.ts',{})})}),backend=new ExactKernelBackend(kernel);let checks=0;
 const ok=(v)=>{checks++;assert.ok(v);},equal=(a,b)=>{checks++;assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)));},near=(a,b)=>{checks++;assert.ok(Math.abs(a-b)<=1e-6*Math.max(1,Math.abs(b)),`${a} != ${b}`);};
 const request=input=>{const count=kernel.shapeCount;try{return backend.execute(input);}finally{equal(kernel.shapeCount,count);}};
 const reject=input=>{checks++;assert.throws(()=>request(input));};
 function mesh(body){const m=body.mesh;ok(body.volume>0&&body.area>0);ok(m.positions.length>0&&m.positions.length===m.normals.length);ok(m.indices.length>0&&m.indices.length%3===0);ok(m.positions.every(Number.isFinite)&&m.normals.every(Number.isFinite));ok(m.indices.every(i=>i>=0&&i<m.positions.length/3));ok(m.faceGroups.length>0&&m.faceGroups.length%3===0);let covered=0;for(let i=0;i<m.faceGroups.length;i+=3){const start=m.faceGroups[i],count=m.faceGroups[i+1];ok(start>=0&&start%3===0&&count>0&&count%3===0&&start+count<=m.indices.length);covered+=count;}equal(covered,m.indices.length);ok(body.lines.length>0&&body.lines.length%6===0&&body.lines.every(Number.isFinite));}
 try{
 const box=request({op:'box',size:[2,3,4],origin:[0,0,0]});near(box.volume,24);near(box.area,52);equal(box.topology.solids,1);equal(box.topology.faces,6);for(let i=0;i<3;i++){near(box.bounds[0][i],0);near(box.bounds[1][i],[2,3,4][i]);}mesh(box);
 const cylinder=request({op:'cylinder',radius:2,height:5,origin:[0,0,0]});near(cylinder.volume,20*Math.PI);for(let i=0;i<3;i++){near(cylinder.bounds[0][i],[-2,-2,0][i]);near(cylinder.bounds[1][i],[2,2,5][i]);}mesh(cylinder);
 function planarFaces(brep){const count=kernel.shapeCount;try{return backend.inspectPlanarFaces(brep);}finally{equal(kernel.shapeCount,count);}}
 const boxPlanes=planarFaces(box.brep);
 equal(boxPlanes.kind,'planar-faces');equal(boxPlanes.brep,box.brep);equal(planarFaces(box.brep),boxPlanes);
 equal(boxPlanes.faces.map(face=>face.faceIndex),[0,1,2,3,4,5]);
 const boxNormals=[[-1,0,0],[1,0,0],[0,-1,0],[0,1,0],[0,0,-1],[0,0,1]];
 for(const face of boxPlanes.faces){
  const normal=boxNormals[face.faceIndex];equal(face.normal,normal);
  const axis=normal.findIndex(Boolean);near(face.origin[axis],normal[axis]<0?0:[2,3,4][axis]);
 }
 const cylinderPlanes=planarFaces(cylinder.brep);equal(cylinderPlanes.faces.map(face=>face.faceIndex),[1,2]);
 for(const face of cylinderPlanes.faces){near(face.origin[0],0);near(face.origin[1],0);near(face.origin[2],face.faceIndex===1?5:0);equal(face.normal,[0,0,face.faceIndex===1?1:-1]);}
 const translatedPlanes=planarFaces(request({op:'box',size:[2,3,4],origin:[7,-4,5]}).brep);
 for(const face of translatedPlanes.faces){equal(face.normal,boxNormals[face.faceIndex]);face.origin.forEach((value,i)=>near(value,boxPlanes.faces[face.faceIndex].origin[i]+[7,-4,5][i]));}
 assert.throws(()=>planarFaces('bad'),/BREP/);
 const tool=request({op:'cylinder',radius:1,height:5,origin:[0,0,0]}),bore=request({op:'boolean',kind:'cut',a:cylinder.brep,b:tool.brep});near(bore.volume,15*Math.PI);equal(bore.topology.solids,1);ok(bore.topology.faces>=4);mesh(bore);
 const shifted=request({op:'box',size:[2,3,4],origin:[1,0,0]});for(const [kind,value] of [['fuse',36],['common',12],['cut',12]]){const result=request({op:'boolean',kind,a:box.brep,b:shifted.brep});near(result.volume,value);mesh(result);}
 const distant=request({op:'box',size:[2,3,4],origin:[10,0,0]}),disjoint=request({op:'boolean',kind:'fuse',a:box.brep,b:distant.brep});near(disjoint.volume,48);equal(disjoint.topology.solids,2);mesh(disjoint);
 const restored=request({op:'inspect',brep:bore.brep});near(restored.volume,bore.volume);equal(restored.bounds,bore.bounds);mesh(restored);
 // Map creation-cache and inspection groups to exact, untranslated BREP ordinals.
 for(const result of [box,cylinder,request({op:'inspect',brep:box.brep}),request({op:'inspect',brep:cylinder.brep})]){
  const faces=backend.inspectPlanarFaces(result.brep).faces;
  const {planarFaceIndices,faceGroups,positions,indices}=result.mesh;
  equal(planarFaceIndices.length,faceGroups.length/3);
  equal([...planarFaceIndices].filter(index=>index>=0).sort((a,b)=>a-b),faces.map(face=>face.faceIndex));
  for(const [group,index] of planarFaceIndices.entries()){
   if(index<0)continue;
   const face=faces.find(face=>face.faceIndex===index);
   const start=faceGroups[group*3],end=start+faceGroups[group*3+1];
   for(let j=start;j<end;j++){
    const p=indices[j]*3;
    near(face.normal.reduce((distance,axis,k)=>distance+axis*(positions[p+k]-face.origin[k]),0),0);
   }
  }
 }
 // A duplicate native hash is treated as ambiguous, even for a planar box.
 const originalHash=kernel.hashCode;
 let firstHash;
 kernel.hashCode=function(face,bound){
  firstHash??=originalHash.call(this,face,bound);
  return firstHash;
 };
 try{
  const collision=request({op:'inspect',brep:box.brep}).mesh.planarFaceIndices;
  ok(collision.length===6&&collision.every(index=>index===-1));
 }finally{kernel.hashCode=originalHash;}
 const step=request({op:'export-step',brep:bore.brep});ok(typeof step==='string'&&step.includes('ISO-10303-21'));const imported=request({op:'import-step',text:step});near(imported.volume,bore.volume);mesh(imported);
 // Independent real kernel STEP writer creates both mm and inch inputs; no simulated geometry.
 const handle=kernel.makeBox(25.4,12.7,5.08);try{for(const unit of ['mm','inch']){const input=kernel.exportStep(handle,{unit,schema:'AP214'}),result=request({op:'import-step',text:input});near(result.bounds[1][0],25.4);near(result.bounds[1][1],12.7);near(result.bounds[1][2],5.08);near(result.volume,25.4*12.7*5.08);}}finally{kernel.release(handle);}
 for(const input of [{op:'box',size:[0,3,4],origin:[0,0,0]},{op:'box',size:[NaN,3,4],origin:[0,0,0]},{op:'cylinder',radius:0,height:5,origin:[0,0,0]},{op:'cylinder',radius:2,height:Infinity,origin:[0,0,0]},{op:'inspect',brep:'bad'},{op:'inspect',brep:'CASCADE Topology V3\nmalformed'},{op:'import-step',text:'bad'},{op:'import-step',text:'ISO-10303-21;\nnot a STEP file\nEND-ISO-10303-21;'},{op:'boolean',kind:'common',a:box.brep,b:distant.brep}])reject(input);
 // Repeated deserialize/tessellate requests must not retain temporary native handles.
 for(let i=0;i<12;i++){const result=request({op:'inspect',brep:box.brep});near(result.volume,24);}equal(kernel.shapeCount,0);
 console.log(`PASS: ${checks} actual OCCT WASM backend analytic geometry, booleans, mesh ranges, BREP/STEP and arena cleanup checks`);
 }finally{kernel[Symbol.dispose]();}
})().catch(error=>{console.error(error);process.exitCode=1;});
