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
