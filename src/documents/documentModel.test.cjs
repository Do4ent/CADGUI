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
for (const value of [null, [], 42, {}, {...document,schemaVersion:10}, {...document,name:' '}, {...document,id:''}, {...document,modifiedAt:'bad'}, {...document,items:[item,item]}]) assert.throws(() => validateDocument(value));
for (const patch of [{pos:[0,1]}, {pos:[0,NaN,0]}, {pos:[0,Infinity,0]}, {size:[1,0,1]}, {size:[1,-1,1]}, {kind:'unknown'}, {color:'red'}, {visible:'yes'}, {id:' '}, {name:''}, {group:null}]) assert.throws(() => validateDocument({...document,items:[{...item,...patch}]}));
assert.throws(() => parseDocument('{bad'), /Invalid document JSON/);
assert.throws(() => parseDocument(JSON.stringify([item])), /Legacy/);
const migrated = parseDocument(JSON.stringify([item]), {id:'legacy',name:'Imported',modifiedAt:'2026-11-02T00:00:00Z'});
assert.equal(migrated.schemaVersion,9);
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
assert.equal(upgrade.schemaVersion,9);
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
hook=useEditorDocuments(()=>[]);assert.equal(hook.tabs[0].dirty,false);assert.equal(hook.document.schemaVersion,9);
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
assert.equal(document.schemaVersion,9);
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
 hook=useEditorDocuments(()=>[]);assert.equal(hook.tabs[0].dirty,dirty);assert.equal(hook.document.schemaVersion,9);
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

// Actual OCCT 5.15.0 makeBox(10,20,30), verified fromBREP/isValid/volume=6000.
const boxBrep="\nCASCADE Topology V3, (c) Open Cascade\nLocations 0\nCurve2ds 24\n1 0 0 1 0 \n1 0 0 1 0 \n1 30 0 0 -1 \n1 0 0 0 1 \n1 0 -20 1 0 \n1 0 0 1 0 \n1 0 0 0 -1 \n1 0 0 0 1 \n1 0 0 1 0 \n1 0 10 1 0 \n1 30 0 0 -1 \n1 10 0 0 1 \n1 0 -20 1 0 \n1 0 10 1 0 \n1 0 0 0 -1 \n1 10 0 0 1 \n1 0 0 0 1 \n1 0 0 1 0 \n1 30 0 0 1 \n1 0 0 1 0 \n1 0 0 0 1 \n1 0 20 1 0 \n1 30 0 0 1 \n1 0 20 1 0 \nCurves 12\n1 0 0 0 0 0 1 \n1 0 0 30 -0 1 0 \n1 0 20 0 0 0 1 \n1 0 0 0 -0 1 0 \n1 10 0 0 0 0 1 \n1 10 0 30 -0 1 0 \n1 10 20 0 0 0 1 \n1 10 0 0 -0 1 0 \n1 0 0 0 1 0 -0 \n1 0 0 30 1 0 -0 \n1 0 20 0 1 0 -0 \n1 0 20 30 1 0 -0 \nPolygon3D 0\nPolygonOnTriangulations 0\nSurfaces 6\n1 0 0 0 1 0 -0 0 0 1 0 -1 0 \n1 0 0 0 -0 1 0 0 0 1 1 0 -0 \n1 0 0 30 0 0 1 1 0 -0 -0 1 0 \n1 0 20 0 -0 1 0 0 0 1 1 0 -0 \n1 0 0 0 0 0 1 1 0 -0 -0 1 0 \n1 10 0 0 1 0 -0 0 0 1 0 -1 0 \nTriangulations 0\n\nTShapes 34\nVe\n1e-07\n0 0 30\n0 0\n\n0101101\n*\nVe\n1e-07\n0 0 0\n0 0\n\n0101101\n*\nEd\n 1e-07 1 1 0\n1  1 0 0 30\n2  1 1 0 0 30\n2  2 2 0 0 30\n0\n\n0101000\n-34 0 +33 0 *\nVe\n1e-07\n0 20 30\n0 0\n\n0101101\n*\nEd\n 1e-07 1 1 0\n1  2 0 0 20\n2  3 1 0 0 20\n2  4 3 0 0 20\n0\n\n0101000\n-31 0 +34 0 *\nVe\n1e-07\n0 20 0\n0 0\n\n0101101\n*\nEd\n 1e-07 1 1 0\n1  3 0 0 30\n2  5 1 0 0 30\n2  6 4 0 0 30\n0\n\n0101000\n-31 0 +29 0 *\nEd\n 1e-07 1 1 0\n1  4 0 0 20\n2  7 1 0 0 20\n2  8 5 0 0 20\n0\n\n0101000\n-29 0 +33 0 *\nWi\n\n0101100\n-32 0 -30 0 +28 0 +27 0 *\nFa\n0  1e-07 1 0\n\n0111000\n+26 0 *\nVe\n1e-07\n10 0 30\n0 0\n\n0101101\n*\nVe\n1e-07\n10 0 0\n0 0\n\n0101101\n*\nEd\n 1e-07 1 1 0\n1  5 0 0 30\n2  9 6 0 0 30\n2  10 2 0 0 30\n0\n\n0101000\n-24 0 +23 0 *\nVe\n1e-07\n10 20 30\n0 0\n\n0101101\n*\nEd\n 1e-07 1 1 0\n1  6 0 0 20\n2  11 6 0 0 20\n2  12 3 0 0 20\n0\n\n0101000\n-21 0 +24 0 *\nVe\n1e-07\n10 20 0\n0 0\n\n0101101\n*\nEd\n 1e-07 1 1 0\n1  7 0 0 30\n2  13 6 0 0 30\n2  14 4 0 0 30\n0\n\n0101000\n-21 0 +19 0 *\nEd\n 1e-07 1 1 0\n1  8 0 0 20\n2  15 6 0 0 20\n2  16 5 0 0 20\n0\n\n0101000\n-19 0 +23 0 *\nWi\n\n0101100\n-22 0 -20 0 +18 0 +17 0 *\nFa\n0  1e-07 6 0\n\n0111000\n+16 0 *\nEd\n 1e-07 1 1 0\n1  9 0 0 10\n2  17 2 0 0 10\n2  18 5 0 0 10\n0\n\n0101000\n-23 0 +33 0 *\nEd\n 1e-07 1 1 0\n1  10 0 0 10\n2  19 2 0 0 10\n2  20 3 0 0 10\n0\n\n0101000\n-24 0 +34 0 *\nWi\n\n0101100\n-14 0 -22 0 +13 0 +32 0 *\nFa\n0  1e-07 2 0\n\n0111000\n+12 0 *\nEd\n 1e-07 1 1 0\n1  11 0 0 10\n2  21 4 0 0 10\n2  22 5 0 0 10\n0\n\n0101000\n-19 0 +29 0 *\nEd\n 1e-07 1 1 0\n1  12 0 0 10\n2  23 4 0 0 10\n2  24 3 0 0 10\n0\n\n0101000\n-21 0 +31 0 *\nWi\n\n0101100\n-10 0 -18 0 +9 0 +28 0 *\nFa\n0  1e-07 4 0\n\n0111000\n+8 0 *\nWi\n\n0101100\n-27 0 -10 0 +17 0 +14 0 *\nFa\n0  1e-07 5 0\n\n0111000\n+6 0 *\nWi\n\n0101100\n-30 0 -9 0 +20 0 +13 0 *\nFa\n0  1e-07 3 0\n\n0111000\n+4 0 *\nSh\n\n0101100\n-25 0 +15 0 -11 0 +7 0 -5 0 +3 0 *\nSo\n\n1100000\n+2 0 *\n\n+1 0 ";
const exactCore=load(path.resolve(__dirname,'../kernel/model.ts'));
const exact=plain(exactCore.createExactModelState());exact.bodies=[{id:'solid',name:'Exact box',brep:boxBrep,color:'#ab1234',visible:true}];
const exactDocument={...document,exactModel:exact};
assert.deepEqual(plain(parseDocument(serializeDocument(exactDocument))),plain(exactDocument));
const cloneExact=validateDocument(exactDocument);cloneExact.exactModel.bodies[0].name='Changed';assert.equal(exact.bodies[0].name,'Exact box');
assert.throws(()=>validateDocument({...document,exactModel:undefined}));
for(const invalid of [{...exact,units:'inch'},{...exact,version:2},{...exact,bodies:[exact.bodies[0],exact.bodies[0]]},{...exact,bodies:[{...exact.bodies[0],brep:'not BREP'}]}])assert.throws(()=>validateDocument({...document,exactModel:invalid}));
for(const version of [1,2,3])for(const dirty of [false,true]){
 const legacyDoc=plain(exactDocument);legacyDoc.schemaVersion=version;delete legacyDoc.exactModel;
 if(version<3)delete legacyDoc.modelAnnotations;if(version===1)delete legacyDoc.drawing;
 const migratedDoc=parseDocument(JSON.stringify(legacyDoc));assert.deepEqual(plain(migratedDoc.exactModel),plain(exactCore.createExactModelState()));assert.deepEqual(plain(migratedDoc.items),[item]);
 const saved=[dirty?'Unsaved title':legacyDoc.name,legacyDoc.items];if(version>=2)saved.push(legacyDoc.drawing);if(version>=3)saved.push(legacyDoc.modelAnnotations);
 state=undefined;storage.set('bendcore-documents-v1',JSON.stringify({version:1,activeId:legacyDoc.id,tabs:[{document:legacyDoc,saved:JSON.stringify(saved)}]}));hook=useEditorDocuments(()=>[]);assert.equal(hook.tabs[0].dirty,dirty);
}
state=undefined;storage.clear();hook=useEditorDocuments(()=>[item]);hook.markSaved(hook.exportDocument());hook=useEditorDocuments(()=>[]);
const exactTab=hook.activeId;hook.setExactModel(exact);hook=useEditorDocuments(()=>[]);assert.equal(hook.modelHistoryCount,1);assert.equal(hook.tabs[0].dirty,true);
exact.bodies[0].name='Caller mutation';assert.equal(hook.exactModel.bodies[0].name,'Exact box');
hook.setExactModel(plain(hook.exactModel));hook=useEditorDocuments(()=>[]);assert.equal(hook.modelHistoryCount,1);
assert.throws(()=>hook.setExactModel({...hook.exactModel,units:'inch'}));assert.equal(hook.modelHistoryCount,1);
const staleExact=hook.setExactModel;const staleItems=hook.changeScene;const staleNotes=hook.setModelAnnotations;
const newerExact=plain(hook.exactModel);newerExact.bodies[0].name='New exact';hook.setExactModel(newerExact);hook=useEditorDocuments(()=>[]);
staleExact(exactCore.createExactModelState());staleItems([]);staleNotes({version:1,annotations:[]});hook=useEditorDocuments(()=>[]);assert.equal(hook.exactModel.bodies[0].name,'New exact');assert.equal(hook.items.length,1);assert.equal(hook.modelHistoryCount,2);
hook.changeScene([]);hook=useEditorDocuments(()=>[]);assert.equal(hook.exactModel.bodies[0].name,'New exact');
hook.modelUndo();hook=useEditorDocuments(()=>[]);assert.equal(hook.items.length,1);hook.modelUndo();hook=useEditorDocuments(()=>[]);assert.equal(hook.exactModel.bodies[0].name,'Exact box');hook.modelUndo();hook=useEditorDocuments(()=>[]);assert.equal(hook.exactModel.bodies.length,0);assert.equal(hook.tabs[0].dirty,false);
hook.modelRedo();hook=useEditorDocuments(()=>[]);assert.equal(hook.exactModel.bodies.length,1);
const lateTab=hook.setExactModel;hook.newDocument();hook=useEditorDocuments(()=>[]);lateTab(newerExact);hook=useEditorDocuments(()=>[]);assert.equal(hook.exactModel.bodies.length,0);hook.activate(exactTab);hook=useEditorDocuments(()=>[]);assert.equal(hook.exactModel.bodies[0].name,'Exact box');
const beforeScene=hook.setExactModel;hook.changeScene([]);hook=useEditorDocuments(()=>[]);beforeScene(newerExact);hook=useEditorDocuments(()=>[]);assert.equal(hook.exactModel.bodies[0].name,'Exact box');
console.log('PASS schema4 real BREP roundtrip, syntactic rejection, legacy clean/dirty migration, unified exact history and stale exact/scene/tab guards');
const delayedExactAfterNote=hook.setExactModel;
const independentNote={id:'world-exact-note',text:'Note',anchor:{kind:'world',point:[0,0,0]},offset:[1,1,0],orientation:'screen',fontSize:.18,color:'#176b9c',visible:true,leader:true};
hook.setModelAnnotations({version:1,annotations:[independentNote]});hook=useEditorDocuments(()=>[]);delayedExactAfterNote(newerExact);hook=useEditorDocuments(()=>[]);assert.equal(hook.exactModel.bodies[0].name,'Exact box');assert.equal(hook.modelAnnotations.annotations.length,1);
const drawingIndependent=plain(hook.drawing);drawingIndependent.properties.title='Independent drawing';hook.setDrawing(drawingIndependent);hook=useEditorDocuments(()=>[]);hook.modelUndo();hook=useEditorDocuments(()=>[]);assert.equal(hook.modelAnnotations.annotations.length,0);assert.equal(hook.drawing.properties.title,'Independent drawing');assert.equal(hook.exactModel.bodies[0].name,'Exact box');
const delayedClosedExact=hook.setExactModel;hook.close(exactTab);hook=useEditorDocuments(()=>[]);delayedClosedExact(newerExact);hook=useEditorDocuments(()=>[]);assert.equal(hook.exactModel.bodies.length,0);
console.log('PASS exact revision guards after annotation edits/closed source and independent drawing undo');

