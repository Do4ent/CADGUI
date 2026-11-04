const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');
function load(filename, mocks = {}) {
 const target = filename.endsWith('.ts') ? filename : filename + '.ts';
 const module = {exports:{}};
 const source = fs.readFileSync(target,'utf8');
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
  {localStorage:mocks.localStorage,crypto:require('node:crypto').webcrypto,exports:module.exports,require:id=>mocks[id] ?? (id.startsWith('.')?load(path.resolve(path.dirname(target),id),mocks):require(id)),structuredClone});
 return module.exports;
}
const exportsObject = load(path.join(__dirname,'documentModel.ts'));
const {createDocument, validateDocument, parseDocument, serializeDocument} = exportsObject;
const plain = value => JSON.parse(JSON.stringify(value));
const item = {id:'a', name:'Box', kind:'box', pos:[0,1,-2], size:[1,2,3], color:'#123abc', visible:true, group:'Parts'};
const document = {...createDocument('doc', 'Example'), items:[item]};
assert.deepEqual(plain(parseDocument(serializeDocument(document))), plain(document));
for (const value of [null, [], 42, {}, {...document,schemaVersion:4}, {...document,name:' '}, {...document,id:''}, {...document,modifiedAt:'bad'}, {...document,items:[item,item]}]) assert.throws(() => validateDocument(value));
for (const patch of [{pos:[0,1]}, {pos:[0,NaN,0]}, {pos:[0,Infinity,0]}, {size:[1,0,1]}, {size:[1,-1,1]}, {kind:'unknown'}, {color:'red'}, {visible:'yes'}, {id:' '}, {name:''}, {group:null}]) assert.throws(() => validateDocument({...document,items:[{...item,...patch}]}));
assert.throws(() => parseDocument('{bad'), /Invalid document JSON/);
assert.throws(() => parseDocument(JSON.stringify([item])), /Legacy/);
const migrated = parseDocument(JSON.stringify([item]), {id:'legacy',name:'Imported',modifiedAt:'2026-11-02T00:00:00Z'});
assert.equal(migrated.schemaVersion,3);
assert.equal(migrated.id,'legacy');
assert.deepEqual(plain(migrated.items),[item]);
assert.deepEqual(plain(parseDocument(serializeDocument(migrated))), plain(migrated));
assert.deepEqual(plain(parseDocument(JSON.stringify({format:'bendcore-demo-v1',items:[item]}),{id:'old'}).items),[item]);
assert.throws(() => parseDocument(JSON.stringify({format:'bendcore-demo-v2',items:[item]}),{id:'old'}), /Unsupported/);
assert.throws(() => parseDocument(JSON.stringify({format:'bendcore-demo-v1',items:[{}]}),{id:'old'}), /Malformed/);
assert.throws(() => createDocument('bad',' '));
const cloned = validateDocument(document);
cloned.items[0].pos[0] = 99;
cloned.items[0].size[0] = 99;
cloned.items[0].name = 'Changed';
assert.deepEqual(document.items,[item]);
console.log('PASS document schema, invalid data, clone isolation and legacy migration');

const old = {...document,schemaVersion:1};delete old.drawing;
const upgrade = parseDocument(JSON.stringify(old));
assert.equal(upgrade.schemaVersion,3);
assert.deepEqual(plain(upgrade.items),[item]);
assert.ok(upgrade.drawing.sheets.length);
assert.throws(()=>validateDocument({...document,drawing:undefined}));
assert.throws(()=>validateDocument({...document,drawing:{version:999}}));
const complex=plain(document);
complex.drawing.properties={number:'Чертёж №1',author:'李 / Иван'};
complex.drawing.dictionary=['Ø ± ½','Строка\nвторая'];
assert.deepEqual(plain(parseDocument(serializeDocument(complex))),complex);
const detached=validateDocument(complex);
detached.drawing.properties.author='Changed';
assert.equal(complex.drawing.properties.author,'李 / Иван');
console.log('PASS schema v2 drawing persistence, metadata roundtrip and v1 migration');

const {createTextEntity}=load(path.resolve(__dirname,'../drawing/model.ts'));
const entity=plain(createTextEntity('leader','Первая строка\nØ ± ½'));
entity.paragraphs[0].runs.push({text:'',field:{kind:'document',key:'number',fallback:'нет данных'},format:{bold:true,color:'#123456'}});
entity.leaders=[{id:'branch',points:[[1,2],[3,4]],shape:'polyline',arrow:'closed',arrowSize:2,landing:3}];
complex.drawing.sheets[0].entities.push(entity);
complex.drawing.templates.push({id:'template',name:'Шаблон',category:'Общее',entity:plain(entity)});
complex.drawing.revisions.push({id:'revision',name:'До изменения',createdAt:new Date().toISOString(),sheets:plain(complex.drawing.sheets)});
assert.deepEqual(plain(parseDocument(serializeDocument(complex))),complex);

