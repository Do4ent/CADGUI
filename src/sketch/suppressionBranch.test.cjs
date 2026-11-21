const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(
  fs.readFileSync(file, 'utf8'),
  {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}},
).outputText, file);

const {createRectangleSketch} = require('./model.ts');
const {describeSuppressionBranch,planBranchSuppression,planBranchResume} = require('./suppressionBranch.ts');
const {validateSketchReferences} = require('./model.ts');
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

const active = structuredClone({...source, suppressedFeatures:[]});
active.fusions.push({id:'consumer',bodyId:'shared-result',aBodyId:'static',bBodyId:'operand'});
active.bodyBooleans=[{id:'terminal',bodyId:'terminal-result',aBodyId:'result',bBodyId:'operand',operation:'common'}];
const body = (id,visible=false) => ({id,name:id,brep:'CASCADE Topology V1 '+id,color:'#123456',visible});
const exact={
  version:1,kernel:'occt-wasm',kernelVersion:'5.15.0',units:'mm',
  bodies:['base','a','b','result','other','shared-result','terminal-result','static','operand'].map(id=>body(id)),
};
const grouped=planBranchSuppression(active,exact,'root');
assert.deepEqual(grouped.state.suppressedFeatures.map(record=>record.featureId),['root','left','right','join','terminal']);
assert.deepEqual(grouped.exact.bodies.map(body=>[body.id,body.visible]),[
  ['other',false],['shared-result',false],['static',false],['operand',false],
]);
assert.throws(()=>planBranchSuppression(source,{...exact,bodies:exact.bodies.filter(body=>body.id!=='result')},'root'),/уже подавленную/);
assert.throws(()=>validateSketchReferences(grouped.state,{bodies:[...grouped.exact.bodies,body('base')]}));
assert.throws(()=>validateSketchReferences(grouped.state,{bodies:grouped.exact.bodies.filter(body=>body.id!=='operand')}));
assert.throws(()=>validateSketchReferences({...grouped.state,suppressedFeatures:grouped.state.suppressedFeatures.slice(1)},grouped.exact),/Корневая/);
const resumed=planBranchResume(grouped.state,grouped.exact,'root');
assert.deepEqual(resumed.state.suppressedFeatures,[]);
assert.deepEqual([...resumed.restored.keys()],['base','a','b','result','terminal-result']);
assert.deepEqual(resumed.exact,grouped.exact);
console.log('PASS suppression branch order, shared descendant deduplication and existing suppression');
