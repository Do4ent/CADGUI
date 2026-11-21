import {useEffect, useState} from 'react';
import {Dialog} from '../components/dialog/Dialog';
import {ParameterField} from '../components/dialog/ParameterField';
import type {ExactBody,Vec3} from '../kernel/types';
import {validateAssemblyInstances,type AssemblyInstance} from './assemblyInstances';

type Props = {
 instances: readonly AssemblyInstance[];
 bodies: readonly ExactBody[];
 onChange: (next: AssemblyInstance[]) => void;
};

export function AssemblyInstancesPanel({instances,bodies,onChange}:Props) {
 const [draft,setDraft]=useState<{id:string;sourceBodyId:string;name:string;values:string[]}|null>(null);
 const [removing,setRemoving]=useState<AssemblyInstance|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{setDraft(null);setRemoving(null);setError('');},[instances,bodies]);
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
  <ul>{instances.map(instance=>{
   const source=bodies.find(body=>body.id===instance.sourceBodyId);
   return <li key={instance.id} data-assembly-occurrence={instance.id}>
    <strong>{instance.name}</strong> · {source?.name??'Исходное тело подавлено'}
    <p>{instance.position.join(' / ')} мм · {instance.rotation.join(' / ')}°</p>
    <button type="button" disabled={!source} onClick={()=>open(instance)}>Изменить вхождение</button>
    <button type="button" onClick={()=>setRemoving(instance)}>Удалить вхождение</button>
   </li>;
  })}</ul>
  {error&&!draft&&<p role="alert">{error}</p>}
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
  {removing&&<Dialog open title="Удаление вхождения" confirmLabel="Удалить" onCancel={()=>setRemoving(null)} onConfirm={()=>{
   try{onChange(instances.filter(instance=>instance.id!==removing.id));setRemoving(null);}catch(e){setError(String(e));}
  }}><p>Удалить вхождение «{removing.name}»?</p></Dialog>}
 </section>;
}