const sketchCore=load(path.resolve(__dirname,'../sketch/model.ts'));
const sketchState={version:1,units:'mm',sketches:[{id:'sketch',name:'Rectangle',plane:'XY',origin:[0,0,0],points:[{id:'p1',x:0,y:0},{id:'p2',x:10,y:0},{id:'p3',x:10,y:20},{id:'p4',x:0,y:20}],closed:true,constraints:[{id:'horizontal',kind:'horizontal',a:'p1',b:'p2'},{id:'vertical',kind:'vertical',a:'p2',b:'p3'}]}],extrusions:[{id:'extrusion',sketchId:'sketch',bodyId:'solid',depth:30}]};
const sourceDocument={...exactDocument,sketchModel:sketchState};
assert.deepEqual(plain(parseDocument(serializeDocument(sourceDocument))),plain(sourceDocument));
assert.throws(()=>validateDocument({...sourceDocument,sketchModel:undefined}));
assert.throws(()=>validateDocument({...sourceDocument,sketchModel:{...sketchState,version:2}}));
assert.throws(()=>validateDocument({...sourceDocument,exactModel:exactCore.createExactModelState()}));
const detachedSource=validateDocument(sourceDocument);detachedSource.sketchModel.sketches[0].points[0].x=99;assert.equal(sketchState.sketches[0].points[0].x,0);
const v4Source=plain(sourceDocument);v4Source.schemaVersion=4;delete v4Source.sketchModel;
const v4Migrated=parseDocument(JSON.stringify(v4Source));assert.deepEqual(plain(v4Migrated.exactModel),plain(v4Source.exactModel));assert.deepEqual(plain(v4Migrated.sketchModel),plain(sketchCore.createSketchModelState()));
for(const dirty of [false,true]){
 state=undefined;storage.set('bendcore-documents-v1',JSON.stringify({version:1,activeId:v4Source.id,tabs:[{document:v4Source,saved:JSON.stringify([dirty?'Unsaved':v4Source.name,v4Source.items,v4Source.drawing,v4Source.modelAnnotations,v4Source.exactModel])}]}));hook=useEditorDocuments(()=>[]);assert.equal(hook.tabs[0].dirty,dirty);
}
state=undefined;storage.clear();hook=useEditorDocuments(()=>[item]);hook.markSaved(hook.exportDocument());hook=useEditorDocuments(()=>[]);
const sketchTab=hook.activeId;hook.setSketchModel(sketchState,sourceDocument.exactModel,'Extrude');hook=useEditorDocuments(()=>[]);assert.equal(hook.modelHistoryCount,1);assert.equal(hook.sketchModel.extrusions.length,1);assert.equal(hook.exactModel.bodies.length,1);
const staleBeforeSketch=hook.setExactModel,staleSketch=hook.setSketchModel,staleSceneBeforeSketch=hook.changeScene;
const editedSketch=plain(hook.sketchModel);editedSketch.sketches[0].name='Renamed source';hook.setSketchModel(editedSketch,hook.exactModel);hook=useEditorDocuments(()=>[]);
staleBeforeSketch(exactCore.createExactModelState());staleSketch(sketchState,sourceDocument.exactModel);staleSceneBeforeSketch([]);hook=useEditorDocuments(()=>[]);assert.equal(hook.sketchModel.sketches[0].name,'Renamed source');assert.equal(hook.items.length,1);assert.equal(hook.exactModel.bodies.length,1);
assert.throws(()=>hook.setSketchModel(editedSketch,exactCore.createExactModelState()));assert.equal(hook.modelHistoryCount,2);
hook.setExactModel(exactCore.createExactModelState(),'Delete body');hook=useEditorDocuments(()=>[]);assert.equal(hook.sketchModel.extrusions.length,0);assert.equal(hook.sketchModel.sketches.length,1);assert.equal(hook.exactModel.bodies.length,0);assert.equal(hook.modelHistoryCount,3);
hook.modelUndo();hook=useEditorDocuments(()=>[]);assert.equal(hook.exactModel.bodies.length,1);assert.equal(hook.sketchModel.extrusions.length,1);hook.modelUndo();hook=useEditorDocuments(()=>[]);assert.equal(hook.sketchModel.sketches[0].name,'Rectangle');hook.modelUndo();hook=useEditorDocuments(()=>[]);assert.equal(hook.sketchModel.sketches.length,0);assert.equal(hook.exactModel.bodies.length,0);assert.equal(hook.tabs[0].dirty,false);
hook.modelRedo();hook=useEditorDocuments(()=>[]);const delayedSketchTab=hook.setSketchModel;hook.newDocument();hook=useEditorDocuments(()=>[]);delayedSketchTab(editedSketch,sourceDocument.exactModel);hook=useEditorDocuments(()=>[]);assert.equal(hook.sketchModel.sketches.length,0);hook.activate(sketchTab);hook=useEditorDocuments(()=>[]);assert.equal(hook.sketchModel.sketches[0].name,'Rectangle');
console.log('PASS schema5 sketch+real BREP roundtrip, v4 saved migrations, atomic source/body undo, deletion pruning and stale sketch revisions/tabs');
const changedOwned=plain(hook.exactModel);changedOwned.bodies[0].brep+='\n';assert.throws(()=>hook.setExactModel(changedOwned),/эскиз/);
const visibleOwned=plain(hook.exactModel);visibleOwned.bodies[0].visible=false;hook.setExactModel(visibleOwned);hook=useEditorDocuments(()=>[]);assert.equal(hook.sketchModel.extrusions.length,1);assert.equal(hook.exactModel.bodies[0].visible,false);
const independentExact=plain(hook.exactModel);independentExact.bodies.push({...independentExact.bodies[0],id:'boolean-result',name:'Independent result'});hook.setExactModel(independentExact);hook=useEditorDocuments(()=>[]);assert.equal(hook.exactModel.bodies.length,2);assert.equal(hook.sketchModel.extrusions.length,1);
const oldSketchWrite=hook.setSketchModel;hook.setModelAnnotations({version:1,annotations:[independentNote]});hook=useEditorDocuments(()=>[]);oldSketchWrite(editedSketch,sourceDocument.exactModel);hook=useEditorDocuments(()=>[]);assert.equal(hook.exactModel.bodies.length,2);assert.equal(hook.modelAnnotations.annotations.length,1);assert.equal(hook.sketchModel.sketches[0].name,'Rectangle');
const sourceCopy=plain(hook.sketchModel),exactCopy=plain(hook.exactModel);sourceCopy.sketches[0].name='Detached input';hook.setSketchModel(sourceCopy,exactCopy);hook=useEditorDocuments(()=>[]);sourceCopy.sketches[0].points[0].x=999;exactCopy.bodies.length=0;assert.equal(hook.sketchModel.sketches[0].points[0].x,0);assert.equal(hook.exactModel.bodies.length,2);
console.log('PASS owned BREP protection, independent bodies, note-revision guard and detached atomic sketch/exact inputs');
const badSource=plain(hook.sketchModel);badSource.sketches[0].constraints.push({id:'broken',kind:'horizontal',a:'missing-point',b:'p1'});
const beforeBadSource=hook.exportDocument().json,beforeBadSourceHistory=hook.modelHistoryCount;
assert.throws(()=>validateDocument({...hook.document,sketchModel:badSource}));assert.throws(()=>hook.setSketchModel(badSource,hook.exactModel));hook=useEditorDocuments(()=>[]);assert.equal(hook.exportDocument().json,beforeBadSource);assert.equal(hook.modelHistoryCount,beforeBadSourceHistory);

