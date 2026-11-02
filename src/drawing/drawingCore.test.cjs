const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),path=require('node:path');
const cache={};
function load(name){if(cache[name])return cache[name];const exports={};cache[name]=exports;const js=ts.transpileModule(fs.readFileSync(path.join(__dirname,name+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInNewContext(js,{exports,require:name=>load(name.replace('./','')),console});return exports;}
const m=load('model'),o=load('operations'),l=load('layout'),d=load('diagnostics');
const json=x=>JSON.parse(JSON.stringify(x));let checks=0;
const equal=(a,b)=>{checks++;assert.deepEqual(json(a),json(b));},ok=(v,msg)=>{checks++;assert.ok(v,msg);},throws=(fn,match)=>{checks++;assert.throws(fn,match)};
const ctx={documentName:'Сборка',documentId:'doc1',modelItems:[{id:'model1',name:'Вал',kind:'cylinder',size:[10,20,10],pos:[1,2,3],color:'#ffffff',visible:true,group:'Детали'}]};
let doc=m.createDrawingDocument();equal(m.validateDrawingDocument(doc),doc);const validated=m.validateDrawingDocument(doc);validated.properties.title='Изменение';equal(doc.properties.title,'');
for(const invalid of [null,[],{}, {...doc,version:2},{...doc,activeSheetId:'missing'},{...doc,unexpected:true},{...doc,styles:[{...doc.styles[0],fontFamily:'Arial;url(x)'}]},{...doc,styles:[{...doc.styles[0],color:'url(javascript:x)'}]},{...doc,styles:[{...doc.styles[0],height:NaN}]}])throws(()=>m.validateDrawingDocument(invalid));
let dupe=m.cloneDrawing(doc);dupe.sheets.push(m.cloneDrawing(doc.sheets[0]));throws(()=>m.validateDrawingDocument(dupe),/duplicate/);
for(const formula of ['1+2*3','(1+2)*3','-4+2','2e3/2'])ok(Number.isFinite(m.evaluateDrawingFormula(formula)));
equal(m.evaluateDrawingFormula('1+2*3'),7);equal(m.evaluateDrawingFormula('(1+2)*3'),9);equal(m.evaluateDrawingFormula('-4+2'),-2);
for(const formula of ['1/0','Infinity','globalThis.process','Math.random()','1+','1 2','__proto__','(()=>1)()'])throws(()=>m.evaluateDrawingFormula(formula));
equal(m.resolveField({kind:'model',targetId:'model1',key:'size.y',precision:2,unit:'mm',prefix:'L='},doc,ctx),{value:'L=20.00 mm',broken:false});
equal(m.resolveField({kind:'model',targetId:'model1',key:'mass'},doc,ctx).broken,true);
equal(m.resolveField({kind:'document',key:'constructor'},doc,ctx).broken,true);
equal(m.resolveField({kind:'formula',key:'2*(3+4)'},doc,ctx).value,'14');
equal(m.resolveField({kind:'sheet',targetId:'sheet-1',key:'number'},doc,ctx).value,'1');
function execute(id,input={},selection=[]){const before=JSON.stringify(doc);const result=o.executeDrawingCommand(doc,selection,id,input,ctx);equal(JSON.stringify(doc),before);doc=result.document;return result;}
let created=execute('TXT-002',{text:'Привет\nWorld',x:10,y:10}),sel=created.selection;let entity=doc.sheets[0].entities[0];equal(m.plainText(entity),'Привет\nWorld');
throws(()=>o.executeDrawingCommand(doc,sel,'TXT-010',{number:Infinity},ctx));throws(()=>o.executeDrawingCommand(doc,sel,'TXT-009',{fontFamily:'Arial";bad'},ctx));
execute('TXT-011',{options:{bold:true,start:0,end:3}},sel);entity=doc.sheets[0].entities[0];equal(entity.paragraphs[0].runs.map(r=>[r.text,!!r.format?.bold]),[['При',true],['вет',false]]);
execute('TXT-012',{options:{underline:true}},sel);execute('TXT-013',{options:{color:'#ff0000'}},sel);execute('TXT-014',{number:1.25},sel);execute('TXT-015',{number:10},sel);execute('TXT-016',{number:0.1},sel);
execute('TXT-018',{options:{anchor:'middle-center'}},sel);execute('TXT-019',{value:'right'},sel);execute('TXT-020',{number:1.5},sel);execute('TXT-021',{options:{spaceBefore:1,spaceAfter:2}},sel);execute('TXT-022',{options:{indent:2,firstIndent:-1},text:'10 20 30'},sel);execute('TXT-023',{value:'number',number:3},sel);execute('TXT-024',{number:2,options:{gap:2}},sel);
execute('TXT-025',{value:'nbsp'},sel);execute('TXT-026',{x:30,y:40},sel);execute('TXT-027',{angle:45},sel);execute('TXT-032',{number:40},sel);execute('TXT-033',{value:'x',number:100},sel);
execute('TXT-034',{text:'Новый стиль'},sel);ok(doc.styles.length===2);execute('TXT-035',{styleId:doc.styles[1].id},sel);execute('TXT-037',{},sel);equal(doc.sheets[0].entities[0].overrides,{});
execute('TXT-038',{value:'ГОСТ'},sel);execute('TXT-039',{options:{scaleMode:'model'}},sel);execute('TXT-040',{options:{layer:'Примечания',printable:false}},sel);execute('TXT-042',{options:{mask:true,maskColor:'#ffffff',maskPadding:1,frame:'rectangle'}},sel);
execute('TXT-043',{text:'⌀ ± μ'},sel);execute('TXT-044',{value:'super',options:{start:0,end:3}},sel);execute('TXT-045',{text:'1',value:'2'},sel);execute('TXT-046',{text:'+0.1',value:'-0.2'},sel);
execute('TXT-059',{field:{kind:'document',key:'name'}},sel);execute('TXT-060',{field:{kind:'model',targetId:'model1',key:'name'}},sel);execute('TXT-061',{field:{kind:'formula',key:'1+2'}},sel);execute('TXT-062',{field:{kind:'model',targetId:'model1',key:'size.y',precision:1,unit:'mm'}},sel);
const live=m.plainText(doc.sheets[0].entities[0],doc,ctx);ok(live.includes('Вал'));execute('TXT-066',{value:'freeze'},sel);ok(doc.sheets[0].entities[0].paragraphs.flatMap(p=>p.runs).some(r=>r.field?.frozen));execute('TXT-066',{value:'restore'},sel);
execute('TXT-063',{text:'Шаблон'},sel);ok(doc.templates.length===1);execute('TXT-071',{templateId:doc.templates[0].id,x:80,y:20});ok(doc.sheets[0].entities.length===2);ok(doc.sheets[0].entities[0].id!==doc.sheets[0].entities[1].id);
execute('TXT-075',{find:'Привет',replace:'Здравствуйте',scope:'document'});execute('TXT-077',{value:'upper'},sel);ok(m.plainText(doc.sheets[0].entities[0],doc,ctx).includes('Вал'),'case preserves live fields');
execute('TXT-069',{text:'Инженерная фраза',options:{save:true}},sel);equal(doc.dictionary,['Инженерная фраза']);
let tt=execute('TXT-067',{text:'Снять заусенцы\nПокрытие'});const ttId=tt.selection[0];let flag=execute('TXT-057',{sourceId:ttId,number:2});equal(m.plainText(doc.sheets[0].entities.find(e=>e.id===flag.selection[0]),doc,ctx),'2');
execute('TXT-074',{field:{kind:'technical',targetId:ttId,key:'1'}},sel);
let balloon=execute('TXT-056',{value:'5'});execute('TXT-079',{number:12},balloon.selection);equal(doc.sheets[0].entities.find(e=>e.id===balloon.selection[0]).annotation.number,'12');
const lead=execute('TXT-005',{text:'Заметка',x:50,y:50});execute('TXT-051',{},lead.selection);execute('TXT-052',{value:'arc'},lead.selection);execute('TXT-053',{value:'dot',number:3,options:{landing:4}},lead.selection);execute('TXT-054',{sourceId:'model1'},lead.selection);equal(doc.sheets[0].entities.find(e=>e.id===lead.selection[0]).leaders[0].attachment,{modelItemId:'model1'});
execute('TXT-048',{text:'0.1',value:'gdt',options:{symbol:'⌖'}});execute('TXT-049',{text:'Ra 3.2',value:'surface'});
const table=execute('TXT-007',{text:'Ячейка',options:{rows:2,columns:2}});ok(m.plainText(doc.sheets[0].entities.find(e=>e.id===table.selection[0])).includes('Ячейка'));
const title=execute('TXT-008');ok(m.plainText(doc.sheets[0].entities.find(e=>e.id===title.selection[0]),doc,ctx).includes('Обозначение'));
execute('TXT-100',{value:'save',text:'Первая'});ok(doc.revisions.length===1);const rev=execute('TXT-100');ok(JSON.parse(rev.message).changed.length===0);
const readonlyBefore=JSON.stringify(doc);for(const id of ['TXT-073','TXT-081','TXT-082','TXT-094','TXT-095','TXT-096','TXT-098','TXT-099','TXT-101']){execute(id);equal(JSON.stringify(doc),readonlyBefore);}
const text=m.createTextEntity('text','one two three four');doc.sheets[0].entities.push(text);text.width=10;text.height=3;
let layout=l.layoutText(text,doc,ctx,(text,style)=>Array.from(text).length*style.height*0.5);ok(layout.lines.length>1);ok(layout.overflow);equal(layout.approximate,false);
text.width=0;text.height=0;layout=l.layoutText(text,doc,ctx);equal(layout.lines.length,1);equal(layout.approximate,true);
const badRef=m.createTextEntity('text','');badRef.paragraphs=[{runs:[{text:'',field:{kind:'model',targetId:'absent',key:'name'}}]}];doc.sheets[0].entities.push(badRef);ok(d.diagnoseDrawing(doc,ctx).some(x=>x.code==='broken-field'));
for(const id of ['TXT-017','TXT-041','TXT-050','TXT-065','TXT-078','TXT-087','TXT-088','TXT-089','TXT-090','TXT-091','TXT-092','TXT-093','TXT-102'])throws(()=>o.executeDrawingCommand(doc,sel,id,{},ctx));
throws(()=>o.executeDrawingCommand(doc,sel,'TXT-103',{},ctx));
const locked=m.cloneDrawing(doc);locked.sheets[0].entities[0].locked=true;throws(()=>o.executeDrawingCommand(locked,sel,'TXT-010',{number:5},ctx),/заблокирован/);
const fullDraft=m.createTextEntity('text','rich');fullDraft.paragraphs=[{runs:[{text:'жирный',format:{bold:true}},{text:'',field:{kind:'model',targetId:'model1',key:'name'}}]}];
const richCreated=execute('TXT-002',{entity:fullDraft});const richId=richCreated.selection[0];let rich=doc.sheets[0].entities.find(e=>e.id===richId);ok(rich.id!==fullDraft.id);equal(rich.paragraphs,fullDraft.paragraphs);
const edited=m.cloneDrawing(rich);edited.id='untrusted-draft-id';edited.paragraphs[0].runs[0].text='правка';execute('TXT-003',{entity:edited},[richId]);rich=doc.sheets[0].entities.find(e=>e.id===richId);equal(rich.id,richId);equal(rich.paragraphs[0].runs[0].text,'правка');ok(rich.paragraphs[0].runs[1].field);
const richLeader=m.createTextEntity('leader','Указание');richLeader.leaders=[{id:'original-branch',points:[[1,2],[3,4]],shape:'arc',arrow:'open',arrowSize:3,landing:4}];const madeLeader=execute('TXT-005',{entity:richLeader});const newLeader=doc.sheets[0].entities.find(e=>e.id===madeLeader.selection[0]);ok(newLeader.leaders[0].id!=='original-branch');equal(newLeader.leaders[0].shape,'arc');
const tsv=execute('TXT-007',{text:'A\tB\nC\tD',options:{rows:2,columns:2,tsv:true}});equal(doc.sheets[0].entities.find(e=>e.id===tsv.selection[0]).rows[1][1][0].runs[0].text,'D');
throws(()=>o.executeDrawingCommand(doc,[],'TXT-007',{text:'A\tB',options:{rows:1,columns:1,tsv:true}},ctx),/TSV/);
const stamp=execute('TXT-008',{options:{title:'Деталь',designation:'АБВ.001',author:'Иванов'}});const stampText=m.plainText(doc.sheets[0].entities.find(e=>e.id===stamp.selection[0]),doc,ctx);ok(stampText.includes('АБВ.001'));ok(stampText.includes('Иванов'));equal(doc.properties.title,'Деталь');
const overflowDoc=m.cloneDrawing(doc);overflowDoc.styles[0].height=Number.MAX_VALUE;overflowDoc.styles[0].widthFactor=2;throws(()=>m.validateDrawingDocument(overflowDoc),/derived text size/);
execute('TXT-066',{value:'freeze'},stamp.selection);let stampEntity=doc.sheets[0].entities.find(e=>e.id===stamp.selection[0]);ok(stampEntity.rows.flatMap(row=>row.flat()).flatMap(p=>p.runs).filter(r=>r.field).every(r=>r.field.frozen!==undefined),'table live fields freeze too');
execute('TXT-066',{value:'restore'},stamp.selection);execute('TXT-011',{options:{bold:true}},stamp.selection);stampEntity=doc.sheets[0].entities.find(e=>e.id===stamp.selection[0]);ok(stampEntity.rows.flatMap(row=>row.flat()).flatMap(p=>p.runs).every(r=>r.format?.bold),'table cell formatting is included');
execute('TXT-068',{number:1},[ttId]);const continuedFlag=doc.sheets[0].entities.find(e=>e.id===flag.selection[0]);ok(continuedFlag.reference.targetId!==ttId);equal(m.plainText(continuedFlag,doc,ctx),'2');ok(!d.diagnoseDrawing(doc,ctx).some(issue=>issue.entityId===continuedFlag.id&&issue.code==='broken-field'));
// Font policies are data, never destructive font replacement or executable CSS.
const fontDoc=m.createDrawingDocument(),fontEntity=m.createTextEntity('text','Шрифт');fontDoc.sheets[0].entities.push(fontEntity);
fontDoc.properties['fontFallback:Arial']='Liberation Sans';const fontSnapshot=JSON.stringify(fontDoc);
equal(m.resolveStyle(fontDoc,fontEntity).fontFamily,'Liberation Sans');equal(fontDoc.styles[0].fontFamily,'Arial');equal(JSON.stringify(fontDoc),fontSnapshot);
fontDoc.properties['fontFallback:Liberation Sans']='Noto Sans';equal(m.resolveStyle(fontDoc,fontEntity).fontFamily,'Noto Sans');equal(m.validateDrawingDocument(fontDoc).properties['fontFallback:Arial'],'Liberation Sans');
const overrideFont=m.cloneDrawing(fontEntity);overrideFont.overrides.fontFamily='Engineering Font';fontDoc.properties['fontFallback:Engineering Font']='Noto Serif';equal(m.resolveStyle(fontDoc,overrideFont).fontFamily,'Noto Serif');equal(overrideFont.overrides.fontFamily,'Engineering Font');equal(fontDoc.styles[0].fontFamily,'Arial');
const noPolicy=m.createDrawingDocument();noPolicy.properties.fontFallbackDescription='plain descriptive metadata';equal(m.resolveStyle(noPolicy,m.createTextEntity()).fontFamily,'Arial');equal(m.validateDrawingDocument(noPolicy).properties.fontFallbackDescription,'plain descriptive metadata');
for(const properties of [
 {'fontFallback:Arial':'Arial'},
 {'fontFallback:Arial':'Noto Sans','fontFallback:Noto Sans':'Arial'},
 {'fontFallback:Arial':'First','fontFallback:First':'Second','fontFallback:Second':'First'}
]){const cyclic=m.createDrawingDocument();cyclic.properties=properties;throws(()=>m.validateDrawingDocument(cyclic),/cycle/);throws(()=>m.resolveStyle(cyclic,m.createTextEntity()),/Цикл/);}
for(const target of ['', '   ', 'Arial; color:red', 'url(https://example.invalid/font)', 'Arial" onload="x', '#badfont']){const unsafe=m.createDrawingDocument();unsafe.properties['fontFallback:Arial']=target;throws(()=>m.validateDrawingDocument(unsafe));throws(()=>m.resolveStyle(unsafe,m.createTextEntity()));}
for(const source of ['', 'Bad;Font','url(font)']){const unsafe=m.createDrawingDocument();unsafe.properties['fontFallback:'+source]='Arial';throws(()=>m.validateDrawingDocument(unsafe));}
const inherited=m.createDrawingDocument();inherited.properties=Object.assign(Object.create({'fontFallback:Arial':'Unexpected Font'}),{title:'ordinary property'});equal(m.resolveStyle(inherited,m.createTextEntity()).fontFamily,'Arial');
console.log(`PASS: ${checks} drawing core schema, fields, operations, layout and diagnostic checks`);
