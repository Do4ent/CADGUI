import {OcctKernel,type OcctModuleFactory} from 'occt-wasm';
// Separate replaceable assets: Vite emits both at the configured application base.
import glueUrl from 'occt-wasm/dist/occt-wasm.js?url';
import wasmUrl from 'occt-wasm/dist/occt-wasm.wasm?url';
import {ExactKernelBackend} from './backend';
import type {KernelRequest,KernelWorkerReply} from './types';
let initialized:Promise<ExactKernelBackend>|null=null;
function backend(){return initialized??=import(/* @vite-ignore */ glueUrl).then(async module=>new ExactKernelBackend(await OcctKernel.init({createModule:module.default as OcctModuleFactory,wasm:wasmUrl}))).catch(error=>{initialized=null;throw error;});}
let queue=Promise.resolve();
self.onmessage=(event:MessageEvent<{id:number;request:KernelRequest}>)=>{
 const {id,request}=event.data;
 queue=queue.then(async()=>{
  try{const result=(await backend()).execute(request);self.postMessage({id,result} satisfies KernelWorkerReply);}
  catch(error){self.postMessage({id,error:error instanceof Error?error.message:'Ошибка геометрического ядра'} satisfies KernelWorkerReply);}
 });
};
