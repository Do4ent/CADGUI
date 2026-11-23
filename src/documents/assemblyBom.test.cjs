const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module,file) => module._compile(ts.transpileModule(
  fs.readFileSync(file,'utf8'),
  {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}},
).outputText,file);

const {buildAssemblyBom,exportAssemblyBomCsv} = require('./assemblyBom.ts');
const instance = (sourceBodyId,parentId,name='Вхождение') => ({sourceBodyId,parentId,name});
const groups = [
  {id:'left',name:'Узел'},
  {id:'right',name:'Узел'},
  {id:'nested',parentId:'left',name:'Вложенный'},
];
const bodies = [
  {id:'one',name:'Деталь',visible:false},
  {id:'two',name:'Деталь',visible:true},
  {id:'unused',name:'Не входит в сборку',visible:true},
];
const instances = [
  instance('one'),instance('one','nested'),instance('one','nested'),
  instance('one','left'),instance('one','left'),instance('one','right'),
  instance('two','right'),instance('missing','nested','Подавленная деталь'),
];
const original = structuredClone({groups,bodies,instances});
const rows = buildAssemblyBom(instances,groups,bodies);
assert.deepEqual(rows,[
  {sourceBodyId:'one',name:'Деталь',quantity:6,available:true,placements:[
    {path:[],quantity:1},{path:['Узел','Вложенный'],quantity:2},
    {path:['Узел'],quantity:2},{path:['Узел'],quantity:1},
  ]},
  {sourceBodyId:'two',name:'Деталь',quantity:1,available:true,placements:[{path:['Узел'],quantity:1}]},
  {sourceBodyId:'missing',name:'Подавленная деталь',quantity:1,available:false,placements:[
    {path:['Узел','Вложенный'],quantity:1},
  ]},
]);
assert.deepEqual({groups,bodies,instances},original);
assert.deepEqual(buildAssemblyBom([],groups,bodies),[]);
assert.throws(()=>buildAssemblyBom([instance('one','missing')],groups,bodies),/не найдена/);
assert.throws(()=>buildAssemblyBom([instance('one','loop')],[{id:'loop',name:'Цикл',parentId:'loop'}],bodies),/Циклическая/);
assert.deepEqual(buildAssemblyBom(instances.slice(1),groups,bodies)[0].quantity,5);

const csv = exportAssemblyBomCsv([{sourceBodyId:'@source',name:'  =СУММ("1,2")',quantity:3,available:false,
  placements:[{path:[],quantity:1},{path:['Деталь, "блок"'],quantity:2}]}]);
assert.equal(csv,
  'Деталь,Идентификатор источника,Количество,Размещения,Статус\r\n' +
  '"\'  =СУММ(""1,2"")","\'@source",3,"Корень сборки × 1\nДеталь, ""блок"" × 2","Тело недоступно"\r\n');
assert.equal(exportAssemblyBomCsv([]).split('\r\n').length,2);
console.log('PASS assembly BOM grouping, nested quantities, missing sources and safe CSV');
