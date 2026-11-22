import {useState} from 'react';
import {Dialog} from '../components/dialog/Dialog';
import type {AssemblyInstance} from './assemblyInstances';
import type {FixedAssemblyMate} from './assemblyMates';

export function fixedMateCandidates(
 instances: readonly AssemblyInstance[], availableSources: ReadonlySet<string>, mates: readonly FixedAssemblyMate[],
): Map<AssemblyInstance, AssemblyInstance[]> {
 const available = instances.filter(instance=>availableSources.has(instance.sourceBodyId));
 const leadersByFollower = new Map(mates.map(mate=>[mate.followerId,mate.leaderId]));
 const roots = available.filter(instance=>!leadersByFollower.has(instance.id));
 const result = new Map<AssemblyInstance, AssemblyInstance[]>();
 for(const leader of available){
  const ancestors = new Set<string>();
  for(let id:string|undefined=leader.id;id!==undefined;id=leadersByFollower.get(id))ancestors.add(id);
  const candidates = roots.filter(instance=>instance.parentId===leader.parentId&&!ancestors.has(instance.id));
  if(candidates.length)result.set(leader,candidates);
 }
 return result;
}

type Props = {
 candidates: ReadonlyMap<AssemblyInstance, readonly AssemblyInstance[]>;
 onAttach: (leaderId: string, followerId: string) => void;
 onClose: () => void;
};

export function AssemblyFixedMateDialog({candidates,onAttach,onClose}:Props){
 const [leaderId,setLeaderId]=useState('');
 const [followerId,setFollowerId]=useState('');
 const [error,setError]=useState('');
 const leaders=Array.from(candidates.keys());
 const leader=leaders.find(instance=>instance.id===leaderId);
 const followers=leader?candidates.get(leader)??[]:[];
 const canConfirm=followers.some(instance=>instance.id===followerId);
 return <Dialog open title="Фиксированное сопряжение" confirmDisabled={!canConfirm} onCancel={onClose} onConfirm={()=>{
  if(!canConfirm)return;
  try{onAttach(leaderId,followerId);onClose();}catch(e){setError(String(e));}
 }}>
  <label>Ведущее вхождение <select aria-label="Ведущее вхождение" value={leader?.id??''} onChange={event=>{
   setLeaderId(event.target.value);setFollowerId('');setError('');
  }}>
   <option value="">Выберите вхождение</option>
   {leaders.map(instance=><option key={instance.id} value={instance.id}>{instance.name}</option>)}
  </select></label>
  <label>Ведомое вхождение <select aria-label="Ведомое вхождение" value={canConfirm?followerId:''} disabled={!leader} onChange={event=>{
   setFollowerId(event.target.value);setError('');
  }}>
   <option value="">Выберите вхождение</option>
   {followers.map(instance=><option key={instance.id} value={instance.id}>{instance.name}</option>)}
  </select></label>
  <p>Выберите вхождения с общим родителем. Ведомое вхождение сохранит текущее положение относительно ведущего.</p>
  {error&&<p role="alert">{error}</p>}
 </Dialog>;
}