// Actual OCCT5.15 cylinder r5/h12, verified isValid/fromBREP and volume300π.
const cylinderBrep="\nCASCADE Topology V3, (c) Open Cascade\nLocations 0\nCurve2ds 6\n1 0 12 1 0 \n2 0 0 1 0 -0 1 5\n1 6.2831853071795862 -0 0 1 \n1 0 -0 0 1 \n1 0 0 1 0 \n2 0 0 1 0 -0 1 5\nCurves 3\n2 0 0 12 0 0 1 1 0 -0 -0 1 0 5\n1 5 -1.2246467991473533e-15 0 0 0 1 \n2 0 0 0 0 0 1 1 0 -0 -0 1 0 5\nPolygon3D 0\nPolygonOnTriangulations 0\nSurfaces 3\n2 0 0 0 0 0 1 1 0 0 0 1 0 5\n1 0 0 12 0 0 1 1 0 0 0 1 0 \n1 0 0 0 0 0 1 1 0 0 0 1 0 \nTriangulations 0\n\nTShapes 13\nVe\n1e-07\n5 -1.22464679914735e-15 12\n0 0\n\n0101101\n*\nEd\n 1e-07 1 1 0\n1  1 0 0 6.28318530717959\n2  1 1 0 0 6.28318530717959\n2  2 2 0 0 6.28318530717959\n0\n\n0101000\n+13 0 -13 0 *\nVe\n1e-07\n5 -1.22464679914735e-15 0\n0 0\n\n0101101\n*\nEd\n 1e-07 1 1 0\n1  2 0 0 12\n3  3 4CN 1 0 0 12\n0\n\n0101000\n-13 0 +11 0 *\nEd\n 1e-07 1 1 0\n1  3 0 0 6.28318530717959\n2  5 1 0 0 6.28318530717959\n2  6 3 0 0 6.28318530717959\n0\n\n0101000\n+11 0 -11 0 *\nWi\n\n0101100\n-12 0 +10 0 +9 0 -10 0 *\nFa\n0  1e-07 1 0\n\n0111000\n+8 0 *\nWi\n\n0101100\n+12 0 *\nFa\n0  1e-07 2 0\n\n0111000\n+6 0 *\nWi\n\n0101100\n-9 0 *\nFa\n0  1e-07 3 0\n\n0111000\n-4 0 *\nSh\n\n0101100\n+7 0 +5 0 -3 0 *\nSo\n\n1100000\n+2 0 *\n\n+1 0 ";
const curvedSources={version:1,units:'mm',sketches:[{id:'circle-source',name:'Circle',plane:'XY',origin:[0,0,0],closed:true,points:[{id:'center',x:0,y:0},{id:'rim',x:5,y:0}],constraints:[{id:'radius',kind:'distance',a:'center',b:'rim',value:5}],geometry:{kind:'circle',center:'center',rim:'rim'}},{id:'arc-source',name:'Arc',plane:'XZ',origin:[1,2,3],closed:false,points:[{id:'c',x:0,y:0},{id:'a',x:5,y:0},{id:'b',x:0,y:5}],constraints:[{id:'equal',kind:'equal-length',a:'c',b:'a',c:'c',d:'b'}],geometry:{kind:'arc',center:'c',start:'a',end:'b',ccw:true}}],extrusions:[{id:'cylinder-feature',sketchId:'circle-source',bodyId:'cylinder',depth:12}]};
const cylinderExact=plain(exactCore.createExactModelState());cylinderExact.bodies=[{id:'cylinder',name:'Real cylinder',brep:cylinderBrep,color:'#124abc',visible:true}];
const curvedDoc={...document,sketchModel:curvedSources,exactModel:cylinderExact};
assert.deepEqual(plain(parseDocument(serializeDocument(curvedDoc))),plain(curvedDoc));
const clonedCurves=validateDocument(curvedDoc);clonedCurves.sketchModel.sketches[0].geometry.rim='changed';assert.equal(curvedSources.sketches[0].geometry.rim,'rim');
for(const patch of [{kind:'circle',center:'center',rim:'missing'},{kind:'circle',center:'center',rim:'rim',extra:true},{kind:'arc',center:'center',start:'rim',end:'rim',ccw:'yes'}]){const bad=plain(curvedDoc);bad.sketchModel.sketches[0].geometry=patch;assert.throws(()=>validateDocument(bad));}
const old5=plain(validateDocument(sourceDocument));old5.schemaVersion=5;assert.ok(!Object.hasOwn(old5.sketchModel.sketches[0],'geometry'));
const migrated5=plain(parseDocument(JSON.stringify(old5)));assert.equal(migrated5.schemaVersion,9);assert.deepEqual(migrated5.sketchModel,old5.sketchModel);assert.deepEqual(migrated5.exactModel,old5.exactModel);
for(const dirty of [false,true]){state=undefined;const marker=[dirty?'Unsaved legacy':old5.name,old5.items,old5.drawing,old5.modelAnnotations,old5.exactModel,old5.sketchModel];storage.set('bendcore-documents-v1',JSON.stringify({version:1,activeId:old5.id,tabs:[{document:old5,saved:JSON.stringify(marker)}]}));hook=useEditorDocuments(()=>[]);assert.equal(hook.tabs[0].dirty,dirty);assert.ok(!Object.hasOwn(hook.sketchModel.sketches[0],'geometry'));}
state=undefined;storage.clear();hook=useEditorDocuments(()=>[item]);hook.markSaved(hook.exportDocument());hook=useEditorDocuments(()=>[]);hook.setSketchModel(curvedSources,cylinderExact);hook=useEditorDocuments(()=>[]);assert.equal(hook.modelHistoryCount,1);assert.equal(hook.exactModel.bodies[0].brep,cylinderBrep);assert.equal(hook.sketchModel.sketches[1].geometry.ccw,true);
hook.modelUndo();hook=useEditorDocuments(()=>[]);assert.equal(hook.sketchModel.sketches.length,0);assert.equal(hook.exactModel.bodies.length,0);assert.equal(hook.tabs[0].dirty,false);hook.modelRedo();hook=useEditorDocuments(()=>[]);assert.equal(hook.sketchModel.sketches[0].geometry.kind,'circle');assert.equal(hook.exactModel.bodies[0].brep,cylinderBrep);
const badCurveCommit=plain(hook.sketchModel);badCurveCommit.sketches[0].geometry.center='missing';const curveHistory=hook.modelHistoryCount;assert.throws(()=>hook.setSketchModel(badCurveCommit,hook.exactModel));hook=useEditorDocuments(()=>[]);assert.equal(hook.modelHistoryCount,curveHistory);assert.equal(hook.sketchModel.sketches[0].geometry.center,'center');
console.log('PASS schema6 curved source/real cylinder BREP roundtrip+undo, strict geometry rejection and absent-geometry v5 clean/dirty migrations');

