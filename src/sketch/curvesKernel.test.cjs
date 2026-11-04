const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const modules=new Map();let occt;function load(relative){const filename=path.resolve(__dirname,relative);if(modules.has(filename))return modules.get(filename);const exports={};modules.set(filename,exports);const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInNewContext(code,{exports,require:name=>name==='occt-wasm'?occt:name==='../kernel/client'?{kernelClient:{execute:()=>{throw Error('Unexpected browser client');}}}:load(path.relative(__dirname,path.resolve(path.dirname(filename),name+'.ts'))),Float32Array,Int32Array,Uint32Array});return exports;}
(async()=>{occt=await import('occt-wasm');const kernel=await occt.OcctKernel.init(),{ExactKernelBackend}=load('../kernel/backend.ts'),backend=new ExactKernelBackend(kernel),m=load('model.ts'),{rebuildSketchBodies}=load('rebuild.ts'),exact=load('../kernel/model.ts');let checks=0;const near=(a,b)=>{checks++;assert.ok(Math.abs(a-b)<1e-6*Math.max(1,Math.abs(b)),`${a} != ${b}`);},eq=(a,b)=>{checks++;assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)));},ok=v=>{checks++;assert.ok(v);},reject=f=>{checks++;assert.throws(f);};const run=r=>{const n=kernel.shapeCount;try{return backend.execute(r);}finally{eq(kernel.shapeCount,n);}};
try{
 const base={op:'extrude-curve',plane:'XY',origin:[10,20,30],depth:3,profile:{kind:'circle',center:[1,2],radius:2}};
 for(const plane of ['XY','XZ','YZ'])for(const depth of [-3,3]){
  const body=run({...base,plane,depth});near(body.volume,12*Math.PI);near(body.area,20*Math.PI);eq(body.topology.solids,1);eq(body.topology.faces,3);
  const normal=m.sketchNormal(plane),center=m.sketchPointToWorld(plane,base.origin,[1,2]);
  for(let i=0;i<3;i++){near(body.bounds[0][i],center[i]+(normal[i]?Math.min(0,normal[i]*depth):-2));near(body.bounds[1][i],center[i]+(normal[i]?Math.max(0,normal[i]*depth):2));}
  near(run({op:'inspect',brep:body.brep}).volume,12*Math.PI);
 }
 for(const plane of ['XY','XZ','YZ'])for(const depth of [-3,3])for(const sweep of [Math.PI/2,-Math.PI/2,Math.PI,-Math.PI,Math.PI*1.5,-Math.PI*1.5]){
  const body=run({...base,plane,depth,profile:{kind:'arc',center:[0,0],radius:2,startAngle:.3,sweep}});near(body.volume,Math.abs(sweep)*6);near(body.area,Math.abs(sweep)*4+3*(4+Math.abs(sweep)*2));eq(body.topology.solids,1);eq(body.topology.faces,5);ok(body.mesh.indices.length>0);
 }
 for(const patch of [{depth:0},{depth:Infinity},{plane:'bad'},{profile:{kind:'circle',center:[0,0],radius:0}},{profile:{kind:'circle',center:[0,0],radius:-1}},{profile:{kind:'circle',center:[NaN,0],radius:2}},{profile:{kind:'arc',center:[0,0],radius:2,startAngle:0,sweep:0}},{profile:{kind:'arc',center:[0,0],radius:2,startAngle:0,sweep:2*Math.PI}},{profile:{kind:'arc',center:[0,0],radius:2,startAngle:NaN,sweep:1}}])reject(()=>run({...base,...patch}));
 console.log(`PASS: ${checks} actual OCCT disk/sector analytic volume, area, signed plane bounds, BREP and arena checks`);
}finally{kernel[Symbol.dispose]();}
})().catch(error=>{console.error(error);process.exit(1)});
