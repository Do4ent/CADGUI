const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/client.ts','utf8').replace('import.meta.url',"'file:///kernel/client.ts'");
const moduleObject={exports:{}};const workers=[];
class FakeWorker{constructor(){this.messages=[];this.stopped=false;workers.push(this)}postMessage(v){this.messages.push(v)}terminate(){this.stopped=true}reply(result){this.onmessage({data:{id:this.messages.at(-1).id,result}})}}
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:moduleObject.exports,require,Worker:FakeWorker,URL,setTimeout,clearTimeout});
(async()=>{
 const {KernelClient}=moduleObject.exports,c=new KernelClient(()=>new FakeWorker(),1000),request={op:'inspect',brep:'a'};
 const a=c.execute(request),b=c.execute(request);assert.equal(a,b);assert.equal(workers[0].messages.length,1);
 workers[0].reply({brep:'a',volume:24});assert.equal((await a).volume,24);assert.equal(await b,await a);
 const box=c.execute({op:'box',size:[2,3,4],origin:[0,0,0]});workers[0].reply({brep:'new',volume:24});await box;const count=workers[0].messages.length;await c.execute({op:'inspect',brep:'new'});assert.equal(workers[0].messages.length,count,'creation result supplies all viewports without remeshing');
 const old=c.execute({op:'inspect',brep:'pending'});c.reset();await assert.rejects(old,/отменено/);assert.equal(workers[0].stopped,true);const fresh=c.execute(request);assert.equal(workers.length,2);workers[1].reply({brep:'a',volume:6});assert.equal((await fresh).volume,6,'reset invalidates prior geometry cache');c.reset();
 const timeoutClient=new KernelClient(()=>new FakeWorker(),5);await assert.rejects(timeoutClient.execute(request),/время/);assert.equal(workers.at(-1).stopped,true);
 const errorClient=new KernelClient(()=>new FakeWorker(),1000);const failed=errorClient.execute(request);workers.at(-1).onerror({preventDefault(){}});await assert.rejects(failed,/WebAssembly/);const retry=errorClient.execute(request);workers.at(-1).reply({brep:'a',volume:3});assert.equal((await retry).volume,3);errorClient.reset();
 console.log('PASS kernel client deduplication, shared viewport cache, reset, timeouts and real-error retry routing');
})().catch(e=>{console.error(e);process.exitCode=1});