// Actual OCCT mixed semicircle wire+diameter, extrusion12, valid volume150π.
const mixedBrep="\nCASCADE Topology V3, (c) Open Cascade\nLocations 2\n1\n              1               0               0               0 \n              0               1               0               0 \n              0               0               1              12 \n2  1 -1 0\nCurve2ds 4\n1 0 0 0 -1 \n1 3.1415926535897931 0 0 -1 \n1 0 0 1 0 \n1 0 -12 1 0 \nCurves 4\n1 5 0 0 0 0 1 \n1 -5 3.0616169991140216e-16 0 0 0 1 \n2 -4.4408920985006262e-16 0 0 0 0 1 1 0 -0 -0 1 0 5\n1 -5 0 0 1 0 0 \nPolygon3D 0\nPolygonOnTriangulations 0\nSurfaces 3\n2 -4.4408920985006262e-16 0 0 -0 -0 -1 1 0 -0 -0 1 0 5\n1 -5 0 0 0 1 0 1 0 0 0 0 -1 \n1 0 1.7320508075688772 0 0 0 1 1 0 -0 -0 1 0 \nTriangulations 0\n\nTShapes 14\nVe\n1e-07\n5 0 0\n0 0\n\n0101101\n*\nEd\n 1e-07 1 1 0\n1  1 0 0 12\n2  1 1 0 0 12\n0\n\n0101000\n+14 0 -14 1 *\nVe\n1.00000000306162e-07\n-5 3.06161699911402e-16 0\n0 0\n\n0101101\n*\nEd\n 1.00000000306162e-07 1 1 0\n1  2 0 0 12\n2  2 1 0 0 12\n0\n\n0101000\n+12 0 -12 1 *\nEd\n 1e-07 1 1 0\n1  3 0 0 3.14159265358979\n2  3 1 0 0 3.14159265358979\n2  4 1 2 0 3.14159265358979\n0\n\n0101000\n+14 0 -12 0 *\nWi\n\n0101100\n+13 0 -11 0 -10 0 +10 1 *\nFa\n0  1e-07 1 0\n\n0101000\n+9 0 *\nEd\n 1e-07 1 1 0\n1  4 0 0 10\n0\n\n0101000\n+12 0 -14 0 *\nWi\n\n0101100\n+11 0 -13 0 -7 0 +7 1 *\nFa\n0  1e-07 2 0\n\n0101000\n+6 0 *\nWi\n\n0101100\n+10 0 +7 0 *\nFa\n0  1e-07 3 0\n\n0101000\n+4 0 *\nSh\n\n0101100\n+8 0 +5 0 +3 0 -3 1 *\nSo\n\n1100000\n-2 0 *\n\n+1 0 ";
const mixedSource={id:'mixed-source',name:'Semicircle',plane:'XY',origin:[0,0,0],closed:true,points:[{id:'center',x:0,y:0},{id:'start',x:5,y:0},{id:'end',x:-5,y:0}],constraints:[],geometry:{kind:'mixed',segments:[{id:'arc-edge',kind:'arc',center:'center',start:'start',end:'end',ccw:true},{id:'diameter-edge',kind:'line',start:'end',end:'start'}]}};
const mixedState={version:1,units:'mm',sketches:[mixedSource],extrusions:[{id:'mixed-feature',sketchId:'mixed-source',bodyId:'mixed-body',depth:12}]};
const mixedExact=plain(exactCore.createExactModelState());mixedExact.bodies=[{id:'mixed-body',name:'Half cylinder',brep:mixedBrep,color:'#345abc',visible:true}];
const mixedDocument={...document,sketchModel:mixedState,exactModel:mixedExact};
const nativeMixed=plain(parseDocument(serializeDocument(mixedDocument)));assert.deepEqual(nativeMixed,plain(mixedDocument));assert.deepEqual(nativeMixed.sketchModel.sketches[0].geometry.segments.map(edge=>edge.id),['arc-edge','diameter-edge']);
const copiedMixed=validateDocument(mixedDocument);copiedMixed.sketchModel.sketches[0].geometry.segments[0].center='changed';assert.equal(mixedSource.geometry.segments[0].center,'center');
for(const mutation of [s=>s.geometry.segments[0].center='missing',s=>s.geometry.segments[1].id='arc-edge',s=>s.geometry.segments[0].ccw='yes',s=>s.geometry.segments[1].start='start',s=>s.geometry.segments[0].extra=true]){const bad=plain(mixedDocument);mutation(bad.sketchModel.sketches[0]);assert.throws(()=>validateDocument(bad));}
const old6=plain(validateDocument(curvedDoc));old6.schemaVersion=6;const migrated6=plain(parseDocument(JSON.stringify(old6)));assert.equal(migrated6.schemaVersion,9);assert.deepEqual(migrated6.sketchModel,old6.sketchModel);assert.deepEqual(migrated6.exactModel,old6.exactModel);
for(const dirty of [false,true]){state=undefined;const saved=[dirty?'Unsaved v6':old6.name,old6.items,old6.drawing,old6.modelAnnotations,old6.exactModel,old6.sketchModel];storage.set('bendcore-documents-v1',JSON.stringify({version:1,activeId:old6.id,tabs:[{document:old6,saved:JSON.stringify(saved)}]}));hook=useEditorDocuments(()=>[]);assert.equal(hook.tabs[0].dirty,dirty);assert.equal(hook.sketchModel.sketches[0].geometry.kind,'circle');}
state=undefined;storage.clear();hook=useEditorDocuments(()=>[item]);hook.markSaved(hook.exportDocument());hook=useEditorDocuments(()=>[]);hook.setSketchModel(mixedState,mixedExact);hook=useEditorDocuments(()=>[]);assert.equal(hook.modelHistoryCount,1);hook.modelUndo();hook=useEditorDocuments(()=>[]);assert.equal(hook.tabs[0].dirty,false);assert.equal(hook.exactModel.bodies.length,0);assert.equal(hook.sketchModel.sketches.length,0);hook.modelRedo();hook=useEditorDocuments(()=>[]);assert.equal(hook.exactModel.bodies[0].brep,mixedBrep);assert.equal(hook.sketchModel.sketches[0].geometry.segments[0].id,'arc-edge');
console.log('PASS schema7 mixed ordered source+real semicylinder BREP, stable IDs, malformed refs and v6 fingerprint migration with atomic Undo');
const angularSource=plain(sketchCore.createMixedSketch('angular-source',10,5));angularSource.constraints.push({id:'angle90',kind:'angle',a:'bl',b:'br',c:'br',d:'cr',value:90});
const angularDocument=plain(mixedDocument);angularDocument.sketchModel.sketches.push(angularSource);const angularNative=plain(parseDocument(serializeDocument(angularDocument)));assert.deepEqual(angularNative.sketchModel.sketches[1].constraints,angularSource.constraints);
for(const change of [s=>s.constraints.find(c=>c.kind==='angle').d='missing',s=>s.constraints.find(c=>c.kind==='angle').value=NaN,s=>s.constraints.find(c=>c.kind==='tangent').other='missing',s=>s.constraints.find(c=>c.kind==='tangent').extra=true]){const bad=plain(angularDocument);change(bad.sketchModel.sketches[1]);assert.throws(()=>validateDocument(bad));}
console.log('PASS schema7 angular/tangent source constraints and malformed nonlinear references');

