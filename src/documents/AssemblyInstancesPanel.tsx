import {useEffect, useState} from 'react';
import {Dialog} from '../components/dialog/Dialog';
import type {ExactBody,Vec3} from '../kernel/types';
import type {AssemblyWorldPose,FixedAssemblyMate} from './assemblyMates';
import {validateAssemblyInstances,type AssemblyInstance} from './assemblyInstances';
import {rebaseAssemblyPose,type AssemblyGroup} from './assemblyHierarchy';
import {AssemblyGroupsEditor,AssemblyParentField,AssemblyPoseFields} from './AssemblyGroupsEditor';

type Props = {
 instances: readonly AssemblyInstance[];
 displayInstances: readonly AssemblyInstance[];
 groups: readonly AssemblyGroup[];
 paths: ReadonlyMap<string,readonly string[]>;
 world: ReadonlyMap<string,AssemblyWorldPose>;
 mates: readonly FixedAssemblyMate[];
 bodies: readonly ExactBody[];
 canCreateMate: boolean;
 onCreateMate: () => void;
 onDetach: (followerId: string) => void;
 onChange: (next: AssemblyInstance[]) => void;
 onGroupsChange: (next: AssemblyGroup[]) => void;
};

export function AssemblyInstancesPanel({instances,displayInstances,groups,paths,world,mates,bodies,canCreateMate,onCreateMate,onDetach,onChange,onGroupsChange}:Props) {
 const [draft,setDraft]=useState<{id:string;sourceBodyId:string;name:string;parentId:string;values:string[]}|null>(null);
 const [removing,setRemoving]=useState<AssemblyInstance|null>(null);
 const [error,setError]=useState('');
 const [detaching,setDetaching]=useState<AssemblyInstance|null>(null);
 const followers=new Map(mates.map(mate=>[mate.followerId,mate.leaderId]));
 const mated=new Set(mates.flatMap(mate=>[mate.leaderId,mate.followerId]));
 const groupNames=new Map(groups.map(group=>[group.id,group.name]));
 useEffect(()=>{setDraft(null);setRemoving(null);setDetaching(null);setError('');},[instances,bodies,mates,groups]);
 const open=(instance?:AssemblyInstance)=>{
  if(!instance&&!bodies[0])return;
  setError('');
  setDraft(instance ? {...instance,parentId:instance.parentId??'',values:[...instance.position,...instance.rotation].map(String)} :
   {id:crypto.randomUUID(),sourceBodyId:bodies[0].id,name:'Вхождение '+(instances.length+1),parentId:'',values:Array(6).fill('0')});
 };
 const current=()=>{
  if(!draft||draft.values.some(value=>!value.trim()))return null;
  const candidate:AssemblyInstance={id:draft.id,sourceBodyId:draft.sourceBodyId,name:draft.name.trim(),...(draft.parentId?{parentId:draft.parentId}:{}),position:draft.values.slice(0,3).map(Number) as Vec3,rotation:draft.values.slice(3).map(Number) as Vec3};
  try{return validateAssemblyInstances([candidate],new Set(bodies.map(body=>body.id)))[0];}catch{return null;}
 };
 const submit=()=>{
  const candidate=current();if(!candidate)return;
  try{
   onChange(instances.some(instance=>instance.id===candidate.id)?instances.map(instance=>instance.id===candidate.id?candidate:instance):[...instances,candidate]);
   setDraft(null);
  }catch(e){setError(String(e));}
 };
 const changeParent=(parentId:string)=>{
  if(!draft)return;
  try{
   const values=instances.some(instance=>instance.id===draft.id)?rebaseAssemblyPose(draft.values,world.get(draft.parentId),world.get(parentId)):draft.values;
   setDraft({...draft,parentId,values});setError('');
  }catch(e){setError(String(e));}
 };
 return <><AssemblyGroupsEditor groups={groups} instances={instances} paths={paths} world={world} onChange={onGroupsChange}/><section aria-label="Вхождения деталей">
  <h3>Вхождения деталей</h3>
  <button type="button" disabled={!bodies.length||instances.length>=100} onClick={()=>open()}>Добавить вхождение</button>
  <button type="button" disabled={!canCreateMate} onClick={onCreateMate}>Создать сопряжение</button>
  <ul>{displayInstances.map(instance=>{
   const leaderId=followers.get(instance.id);
   const leader=leaderId&&instances.find(item=>item.id===leaderId);
   const source=bodies.find(body=>body.id===instance.sourceBodyId);
   const path=paths.get(instance.id)??[instance.id];
   return <li key={instance.id} data-assembly-occurrence={instance.id} data-assembly-path={JSON.stringify(path)} data-assembly-world-position={JSON.stringify(instance.position)}>
    <strong>{[...path.slice(0,-1).map(id=>groupNames.get(id)),instance.name].join(' / ')}</strong> · {source?.name??'Исходное тело подавлено'}
    <p>{instance.position.map(value=>Number(value.toFixed(6))).join(' / ')} мм · {instance.rotation.map(value=>Number(value.toFixed(6))).join(' / ')}°</p>
    <button type="button" disabled={!source||!!leader} onClick={()=>open(instances.find(item=>item.id===instance.id))}>Изменить вхождение</button>
    {leader&&<><p>Фиксированное сопряжение · {leader.name}</p><button type="button" onClick={()=>{setError('');setDetaching(instance);}}>Отсоединить сопряжение</button></>}
    <button type="button" onClick={()=>setRemoving(instance)}>Удалить вхождение</button>
   </li>;
  })}</ul>
  {error&&!draft&&!detaching&&<p role="alert">{error}</p>}
  {draft&&<Dialog open title="Вхождение детали" confirmDisabled={!current()} onConfirm={submit} onCancel={()=>setDraft(null)}>
   <label>Имя вхождения<input value={draft.name} maxLength={200} onChange={event=>setDraft({...draft,name:event.target.value})}/></label>
   <label>Исходное тело<select aria-label="Исходное тело" value={draft.sourceBodyId} onChange={event=>setDraft({...draft,sourceBodyId:event.target.value})}>
    {bodies.map(body=><option key={body.id} value={body.id}>{body.name}</option>)}
   </select></label>
   <AssemblyParentField groups={groups} paths={paths} value={draft.parentId} disabled={mated.has(draft.id)} onChange={changeParent}/>
   <AssemblyPoseFields values={draft.values} onChange={values=>setDraft({...draft,values})}/>
   <p>Смещение и повороты XYZ заданы в системе координат родительской подсборки. Для переноса вхождения с фиксированным сопряжением сначала отсоедините сопряжение.</p>
   {!current()&&<p role="status">Введите имя и конечные значения в пределах ±1 000 000 мм и ±360°.</p>}
   {error&&<p role="alert">{error}</p>}
  </Dialog>}
  {detaching&&<Dialog open title="Отсоединить сопряжение" onCancel={()=>setDetaching(null)} onConfirm={()=>{
   try{onDetach(detaching.id);setDetaching(null);}catch(e){setError(String(e));}
  }}><p>Вхождение «{detaching.name}» сохранит текущее положение.</p>{error&&<p role="alert">{error}</p>}</Dialog>}
  {removing&&<Dialog open title="Удаление вхождения" confirmLabel="Удалить" onCancel={()=>setRemoving(null)} onConfirm={()=>{
   try{onChange(instances.filter(instance=>instance.id!==removing.id));setRemoving(null);}catch(e){setError(String(e));}
  }}><p>Удалить вхождение «{removing.name}»?</p></Dialog>}
 </section></>;
}
