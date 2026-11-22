const assert = require('node:assert/strict');
const fs = require('node:fs');
const {Quaternion, Vector3, Euler} = require('three');
const ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(
  fs.readFileSync(file, 'utf8'),
  {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}},
).outputText, file);

const {planarMateTransform, planarMateTransformMatches} = require('./planarMateTransform.ts');
const {assemblyPoseRelativeTo} = require('./assemblyMates.ts');
const quaternion = (x,y,z) => new Quaternion().setFromEuler(new Euler(x,y,z)).toArray();
const vector = values => new Vector3(...values);
const rotation = pose => new Quaternion(...pose.quaternion);
const xPlane = {faceIndex:1, origin:[2,1,4], normal:[1,0,0]};
const yPlane = {faceIndex:2, origin:[3,7,-2], normal:[0,1,0]};
const near = (a,b) => assert.ok(Math.abs(a-b) <= 1e-9, `${a} ≠ ${b}`);

for (let i=0; i<128; i++) {
  const leader = {position:[8,-3,13], quaternion:quaternion(i*.019,i*.11,-i*.27)};
  const follower = {position:[42,-17,6], quaternion:quaternion(i*.071,-i*.19,i*.023)};
  const before = assemblyPoseRelativeTo(follower,leader);
  const solved = planarMateTransform(leader,follower,xPlane,yPlane);
  assert.ok(planarMateTransformMatches(solved,xPlane,yPlane));
  assert.ok(!planarMateTransformMatches({...solved,position:[solved.position[0]+0.01,...solved.position.slice(1)]},xPlane,yPlane));
  assert.ok(!planarMateTransformMatches({...solved,quaternion:[0,0,0,1]},xPlane,yPlane));
  const target = vector(xPlane.normal).negate();
  const oldNormal = vector(yPlane.normal).applyQuaternion(rotation(before));
  const orientation = rotation(solved);
  const newNormal = vector(yPlane.normal).applyQuaternion(orientation);
  near(newNormal.distanceTo(target),0);
  near(orientation.angleTo(rotation(before)),oldNormal.angleTo(target));
  const point = vector(yPlane.origin).applyQuaternion(orientation).add(vector(solved.position));
  near(point.sub(vector(xPlane.origin)).dot(vector(xPlane.normal)),0);
  near(solved.position[1],before.position[1]);
  near(solved.position[2],before.position[2]);
}

const identity = {position:[0,0,0], quaternion:[0,0,0,1]};
for (const angle of [0,1e-10,Math.PI-1e-10,Math.PI]) {
  const follower = {position:[7,11,13], quaternion:quaternion(0,0,angle)};
  const solved = planarMateTransform(identity,follower,xPlane,xPlane);
  near(vector(xPlane.normal).applyQuaternion(rotation(solved)).distanceTo(new Vector3(-1,0,0)),0);
  near(solved.position[0],4);
  near(solved.position[1],11);
  near(solved.position[2],13);
}

console.log('PASS planar face coincidence over 128 rotated poses and parallel/antiparallel edge cases');