// Actual OCCT r5 cylinder minus r2 cylinder, h12; valid fromBREP volume252π.
const perforatedBrep="\nCASCADE Topology V3, (c) Open Cascade\nLocations 0\nCurve2ds 14\n1 0 12 1 0 \n2 0 0 1 0 -0 1 5\n1 6.2831853071795862 -0 0 1 \n1 0 -0 0 1 \n1 0 0 1 0 \n2 0 0 1 0 -0 1 5\n1 0 12 1 0 \n2 0 0 1 0 -0 1 2\n2 0 0 1 0 -0 1 2\n1 0 0 1 0 \n2 0 0 1 0 -0 1 2\n2 0 0 1 0 -0 1 2\n1 6.2831853071795862 -0 0 1 \n1 0 -0 0 1 \nCurves 6\n2 0 0 12 0 0 1 1 0 -0 -0 1 0 5\n1 5 -1.2246467991473533e-15 0 0 0 1 \n2 0 0 0 0 0 1 1 0 -0 -0 1 0 5\n2 0 0 12 0 0 1 1 0 -0 -0 1 0 2\n2 0 0 0 0 0 1 1 0 -0 -0 1 0 2\n1 2 -4.8985871965894128e-16 0 0 0 1 \nPolygon3D 0\nPolygonOnTriangulations 0\nSurfaces 6\n2 0 0 0 0 0 1 1 0 0 0 1 0 5\n1 0 0 12 0 0 1 1 0 0 0 1 0 \n1 0 0 0 0 0 1 1 0 0 0 1 0 \n2 0 0 0 0 0 1 1 0 0 0 1 0 2\n1 0 0 12 0 0 1 1 0 0 0 1 0 \n1 0 0 0 0 0 1 1 0 0 0 1 0 \nTriangulations 0\n\nTShapes 23\nVe\n1e-07\n5 -1.22464679914735e-15 12\n0 0\n\n0101101\n*\nEd\n 1e-07 1 1 0\n1  1 0 0 6.28318530717959\n2  1 1 0 0 6.28318530717959\n2  2 2 0 0 6.28318530717959\n0\n\n0101000\n+23 0 -23 0 *\nVe\n1e-07\n5 -1.22464679914735e-15 0\n0 0\n\n0101101\n*\nEd\n 1e-07 1 1 0\n1  2 0 0 12\n3  3 4CN 1 0 0 12\n0\n\n0101000\n-23 0 +21 0 *\nEd\n 1e-07 1 1 0\n1  3 0 0 6.28318530717959\n2  5 1 0 0 6.28318530717959\n2  6 3 0 0 6.28318530717959\n0\n\n0101000\n+21 0 -21 0 *\nWi\n\n0101100\n-22 0 +20 0 +19 0 -20 0 *\nFa\n0  1e-07 1 0\n\n0111000\n+18 0 *\nWi\n\n0101100\n+22 0 *\nVe\n1e-07\n2 -4.89858719658941e-16 12\n0 0\n\n0101101\n*\nEd\n 1e-07 1 1 0\n1  4 0 0 6.28318530717959\n2  7 4 0 0 6.28318530717959\n2  8 5 0 0 6.28318530717959\n2  9 2 0 0 6.28318530717959\n0\n\n0101000\n+15 0 -15 0 *\nWi\n\n0101100\n-14 0 *\nFa\n0  1e-07 2 0\n\n0101000\n+16 0 +13 0 *\nWi\n\n0101100\n+19 0 *\nVe\n1e-07\n2 -4.89858719658941e-16 0\n0 0\n\n0101101\n*\nEd\n 1e-07 1 1 0\n1  5 0 0 6.28318530717959\n2  10 4 0 0 6.28318530717959\n2  11 6 0 0 6.28318530717959\n2  12 3 0 0 6.28318530717959\n0\n\n0101000\n+10 0 -10 0 *\nWi\n\n0101100\n-9 0 *\nFa\n0  1e-07 3 0\n\n0101000\n+11 0 +8 0 *\nEd\n 1e-07 1 1 0\n1  6 0 0 12\n3  13 14CN 4 0 0 12\n0\n\n0101000\n-15 0 +10 0 *\nWi\n\n0101100\n-14 0 +6 0 +9 0 -6 0 *\nFa\n0  1e-07 4 0\n\n0111000\n+5 0 *\nSh\n\n0101100\n+17 0 +12 0 -7 0 -4 0 *\nSo\n\n0100000\n+3 0 *\nCo\n\n1100000\n+2 0 *\n\n+1 0 ";
const annulusOuter=plain(curvedSources.sketches[0]);annulusOuter.id='outer-circle';annulusOuter.name='Outer';annulusOuter.holes=['inner-circle'];
const annulusInner=plain(curvedSources.sketches[0]);annulusInner.id='inner-circle';annulusInner.name='Bore';annulusInner.points.find(p=>p.id==='rim').x=2;annulusInner.constraints[0].value=2;
const annulusState={version:1,units:'mm',sketches:[annulusOuter,annulusInner],extrusions:[{id:'annulus-feature',sketchId:'outer-circle',bodyId:'annulus-body',depth:12}]};
const annulusExact=plain(exactCore.createExactModelState());annulusExact.bodies=[{id:'annulus-body',name:'Perforated cylinder',brep:perforatedBrep,color:'#12ab45',visible:true}];
const annulusDocument={...document,sketchModel:annulusState,exactModel:annulusExact};const annulusNative=plain(parseDocument(serializeDocument(annulusDocument)));assert.deepEqual(annulusNative,plain(annulusDocument));assert.deepEqual(annulusNative.sketchModel.sketches[0].holes,['inner-circle']);
const annulusClone=validateDocument(annulusDocument);annulusClone.sketchModel.sketches[0].holes[0]='mutated';assert.equal(annulusOuter.holes[0],'inner-circle');
for(const mutation of [s=>s.sketches[0].holes=['missing'],s=>s.sketches[0].holes=['inner-circle','inner-circle'],s=>s.sketches[0].holes=['outer-circle'],s=>s.sketches[1].holes=['outer-circle'],s=>s.sketches[1].plane='XZ',s=>s.sketches[1].closed=false,s=>s.sketches[1].origin=[0,0,1]]){const bad=plain(annulusDocument);mutation(bad.sketchModel);assert.throws(()=>validateDocument(bad));}
const old7=plain(validateDocument(mixedDocument));old7.schemaVersion=7;assert.ok(!Object.hasOwn(old7.sketchModel.sketches[0],'holes'));const migrated7=plain(parseDocument(JSON.stringify(old7)));assert.equal(migrated7.schemaVersion,9);assert.deepEqual(migrated7.sketchModel,old7.sketchModel);
for(const dirty of [false,true]){state=undefined;const saved=[dirty?'Unsaved v7':old7.name,old7.items,old7.drawing,old7.modelAnnotations,old7.exactModel,old7.sketchModel];storage.set('bendcore-documents-v1',JSON.stringify({version:1,activeId:old7.id,tabs:[{document:old7,saved:JSON.stringify(saved)}]}));hook=useEditorDocuments(()=>[]);assert.equal(hook.tabs[0].dirty,dirty);assert.ok(!Object.hasOwn(hook.sketchModel.sketches[0],'holes'));}
state=undefined;storage.clear();hook=useEditorDocuments(()=>[item]);hook.markSaved(hook.exportDocument());hook=useEditorDocuments(()=>[]);hook.setSketchModel(annulusState,annulusExact);hook=useEditorDocuments(()=>[]);assert.equal(hook.modelHistoryCount,1);assert.equal(hook.exactModel.bodies[0].brep,perforatedBrep);
const withoutBore=sketchCore.removeSketch(hook.sketchModel,'inner-circle');assert.equal(withoutBore.sketches.length,1);assert.ok(!withoutBore.sketches[0].holes?.includes('inner-circle'));assert.equal(withoutBore.extrusions[0].bodyId,'annulus-body');
const rebuiltSolid=plain(hook.exactModel);rebuiltSolid.bodies[0].brep=cylinderBrep;hook.setSketchModel(withoutBore,rebuiltSolid,'Remove bore and rebuild');hook=useEditorDocuments(()=>[]);assert.equal(hook.modelHistoryCount,2);assert.equal(hook.exactModel.bodies[0].brep,cylinderBrep);
hook.modelUndo();hook=useEditorDocuments(()=>[]);assert.equal(hook.exactModel.bodies[0].brep,perforatedBrep);assert.deepEqual(plain(hook.sketchModel.sketches[0].holes),['inner-circle']);assert.equal(hook.sketchModel.sketches[1].id,'inner-circle');hook.modelUndo();hook=useEditorDocuments(()=>[]);assert.equal(hook.sketchModel.sketches.length,0);assert.equal(hook.exactModel.bodies.length,0);assert.equal(hook.tabs[0].dirty,false);hook.modelRedo();hook=useEditorDocuments(()=>[]);assert.equal(hook.sketchModel.sketches[0].holes[0],'inner-circle');assert.equal(hook.exactModel.bodies[0].brep,perforatedBrep);
console.log('PASS schema8 perforated BREP/source roundtrip, hole IDs/ref validation, v7 absent-hole clean/dirty migration and atomic remove+rebuild Undo');
for(const offset of [3,10]){const bad=plain(annulusDocument);for(const p of bad.sketchModel.sketches[1].points)p.x+=offset;assert.throws(()=>validateDocument(bad));}
const nestedHole=plain(annulusDocument);const nestedSource=plain(annulusInner);nestedSource.id='nested-hole';nestedSource.points.find(p=>p.id==='rim').x=1;nestedSource.constraints[0].value=1;nestedHole.sketchModel.sketches.push(nestedSource);nestedHole.sketchModel.sketches[1].holes=['nested-hole'];assert.throws(()=>validateDocument(nestedHole));

