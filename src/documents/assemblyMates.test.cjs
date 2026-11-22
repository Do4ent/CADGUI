const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(
  fs.readFileSync(file, 'utf8'),
  {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}},
).outputText, file);

const {angularAssemblyMateFromPoses,createFixedAssemblyMate, distanceAssemblyMateFromPoses, resolveAssemblyPoses, materializeAssemblyPlacement} = require('./assemblyMates.ts');
const make = (id, position, rotation = [0, 0, 0]) => ({id, position, rotation});
const near = (actual, expected) => {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, index) => assert.ok(Math.abs(value - expected[index]) < 1e-8, `${actual} ≠ ${expected}`));
};
const sameOrientation = (actual, expected) => {
  const sign = actual.reduce((dot, value, index) => dot + value * expected[index], 0) < 0 ? -1 : 1;
  near(actual.map(value => value * sign), expected);
};

const source = [make('a', [0, 0, 0]), make('b', [10, 0, 0], [27, 36, -51]), make('c', [10, 5, 0])];
const snapshot = structuredClone(source);
const ab = createFixedAssemblyMate(source, [], 'a', 'b');
const bc = createFixedAssemblyMate(source, [ab], 'b', 'c');
const attached = resolveAssemblyPoses(source, [bc, ab]);
const initial = resolveAssemblyPoses(source, []);
for (const [id, pose] of initial) {
  near(attached.get(id).position, pose.position);
  sameOrientation(attached.get(id).quaternion, pose.quaternion);
}

const moved = resolveAssemblyPoses([make('a', [1, 2, 3], [0, 0, 90]), ...source.slice(1)], [bc, ab]);
near(moved.get('b').position, [1, 12, 3]);
near(moved.get('c').position, [-4, 12, 3]);
const detached = materializeAssemblyPlacement('b', moved.get('b'));
const afterDetach = resolveAssemblyPoses([source[0], detached, source[2]], [bc]);
near(afterDetach.get('c').position, moved.get('c').position);
sameOrientation(afterDetach.get('b').quaternion, moved.get('b').quaternion);

for (const y of [89.999, 90, -89.999, -90]) {
  const [pose] = resolveAssemblyPoses([make('b', [0, 0, 0], [30, y, 40])], []).values();
  const [roundtrip] = resolveAssemblyPoses([materializeAssemblyPlacement('b', pose)], []).values();
  sameOrientation(roundtrip.quaternion, pose.quaternion);
}
assert.throws(() => createFixedAssemblyMate(source, [ab, bc], 'c', 'a'), /cycle/);
assert.throws(() => createFixedAssemblyMate(source, [ab], 'c', 'b'), /multiple leaders/);
assert.throws(() => createFixedAssemblyMate(source, [], 'a', 'a'), /endpoints/);
assert.throws(() => createFixedAssemblyMate(source, [], 'a', 'missing'), /Missing/);
assert.throws(() => resolveAssemblyPoses(source, [{...ab, quaternion: [0, 0, 0, 2]}]), /relative pose/);
assert.throws(() => resolveAssemblyPoses(source, [{...ab, translation: new Array(3)}]), /relative pose/);
assert.deepEqual(source, snapshot);
console.log('PASS fixed mate graph, no-jump attach, rigid propagation and detach');

const distanceMate = distanceAssemblyMateFromPoses(initial,'a','b',15);
const distancePoses = resolveAssemblyPoses([make('a',[1,2,3],[0,0,90]),...source.slice(1)], [distanceMate,bc]);
near(distancePoses.get('b').position,[1,17,3]);
near(distancePoses.get('c').position,[-4,17,3]);
sameOrientation(distancePoses.get('b').quaternion,moved.get('b').quaternion);

const coincident = [make('a',[2,3,4],[0,0,90]), make('b',[2,3,4],[10,20,30])];
const coincidentMate = distanceAssemblyMateFromPoses(resolveAssemblyPoses(coincident,[]),'a','b',2);
assert.deepEqual(coincidentMate.direction,[1,0,0]);
near(resolveAssemblyPoses(coincident,[coincidentMate]).get('b').position,[2,5,4]);
near(resolveAssemblyPoses(coincident,[{...coincidentMate,distance:0}]).get('b').position,[2,3,4]);
assert.throws(()=>resolveAssemblyPoses(source,[{...distanceMate,distance:-1}]), /relative pose/);
assert.throws(()=>resolveAssemblyPoses(source,[{...distanceMate,direction:[0,0,0]}]), /relative pose/);
console.log('PASS distance mates, zero and coincident origins, rotated direction and fixed descendants');


const {Euler, Quaternion, Vector3} = require('three');
const radians = Math.PI / 180;
const angularLeader = make('leader', [42, -11, 3], [34, -12, 65]);
const angularFollower = make('follower', [-10, 42, -8], [-8, 76, 11]);
const angularPlacements = [angularLeader, angularFollower];
const free = resolveAssemblyPoses(angularPlacements, []);
const intoLeader = new Quaternion(...free.get('leader').quaternion).invert();
const captured = intoLeader.clone().multiply(new Quaternion(...free.get('follower').quaternion));
const originalAxis = new Vector3(1, 0, 0).applyQuaternion(captured);
const originalHeading = Math.atan2(originalAxis.y, originalAxis.x);
for (const angle of [-180, -37, 0, 55, 180]) {
  const mate = angularAssemblyMateFromPoses(free, 'leader', 'follower', angle);
  const solved = resolveAssemblyPoses(angularPlacements, [mate]).get('follower');
  near(solved.position, free.get('follower').position);
  const solvedLocal = intoLeader.clone().multiply(new Quaternion(...solved.quaternion));
  const expected = captured.clone().premultiply(new Quaternion().setFromEuler(new Euler(0, 0, angle * radians - originalHeading)));
  sameOrientation(solvedLocal.toArray(), expected.toArray());
  assert.throws(() => resolveAssemblyPoses(angularPlacements, [{...mate, angle: 180.01}]), /угол/);
  assert.throws(() => resolveAssemblyPoses(angularPlacements, [{...mate, quaternion: captured.toArray()}]), /угол/);
}
const vertical = resolveAssemblyPoses([make('leader', [0, 0, 0]), make('follower', [0, 0, 0], [0, 90, 0])], []);
assert.throws(() => angularAssemblyMateFromPoses(vertical, 'leader', 'follower', 20), /параллельна/);
console.log('PASS signed angular mates retain offset and captured tilt/roll, reject vertical projected axes');
