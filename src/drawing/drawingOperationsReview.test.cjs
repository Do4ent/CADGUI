const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const cache=new Map();
function load(name){if(cache.has(name))return cache.get(name);const exports={};cache.set(name,exports);const source=fs.readFileSync(path.join(__dirname,name+'.ts'),'utf8');vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:name=>load(name.replace('./',''))});return exports;}
const m=load('model'),o=load('operations');const plain=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
const ctx={documentName:'Review',documentId:'review',modelItems:[]};
for(const kind of ['symbol','table','geometry']){
 const doc=m.createDrawingDocument(),entity=m.createTextEntity(kind,'Сохраняемый текст');
 if(kind==='symbol')entity.annotation={type:'balloon',number:'123',fields:{mode:'manual'}};
 if(kind==='table')entity.rows=[[[{runs:[{text:'Содержимое ячейки'}]}]]];
 if(kind==='geometry')entity.geometry={type:'line',points:[[0,0],[10,0]]};
 doc.sheets[0].entities.push(entity);const before=JSON.stringify(doc);
 const add=o.executeDrawingCommand(doc,[entity.id],'TXT-051',{value:'add',x:5,y:5},ctx);
 assert.equal(JSON.stringify(doc),before,'adding branch must not mutate input');
 const added=add.document.sheets[0].entities[0];
 assert.equal(added.kind,kind,kind+' semantic kind survives adding a branch');
 assert.equal(m.plainText(added,add.document,ctx),m.plainText(entity,doc,ctx),'semantic text remains available to the existing renderer');
 assert.deepEqual(plain(added.annotation),plain(entity.annotation));assert.deepEqual(plain(added.rows),plain(entity.rows));assert.deepEqual(plain(added.geometry),plain(entity.geometry));
 const branchId=added.leaders[0].id,addSnapshot=JSON.stringify(add.document);
 const remove=o.executeDrawingCommand(add.document,[entity.id],'TXT-051',{value:'remove',sourceId:branchId},ctx);
 assert.equal(JSON.stringify(add.document),addSnapshot,'removing branch must not mutate input');
 const removed=remove.document.sheets[0].entities[0];assert.equal(removed.kind,kind,kind+' semantic kind survives removing final branch');assert.equal(removed.leaders.length,0);assert.equal(m.plainText(removed,remove.document,ctx),m.plainText(entity,doc,ctx));
}
let doc=m.createDrawingDocument(),text=m.createTextEntity('text','Обычная заметка');doc.sheets[0].entities.push(text);
let result=o.executeDrawingCommand(doc,[text.id],'TXT-051',{value:'add'},ctx);assert.equal(result.document.sheets[0].entities[0].kind,'leader');result=o.executeDrawingCommand(result.document,[text.id],'TXT-051',{value:'remove'},ctx);assert.equal(result.document.sheets[0].entities[0].kind,'text','plain text/leader lifecycle remains available');
for(const invalidKind of ['table','symbol','geometry']){
 const doc=m.createDrawingDocument(),first=m.createTextEntity('text','Первый текст'),other=m.createTextEntity(invalidKind,'Второй текст');
 if(invalidKind==='table')other.rows=[[[{runs:[{text:'Не потерять ячейку'}]}]]];
 if(invalidKind==='symbol')other.annotation={type:'balloon',number:'42',fields:{mode:'manual'}};
 if(invalidKind==='geometry')other.geometry={type:'line',points:[[0,0],[25,0]]};
 doc.sheets[0].entities.push(first,other);const before=JSON.stringify(doc);
 assert.throws(()=>o.executeDrawingCommand(doc,[first.id,other.id],'TXT-085',{},ctx),/только текст/);
 assert.equal(JSON.stringify(doc),before,invalidKind+' rejection preserves every selected entity');
}
const doc2=m.createDrawingDocument(),left=m.createTextEntity('text','Первая'),right=m.createTextEntity('text','Вторая');left.y=10;right.y=20;right.paragraphs[0].runs.push({text:'',field:{kind:'document',key:'name'}});doc2.sheets[0].entities.push(left,right);const merged=o.executeDrawingCommand(doc2,[right.id,left.id],'TXT-085',{},ctx);assert.equal(merged.document.sheets[0].entities.length,1);assert.equal(m.plainText(merged.document.sheets[0].entities[0],merged.document,ctx),'Первая\nВтораяReview');assert.ok(merged.document.sheets[0].entities[0].paragraphs[1].runs[1].field,'valid text merge preserves live fields');
console.log('PASS: leader branches preserve semantic kinds and merge rejects non-text data without mutation');