// Actual OCCT box10x20x30 minus r2/h5 cylinder at(5,10,0), blind pocket volume6000−20π.
const blindPocketBrep="\nCASCADE Topology V3, (c) Open Cascade\nLocations 0\nCurve2ds 30\n1 0 0 1 0 \n1 0 0 1 0 \n1 30 0 0 -1 \n1 0 0 0 1 \n1 0 -20 1 0 \n1 0 0 1 0 \n1 0 0 0 -1 \n1 0 0 0 1 \n1 0 0 0 1 \n1 0 0 1 0 \n1 0 0 1 0 \n1 0 10 1 0 \n1 30 0 0 1 \n1 0 0 1 0 \n1 30 0 0 1 \n1 0 20 1 0 \n1 30 0 0 -1 \n1 10 0 0 1 \n1 0 0 0 1 \n1 0 20 1 0 \n1 0 -20 1 0 \n1 0 10 1 0 \n1 0 0 0 -1 \n1 10 0 0 1 \n1 0 0 1 0 \n2 0 0 1 0 -0 1 2\n2 5 10 1 0 -0 1 2\n1 0 5 1 0 \n1 6.2831853071795862 -0 0 1 \n1 0 -0 0 1 \nCurves 15\n1 0 0 0 0 0 1 \n1 0 0 30 -0 1 0 \n1 0 20 0 0 0 1 \n1 0 0 0 -0 1 0 \n1 0 0 0 1 0 -0 \n1 10 0 0 0 0 1 \n1 0 0 30 1 0 -0 \n1 0 20 30 1 0 -0 \n1 10 0 30 -0 1 0 \n1 0 20 0 1 0 -0 \n1 10 20 0 0 0 1 \n1 10 0 0 -0 1 0 \n2 5 10 0 0 0 1 1 0 -0 -0 1 0 2\n2 5 10 5 0 0 1 1 0 -0 -0 1 0 2\n1 7 10 0 0 0 1 \nPolygon3D 0\nPolygonOnTriangulations 0\nSurfaces 9\n1 0 0 0 1 0 -0 0 0 1 0 -1 0 \n1 0 0 0 -0 1 0 0 0 1 1 0 -0 \n1 0 0 30 0 0 1 1 0 -0 -0 1 0 \n1 0 20 0 -0 1 0 0 0 1 1 0 -0 \n1 0 0 0 0 0 1 1 0 -0 -0 1 0 \n1 10 0 0 1 0 -0 0 0 1 0 -1 0 \n2 5 10 0 0 0 1 1 0 0 0 1 0 2\n1 5 10 0 0 0 1 1 0 0 0 1 0 \n1 5 10 5 0 0 1 1 0 0 0 1 0 \nTriangulations 0\n\nTShapes 45\nVe\n1e-07\n0 0 30\n0 0\n\n0101101\n*\nVe\n1e-07\n0 0 0\n0 0\n\n0101101\n*\nEd\n 1e-07 1 1 0\n1  1 0 0 30\n2  1 1 0 0 30\n2  2 2 0 0 30\n0\n\n0101000\n-45 0 +44 0 *\nVe\n1e-07\n0 20 30\n0 0\n\n0101101\n*\nEd\n 1e-07 1 1 0\n1  2 0 0 20\n2  3 1 0 0 20\n2  4 3 0 0 20\n0\n\n0101000\n-42 0 +45 0 *\nVe\n1e-07\n0 20 0\n0 0\n\n0101101\n*\nEd\n 1e-07 1 1 0\n1  3 0 0 30\n2  5 1 0 0 30\n2  6 4 0 0 30\n0\n\n0101000\n-42 0 +40 0 *\nEd\n 1e-07 1 1 0\n1  4 0 0 20\n2  7 1 0 0 20\n2  8 5 0 0 20\n0\n\n0101000\n-40 0 +44 0 *\nWi\n\n0101100\n-43 0 -41 0 +39 0 +38 0 *\nFa\n0  1e-07 1 0\n\n0111000\n+37 0 *\nVe\n1e-07\n10 0 0\n0 0\n\n0101101\n*\nEd\n 1e-07 1 1 0\n1  5 0 0 10\n2  9 2 0 0 10\n2  10 5 0 0 10\n0\n\n0101000\n-35 0 +44 0 *\nVe\n1e-07\n10 0 30\n0 0\n\n0101101\n*\nEd\n 1e-07 1 1 0\n1  6 0 0 30\n2  11 6 0 0 30\n2  12 2 0 0 30\n0\n\n0101000\n-33 0 +35 0 *\nEd\n 1e-07 1 1 0\n1  7 0 0 10\n2  13 2 0 0 10\n2  14 3 0 0 10\n0\n\n0101000\n-33 0 +45 0 *\nWi\n\n0101100\n-34 0 -32 0 +31 0 +43 0 *\nFa\n0  1e-07 2 0\n\n0111000\n+30 0 *\nVe\n1e-07\n10 20 30\n0 0\n\n0101101\n*\nEd\n 1e-07 1 1 0\n1  8 0 0 10\n2  15 4 0 0 10\n2  16 3 0 0 10\n0\n\n0101000\n-28 0 +42 0 *\nEd\n 1e-07 1 1 0\n1  9 0 0 20\n2  17 6 0 0 20\n2  18 3 0 0 20\n0\n\n0101000\n-28 0 +33 0 *\nWi\n\n0101100\n-41 0 -27 0 +26 0 +31 0 *\nFa\n0  1e-07 3 0\n\n0111000\n+25 0 *\nVe\n1e-07\n10 20 0\n0 0\n\n0101101\n*\nEd\n 1e-07 1 1 0\n1  10 0 0 10\n2  19 4 0 0 10\n2  20 5 0 0 10\n0\n\n0101000\n-23 0 +40 0 *\nEd\n 1e-07 1 1 0\n1  11 0 0 30\n2  21 6 0 0 30\n2  22 4 0 0 30\n0\n\n0101000\n-28 0 +23 0 *\nWi\n\n0101100\n-22 0 -21 0 +27 0 +39 0 *\nFa\n0  1e-07 4 0\n\n0111000\n+20 0 *\nEd\n 1e-07 1 1 0\n1  12 0 0 20\n2  23 6 0 0 20\n2  24 5 0 0 20\n0\n\n0101000\n-23 0 +35 0 *\nWi\n\n0101100\n-38 0 -22 0 +34 0 +18 0 *\nVe\n1e-07\n7 10 0\n0 0\n\n0101101\n*\nEd\n 1e-07 1 1 0\n1  13 0 0 6.28318530717959\n2  25 7 0 0 6.28318530717959\n2  26 8 0 0 6.28318530717959\n2  27 5 0 0 6.28318530717959\n0\n\n0101000\n+16 0 -16 0 *\nWi\n\n0101100\n-15 0 *\nFa\n0  1e-07 5 0\n\n0101000\n+17 0 +14 0 *\nWi\n\n0101100\n-32 0 -26 0 +21 0 +18 0 *\nFa\n0  1e-07 6 0\n\n0111000\n+12 0 *\nVe\n1e-07\n7 10 5\n0 0\n\n0101101\n*\nEd\n 1e-07 1 1 0\n1  14 0 0 6.28318530717959\n2  28 7 0 0 6.28318530717959\n0\n\n0101000\n+10 0 -10 0 *\nEd\n 1e-07 1 1 0\n1  15 0 0 5\n3  29 30CN 7 0 0 5\n0\n\n0101000\n-10 0 +16 0 *\nWi\n\n0101100\n-9 0 +8 0 +15 0 -8 0 *\nFa\n0  1e-07 7 0\n\n0111000\n+7 0 *\nWi\n\n0101100\n+9 0 *\nFa\n0  1e-07 9 0\n\n0111000\n+5 0 *\nSh\n\n0101100\n-36 0 -29 0 +24 0 +19 0 -13 0 +11 0 -6 0 -4 0 *\nSo\n\n0100000\n+3 0 *\nCo\n\n1100000\n+2 0 *\n\n+1 0 ";
const pocketSource=plain(curvedSources.sketches[0]);pocketSource.id='pocket-source';pocketSource.name='Blind pocket';pocketSource.origin=[5,10,0];pocketSource.points.find(p=>p.id==='rim').x=2;pocketSource.constraints[0].value=2;
const cutState={version:1,units:'mm',sketches:[pocketSource],extrusions:[],cuts:[{id:'pocket-feature',sketchId:'pocket-source',bodyId:'pocket-output',targetBodyId:'static-box',depth:5}]};
const cutExact=plain(exactCore.createExactModelState());cutExact.bodies=[{id:'static-box',name:'Target',brep:boxBrep,color:'#123abc',visible:false},{id:'pocket-output',name:'Pocket',brep:blindPocketBrep,color:'#456abc',visible:true},{id:'unrelated',name:'Keep',brep:boxBrep,color:'#abcdef',visible:true}];
const cutDocument={...document,sketchModel:cutState,exactModel:cutExact};assert.deepEqual(plain(parseDocument(serializeDocument(cutDocument))),plain(cutDocument));
const cutCloned=validateDocument(cutDocument);cutCloned.sketchModel.cuts[0].targetBodyId='changed';assert.equal(cutState.cuts[0].targetBodyId,'static-box');
for(const mutation of [s=>s.cuts[0].targetBodyId='missing',s=>s.cuts[0].targetBodyId='pocket-output',s=>s.cuts.push({...s.cuts[0]}),s=>s.cuts[0].sketchId='missing',s=>s.cuts[0].depth=0]){const bad=plain(cutDocument);mutation(bad.sketchModel);assert.throws(()=>validateDocument(bad));}
const old8=plain(validateDocument(annulusDocument));old8.schemaVersion=8;assert.ok(!Object.hasOwn(old8.sketchModel,'cuts'));const migrated8=plain(parseDocument(JSON.stringify(old8)));assert.equal(migrated8.schemaVersion,9);assert.deepEqual(migrated8.sketchModel,old8.sketchModel);
for(const dirty of [false,true]){state=undefined;const saved=[dirty?'Unsaved v8':old8.name,old8.items,old8.drawing,old8.modelAnnotations,old8.exactModel,old8.sketchModel];storage.set('bendcore-documents-v1',JSON.stringify({version:1,activeId:old8.id,tabs:[{document:old8,saved:JSON.stringify(saved)}]}));hook=useEditorDocuments(()=>[]);assert.equal(hook.tabs[0].dirty,dirty);assert.ok(!Object.hasOwn(hook.sketchModel,'cuts'));}
state=undefined;storage.clear();hook=useEditorDocuments(()=>[item]);hook.markSaved(hook.exportDocument());hook=useEditorDocuments(()=>[]);const cutTab=hook.activeId;hook.setSketchModel(cutState,cutExact);hook=useEditorDocuments(()=>[]);assert.equal(hook.modelHistoryCount,1);assert.equal(hook.exactModel.bodies[1].brep,blindPocketBrep);
const changedTarget=plain(hook.exactModel);changedTarget.bodies[0].brep+='\n';assert.throws(()=>hook.setExactModel(changedTarget),/эскиз/);const changedResult=plain(hook.exactModel);changedResult.bodies[1].brep+='\n';assert.throws(()=>hook.setExactModel(changedResult),/эскиз/);
const metadataOnly=plain(hook.exactModel);metadataOnly.bodies[0].name='Renamed target';metadataOnly.bodies[0].visible=true;metadataOnly.bodies.push({id:'independent',name:'Independent',brep:boxBrep,color:'#abcdef',visible:true});hook.setExactModel(metadataOnly);hook=useEditorDocuments(()=>[]);assert.equal(hook.sketchModel.cuts.length,1);assert.equal(hook.exactModel.bodies.length,4);
const noTarget=plain(hook.exactModel);noTarget.bodies=noTarget.bodies.filter(body=>body.id!=='static-box');hook.setExactModel(noTarget,'Delete target');hook=useEditorDocuments(()=>[]);assert.equal(hook.sketchModel.cuts.length,0);assert.deepEqual(plain(hook.exactModel.bodies.map(body=>body.id)),['unrelated','independent']);assert.equal(hook.sketchModel.sketches.length,1);assert.equal(hook.items.length,1);
hook.modelUndo();hook=useEditorDocuments(()=>[]);assert.equal(hook.sketchModel.cuts[0].id,'pocket-feature');assert.equal(hook.exactModel.bodies.find(body=>body.id==='pocket-output').brep,blindPocketBrep);
const lateCut=hook.setSketchModel;hook.setModelAnnotations({version:1,annotations:[independentNote]});hook=useEditorDocuments(()=>[]);lateCut(cutState,cutExact);hook=useEditorDocuments(()=>[]);assert.equal(hook.modelAnnotations.annotations.length,1);assert.equal(hook.exactModel.bodies.length,4);
const crossTabCut=hook.setSketchModel;hook.newDocument();hook=useEditorDocuments(()=>[]);crossTabCut(cutState,cutExact);hook=useEditorDocuments(()=>[]);assert.equal(hook.exactModel.bodies.length,0);hook.activate(cutTab);hook=useEditorDocuments(()=>[]);assert.equal(hook.sketchModel.cuts[0].id,'pocket-feature');
console.log('PASS schema9 actual blind pocket BREP/native graph, v8 clean/dirty, static/owned guards, target-deletion cascade and stale note/tab callbacks');

