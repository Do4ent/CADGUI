import type {KernelOutput,KernelRequest,KernelWorkerReply} from './types';
type Pending={resolve:(result:KernelOutput)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>};
/** One serialized worker; a timeout terminates its WASM instance. Late replies
 * are never delivered to a caller after reset. UI/document revision guards
 * provide the independent protection against committing to another document. */
export class KernelClient{
 private worker:Worker|null=null;private serial=0;private pending=new Map<number,Pending>();
 constructor(private factory:()=>Worker=()=>new Worker(new URL('./worker.ts',import.meta.url),{type:'module'}),private timeoutMs=45_000){}
 private start(){
  if(this.worker)return this.worker;
  const worker=this.factory();this.worker=worker;
  worker.onmessage=(event:MessageEvent<KernelWorkerReply>)=>{const reply=event.data,pending=this.pending.get(reply.id);if(!pending)return;clearTimeout(pending.timer);this.pending.delete(reply.id);if('error' in reply)pending.reject(new Error(reply.error));else pending.resolve(reply.result);};
  worker.onerror=event=>{event.preventDefault();this.reset('Не удалось запустить Open CASCADE WebAssembly. Повторите операцию в современном браузере.');};
  worker.onmessageerror=()=>this.reset('Повреждён ответ геометрического ядра');return worker;
 }
 execute(request:KernelRequest):Promise<KernelOutput>{return new Promise((resolve,reject)=>{
  let worker:Worker;try{worker=this.start();}catch(error){reject(error instanceof Error?error:new Error(String(error)));return;}
  const id=++this.serial,timer=setTimeout(()=>this.reset('Превышено время вычисления геометрии. Ядро перезапущено; документ не изменён.'),this.timeoutMs);
  this.pending.set(id,{resolve,reject,timer});try{worker.postMessage({id,request});}catch(error){clearTimeout(timer);this.pending.delete(id);reject(error instanceof Error?error:new Error(String(error)));}
 });}
 reset(message='Вычисление отменено; документ не изменён.'){
  this.worker?.terminate();this.worker=null;
  for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new Error(message));}this.pending.clear();
 }
}
export const kernelClient=new KernelClient();
