import {useEffect, useState} from 'react';
import {Dialog} from '../components/dialog/Dialog';
import {ParameterField} from '../components/dialog/ParameterField';
import type {ExactBody,Vec3} from '../kernel/types';
import type {FixedAssemblyMate} from './assemblyMates';
import {validateAssemblyInstances,type AssemblyInstance} from './assemblyInstances';

type Props = {
 instances: readonly AssemblyInstance[];
 displayInstances: readonly AssemblyInstance[];
 mates: readonly FixedAssemblyMate[];
 bodies: readonly ExactBody[];
 onAttach: (leaderId: string, followerId: string) => void;
 onDetach: (followerId: string) => void;
 onChange: (next: AssemblyInstance[]) => void;
};

export function AssemblyInstancesPanel({instances,displayInstances,mates,bodies,onAttach,onDetach,onChange}:Props) {
 const [draft,setDraft]=useState<{id:string;sourceBodyId:string;name:string;values:string[]}|null>(null);
 const [removing,setRemoving]=useState<AssemblyInstance|null>(null);
 const [error,setError]=useState('');
 const [mateDraft,setMateDraft]=useState<{leaderId:string;followerId:string}|null>(null);
 const [detaching,setDetaching]=useState<AssemblyInstance|null>(null);
 const followers=new Map(mates.map(mate=>[mate.followerId,mate.leaderId]));
 const available=instances.filter(instance=>bodies.some(body=>body.id===instance.sourceBodyId));
 const eligibleFollowers=(leaderId:string)=>{
  if(!leaderId)return [];
  const ancestors=new Set<string>();
  for(let id:string|undefined=leaderId;id!==undefined;id=followers.get(id))ancestors.add(id);
  return available.filter(instance=>!ancestors.has(instance.id)&&!followers.has(instance.id));
 };
 const eligibleLeaders=available.filter(instance=>eligibleFollowers(instance.id).length>0);
 useEffect(()=>{setDraft(null);setRemoving(null);setMateDraft(null);setDetaching(null);setError('');},[instances,bodies,mates]);
 const open=(instance?:AssemblyInstance)=>{
  if(!instance&&!bodies[0])return;
  setError('');
  setDraft(instance ? {...instance,values:[...instance.position,...instance.rotation].map(String)} :
   {id:crypto.randomUUID(),sourceBodyId:bodies[0].id,name:'Вхождение '+(instances.length+1),values:Array(6).fill('0')});
 };
 const current=()=>{
  if(!draft||draft.values.some(value=>!value.trim()))return null;
  const candidate:AssemblyInstance={id:draft.id,sourceBodyId:draft.sourceBodyId,name:draft.name.trim(),position:draft.values.slice(0,3).map(Number) as Vec3,rotation:draft.values.slice(3).map(Number) as Vec3};
  try{return validateAssemblyInstances([candidate],new Set(bodies.map(body=>body.id)))[0];}catch{return null;}
 };
 const submit=()=>{
  const candidate=current();if(!candidate)return;
  try{
   onChange(instances.some(instance=>instance.id===candidate.id)?instances.map(instance=>instance.id===candidate.id?candidate:instance):[...instances,candidate]);
   setDraft(null);
  }catch(e){setError(String(e));}
 };
 return <section aria-label="Вхождения деталей">
  <h3>Вхождения деталей</h3>
  <button type="button" disabled={!bodies.length||instances.length>=100} onClick={()=>open()}>Добавить вхождение</button>
  <button type="button" disabled={!eligibleLeaders.length} onClick={()=>{setError('');setMateDraft({leaderId:'',followerId:''});}}>Создать сопряжение</button>
  <ul>{displayInstances.map(instance=>{
   const leaderId=followers.get(instance.id);
   const leader=leaderId&&instances.find(item=>item.id===leaderId);
   const source=bodies.find(body=>body.id===instance.sourceBodyId);
   return <li key={instance.id} data-assembly-occurrence={instance.id}>
    <strong>{instance.name}</strong> · {source?.name??'Исходное тело подавлено'}
    <p>{instance.position.map(value=>Number(value.toFixed(6))).join(' / ')} мм · {instance.rotation.map(value=>Number(value.toFixed(6))).join(' / ')}°</p>
    <button type="button" disabled={!source||!!leader} onClick={()=>open(instance)}>Изменить вхождение</button>
    {leader&&<><p>Фиксированное сопряжение · {leader.name}</p><button type="button" onClick={()=>{setError('');setDetaching(instance);}}>Отсоединить сопряжение</button></>}
    <button type="button" onClick={()=>setRemoving(instance)}>Удалить вхождение</button>
   </li>;
  })}</ul>
  {error&&!draft&&!mateDraft&&!detaching&&<p role="alert">{error}</p>}
  {draft&&<Dialog open title="Вхождение детали" confirmDisabled={!current()} onConfirm={submit} onCancel={()=>setDraft(null)}>
   <label>Имя вхождения<input value={draft.name} maxLength={200} onChange={event=>setDraft({...draft,name:event.target.value})}/></label>
   <label>Исходное тело<select aria-label="Исходное тело" value={draft.sourceBodyId} onChange={event=>setDraft({...draft,sourceBodyId:event.target.value})}>
    {bodies.map(body=><option key={body.id} value={body.id}>{body.name}</option>)}
   </select></label>
   {draft.values.map((value,index)=>{
    const axis='XYZ'[index%3], offset=index<3;
    return <ParameterField key={index} label={(offset?'Смещение ':'Поворот ')+axis} icon={offset?'length':'angle'} unit={offset?'мм':'°'} value={value}
     onChange={next=>setDraft({...draft,values:draft.values.map((previous,i)=>i===index?next:previous)})}/>;
   })}
   <p>Повороты заданы в порядке Эйлера XYZ, смещение — в координатах сборки.</p>
   {!current()&&<p role="status">Введите имя и конечные значения в пределах ±1 000 000 мм и ±360°.</p>}
   {error&&<p role="alert">{error}</p>}
  </Dialog>}
  {mateDraft&&<Dialog open title="Фиксированное сопряжение" confirmDisabled={!mateDraft.leaderId||!mateDraft.followerId} onCancel={()=>setMateDraft(null)} onConfirm={()=>{
   try{onAttach(mateDraft.leaderId,mateDraft.followerId);setMateDraft(null);}catch(e){setError(String(e));}
  }}>
   <label>Ведущее вхождение<select value={mateDraft.leaderId} onChange={event=>setMateDraft({...mateDraft,leaderId:event.target.value,followerId:''})}>
    <option value="">Выберите вхождение</option>
    {eligibleLeaders.map(instance=><option key={instance.id} value={instance.id}>{instance.name}</option>)}
   </select></label>
   <label>Ведомое вхождение<select value={mateDraft.followerId} disabled={!mateDraft.leaderId} onChange={event=>setMateDraft({...mateDraft,followerId:event.target.value})}>
    <option value="">Выберите вхождение</option>
    {eligibleFollowers(mateDraft.leaderId).map(instance=><option key={instance.id} value={instance.id}>{instance.name}</option>)}
   </select></label>
   <p>Ведомое вхождение сохранит текущее положение относительно ведущего.</p>
   {error&&<p role="alert">{error}</p>}
  </Dialog>}
  {detaching&&<Dialog open title="Отсоединить сопряжение" onCancel={()=>setDetaching(null)} onConfirm={()=>{
   try{onDetach(detaching.id);setDetaching(null);}catch(e){setError(String(e));}
  }}><p>Вхождение «{detaching.name}» сохранит текущее положение.</p>{error&&<p role="alert">{error}</p>}</Dialog>}
  {removing&&<Dialog open title="Удаление вхождения" confirmLabel="Удалить" onCancel={()=>setRemoving(null)} onConfirm={()=>{
   try{onChange(instances.filter(instance=>instance.id!==removing.id));setRemoving(null);}catch(e){setError(String(e));}
  }}><p>Удалить вхождение «{removing.name}»?</p></Dialog>}
 </section>;
}
