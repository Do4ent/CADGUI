const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const cache=new Map();let calls=0;
function load(file){file=path.resolve(__dirname,file);if(cache.has(file))return cache.get(file);const module={exports:{}};cache.set(file,module.exports);const requireLocal=id=>{if(id.endsWith('.css'))return {};if(id==='./client')return {kernelClient:{execute:()=>{calls++;throw Error('SSR must not run kernel')}}};if(!id.startsWith('.'))return require(id);let resolved=path.resolve(path.dirname(file),id);resolved=['.tsx','.ts','.js'].map(ext=>resolved+ext).find(fs.existsSync);return load(resolved);};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;vm.runInNewContext(code,{require:requireLocal,module,exports:module.exports,console,structuredClone,crypto:require('node:crypto').webcrypto,setTimeout,clearTimeout});cache.set(file,module.exports);return module.exports;}
const {ExactModelPanel,validExactNumber}=load('./ExactModelPanel.tsx');const {createExactModelState}=load('./model.ts');
for(const value of ['0','-1000000','1000000','0.00001'])assert.equal(validExactNumber(value),true);
for(const value of ['',' ','NaN','Infinity','1000001','-1000001'])assert.equal(validExactNumber(value),false);
for(const value of ['0','-1','0.000001','1000001'])assert.equal(validExactNumber(value,true),false);
assert.equal(validExactNumber('0.00001',true),true);assert.equal(validExactNumber('1000000',true),true);
const state=createExactModelState();state.bodies.push({id:'body',name:'<script>escaped</script>',brep:'CASCADE Topology V1',visible:true,color:'#2378e8'});const initial=JSON.stringify(state);let changes=0;
const html=renderToStaticMarkup(React.createElement(ExactModelPanel,{state,selected:{documentId:'doc',bodyId:'body',brepSource:state.bodies[0].brep,faceId:null,meshSource:null,renderScope:null},documentId:'doc',onChange:()=>changes++,onSelect:()=>changes++}));
for(const text of ['Точная геометрия','Создать точный параллелепипед','Создать точный цилиндр','Булева операция','Файл STEP','Экспорт STEP','Проверить тело','Удалить тело','data-exact-body-id="body"','aria-pressed="true"'])assert.ok(html.includes(text),text);
assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.equal(calls,0);assert.equal(changes,0);assert.equal(JSON.stringify(state),initial);
console.log('Exact panel SSR and numeric validation checks passed');
