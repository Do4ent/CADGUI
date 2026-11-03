/** State-level functional regression suite; no browser/runtime dependencies. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');const ts=(()=>{try{return require('typescript')}catch{return require(require('node:child_process').execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim()+'/typescript')}})();
const main=fs.readFileSync(path.join(root,'src/main.tsx'),'utf8');const dock=fs.readFileSync(path.join(root,'src/DockManager.tsx'),'utf8');const ribbon=fs.readFileSync(path.join(root,'src/CustomRibbon.tsx'),'utf8');
let count=0;function check(x,msg){assert.ok(x,msg);count++}function equal(a,b,msg){assert.deepEqual(a,b,msg);count++}
const memory=new Map();const storage={getItem(k){return memory.has(k)?memory.get(k):null},setItem(k,v){memory.set(k,String(v))},removeItem(k){memory.delete(k)}};
// Execute the real TypeScript settings loader in an isolated VM, not a rewritten test copy.
const settingsBlock=main.slice(main.indexOf('type UiSettings='),main.indexOf('function App()'));
check(settingsBlock.includes('function loadUiSettings'), 'settings loader exists');
const js=ts.transpileModule(settingsBlock+'\nexports.loadUiSettings=loadUiSettings;exports.UI_DEFAULTS=UI_DEFAULTS;', {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const exp={};vm.runInNewContext(js,{exports:exp,localStorage:storage,Number,Math,JSON});const load=exp.loadUiSettings,defaults=JSON.parse(JSON.stringify(exp.UI_DEFAULTS));
equal(JSON.parse(JSON.stringify(load())),defaults,'missing settings defaults');
for(const bad of ['{bad','[]','null','42','"hi"']){storage.setItem('bendcore-ui-v25',bad);equal(JSON.parse(JSON.stringify(load())),defaults,'invalid persisted data: '+bad)}
storage.setItem('bendcore-ui-v25',JSON.stringify({viewLayout:'two',tab:'Эскиз',section:'XY',sectionOffset:99,sharedZoom:-2,edges:false,left:false}));
let v=load();equal(v.viewLayout,'two');equal(v.tab,'Эскиз');equal(v.section,'XY');equal(v.sectionOffset,3);equal(v.sharedZoom,10);equal(v.edges,false);equal(v.left,false);
for(const tab of ['Модель','Сборка','Эскиз','Чертёж','Поверхности','Листовой металл','Сварка','Трубопроводы','Анализ','Вид']){storage.setItem('bendcore-ui-v25',JSON.stringify({tab}));equal(load().tab,tab,'environment persistence '+tab)}
for(const bad of ['Unknown','<script>','', 'Сборка'.repeat(100)]){storage.setItem('bendcore-ui-v25',JSON.stringify({tab:bad}));equal(load().tab,defaults.tab,'reject invalid environment '+bad)}
for(const layout of ['one','two','four']){storage.setItem('bendcore-ui-v25',JSON.stringify({viewLayout:layout}));equal(load().viewLayout,layout,'viewport layout '+layout)}
for(const bad of ['seven','quad','']){storage.setItem('bendcore-ui-v25',JSON.stringify({viewLayout:bad}));equal(load().viewLayout,defaults.viewLayout)}
for(const section of ['off','XY','XZ','YZ']){storage.setItem('bendcore-ui-v25',JSON.stringify({section}));equal(load().section,section)}
for(const invalid of [null,{},[],false,'x']){storage.setItem('bendcore-ui-v25',JSON.stringify({sectionOffset:invalid,sharedZoom:invalid}));v=load();equal(v.sectionOffset,defaults.sectionOffset);equal(v.sharedZoom,defaults.sharedZoom)}
// Verify environment-specific UI, keyboard and panel contracts exist in source.
for(const label of ['Модель','Сборка','Эскиз','Чертёж','Поверхности','Листовой металл','Сварка','Трубопроводы','Анализ','Вид'])check(main.includes(`'${label}':{root:`),'environment definition '+label);
for(const token of ['setTab(', 'setSelected(', 'documents.changeScene(', 'documents.modelUndo(', 'documents.modelRedo(', 'data-property-editor="true"','role="tree"','role="treeitem"','aria-label="Строка состояния"','commandEnabled(', 'contextCommandIds('])check(main.includes(token),'UI interaction contract '+token);
for(const token of ['onKeyDown','onClick','role="menu"','setMenu(null)'])check(main.includes(token),'context interaction '+token);
for(const token of ['localStorage.setItem','bendcore-profiles-v07','importProfiles','saveProfile','loadProfile','zoneView(','setLayout(','setView('])check(dock.includes(token),'dock workspace contract '+token);
for(const token of ['onClick','onKeyDown','button'])check(ribbon.includes(token),'ribbon keyboard contract '+token);
// Exercise actual command registry enablement in all combinations of selection, history and item counts.
const reg=fs.readFileSync(path.join(root,'src/CommandRegistry.ts'),'utf8');const regjs=ts.transpileModule(reg,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;const e={};vm.runInNewContext(regjs,{exports:e});
for(const selected of [false,true])for(const itemCount of [0,2])for(const historyCount of [0,2])for(const futureCount of [0,2]){const ctx={selected,itemCount,historyCount,futureCount};for(const [id,cmd] of Object.entries(e.commandCatalog)){const expected=(!cmd.requiresSelection||selected)&&(!cmd.requiresItems||itemCount>0)&&(!cmd.requiresHistory||(cmd.requiresHistory==='undo'?historyCount>0:futureCount>0));equal(e.commandEnabled(id,ctx),expected,`${id} context ${JSON.stringify(ctx)}`)}}
for(const area of ['viewport','tree','component'])for(const id of e.contextCommandIds(area))check(Boolean(e.commandCatalog[id]),`${area} references ${id}`);
console.log(`PASS: ${count} state-functional and UI-contract assertions. NOTE: browser end-to-end interaction is NOT covered.`);
