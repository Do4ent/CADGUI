const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');const Module=require('module');
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,f);
const original=Module._load;Module._load=function(id,...args){if(id==='./client')return {kernelClient:{execute:()=>Promise.reject(new Error('No worker in unit test'))}};if(id==='@react-three/drei')return {Html:()=>null};return original.call(this,id,...args)};
const {createBodyGeometry,faceAtTriangle,faceHighlightGeometry,exactClippingPlanes}=require('./ExactModelLayer.tsx');Module._load=original;
const result={mesh:{positions:new Float32Array([0,0,0,2,0,0,2,2,0,0,2,0]),normals:new Float32Array([0,0,1,0,0,1,0,0,1,0,0,1]),indices:new Uint32Array([0,1,2,0,2,3]),faceGroups:new Int32Array([0,3,47,3,3,91])}};
assert.equal(faceAtTriangle(result.mesh.faceGroups,0),47);assert.equal(faceAtTriangle(result.mesh.faceGroups,1),91);assert.equal(faceAtTriangle(result.mesh.faceGroups,2),null);
const geometry=createBodyGeometry(result);assert.deepEqual(Array.from(geometry.index.array),[0,1,2,0,2,3]);assert.deepEqual(geometry.boundingBox.max.toArray(),[2,2,0]);assert.equal(geometry.attributes.normal.count,4);
const highlight=faceHighlightGeometry(result,3,3);assert.deepEqual(Array.from(highlight.index.array),[0,2,3]);
assert.throws(()=>createBodyGeometry({...result,mesh:{...result.mesh,indices:new Uint32Array([0,1,99])}}),/BREP/);
for(const [section,point] of [['XY',[0,0,3]],['XZ',[0,3,0]],['YZ',[3,0,0]]])assert.equal(exactClippingPlanes(section,2)[0].distanceToPoint(new (require('three').Vector3)(...point)),-1);
assert.deepEqual(exactClippingPlanes('off'),[]);geometry.dispose();highlight.dispose();
console.log('PASS actual indexed BREP geometry, index-range face selection/highlight, clipping and malformed mesh rejection');

// Hash collision must select a single ordinal range, never all equal hashes.
result.mesh.faceGroups=new Int32Array([0,3,47,3,3,47]);const range=faceHighlightGeometry(result,3,3);assert.deepEqual(Array.from(range.index.array),[0,2,3]);range.dispose();

const THREE=require('three');
const {visiblePickRaycast}=require('./ExactModelLayer.tsx');
const {exactPlaneAtTriangle}=require('../documents/assemblyViewportFacePick.ts');
const pickMesh={...result.mesh,planarFaceIndices:new Int32Array([5,-1])};
assert.equal(exactPlaneAtTriangle(pickMesh,0),5);
for(const triangle of [1,2,-1,0.1,Infinity])assert.equal(exactPlaneAtTriangle(pickMesh,triangle),undefined);
assert.equal(exactPlaneAtTriangle(result.mesh,0),undefined);
assert.equal(exactPlaneAtTriangle({...pickMesh,planarFaceIndices:new Int32Array([5])},0),undefined);

const box=new THREE.Mesh(new THREE.BoxGeometry(2,2,2),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
box.position.z=-0.5;
box.updateMatrixWorld();
const ray=new THREE.Raycaster(new THREE.Vector3(0.2,0.1,10),new THREE.Vector3(0,0,-1));
const visibleHits=[];
visiblePickRaycast(exactClippingPlanes('XY',0)).call(box,ray,visibleHits);
assert.deepEqual(visibleHits.map(hit=>hit.point.z),[-1.5]);
box.geometry.dispose();box.material.dispose();
