const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');const vm=require('node:vm');
const root=path.resolve(__dirname,'..');const ts=(()=>{try{return require('typescript')}catch{return require(require('node:child_process').execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim()+'/typescript')}})();
const files=fs.readdirSync(path.join(root,'src')).filter(f=>/\.tsx?$/.test(f));let checks=0;
for(const f of files){const source=fs.readFileSync(path.join(root,'src',f),'utf8');const result=ts.transpileModule(source,{fileName:f,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});const errors=(result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);assert.equal(errors.length,0,`${f}: ${errors.map(e=>ts.flattenDiagnosticMessageText(e.messageText,' ')).join('; ')}`);checks++}
const source=fs.readFileSync(path.join(root,'src/CommandRegistry.ts'),'utf8');const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const output={};vm.runInNewContext(compiled,{exports:output,require});const {commandCatalog,commandEnabled,contextCommandIds}=output;
assert.ok(Object.keys(commandCatalog).length>=12);checks++;
for(const [id,cmd] of Object.entries(commandCatalog)){assert.equal(cmd.id,id);assert.ok(cmd.label.trim());assert.ok(cmd.hint.trim());checks+=3}
for(const area of ['viewport','tree','component']){const ids=contextCommandIds(area);assert.ok(ids.length>0);assert.equal(new Set(ids).size,ids.length);for(const id of ids)assert.ok(commandCatalog[id],`${area}: ${id}`);checks+=ids.length+2}
const empty={selected:false,itemCount:0,historyCount:0,futureCount:0};const ready={selected:true,itemCount:3,historyCount:2,futureCount:1};
for(const id of Object.keys(commandCatalog)){assert.equal(commandEnabled(id,ready),true,id);checks++}
for(const id of ['duplicate','hide','isolate','delete','clear']){assert.equal(commandEnabled(id,empty),false,id);checks++}
for(const id of ['undo','redo','showall']){assert.equal(commandEnabled(id,empty),false,id);checks++}
assert.equal(commandEnabled('invalid',ready),false);checks++;
const main=fs.readFileSync(path.join(root,'src/main.tsx'),'utf8');const expected=['Модель','Сборка','Эскиз','Чертёж','Поверхности','Листовой металл','Сварка','Трубопроводы','Анализ','Вид'];for(const name of expected){assert.ok(main.includes(`'${name}':{root:`),`Missing environment: ${name}`);checks++}
for(const pattern of ['role="tree"','role="treeitem"','role="menu"','aria-label="Строка состояния"','data-property-editor="true"']){assert.ok(main.includes(pattern),`Missing accessibility landmark: ${pattern}`);checks++}
console.log(`PASS: ${checks} static, command registry and environment checks; ${files.length} TypeScript/TSX files parse successfully.`);
