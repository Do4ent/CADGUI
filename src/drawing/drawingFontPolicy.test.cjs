const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const cache={};
function load(name){
 if(cache[name])return cache[name];
 const exports={};cache[name]=exports;
 const source=ts.transpileModule(fs.readFileSync(path.join(__dirname,name+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(source,{exports,require:id=>load(id.replace('./',''))});
 return exports;
}
const {resolveFontFamily}=load('fontPolicy'),{layoutText}=load('layout'),m=load('model');
const document=m.createDrawingDocument();
document.properties['fontFallback:Missing Base']='Liberation Sans';
document.properties['fontFallback:Engineering Font']='Intermediate Font';
document.properties['fontFallback:Intermediate Font']='Noto Serif';
document.styles[0].fontFamily='Missing Base';
const entity=m.createTextEntity('text','unused');
entity.width=40;entity.height=0;
entity.paragraphs=[{list:'number',runs:[
 {text:'AB CD',format:{fontFamily:'Engineering Font',bold:true,height:5}},
 {text:' field',format:{fontFamily:'Engineering Font'},field:{kind:'document',key:'name'}},
 {text:' stack',format:{fontFamily:'Engineering Font'},stack:{top:'1',bottom:'2',kind:'fraction'},script:'super'},
 {text:' inherited'}
]}];
document.sheets[0].entities.push(entity);
const before=JSON.stringify(document);
const measured=[];
const layout=layoutText(entity,document,{documentName:'Field',documentId:'doc',modelItems:[]},(text,style)=>{
 measured.push({text,fontFamily:style.fontFamily,bold:style.bold,height:style.height});
 return text.length*(style.fontFamily==='Noto Serif'?1:2);
});
assert.equal(JSON.stringify(document),before,'layout must retain original font references');
assert.equal(resolveFontFamily(document,'Engineering Font'),'Noto Serif');
assert.equal(resolveFontFamily(document,'Unmapped Font'),'Unmapped Font');
assert.ok(measured.some(run=>run.text==='AB'&&run.fontFamily==='Noto Serif'&&run.bold&&run.height===5),'measurement receives mapped character font and preserved formatting');
assert.ok(measured.some(run=>run.text==='Field'&&run.fontFamily==='Noto Serif'),'live fields use mapped character fonts');
assert.ok(measured.some(run=>run.text==='1/2'&&run.fontFamily==='Noto Serif'),'stacked text uses mapped character fonts');
assert.ok(measured.some(run=>run.text==='1. '&&run.fontFamily==='Liberation Sans'),'list prefixes inherit resolved entity font');
assert.ok(layout.lines.flatMap(line=>line.runs).some(run=>run.text==='AB'&&run.style.fontFamily==='Noto Serif'));
assert.ok(layout.lines.flatMap(line=>line.runs).every(run=>!['Engineering Font','Missing Base','Intermediate Font'].includes(run.style.fontFamily)));
const narrow=m.createTextEntity('text','');narrow.width=11;narrow.height=0;narrow.paragraphs=[{runs:[{text:'AB CD',format:{fontFamily:'Engineering Font'}}]}];
const narrowLayout=layoutText(narrow,document,undefined,(text,style)=>text.length*(style.fontFamily==='Noto Serif'?2:10));
assert.equal(narrowLayout.lines.length,1,'wrapping uses substituted font metrics, not requested missing-font metrics');
assert.equal(narrowLayout.width,10);
for(const policies of [
 {'fontFallback:Engineering Font':'Engineering Font'},
 {'fontFallback:Engineering Font':'Other','fontFallback:Other':'Engineering Font'},
 {'fontFallback:Engineering Font':'Other','fontFallback:Other':'Third','fontFallback:Third':'Other'}
]){
 const cyclic=m.createDrawingDocument();cyclic.properties=policies;
 assert.throws(()=>resolveFontFamily(cyclic,'Engineering Font'),/Цикл/);
 assert.throws(()=>layoutText(narrow,cyclic),/Цикл/,'run-only fallback cycles fail deterministically');
}
for(const value of ['', '   ', 'Arial; color:red', 'url(x)', 'Bad"Font', '#bad', 'X'.repeat(121), 42, null]){
 const unsafe=m.createDrawingDocument();unsafe.properties['fontFallback:Engineering Font']=value;
 assert.throws(()=>resolveFontFamily(unsafe,'Engineering Font'),/Недопустимое/);
 assert.throws(()=>layoutText(narrow,unsafe),/Недопустимое/);
}
for(const family of ['', ' ', 'url(x)', 'Bad"Font'])assert.throws(()=>resolveFontFamily(document,family));
const inherited=m.createDrawingDocument();
inherited.properties=Object.assign(Object.create({'fontFallback:Engineering Font':'Unexpected'}),{title:'test'});
assert.equal(resolveFontFamily(inherited,'Engineering Font'),'Engineering Font','prototype properties cannot alter document policy');
console.log('PASS: run-font fallback chains, measured wrapping, source preservation, cycle/unsafe rejection and own-property policy');