let state;
const storage=new Map();
const mocks={react:{useState:init=>{if(state===undefined)state=init();return [state,value=>{state=typeof value==='function'?value(state):value}];},useEffect:()=>{}},localStorage:{getItem:key=>storage.get(key)??null}};
const {useEditorDocuments}=load(path.resolve(__dirname,'../editor/useEditorDocuments.ts'),mocks);
let hook=useEditorDocuments(()=>[item]);
const first=hook.activeId;
const initialSnapshot=hook.exportDocument();hook.markSaved(initialSnapshot);
hook=useEditorDocuments(()=>[]);assert.equal(hook.tabs[0].dirty,false);
hook.setDrawing(complex.drawing,'Create text');hook=useEditorDocuments(()=>[]);
assert.equal(hook.drawingHistoryCount,1);assert.equal(hook.tabs[0].dirty,true);
assert.throws(()=>hook.setDrawing({version:999}));hook=useEditorDocuments(()=>[]);assert.equal(hook.drawingHistoryCount,1);
hook.setDrawing(plain(complex.drawing));hook=useEditorDocuments(()=>[]);assert.equal(hook.drawingHistoryCount,1);
hook.drawingUndo();hook=useEditorDocuments(()=>[]);assert.equal(hook.drawingFutureCount,1);assert.equal(hook.tabs[0].dirty,false);
hook.drawingRedo();hook=useEditorDocuments(()=>[]);assert.equal(hook.drawing.sheets[0].entities.length,1);
hook.newDocument();hook=useEditorDocuments(()=>[]);assert.equal(hook.drawingHistoryCount,0);
hook.activate(first);hook=useEditorDocuments(()=>[]);assert.equal(hook.drawingHistoryCount,1);
hook.markSaved(initialSnapshot);hook=useEditorDocuments(()=>[]);assert.equal(hook.tabs[0].dirty,true);
state=undefined;storage.set('bendcore-documents-v1',JSON.stringify({version:1,activeId:old.id,tabs:[{document:old,saved:JSON.stringify([old.name,old.items])}]}));
hook=useEditorDocuments(()=>[]);assert.equal(hook.tabs[0].dirty,false);assert.equal(hook.document.schemaVersion,3);
state=undefined;storage.set('bendcore-documents-v1','{corrupt');hook=useEditorDocuments(()=>[]);assert.ok(hook.recoveryError);assert.equal(storage.get('bendcore-documents-v1'),'{corrupt');
console.log('PASS drawing history, dirty guards, per-tab state, snapshot save and workspace migration');

const second=plain(hook.drawing);second.properties.title='Second operation';hook.setDrawing(second);
hook=useEditorDocuments(()=>[]);const third=plain(hook.drawing);third.properties.title='Third operation';hook.setDrawing(third);
hook=useEditorDocuments(()=>[]);hook.drawingUndo();hook=useEditorDocuments(()=>[]);hook.drawingUndo();hook=useEditorDocuments(()=>[]);
assert.notEqual(hook.drawing.properties.title,'Third operation');
hook.drawingRedo();hook=useEditorDocuments(()=>[]);assert.equal(hook.drawing.properties.title,'Second operation');
hook.drawingRedo();hook=useEditorDocuments(()=>[]);assert.equal(hook.drawing.properties.title,'Third operation');
state=undefined;storage.set('bendcore-documents-v1',JSON.stringify({version:1,activeId:old.id,tabs:[{document:old,saved:JSON.stringify(['Before edit',old.items])}]}));
hook=useEditorDocuments(()=>[]);assert.equal(hook.tabs[0].dirty,true);
console.log('PASS consecutive drawing undo/redo and dirty v1 workspace recovery');

