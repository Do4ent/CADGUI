const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const modules = {};
function load(name) {
 if (modules[name]) return modules[name];
 const exports = {};
 modules[name] = exports;
 const source = fs.readFileSync(__dirname + '/' + name + '.ts', 'utf8');
 const js = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(js, {exports, require: path => load(path.replace('./', ''))});
 return exports;
}
const v = load('parameterValidation');
const t = load('commandTransaction');
const plain = value => JSON.parse(JSON.stringify(value));
for (const kind of ['box', 'cylinder', 'pipe']) {
 const draft = v.createCommandDraft(kind);
 assert.equal(v.validateCommandDraft(draft).length, 0);
 for (const parameter of draft.parameters) {
  const missing = {...draft, parameters: draft.parameters.filter(p => p.name !== parameter.name)};
  assert.ok(v.validateCommandDraft(missing).some(e => e === 'Missing parameter: ' + parameter.name));
  for (const value of [0, -1, NaN, Infinity]) assert.ok(v.validateCommandDraft({...draft, parameters: draft.parameters.map(p => p.name === parameter.name ? {...p, value} : p)}).length);
 }
 assert.ok(v.validateCommandDraft({...draft, parameters: [...draft.parameters, draft.parameters[0]]}).length);
 assert.ok(v.validateCommandDraft({...draft, parameters: draft.parameters.map(p => ({...p, unit:'deg'}))}).length);
}
assert.ok(v.validateCommandDraft({kind:'toString',parameters:[]}).length);
assert.ok(v.validateCommandDraft({kind:'box',parameters:[{name:'unknown',value:1,unit:'mm'}]}).length);
const pipe = v.createCommandDraft('pipe');
pipe.parameters.find(p => p.name === 'innerRadius').value = 0.5;
assert.ok(v.validateCommandDraft(pipe).includes('innerRadius: must be smaller than outerRadius'));
assert.throws(() => v.draftToSize(pipe));
assert.deepEqual(plain(v.draftToSize(v.createCommandDraft('box'))), [1,1,1]);
const cylinder = v.createCommandDraft('cylinder'); cylinder.parameters[0].value=3;
assert.deepEqual(plain(v.draftToSize(cylinder)), [6,1,6], 'radius converts to renderer diameter');
for (const kind of ['cylinder', 'pipe']) {
 const overflow = v.createCommandDraft(kind);
 const radius = overflow.parameters.find(p => p.name === (kind === 'pipe' ? 'outerRadius' : 'radius'));
 radius.value = Number.MAX_VALUE;
 assert.ok(v.validateCommandDraft(overflow).includes(radius.name + ': diameter must be finite'));
 assert.throws(() => v.draftToSize(overflow), /diameter must be finite/);
 radius.value = Number.MAX_VALUE / 2;
 assert.equal(v.validateCommandDraft(overflow).length, 0, 'finite derived diameters remain valid');
 assert.ok(v.draftToSize(overflow).every(Number.isFinite));
}
assert.ok(v.validateNumericParameter({name:'width',value:1,unit:'mm',min:2,max:1}));
assert.ok(v.validateNumericParameter({name:'width',value:1,unit:'mm',max:NaN}));
const draft = v.createCommandDraft('box');
const pending = t.beginCommand(draft, 'part1');
draft.parameters[0].value = 7;
assert.equal(pending.draft.parameters[0].value, 1, 'draft isolates edits');
const initial = t.createCommandHistory([{id:'part1', width:1}]);
const updated = t.updateCommand(pending, 'width', 2);
assert.equal(pending.draft.parameters[0].value, 1);
assert.equal(t.cancelCommand(updated), null);
assert.equal(initial.present[0].width, 1, 'opening/editing/cancel never changes present');
let calls = 0;
const apply = (items, draft, id) => {calls++; return items.map(item => item.id === id ? {...item, width:draft.parameters[0].value} : item)};
const invalid = t.confirmCommand(initial, t.updateCommand(updated,'width',-1), apply);
assert.equal(calls, 0);
assert.equal(invalid.history, initial);
assert.ok(invalid.transaction && invalid.errors.length);
const confirmed = t.confirmCommand(initial, updated, apply);
assert.equal(calls, 1);
assert.equal(confirmed.transaction, null);
assert.equal(confirmed.history.present[0].width, 2);
assert.equal(initial.present[0].width, 1);
const undone = t.undoCommand(confirmed.history);
assert.equal(undone.present, initial.present);
assert.equal(t.redoCommand(undone).present, confirmed.history.present);
const branched = t.confirmCommand(undone, t.updateCommand(updated,'width',3), apply);
assert.equal(branched.history.future.length, 0, 'new commit discards redo');
assert.equal(t.undoCommand(initial), initial);
assert.equal(t.redoCommand(initial), initial);
assert.equal(t.confirmCommand(initial, updated, items => items).history, initial);
console.log('PASS: CAD parameter validation, confirm/cancel isolation and undo/redo regressions');
