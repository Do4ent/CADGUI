/** Adapter test uses real jsPDF/fonts; SVG traversal is a controlled boundary double.
 * Full SVG geometry fidelity requires the browser acceptance checks. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),os=require('node:os');
const ts=require('typescript');
const root=path.resolve(__dirname,'../../..');
const fonts=path.join(root,'public/fonts');
let conversions=0,converted;
const convert=async (svg,pdf,options)=>{
 conversions++;converted=svg;assert.equal(options.width,297);assert.equal(options.height,210);
 assert.equal(svg.geometryMarker,'paths masks frames leaders tables');
 pdf.text(svg.textContent,10,20);
};
const exp={};
const source=fs.readFileSync(path.join(__dirname,'pdf.ts'),'utf8');
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
 exports:exp,require:id=>id==='svg2pdf.js'?{svg2pdf:convert}:require(id),URL,document:{baseURI:'http://localhost/app/'},btoa,
 fetch:async url=>{const filename=path.basename(url.pathname);const data=fs.readFileSync(path.join(fonts,filename));return {ok:true,arrayBuffer:async()=>data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength)};}
});
function svg(box='0 0 297 210'){
 const text={style:{fontFamily:'Arial'},getAttribute:()=>null,setAttribute(){}};
 const result={textContent:'Чертёж Ø ± ½',geometryMarker:'paths masks frames leaders tables',getAttribute:key=>key==='viewBox'?box:null,setAttribute(){},querySelectorAll:(selector)=>selector?.includes("data-drawing-ui")?[]:[text],cloneNode:()=>svg(box)};
 return result;
}
(async()=>{
 await assert.rejects(()=>exp.exportDrawingPdf(svg('0 0 NaN 210')),/размер/);
 await assert.rejects(()=>exp.exportDrawingPdf(svg('0 0 6000 210')),/5080/);
 assert.equal(conversions,0);
 const original=svg();const result=await exp.exportDrawingPdf(original);
 assert.equal(conversions,1);assert.notEqual(converted,original);
 assert.equal(original.querySelectorAll()[0].style.fontFamily,'Arial');
 assert.equal(converted.querySelectorAll()[0].style.fontFamily,'DejaVu Sans');
 assert.ok(result.warnings.some(w=>w.includes('заменены')));
 const bytes=Buffer.from(await result.blob.arrayBuffer());
 assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
 assert.ok(bytes.includes(Buffer.from('/ToUnicode')),'embedded Unicode mapping');
 assert.ok(bytes.length>10000,'actual embedded font data');
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'bendcore-pdf-'));
 try{
  const filename=path.join(directory,'drawing.pdf');fs.writeFileSync(filename,bytes);
  const extraction=require('node:child_process').spawnSync('pdftotext',[filename,'-'],{encoding:'utf8'});
  if(extraction.error?.code==='ENOENT')console.log('SKIP pdftotext: utility unavailable');
  else {assert.equal(extraction.status,0,extraction.stderr);assert.ok(extraction.stdout.includes('Чертёж Ø ± ½'),extraction.stdout);}
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
 console.log('PASS vector PDF adapter boundary, embedded fonts, searchable Cyrillic text and page validation');
})().catch(error=>{console.error(error);process.exitCode=1;});