// Async operations retain their render's source tab and drawing snapshot.
const sourceId=hook.activeId;
const delayed=hook.setDrawing;
const sourceDrawing=plain(hook.drawing);
hook.newDocument();hook=useEditorDocuments(()=>[]);
const otherId=hook.activeId,otherDrawing=plain(hook.drawing);
const imported=plain(sourceDrawing);imported.properties.title='Delayed import';
delayed(imported);hook=useEditorDocuments(()=>[]);
assert.deepEqual(plain(hook.drawing),otherDrawing);
assert.equal(hook.drawingHistoryCount,0);
hook.activate(sourceId);hook=useEditorDocuments(()=>[]);
assert.deepEqual(plain(hook.drawing),sourceDrawing);
const olderSetter=hook.setDrawing;
const newer=plain(hook.drawing);newer.properties.title='Newer edit';
hook.setDrawing(newer);hook=useEditorDocuments(()=>[]);
const historyCount=hook.drawingHistoryCount;
olderSetter(imported);hook=useEditorDocuments(()=>[]);
assert.equal(hook.drawing.properties.title,'Newer edit');
assert.equal(hook.drawingHistoryCount,historyCount);
// Closing a source document also invalidates its outstanding callback.
const closedSetter=hook.setDrawing;hook.close(sourceId);hook=useEditorDocuments(()=>[]);
assert.equal(hook.activeId,otherId);closedSetter(imported);hook=useEditorDocuments(()=>[]);
assert.deepEqual(plain(hook.drawing),otherDrawing);
console.log('PASS async drawing guards: tab switch, closed source and stale same-document callbacks');

const {defaultDimensionDefinition,defaultDimensionStyle}=load(path.resolve(__dirname,'../drawing/dimensions/defaults.ts'));
const dimensionDoc=plain(createDocument('dimension-doc','Размеры'));
const dd=defaultDimensionDefinition('aligned');
dd.refs=[{point:[0,0]},{point:[3,4]}];
const dimensionEntity=plain(createTextEntity('symbol','not-a-source-cache'));
dimensionEntity.dimension=plain(dd);
dimensionDoc.drawing.sheets[0].entities=[dimensionEntity];
dimensionDoc.drawing.dimensionStyles=[plain(defaultDimensionStyle())];
assert.deepEqual(plain(parseDocument(serializeDocument(dimensionDoc))),dimensionDoc);
for(const mutate of [
 doc=>doc.drawing.sheets[0].entities[0].dimension.version=2,
 doc=>doc.drawing.sheets[0].entities[0].dimension.mode='driving',
 doc=>doc.drawing.sheets[0].entities[0].dimension.unknown=true,
 doc=>doc.drawing.sheets[0].entities[0].dimension.refs=[{entityId:'line',point:[0,0]}],
 doc=>doc.drawing.dimensionStyles.push(plain(doc.drawing.dimensionStyles[0])),
 doc=>doc.drawing.dimensionStyles[0].arrow='future',
 doc=>doc.drawing.sheets[0].entities[0].dimension.format.unit='future',
 doc=>doc.drawing.sheets[0].entities[0].dimension.format.precision=Infinity,
]){const bad=plain(dimensionDoc);mutate(bad);assert.throws(()=>serializeDocument(bad));}
const arcDoc=plain(createDocument('arc-doc'));
const arc=plain(createTextEntity('geometry',''));arc.geometry={type:'arc',radius:15,startAngle:0,endAngle:90,clockwise:false};
arcDoc.drawing.sheets[0].entities=[arc];assert.deepEqual(plain(parseDocument(serializeDocument(arcDoc))),arcDoc);
for(const patch of [{radius:0},{radius:NaN},{startAngle:Infinity},{endAngle:'90'},{clockwise:'false'},{unknown:true}]){const bad=plain(arcDoc);Object.assign(bad.drawing.sheets[0].entities[0].geometry,patch);assert.throws(()=>serializeDocument(bad));}
const {plainText}=load(path.resolve(__dirname,'../drawing/model.ts'));
const {diagnoseDrawing}=load(path.resolve(__dirname,'../drawing/diagnostics.ts'));
assert.equal(plainText(dimensionEntity,dimensionDoc.drawing),'5');
const broken=plain(dimensionDoc);const brokenEntity=broken.drawing.sheets[0].entities[0];brokenEntity.dimension.refs=[{entityId:'missing',anchor:'start'},{entityId:'missing',anchor:'end'}];
brokenEntity.annotation={type:'dimension',fields:{value:'123456'}};
assert.equal(plainText(brokenEntity,broken.drawing),'⟦нет источника⟧');
assert.ok(diagnoseDrawing(broken.drawing).some(d=>d.entityId===brokenEntity.id&&d.code==='dimension-source'&&d.severity==='error'));
const wrongType=plain(dimensionDoc);const textSource=plain(createTextEntity('text','Not geometry'));wrongType.drawing.sheets[0].entities.push(textSource);wrongType.drawing.sheets[0].entities[0].dimension.refs=[{entityId:textSource.id}];
assert.ok(diagnoseDrawing(wrongType.drawing).some(d=>d.code==='dimension-source'));
const frozen=plain(dimensionDoc);const frozenEntity=frozen.drawing.sheets[0].entities[0];frozenEntity.dimension.frozen={value:5,unit:'mm',points:[[0,0],[3,4]]};frozenEntity.dimension.manualText='Ручной размер';
const issues=diagnoseDrawing(frozen.drawing);assert.ok(issues.some(d=>d.code==='dimension-manual-override'));assert.ok(issues.some(d=>d.code==='dimension-frozen'));
console.log('PASS native dimension roundtrip, strict future schemas, arc persistence and source diagnostics');

