import {useState} from 'react';
import {Dialog} from '../components/dialog/Dialog';
import type {AssemblyGroup} from './assemblyHierarchy';
import type {AssemblyInstance} from './assemblyInstances';
import {MAX_MATE_ANGLE,MAX_MATE_DISTANCE,type AssemblyMate,type MateParameter} from './assemblyMates';
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
 onAttach: (leaderId: string, followerId: string, parameter?: MateParameter) => void;
 onClose: () => void;
};

export function AssemblyFixedMateDialog({candidates,groups,paths,onAttach,onClose}:Props){
 const [leaderId,setLeaderId]=useState('');
 const [followerId,setFollowerId]=useState('');
 const [kind,setKind]=useState<'fixed'|MateParameter['kind']>('fixed');
 const [value,setValue]=useState('');
 const [error,setError]=useState('');
 const groupNames = new Map(groups.map(group => [group.id, group.name]));
 const displayPath = (instance: AssemblyInstance) =>
  [...(paths.get(instance.id)?.slice(0,-1) ?? []).map(id => groupNames.get(id)), instance.name].join(' / ');
 const leaders=Array.from(candidates.keys());
 const leader=leaders.find(instance=>instance.id===leaderId);
 const followers=leader?candidates.get(leader)??[]:[];
 const followerValid=followers.some(instance=>instance.id===followerId);
 const target=kind==='fixed'?undefined:parseMateParameter(kind,value);
 const canConfirm=followerValid&&(kind==='fixed'||target!==undefined);
 return <Dialog open title={kind==='fixed'?'Фиксированное сопряжение':mateParameterDetails[kind].title} confirmDisabled={!canConfirm} onCancel={onClose} onConfirm={()=>{
  if(!canConfirm)return;
  try{onAttach(leaderId,followerId,kind==='fixed'||target===undefined?undefined:{kind,value:target});onClose();}catch(e){setError(String(e));}
 }}>
  <label>Тип сопряжения <select aria-label="Тип сопряжения" value={kind} onChange={event=>{
   const next=event.target.value;
   if(next==='fixed'||next==='angular'||next==='distance'){setKind(next);setValue('');setError('');}
  }}>
   <option value="fixed">Фиксированное</option>
   <option value="distance">По расстоянию</option>
   <option value="angular">Угловое</option>
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
  {kind!=='fixed'&&<MateParameterField kind={kind} value={value} onChange={value=>{setValue(value);setError('');}}/>}
  {kind==='fixed'
   ? <p>Ведомое вхождение сохранит текущее положение относительно ведущего при перемещении ведущего или его подсборки.</p>
   : kind==='angular'
     ? <p>Угол задаётся от оси +X ведущего до проекции оси +X ведомого на плоскость XY ведущего. Положение, наклон и крен ведомого сохраняются относительно ведущего.</p>
     : <p>Расстояние измеряется между началами координат вхождений. Сопряжение сохраняет направление и относительный поворот. Для совпадающих начал используется ось +X ведущего вхождения.</p>}
  {error&&<p role="alert">{error}</p>}
 </Dialog>;
}


export const mateParameterDetails = {
 distance: {title:'Сопряжение по расстоянию', editTitle:'Расстояние сопряжения', editLabel:'Изменить расстояние', label:'Расстояние (мм)', icon:'length', unit:'мм', min:0, max:MAX_MATE_DISTANCE},
 angular: {title:'Угловое сопряжение', editTitle:'Угол сопряжения', editLabel:'Изменить угол', label:'Угол (°)', icon:'angle', unit:'°', min:-MAX_MATE_ANGLE, max:MAX_MATE_ANGLE},
} as const;

export function parseMateParameter(kind: MateParameter['kind'], value: string): number | undefined {
 const normalized = value.replace(',', '.');
 return validateNumber(normalized,mateParameterDetails[kind]) ? undefined : Number(normalized);
}

export function MateParameterField({kind,value,onChange}:{kind:MateParameter['kind']; value:string; onChange:(value:string)=>void}) {
 const details = mateParameterDetails[kind];
 return <ParameterField label={details.label} icon={details.icon} value={value} onChange={onChange}
  error={value ? validateNumber(value.replace(',', '.'),details) : undefined}/>;
}
