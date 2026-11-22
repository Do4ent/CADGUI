import {useState} from 'react';
import {Dialog} from '../components/dialog/Dialog';
import type {AssemblyGroup} from './assemblyHierarchy';
import type {AssemblyInstance} from './assemblyInstances';
import {MAX_MATE_DISTANCE,type AssemblyMate} from './assemblyMates';
import {validateNumber} from '../components/dialog/validation';
import {ParameterField} from '../components/dialog/ParameterField';

export function fixedMateCandidates(
 instances: readonly AssemblyInstance[], availableSources: ReadonlySet<string>, mates: readonly AssemblyMate[],
): Map<AssemblyInstance, AssemblyInstance[]> {
 const available = instances.filter(instance=>availableSources.has(instance.sourceBodyId));
 const leadersByFollower = new Map(mates.map(mate=>[mate.followerId,mate.leaderId]));
 const roots = available.filter(instance=>!leadersByFollower.has(instance.id));
 const result = new Map<AssemblyInstance, AssemblyInstance[]>();
 for(const leader of available){
  const ancestors = new Set<string>();
  for(let id:string|undefined=leader.id;id!==undefined;id=leadersByFollower.get(id))ancestors.add(id);
  const candidates = roots.filter(instance=>!ancestors.has(instance.id));
  if(candidates.length)result.set(leader,candidates);
 }
 return result;
}

type Props = {
 candidates: ReadonlyMap<AssemblyInstance, readonly AssemblyInstance[]>;
 groups: readonly AssemblyGroup[];
 paths: ReadonlyMap<string, readonly string[]>;
 onAttach: (leaderId: string, followerId: string, distance?: number) => void;
 onClose: () => void;
};

export function AssemblyFixedMateDialog({candidates,groups,paths,onAttach,onClose}:Props){
 const [leaderId,setLeaderId]=useState('');
 const [followerId,setFollowerId]=useState('');
 const [kind,setKind]=useState('fixed');
 const [distance,setDistance]=useState('');
 const [error,setError]=useState('');
 const groupNames = new Map(groups.map(group => [group.id, group.name]));
 const displayPath = (instance: AssemblyInstance) =>
  [...(paths.get(instance.id)?.slice(0,-1) ?? []).map(id => groupNames.get(id)), instance.name].join(' / ');
 const leaders=Array.from(candidates.keys());
 const leader=leaders.find(instance=>instance.id===leaderId);
 const followers=leader?candidates.get(leader)??[]:[];
 const followerValid=followers.some(instance=>instance.id===followerId);
 const target=parseMateDistance(distance);
 const canConfirm=followerValid&&(kind==='fixed'||target!==undefined);
 return <Dialog open title={kind==='fixed'?'Фиксированное сопряжение':'Сопряжение по расстоянию'} confirmDisabled={!canConfirm} onCancel={onClose} onConfirm={()=>{
  if(!canConfirm)return;
  try{onAttach(leaderId,followerId,kind==='distance'?target:undefined);onClose();}catch(e){setError(String(e));}
 }}>
  <label>Тип сопряжения <select aria-label="Тип сопряжения" value={kind} onChange={event=>{
   setKind(event.target.value);setError('');
  }}>
   <option value="fixed">Фиксированное</option>
   <option value="distance">По расстоянию</option>
  </select></label>
  <label>Ведущее вхождение <select aria-label="Ведущее вхождение" value={leader?.id??''} onChange={event=>{
   setLeaderId(event.target.value);setFollowerId('');setError('');
  }}>
   <option value="">Выберите вхождение</option>
   {leaders.map(instance=><option key={instance.id} value={instance.id}>{displayPath(instance)}</option>)}
  </select></label>
  <label>Ведомое вхождение <select aria-label="Ведомое вхождение" value={followerValid?followerId:''} disabled={!leader} onChange={event=>{
   setFollowerId(event.target.value);setError('');
  }}>
   <option value="">Выберите вхождение</option>
   {followers.map(instance=><option key={instance.id} value={instance.id}>{displayPath(instance)}</option>)}
  </select></label>
  {kind==='distance'&&<MateDistanceField value={distance} onChange={value=>{setDistance(value);setError('');}}/>}
  {kind==='fixed'
   ? <p>Ведомое вхождение сохранит текущее положение относительно ведущего при перемещении ведущего или его подсборки.</p>
   : <p>Расстояние измеряется между началами координат вхождений. Сопряжение сохраняет направление и относительный поворот. Для совпадающих начал используется ось +X ведущего вхождения.</p>}
  {error&&<p role="alert">{error}</p>}
 </Dialog>;
}


const distanceError = (value: string) => validateNumber(value.replace(',', '.'),{min:0,max:MAX_MATE_DISTANCE});
export function parseMateDistance(value: string): number | undefined {
 return distanceError(value) ? undefined : Number(value.replace(',', '.'));
}

export function MateDistanceField({value,onChange}:{value:string; onChange:(value:string)=>void}) {
 return <ParameterField label="Расстояние (мм)" icon="length" value={value} onChange={onChange}
  error={value ? distanceError(value) : undefined}/>;
}