// Actual OCCT descendant r1/h8 deeper pocket, total volume6000−23π.
const descendantCutBrep="\nCASCADE Topology V3, (c) Open Cascade\nLocations 0\nCurve2ds 36\n1 0 0 1 0 \n1 0 0 1 0 \n1 30 0 0 -1 \n1 0 0 0 1 \n1 0 -20 1 0 \n1 0 0 1 0 \n1 0 0 0 -1 \n1 0 0 0 1 \n1 0 0 0 1 \n1 0 0 1 0 \n1 0 0 1 0 \n1 0 10 1 0 \n1 30 0 0 1 \n1 0 0 1 0 \n1 30 0 0 1 \n1 0 20 1 0 \n1 30 0 0 -1 \n1 10 0 0 1 \n1 0 0 0 1 \n1 0 20 1 0 \n1 0 -20 1 0 \n1 0 10 1 0 \n1 0 0 0 -1 \n1 10 0 0 1 \n1 0 0 1 0 \n2 0 0 1 0 -0 1 2\n2 5 10 1 0 -0 1 2\n1 0 5 1 0 \n2 0 0 1 0 -0 1 2\n1 6.2831853071795862 -0 0 1 \n1 0 -0 0 1 \n2 0 0 1 0 -0 1 1\n1 0 5 1 0 \n1 6.2831853071795862 -0 0 1 \n1 0 -0 0 1 \n1 0 8 1 0 \nCurves 18\n1 0 0 0 0 0 1 \n1 0 0 30 -0 1 0 \n1 0 20 0 0 0 1 \n1 0 0 0 -0 1 0 \n1 0 0 0 1 0 -0 \n1 10 0 0 0 0 1 \n1 0 0 30 1 0 -0 \n1 0 20 30 1 0 -0 \n1 10 0 30 -0 1 0 \n1 0 20 0 1 0 -0 \n1 10 20 0 0 0 1 \n1 10 0 0 -0 1 0 \n2 5 10 0 0 0 1 1 0 -0 -0 1 0 2\n2 5 10 5 0 0 1 1 0 -0 -0 1 0 2\n1 7 10 0 0 0 1 \n2 5 10 5 0 0 1 1 0 -0 -0 1 0 1\n1 6 10 0 0 0 1 \n2 5 10 8 0 0 1 1 0 -0 -0 1 0 1\nPolygon3D 0\nPolygonOnTriangulations 0\nSurfaces 11\n1 0 0 0 1 0 -0 0 0 1 0 -1 0 \n1 0 0 0 -0 1 0 0 0 1 1 0 -0 \n1 0 0 30 0 0 1 1 0 -0 -0 1 0 \n1 0 20 0 -0 1 0 0 0 1 1 0 -0 \n1 0 0 0 0 0 1 1 0 -0 -0 1 0 \n1 10 0 0 1 0 -0 0 0 1 0 -1 0 \n2 5 10 0 0 0 1 1 0 0 0 1 0 2\n1 5 10 0 0 0 1 1 0 0 0 1 0 \n1 5 10 5 0 0 1 1 0 0 0 1 0 \n2 5 10 0 0 0 1 1 0 0 0 1 0 1\n1 5 10 8 0 0 1 1 0 0 0 1 0 \nTriangulations 0\n\nTShapes 55\nVe\n1e-07\n0 0 30\n0 0\n\n0101101\n*\nVe\n1e-07\n0 0 0\n0 0\n\n0101101\n*\nEd\n 1e-07 1 1 0\n1  1 0 0 30\n2  1 1 0 0 30\n2  2 2 0 0 30\n0\n\n0101000\n-55 0 +54 0 *\nVe\n1e-07\n0 20 30\n0 0\n\n0101101\n*\nEd\n 1e-07 1 1 0\n1  2 0 0 20\n2  3 1 0 0 20\n2  4 3 0 0 20\n0\n\n0101000\n-52 0 +55 0 *\nVe\n1e-07\n0 20 0\n0 0\n\n0101101\n*\nEd\n 1e-07 1 1 0\n1  3 0 0 30\n2  5 1 0 0 30\n2  6 4 0 0 30\n0\n\n0101000\n-52 0 +50 0 *\nEd\n 1e-07 1 1 0\n1  4 0 0 20\n2  7 1 0 0 20\n2  8 5 0 0 20\n0\n\n0101000\n-50 0 +54 0 *\nWi\n\n0101100\n-53 0 -51 0 +49 0 +48 0 *\nFa\n0  1e-07 1 0\n\n0111000\n+47 0 *\nVe\n1e-07\n10 0 0\n0 0\n\n0101101\n*\nEd\n 1e-07 1 1 0\n1  5 0 0 10\n2  9 2 0 0 10\n2  10 5 0 0 10\n0\n\n0101000\n-45 0 +54 0 *\nVe\n1e-07\n10 0 30\n0 0\n\n0101101\n*\nEd\n 1e-07 1 1 0\n1  6 0 0 30\n2  11 6 0 0 30\n2  12 2 0 0 30\n0\n\n0101000\n-43 0 +45 0 *\nEd\n 1e-07 1 1 0\n1  7 0 0 10\n2  13 2 0 0 10\n2  14 3 0 0 10\n0\n\n0101000\n-43 0 +55 0 *\nWi\n\n0101100\n-44 0 -42 0 +41 0 +53 0 *\nFa\n0  1e-07 2 0\n\n0111000\n+40 0 *\nVe\n1e-07\n10 20 30\n0 0\n\n0101101\n*\nEd\n 1e-07 1 1 0\n1  8 0 0 10\n2  15 4 0 0 10\n2  16 3 0 0 10\n0\n\n0101000\n-38 0 +52 0 *\nEd\n 1e-07 1 1 0\n1  9 0 0 20\n2  17 6 0 0 20\n2  18 3 0 0 20\n0\n\n0101000\n-38 0 +43 0 *\nWi\n\n0101100\n-51 0 -37 0 +36 0 +41 0 *\nFa\n0  1e-07 3 0\n\n0111000\n+35 0 *\nVe\n1e-07\n10 20 0\n0 0\n\n0101101\n*\nEd\n 1e-07 1 1 0\n1  10 0 0 10\n2  19 4 0 0 10\n2  20 5 0 0 10\n0\n\n0101000\n-33 0 +50 0 *\nEd\n 1e-07 1 1 0\n1  11 0 0 30\n2  21 6 0 0 30\n2  22 4 0 0 30\n0\n\n0101000\n-38 0 +33 0 *\nWi\n\n0101100\n-32 0 -31 0 +37 0 +49 0 *\nFa\n0  1e-07 4 0\n\n0111000\n+30 0 *\nEd\n 1e-07 1 1 0\n1  12 0 0 20\n2  23 6 0 0 20\n2  24 5 0 0 20\n0\n\n0101000\n-33 0 +45 0 *\nWi\n\n0101100\n-48 0 -32 0 +44 0 +28 0 *\nVe\n1e-07\n7 10 0\n0 0\n\n0101101\n*\nEd\n 1e-07 1 1 0\n1  13 0 0 6.28318530717959\n2  25 7 0 0 6.28318530717959\n2  26 8 0 0 6.28318530717959\n2  27 5 0 0 6.28318530717959\n0\n\n0101000\n+26 0 -26 0 *\nWi\n\n0101100\n-25 0 *\nFa\n0  1e-07 5 0\n\n0101000\n+27 0 +24 0 *\nWi\n\n0101100\n-42 0 -36 0 +31 0 +28 0 *\nFa\n0  1e-07 6 0\n\n0111000\n+22 0 *\nVe\n1e-07\n7 10 5\n0 0\n\n0101101\n*\nEd\n 1e-07 1 1 0\n1  14 0 0 6.28318530717959\n2  28 7 0 0 6.28318530717959\n2  29 9 0 0 6.28318530717959\n0\n\n0101000\n+20 0 -20 0 *\nEd\n 1e-07 1 1 0\n1  15 0 0 5\n3  30 31CN 7 0 0 5\n0\n\n0101000\n-20 0 +26 0 *\nWi\n\n0101100\n-19 0 +18 0 +25 0 -18 0 *\nFa\n0  1e-07 7 0\n\n0111000\n+17 0 *\nWi\n\n0101100\n+19 0 *\nVe\n1e-07\n6 10 5\n0 0\n\n0101101\n*\nEd\n 1e-07 1 1 0\n1  16 0 0 6.28318530717959\n2  32 9 0 0 6.28318530717959\n2  33 10 0 0 6.28318530717959\n0\n\n0101100\n+14 0 -14 0 *\nWi\n\n0101100\n-13 0 *\nFa\n0  1e-07 9 0\n\n0101000\n+15 0 +12 0 *\nVe\n1e-07\n6 10 8\n0 0\n\n0101101\n*\nEd\n 1e-07 1 1 0\n1  17 0 5 8\n3  34 35CN 10 0 5 8\n0\n\n0101000\n+14 0 -10 0 *\nEd\n 1e-07 1 1 0\n1  18 0 0 6.28318530717959\n2  36 10 0 0 6.28318530717959\n0\n\n0101000\n+10 0 -10 0 *\nWi\n\n0101100\n+9 0 +13 0 -9 0 -8 0 *\nFa\n0  1e-07 10 0\n\n0101000\n+7 0 *\nWi\n\n0101100\n+8 0 *\nFa\n0  1e-07 11 0\n\n0111000\n+5 0 *\nSh\n\n0101100\n-46 0 -39 0 +34 0 +29 0 -23 0 +21 0 -16 0 -11 0 -6 0 -4 0 \n*\nSo\n\n0100000\n+3 0 *\nCo\n\n1100000\n+2 0 *\n\n+1 0 ";
const descendantState=plain(hook.sketchModel);const deeperSource=plain(pocketSource);deeperSource.id='deep-source';deeperSource.points.find(p=>p.id==='rim').x=1;deeperSource.constraints[0].value=1;descendantState.sketches.push(deeperSource);descendantState.cuts.push({id:'deep-feature',sketchId:'deep-source',targetBodyId:'pocket-output',bodyId:'deep-output',depth:8});
const descendantExact=plain(hook.exactModel);descendantExact.bodies.push({id:'deep-output',name:'Deep pocket',brep:descendantCutBrep,color:'#abcd12',visible:true});hook.setSketchModel(descendantState,descendantExact);hook=useEditorDocuments(()=>[]);
const deletedAncestor=plain(hook.exactModel);deletedAncestor.bodies=deletedAncestor.bodies.filter(body=>body.id!=='pocket-output');hook.setExactModel(deletedAncestor);hook=useEditorDocuments(()=>[]);assert.equal(hook.sketchModel.cuts.length,0);assert.ok(hook.exactModel.bodies.some(body=>body.id==='static-box'));assert.ok(!hook.exactModel.bodies.some(body=>body.id==='deep-output'));assert.ok(hook.exactModel.bodies.some(body=>body.id==='independent'));assert.equal(hook.modelAnnotations.annotations.length,1);assert.equal(hook.sketchModel.sketches.length,2);
hook.modelUndo();hook=useEditorDocuments(()=>[]);assert.equal(hook.sketchModel.cuts.length,2);assert.equal(hook.exactModel.bodies.find(body=>body.id==='deep-output').brep,descendantCutBrep);
const deletedRoot=plain(hook.exactModel);deletedRoot.bodies=deletedRoot.bodies.filter(body=>body.id!=='static-box');hook.setExactModel(deletedRoot);hook=useEditorDocuments(()=>[]);assert.equal(hook.sketchModel.cuts.length,0);assert.ok(!hook.exactModel.bodies.some(body=>['pocket-output','deep-output'].includes(body.id)));assert.deepEqual(plain(hook.exactModel.bodies.map(body=>body.id)),['unrelated','independent']);hook.modelUndo();hook=useEditorDocuments(()=>[]);assert.equal(hook.sketchModel.cuts.length,2);assert.equal(hook.exactModel.bodies.find(body=>body.id==='pocket-output').brep,blindPocketBrep);
console.log('PASS multi-cut descendant cascade removes orphan outputs atomically, restores real BREP via Undo and preserves unrelated bodies/notes/sources');
