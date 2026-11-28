const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module,file) => module._compile(ts.transpileModule(
  fs.readFileSync(file,'utf8'),
  {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}},
).outputText,file);

const {createAssemblyBomTable} = require('./assemblyBomTable.ts');
const {createDrawingDocument, validateDrawingDocument} = require('./model.ts');

const document = createDrawingDocument();
const original = structuredClone(document);
const rows = [
  {sourceBodyId:'a',name:'Корпус',quantity:2,available:true,placements:[
    {path:[],quantity:1},{path:['Крышка','Узел'],quantity:1},
  ]},
  {sourceBodyId:'b',name:'Шток',quantity:1,available:false,placements:[
    {path:['Крышка'],quantity:1},
  ]},
];
const snapshot = createAssemblyBomTable(document,rows);
const cellText = cell => cell.map(paragraph => paragraph.runs.map(run => run.text).join('')).join('\n');
assert.equal(snapshot.exceedsSheet,false);
assert.deepEqual(document,original);
assert.deepEqual(snapshot.entity.rows.map(row=>row.map(cellText)),[
  ['Деталь','Количество','Размещение'],
  ['Корпус','2','Корень сборки × 1\nКрышка / Узел × 1'],
  ['Шток\nИсходное тело недоступно','1','Крышка × 1'],
]);
rows[0].quantity = 10;
assert.equal(cellText(snapshot.entity.rows[1][1]),'2');
document.sheets[0].entities.push(snapshot.entity);
assert.deepEqual(validateDrawingDocument(JSON.parse(JSON.stringify(document))),document);
const distinguish = createAssemblyBomTable(document,[rows[0],{...rows[0],sourceBodyId:'same-name'}]);
assert.equal(cellText(distinguish.entity.rows[1][0]),'Корпус\na');
assert.equal(cellText(distinguish.entity.rows[2][0]),'Корпус\nsame-name');
const manyRows = Array.from({length:100},()=>rows[0]);
const tall = createAssemblyBomTable(document,manyRows);
assert.ok(tall.exceedsSheet);
assert.equal(tall.entity.rows.length,101);
const long = createAssemblyBomTable(document,[{...rows[0],name:'Д'.repeat(200)}]);
assert.ok(long.exceedsSheet);
assert.throws(()=>createAssemblyBomTable(document,[]),/нет вхождений/);
console.log('PASS native drawing BOM snapshot, sizing, overflow warning and full row retention');