const detachedFrozen=plain(frozen);detachedFrozen.drawing.sheets[0].entities[0].dimension.refs=[];assert.deepEqual(plain(parseDocument(serializeDocument(detachedFrozen))),detachedFrozen);

// Native v3 requires annotation state; old versions migrate without losing drawing/items.
assert.equal(document.schemaVersion,3);
assert.deepEqual(plain(document.modelAnnotations),{version:1,annotations:[]});
const v2=plain(complex);v2.schemaVersion=2;delete v2.modelAnnotations;
const fromV2=plain(parseDocument(JSON.stringify(v2)));
assert.deepEqual(fromV2.items,v2.items);assert.deepEqual(fromV2.drawing,v2.drawing);
assert.deepEqual(fromV2.modelAnnotations,{version:1,annotations:[]});
assert.throws(()=>validateDocument({...document,modelAnnotations:undefined}));
assert.throws(()=>validateDocument({...document,modelAnnotations:{version:2,annotations:[]}}));
assert.throws(()=>validateDocument({...document,modelAnnotations:{version:1,annotations:[{}]}}));
for(const dirty of [false,true]){
 state=undefined;storage.set('bendcore-documents-v1',JSON.stringify({version:1,activeId:v2.id,tabs:[{document:v2,saved:JSON.stringify([dirty?'Unsaved name':v2.name,v2.items,v2.drawing])}]}));
 hook=useEditorDocuments(()=>[]);assert.equal(hook.tabs[0].dirty,dirty);assert.equal(hook.document.schemaVersion,3);
}
state=undefined;storage.clear();hook=useEditorDocuments(()=>[item]);
const sceneId=hook.activeId;
hook.markSaved(hook.exportDocument());hook=useEditorDocuments(()=>[]);
const changedItems=plain(hook.items);changedItems[0].name='Scene change';
hook.changeScene(changedItems,'Rename');hook=useEditorDocuments(()=>[]);
assert.equal(hook.modelHistoryCount,1);assert.equal(hook.tabs[0].dirty,true);
hook.changeScene(plain(changedItems));hook=useEditorDocuments(()=>[]);assert.equal(hook.modelHistoryCount,1);
assert.throws(()=>hook.changeScene([{...item,size:[0,1,1]}]));hook=useEditorDocuments(()=>[]);assert.equal(hook.modelHistoryCount,1);
hook.modelUndo();hook=useEditorDocuments(()=>[]);assert.equal(hook.items[0].name,item.name);assert.equal(hook.tabs[0].dirty,false);
hook.modelRedo();hook=useEditorDocuments(()=>[]);assert.equal(hook.items[0].name,'Scene change');
const staleScene=hook.changeScene;hook.newDocument();hook=useEditorDocuments(()=>[]);
const destinationId=hook.activeId;staleScene([item]);hook=useEditorDocuments(()=>[]);assert.equal(hook.items.length,0);assert.equal(hook.modelHistoryCount,0);
hook.activate(sceneId);hook=useEditorDocuments(()=>[]);
const staleSceneSameTab=hook.changeScene;hook.changeScene([{...item,name:'Newer scene'}]);hook=useEditorDocuments(()=>[]);
staleSceneSameTab([item]);hook=useEditorDocuments(()=>[]);assert.equal(hook.items[0].name,'Newer scene');
console.log('PASS schema3 strict native annotation state, v2 fingerprint migration and guarded scene history');

