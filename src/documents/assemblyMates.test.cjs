const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(
  fs.readFileSync(file, 'utf8'),
  {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}},
).outputText, file);

const {createFixedAssemblyMate, resolveAssemblyPoses, materializeAssemblyPlacement} = require('./assemblyMates.ts');
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
