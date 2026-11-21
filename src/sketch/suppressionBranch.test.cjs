const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(
  fs.readFileSync(file, 'utf8'),
  {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}},
).outputText, file);

const {createRectangleSketch} = require('./model.ts');
const {describeSuppressionBranch} = require('./suppressionBranch.ts');
const source = {
  version: 1, units: 'mm', sketches: [createRectangleSketch('s', 2, 3)],
  extrusions: [{id: 'root', sketchId: 's', bodyId: 'base', depth: 2}],
  cuts: [
    {id: 'left', sketchId: 's', bodyId: 'a', targetBodyId: 'base', depth: 1},
    {id: 'right', sketchId: 's', bodyId: 'b', targetBodyId: 'base', depth: 1},
    {id: 'unrelated', sketchId: 's', bodyId: 'other', targetBodyId: 'static', depth: 1},
  ],
  fusions: [{id: 'join', bodyId: 'result', aBodyId: 'a', bBodyId: 'b'}],
  suppressedFeatures: [{featureId: 'join', output: {name: 'Result', color: '#123456', visible: true}}],
};
const snapshot = structuredClone(source);
const branch = describeSuppressionBranch(source, 'root');
assert.equal(branch[0].featureId, 'root');
assert.deepEqual(branch.slice(1, 3).map(item => item.featureId).sort(), ['left', 'right']);
assert.deepEqual(branch[3], {
  featureId: 'join', bodyId: 'result', kind: 'fusion', alreadySuppressed: true,
});
assert.equal(branch.length, 4);
assert.deepEqual(describeSuppressionBranch(source, 'left').map(item => item.featureId), ['left', 'join']);
assert.throws(() => describeSuppressionBranch(source, 'missing'), /отсутствует/);
assert.deepEqual(source, snapshot);
console.log('PASS suppression branch order, shared descendant deduplication and existing suppression');