const annotationCore=load(path.resolve(__dirname,'../modelAnnotations/model.ts'));
const note=annotationCore.createModelAnnotation('note-1',item.id);note.text='Контроль Ø ±\n第二行';note.orientation='XZ';
const notes={version:1,annotations:[note]};
const annotated=plain(createDocument('annotations-doc'));annotated.items=[plain(item)];annotated.modelAnnotations=plain(notes);
assert.deepEqual(plain(parseDocument(serializeDocument(annotated))),annotated);
const cloneNotes=validateDocument(annotated);cloneNotes.modelAnnotations.annotations[0].anchor.point[0]=42;cloneNotes.modelAnnotations.annotations[0].text='Changed';
assert.equal(annotated.modelAnnotations.annotations[0].anchor.point[0],0);assert.equal(annotated.modelAnnotations.annotations[0].text,note.text);
assert.throws(()=>validateDocument({...annotated,modelAnnotations:{...notes,annotations:[note,note]}}));
const missingReference=plain(annotated);missingReference.items=[];
assert.deepEqual(plain(parseDocument(serializeDocument(missingReference))).modelAnnotations,plain(notes));
assert.equal(annotationCore.resolveModelAnnotation(note,[]).status,'missing');

// Unified history interleaves note changes, geometry changes and source deletion.
state=undefined;storage.clear();hook=useEditorDocuments(()=>[item]);
hook.markSaved(hook.exportDocument());hook=useEditorDocuments(()=>[]);
const originalSaved=hook.exportDocument();
hook.setModelAnnotations(notes);hook=useEditorDocuments(()=>[]);
assert.equal(hook.modelHistoryCount,1);assert.equal(hook.tabs[0].dirty,true);
note.text='Mutated caller';assert.notEqual(hook.modelAnnotations.annotations[0].text,note.text);
const retainedNoteText=hook.modelAnnotations.annotations[0].text;
const beforeNotesNoop=hook.modelHistoryCount;hook.setModelAnnotations(plain(hook.modelAnnotations));hook=useEditorDocuments(()=>[]);assert.equal(hook.modelHistoryCount,beforeNotesNoop);
assert.throws(()=>hook.setModelAnnotations({version:1,annotations:[{}]}));hook=useEditorDocuments(()=>[]);assert.equal(hook.modelHistoryCount,1);
const moved=plain(hook.items);moved[0].pos=[4,5,6];hook.changeScene(moved);hook=useEditorDocuments(()=>[]);
assert.equal(hook.modelHistoryCount,2);assert.deepEqual(plain(hook.items[0].pos),[4,5,6]);
hook.changeScene([]);hook=useEditorDocuments(()=>[]);assert.equal(hook.modelAnnotations.annotations.length,1);assert.equal(hook.modelHistoryCount,3);
hook.modelUndo();hook=useEditorDocuments(()=>[]);assert.deepEqual(plain(hook.items[0].pos),[4,5,6]);assert.equal(hook.modelAnnotations.annotations[0].text,retainedNoteText);
hook.modelUndo();hook=useEditorDocuments(()=>[]);assert.deepEqual(plain(hook.items[0].pos),item.pos);assert.equal(hook.modelAnnotations.annotations.length,1);
hook.modelUndo();hook=useEditorDocuments(()=>[]);assert.equal(hook.modelAnnotations.annotations.length,0);assert.equal(hook.tabs[0].dirty,false);
hook.modelRedo();hook=useEditorDocuments(()=>[]);assert.equal(hook.modelAnnotations.annotations.length,1);
hook.modelRedo();hook=useEditorDocuments(()=>[]);assert.deepEqual(plain(hook.items[0].pos),[4,5,6]);
hook.modelRedo();hook=useEditorDocuments(()=>[]);assert.equal(hook.items.length,0);assert.equal(hook.modelAnnotations.annotations.length,1);
// Drawing history does not enter model chronology.
const modelCount=hook.modelHistoryCount;const drawingUpdate=plain(hook.drawing);drawingUpdate.properties.title='Drawing only';hook.setDrawing(drawingUpdate);hook=useEditorDocuments(()=>[]);assert.equal(hook.modelHistoryCount,modelCount);assert.equal(hook.drawingHistoryCount,1);
hook.modelUndo();hook=useEditorDocuments(()=>[]);assert.equal(hook.drawing.properties.title,'Drawing only');
hook.drawingUndo();hook=useEditorDocuments(()=>[]);assert.equal(hook.modelAnnotations.annotations.length,1);assert.deepEqual(plain(hook.items[0].pos),[4,5,6]);
// Source tab, source note revision AND scene item revision protect asynchronous results.
const annotationTab=hook.activeId,oldAnnotationSetter=hook.setModelAnnotations;
const annotationBefore=plain(hook.modelAnnotations);
hook.newDocument();hook=useEditorDocuments(()=>[]);const emptyAnnotationTab=hook.activeId;
oldAnnotationSetter({version:1,annotations:[]});hook=useEditorDocuments(()=>[]);assert.equal(hook.modelHistoryCount,0);assert.equal(hook.modelAnnotations.annotations.length,0);
hook.activate(annotationTab);hook=useEditorDocuments(()=>[]);assert.deepEqual(plain(hook.modelAnnotations),annotationBefore);
const staleAfterGeometry=hook.setModelAnnotations;hook.changeScene([{...item,name:'More recent scene'}]);hook=useEditorDocuments(()=>[]);
staleAfterGeometry({version:1,annotations:[]});hook=useEditorDocuments(()=>[]);assert.equal(hook.modelAnnotations.annotations.length,1);
const staleAfterNotes=hook.setModelAnnotations;const revisedNotes=plain(hook.modelAnnotations);revisedNotes.annotations[0].text='Newer annotation';hook.setModelAnnotations(revisedNotes);hook=useEditorDocuments(()=>[]);
staleAfterNotes({version:1,annotations:[]});hook=useEditorDocuments(()=>[]);assert.equal(hook.modelAnnotations.annotations[0].text,'Newer annotation');
const staleSceneAfterNotes=hook.changeScene;const revisedAgain=plain(hook.modelAnnotations);revisedAgain.annotations[0].color='#ffffff';hook.setModelAnnotations(revisedAgain);hook=useEditorDocuments(()=>[]);
staleSceneAfterNotes([]);hook=useEditorDocuments(()=>[]);assert.equal(hook.items.length,1);
const closedNoteSetter=hook.setModelAnnotations;hook.close(annotationTab);hook=useEditorDocuments(()=>[]);assert.equal(hook.activeId,emptyAnnotationTab);
closedNoteSetter(revisedAgain);hook=useEditorDocuments(()=>[]);assert.equal(hook.modelAnnotations.annotations.length,0);
// Saved markers for v3 remain content-sensitive; stale exports cannot clear new note edits.
state=undefined;storage.clear();hook=useEditorDocuments(()=>[item]);hook.markSaved(hook.exportDocument());hook=useEditorDocuments(()=>[]);const oldNoteSave=hook.exportDocument();hook.setModelAnnotations(notes);hook=useEditorDocuments(()=>[]);hook.markSaved(oldNoteSave);hook=useEditorDocuments(()=>[]);assert.equal(hook.tabs[0].dirty,true);
console.log('PASS schema3 annotation Unicode/source persistence, mixed scene-note undo/redo, clone/no-op/invalid guards, drawing independence and stale-tab/revision protection');

