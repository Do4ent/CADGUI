const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
function load(file) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  vm.runInNewContext(source, { exports, require(id) {
    if (id.endsWith('.css')) return {};
    if (!id.startsWith('.')) return require(id);
    const target = path.resolve(path.dirname(file), id);
    return load(fs.existsSync(`${target}.tsx`) ? `${target}.tsx` : `${target}.ts`);
  }});
  return exports;
}
const { validateNumber } = load(path.join(__dirname, 'validation.ts'));
for (const raw of ['', '  ', 'NaN', 'Infinity', '1e999', '0x10', '2mm', '1,2']) assert.ok(validateNumber(raw), raw);
for (const raw of ['1', '-2.5', '.5', ' 1e2 ']) assert.equal(validateNumber(raw), undefined, raw);
assert.ok(validateNumber('0', {min: 0, exclusiveMin: true}));
assert.equal(validateNumber('0', {min: 0}), undefined);
assert.ok(validateNumber('11', {max: 10}));
const { ParameterField } = load(path.join(__dirname, 'ParameterField.tsx'));
const { Dialog } = load(path.join(__dirname, 'Dialog.tsx'));
const markup = renderToStaticMarkup(React.createElement(Dialog, {
  open: false, title: 'Размеры', onCancel() {}, onConfirm() {}, confirmDisabled: true
}, React.createElement(ParameterField, {label: 'Длина', icon: 'length', value: '0', unit: 'мм', error: 'Больше нуля', onChange() {}})));
assert.match(markup, /<dialog[^>]*aria-labelledby=/);
assert.match(markup, /<label[^>]*for=/);
assert.match(markup, /aria-invalid="true"/);
assert.match(markup, /aria-describedby=/);
assert.match(markup, /role="alert"/);
assert.match(markup, /type="submit" disabled/);
assert.match(markup, /type="button"/);
console.log('PASS: dialog SSR accessibility and numeric validation regression checks');
