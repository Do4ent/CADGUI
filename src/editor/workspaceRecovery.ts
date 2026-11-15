/** Two generations, with validation before rotation. No read operation mutates storage. */
export const WORKSPACE_KEY='bendcore-documents-v1';
export const WORKSPACE_BACKUP_KEY=WORKSPACE_KEY+'-backup';
export type RecoveryStorage=Pick<Storage,'getItem'|'setItem'>;
export type RecoveryResult<T>={status:'primary'|'backup';value:T}|{status:'empty'|'unrecoverable';value:null};
export function readWorkspaceRecovery<T>(storage:RecoveryStorage,decode:(raw:string)=>T):RecoveryResult<T>{
 let encountered=false;
 for(const [key,status] of [[WORKSPACE_KEY,'primary'],[WORKSPACE_BACKUP_KEY,'backup']] as const){
  try{const raw=storage.getItem(key);if(raw===null)continue;encountered=true;return {status,value:decode(raw)};}catch{encountered=true;}
 }
 return {status:encountered?'unrecoverable':'empty',value:null};
}
export function saveWorkspaceRecovery<T>(storage:RecoveryStorage,next:string,decode:(raw:string)=>T):void{
 decode(next);
 const previous=storage.getItem(WORKSPACE_KEY);
 if(previous!==null){
  // Never rotate damaged primary data over the last valid backup.
  decode(previous);
  if(previous===next)return;
  // Backup failure aborts primary replacement, preserving the prior generation.
  storage.setItem(WORKSPACE_BACKUP_KEY,previous);
 }
 storage.setItem(WORKSPACE_KEY,next);
}

export const WORKSPACE_ARCHIVE_PREFIX=WORKSPACE_KEY+'-archive-';
export type ResumeStorage=RecoveryStorage&Pick<Storage,'removeItem'>;
type RecoveryArchive={primary:string|null;backup:string|null;key:string;raw:string};
const archives=new WeakMap<RecoveryStorage,RecoveryArchive>();
/** Explicit recovery action: preserve exact source bytes before replacing either slot. */
export function resumeWorkspaceRecovery<T>(storage:ResumeStorage,next:string,decode:(raw:string)=>T):{archiveKey:string}{
 decode(next);
 let source:RecoveryArchive;
 try{
 const primary=storage.getItem(WORKSPACE_KEY),backup=storage.getItem(WORKSPACE_BACKUP_KEY);
 let archive=archives.get(storage);
 if(!archive||archive.primary!==primary||archive.backup!==backup||storage.getItem(archive.key)!==archive.raw){
  let key='';
  for(let i=0;i<5;i++){const candidate=WORKSPACE_ARCHIVE_PREFIX+crypto.randomUUID();if(storage.getItem(candidate)===null){key=candidate;break;}}
  if(!key)throw Error('Не удалось создать отдельный архив исходных данных. Автосохранение остаётся отключённым.');
  const raw=JSON.stringify({version:1,createdAt:new Date().toISOString(),primary,backup});
  storage.setItem(key,raw);
  if(storage.getItem(key)!==raw)throw Error('Не удалось проверить архив. Исходные записи не изменены.');
  archive={primary,backup,key,raw};archives.set(storage,archive);
 }
 source=archive;
 }catch{throw Error('Не удалось прочитать или сохранить архив исходных данных. Основная и резервная записи не изменены. Освободите место или экспортируйте документы в JSON.');}
 const {primary,backup}=source;
 // Reads above (including archive checks) must succeed before any source-slot mutation.
 const previous=[[WORKSPACE_KEY,primary],[WORKSPACE_BACKUP_KEY,backup]] as const;
 try{
  storage.setItem(WORKSPACE_BACKUP_KEY,next);
  storage.setItem(WORKSPACE_KEY,next);
  if(storage.getItem(WORKSPACE_KEY)!==next||storage.getItem(WORKSPACE_BACKUP_KEY)!==next)throw Error('Проверка записи не пройдена');
 }catch{
  // Restore shrinking values first to release quota before restoring larger values.
  const restore=previous.map(([key,value])=>{let current:string|null=null;try{current=storage.getItem(key)}catch{/* Still attempt rollback. */}return {key,value,delta:(value===null?0:value.length+key.length)-(current===null?0:current.length+key.length)};}).sort((a,b)=>a.delta-b.delta);
  for(const {key,value}of restore)try{if(value===null)storage.removeItem(key);else storage.setItem(key,value)}catch{/* Report exact verification result below. */}
  let restored=false;try{restored=storage.getItem(WORKSPACE_KEY)===source.primary&&storage.getItem(WORKSPACE_BACKUP_KEY)===source.backup}catch{/* Unverified rollback remains a failure. */}
  throw Error(restored?'Не удалось возобновить автосохранение. Исходные записи восстановлены; архив сохранён. Освободите место или экспортируйте документы и повторите попытку.':'Не удалось возобновить автосохранение и подтвердить полный откат записей. Архив исходных данных сохранён; автосохранение остаётся отключённым. Экспортируйте документы в JSON.');
 }
 return {archiveKey:source.key};
}