// Finite component and offset values can still overflow after resolving the anchor.
const extremeNote=annotationCore.createModelAnnotation('extreme',item.id);extremeNote.anchor.point=[Number.MAX_VALUE,0,0];extremeNote.offset=[Number.MAX_VALUE,0,0];
const extremeScene=plain(annotated);extremeScene.modelAnnotations={version:1,annotations:[extremeNote]};
assert.throws(()=>serializeDocument(extremeScene),/конечным/);
state=undefined;storage.clear();hook=useEditorDocuments(()=>[item]);const beforeExtreme=hook.exportDocument().json;
assert.throws(()=>hook.setModelAnnotations(extremeScene.modelAnnotations),/конечным/);hook=useEditorDocuments(()=>[]);assert.equal(hook.modelHistoryCount,0);assert.equal(hook.exportDocument().json,beforeExtreme);
const safeAtOrigin=plain(extremeNote);safeAtOrigin.anchor.point=[Number.MAX_VALUE,0,0];safeAtOrigin.offset=[0,0,0];hook.setModelAnnotations({version:1,annotations:[safeAtOrigin]});hook=useEditorDocuments(()=>[]);
const priorCount=hook.modelHistoryCount;const hugePosition=plain(item);hugePosition.pos=[Number.MAX_VALUE,1,0];assert.throws(()=>hook.changeScene([hugePosition]),/конечным/);hook=useEditorDocuments(()=>[]);assert.equal(hook.modelHistoryCount,priorCount);assert.deepEqual(plain(hook.items[0].pos),item.pos);
// A missing source is preserved even if its unresolved local values would overflow together.
const unresolved=plain(extremeScene);unresolved.items=[];assert.deepEqual(plain(parseDocument(serializeDocument(unresolved))).modelAnnotations,plain(extremeScene.modelAnnotations));
console.log('PASS combined scene annotation overflow rejected before persistence/history while unresolved sources remain repairable');
