import {useState} from 'react';
import {Dialog} from '../components/dialog/Dialog';
import {ParameterField} from '../components/dialog/ParameterField';
import type {Vec3} from '../kernel/types';
import {MAX_ASSEMBLY_GROUPS,rebaseAssemblyPose,validateAssemblyGroups,type AssemblyGroup} from './assemblyHierarchy';
import type {AssemblyInstance} from './assemblyInstances';
import type {AssemblyWorldPose} from './assemblyMates';

export function AssemblyParentField({groups,paths,value,onChange,exclude}: {
 groups: readonly AssemblyGroup[];
 paths: ReadonlyMap<string,readonly string[]>;
 value: string;
 onChange: (value: string) => void;
 exclude?: string;
}){
 const names=new Map(groups.map(group=>[group.id,group.name]));
 return <label>Родительская подсборка <select aria-label="Родительская подсборка" value={value} onChange={event=>onChange(event.target.value)}>
  <option value="">Корень сборки</option>
  {groups.filter(group=>exclude===undefined||!paths.get(group.id)?.includes(exclude)).map(group=>
   <option key={group.id} value={group.id}>{paths.get(group.id)?.map(id=>names.get(id)).join(' / ')}</option>)}
 </select></label>;
}

export function AssemblyPoseFields({values,onChange}: {values: string[]; onChange: (values: string[]) => void}){
 return values.map((value,index)=>{
  const axis='XYZ'[index%3], offset=index<3;
  return <ParameterField key={index} label={(offset?'Смещение ':'Поворот ')+axis} icon={offset?'length':'angle'} unit={offset?'мм':'°'} value={value}
   onChange={next=>onChange(values.map((previous,i)=>i===index?next:previous))}/>;
 });
}

type GroupDraft={id: string; name: string; parentId: string; values: string[]};
export function AssemblyGroupsEditor({groups,instances,paths,world,onChange}: {
 groups: readonly AssemblyGroup[];
 instances: readonly AssemblyInstance[];
 paths: ReadonlyMap<string,readonly string[]>;
 world: ReadonlyMap<string,AssemblyWorldPose>;
 onChange: (value: AssemblyGroup[]) => void;
}){
 const [draft,setDraft]=useState<GroupDraft|null>(null);
 const [removing,setRemoving]=useState<AssemblyGroup|null>(null);
 const [error,setError]=useState('');
 const open=(group?:AssemblyGroup)=>{
  setError('');
  setDraft(group?{...group,parentId:group.parentId??'',values:[...group.position,...group.rotation].map(String)} :
   {id:crypto.randomUUID(),name:'Подсборка '+(groups.length+1),parentId:'',values:Array(6).fill('0')});
 };
 const groupCandidate=()=>{
  if(!draft||draft.values.some(value=>!value.trim()))return null;
  const {id,name,parentId,values}=draft;
  try{return validateAssemblyGroups([{id,name:name.trim(),...(parentId?{parentId}:{}),
   position:values.slice(0,3).map(Number) as Vec3,rotation:values.slice(3).map(Number) as Vec3}])[0];}
  catch{return null;}
 };
 const submit=()=>{
  const candidate=groupCandidate();if(!candidate)return;
  const next=groups.some(group=>group.id===candidate.id)?groups.map(group=>group.id===candidate.id?candidate:group):[...groups,candidate];
  try{onChange(next);setDraft(null);}catch(e){setError(String(e));}
 };
 const changeParent=(parentId:string)=>{
  if(!draft)return;
  try{
   const values=groups.some(group=>group.id===draft.id)?rebaseAssemblyPose(draft.values,world.get(draft.parentId),world.get(parentId)):draft.values;
   setDraft({...draft,parentId,values});setError('');
  }catch(e){setError(String(e));}
 };
 const names=new Map(groups.map(group=>[group.id,group.name]));
 return <section aria-label="Подсборки">
  <h3>Подсборки</h3>
  <button type="button" disabled={groups.length>=MAX_ASSEMBLY_GROUPS} onClick={()=>open()}>Добавить подсборку</button>
  <ul>{groups.map(group=>{
   const path=paths.get(group.id)??[group.id];
   const position=world.get(group.id)?.position??group.position;
   const hasChildren=groups.some(item=>item.parentId===group.id)||instances.some(item=>item.parentId===group.id);
   return <li key={group.id} data-assembly-group={group.id} data-assembly-path={JSON.stringify(path)} data-assembly-world-position={JSON.stringify(position)}>
    <strong>{path.map(id=>names.get(id)).join(' / ')}</strong>
    <p>{position.map(value=>Number(value.toFixed(6))).join(' / ')} мм</p>
    <button type="button" onClick={()=>open(group)}>Изменить подсборку</button>
    <button type="button" disabled={hasChildren} title={hasChildren?'Сначала переместите или удалите дочерние элементы':undefined}
     onClick={()=>{setError('');setRemoving(group);}}>Удалить подсборку</button>
   </li>;
  })}</ul>
  {draft&&<Dialog open title="Подсборка" confirmDisabled={!groupCandidate()} onCancel={()=>setDraft(null)} onConfirm={submit}>
   <label>Имя подсборки<input value={draft.name} maxLength={200} onChange={event=>setDraft({...draft,name:event.target.value})}/></label>
   <AssemblyParentField groups={groups} paths={paths} value={draft.parentId} exclude={draft.id} onChange={changeParent}/>
   <AssemblyPoseFields values={draft.values} onChange={values=>setDraft({...draft,values})}/>
   <p>Смещение и повороты XYZ заданы в системе координат родительской подсборки. Смена родителя существующей подсборки сохраняет её положение в модели.</p>
   {!groupCandidate()&&<p role="status">Введите имя и конечные значения в пределах ±1 000 000 мм и ±360°.</p>}
   {error&&<p role="alert">{error}</p>}
  </Dialog>}
  {removing&&<Dialog open title="Удаление подсборки" confirmLabel="Удалить" onCancel={()=>setRemoving(null)} onConfirm={()=>{
   try{onChange(groups.filter(group=>group.id!==removing.id));setRemoving(null);}catch(e){setError(String(e));}
  }}><p>Удалить подсборку «{removing.name}»?</p>{error&&<p role="alert">{error}</p>}</Dialog>}
 </section>;
}
