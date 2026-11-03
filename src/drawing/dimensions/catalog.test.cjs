const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'catalog.ts'),'utf8');
const exportsObject={};
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exportsObject,Map});
const {dimensionCommands,dimensionCommandGroups,getDimensionCommand}=exportsObject;
const spec=JSON.parse(fs.readFileSync(path.join(__dirname,'../../..','docs/DRAWING_DIMENSION_TOOLKIT.json'),'utf8'));
const features=spec.groups.flatMap(group=>group.features.map(feature=>({...feature,groupId:group.id})));
assert.equal(dimensionCommands.length,126);assert.equal(dimensionCommandGroups.length,16);
assert.equal(new Set(dimensionCommands.map(command=>command.id)).size,126);
const kinds=new Set(['horizontal','vertical','aligned','rotated','point-line','parallel','radius','diameter','angle','angle3','arc-length','ordinate-x','ordinate-y','chamfer']);
const actions=new Set(['create','create-context','group-chain','group-baseline','group-ordinate','edit','source','diagnose','freeze','detach','restore','duplicate','delete','select','align','distribute','copy-style','reset-style','styles','bulk-style','inspection','json','export','history','unavailable']);
for(const feature of features){
 const command=getDimensionCommand(feature.id);assert.ok(command,feature.id);
 for(const key of ['id','label','groupId','phase'])assert.equal(command[key],feature[key],feature.id+' '+key);
 assert.equal(command.description,feature.behavior);
 assert.equal(typeof command.requiresSelection,'boolean');assert.ok(actions.has(command.action));
 if(command.kind)assert.ok(kinds.has(command.kind));
 if(command.action==='create')assert.ok(command.kind,feature.id+' creation needs an actual measurement kind');
 if(command.unavailableReason){assert.equal(command.action,'unavailable');assert.ok(command.unavailableReason.trim());}
 else assert.notEqual(command.action,'unavailable','missing capability explanation');
}
for(const group of spec.groups){
 const runtime=dimensionCommandGroups.find(item=>item.id===group.id);assert.ok(runtime);assert.equal(runtime.label,group.label);
 assert.deepEqual(Array.from(runtime.commands,c=>c.id),group.features.map(feature=>feature.id));
 for(const command of runtime.commands)assert.equal(command,getDimensionCommand(command.id),'groups share catalog objects');
}
for(const id of ['DIM-000','DIM-127','dim-001','DIM-001-extra','toString','__proto__',''])assert.equal(getDimensionCommand(id),undefined);
for(const id of ['DIM-016','DIM-028','DIM-074','DIM-088','DIM-107','DIM-115','DIM-123','DIM-125'])assert.ok(getDimensionCommand(id).unavailableReason,id+' advanced backend must not be simulated');
assert.equal(getDimensionCommand('DIM-003').kind,'aligned');assert.equal(getDimensionCommand('DIM-010').kind,'diameter');assert.equal(getDimensionCommand('DIM-014').kind,'arc-length');
console.log('PASS: dimension catalog exact 126-ID/16-group parity, routing metadata, genuine capability gates and unknown rejection');
