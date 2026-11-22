import type {ExactBody,PlanarFaceInspection} from '../kernel/types';
import type {InspectPlanarFaces} from './assemblyFaceReferences';
import {useEffect,useRef,useState} from 'react';
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
 bodies: readonly ExactBody[];
 inspectPlanarFaces: InspectPlanarFaces;
 onAttachPlanar: (leaderId:string,followerId:string,leaderFaceIndex:number,followerFaceIndex:number,inspect:InspectPlanarFaces,signal:AbortSignal)=>Promise<void>;
 onAttach: (leaderId: string, followerId: string, parameter?: MateParameter) => void;
 onClose: () => void;
};

type FaceSelection = {sourceBodyId:string; brep:string; index:string};

function usePlanarFaces(brep:string|undefined,inspect:InspectPlanarFaces) {
 const [inspection,setInspection] = useState<PlanarFaceInspection>();
 const [failure,setFailure] = useState<{brep:string;message:string}>();
 useEffect(()=>{
  setInspection(undefined);setFailure(undefined);
  if (!brep) return;
  let current = true;
  void inspect(brep).then(result=>{if(current)setInspection(result);},error=>{
   if(current)setFailure({brep,message:String(error)});
  });
  return ()=>{current=false;};
 },[brep,inspect]);
 const activeInspection=inspection?.brep===brep ? inspection : undefined;
 const error=failure?.brep===brep ? failure?.message : undefined;
 return {faces:activeInspection?.faces,error,loading:!!brep&&!activeInspection&&!error};
}

export function AssemblyFixedMateDialog({candidates,groups,paths,bodies,inspectPlanarFaces,onAttachPlanar,onAttach,onClose}:Props){
 const [leaderId,setLeaderId]=useState('');
 const [followerId,setFollowerId]=useState('');
 const [kind,setKind]=useState<'fixed'|'planar'|MateParameter['kind']>('fixed');
 const [value,setValue]=useState('');
 const [error,setError]=useState('');
 const [leaderFace,setLeaderFace]=useState<FaceSelection>();
 const [followerFace,setFollowerFace]=useState<FaceSelection>();
 const [busy,setBusy]=useState(false);
 const pending=useRef<AbortController|null>(null);
 useEffect(()=>()=>pending.current?.abort(),[]);
 const groupNames = new Map(groups.map(group => [group.id, group.name]));
 const displayPath = (instance: AssemblyInstance) =>
  [...(paths.get(instance.id)?.slice(0,-1) ?? []).map(id => groupNames.get(id)), instance.name].join(' / ');
 const leaders=Array.from(candidates.keys());
 const leader=leaders.find(instance=>instance.id===leaderId);
 const followers=leader?candidates.get(leader)??[]:[];
 const followerValid=followers.some(instance=>instance.id===followerId);
 const follower=followers.find(instance=>instance.id===followerId);
 const leaderBody=bodies.find(body=>body.id===leader?.sourceBodyId);
 const followerBody=bodies.find(body=>body.id===follower?.sourceBodyId);
 const leaderCatalog=usePlanarFaces(kind==='planar'?leaderBody?.brep:undefined,inspectPlanarFaces);
 const followerCatalog=usePlanarFaces(kind==='planar'?followerBody?.brep:undefined,inspectPlanarFaces);
 const target=kind==='fixed'||kind==='planar' ? undefined : parseMateParameter(kind,value);
 const faceValue=(selection:FaceSelection|undefined,body:ExactBody|undefined)=>(
  selection&&body&&selection.sourceBodyId===body.id&&selection.brep===body.brep ? selection.index : ''
 );
 const leaderIndex=faceValue(leaderFace,leaderBody);
 const followerIndex=faceValue(followerFace,followerBody);
 const selectedFaces = leaderCatalog.faces?.some(face=>String(face.faceIndex)===leaderIndex) &&
  followerCatalog.faces?.some(face=>String(face.faceIndex)===followerIndex);
 const canConfirm=!busy&&followerValid&&(kind==='planar'?selectedFaces:kind==='fixed'||target!==undefined);
 const title=kind==='fixed'?'Фиксированное сопряжение':kind==='planar'?'Совмещение плоских граней':mateParameterDetails[kind].title;
 const close=()=>{pending.current?.abort();onClose();};
 return <Dialog open title={title} confirmDisabled={!canConfirm} onCancel={close} onConfirm={()=>{
  if(!canConfirm||pending.current)return;
  if(kind==='planar'){
   const controller=new AbortController();
   pending.current=controller;setBusy(true);setError('');
   void onAttachPlanar(leaderId,followerId,Number(leaderIndex),Number(followerIndex),inspectPlanarFaces,controller.signal)
    .then(()=>{if(!controller.signal.aborted)onClose();})
    .catch(error=>{if(!controller.signal.aborted)setError(String(error));})
    .finally(()=>{if(!controller.signal.aborted){pending.current=null;setBusy(false);}});
   return;
  }
  try{onAttach(leaderId,followerId,kind==='fixed'||target===undefined?undefined:{kind,value:target});onClose();}catch(e){setError(String(e));}
 }}>
  <label>Тип сопряжения <select aria-label="Тип сопряжения" disabled={busy} value={kind} onChange={event=>{
   const next=event.target.value;
   if(next==='fixed'||next==='angular'||next==='distance'||next==='planar'){setKind(next);setValue('');setError('');setLeaderFace(undefined);setFollowerFace(undefined);}
  }}>
   <option value="fixed">Фиксированное</option>
   <option value="distance">По расстоянию</option>
   <option value="angular">Угловое</option>
   <option value="planar">Совмещение плоских граней</option>
  </select></label>
  <label>Ведущее вхождение <select aria-label="Ведущее вхождение" disabled={busy} value={leader?.id??''} onChange={event=>{
   setLeaderId(event.target.value);setFollowerId('');setLeaderFace(undefined);setFollowerFace(undefined);setError('');
  }}>
   <option value="">Выберите вхождение</option>
   {leaders.map(instance=><option key={instance.id} value={instance.id}>{displayPath(instance)}</option>)}
  </select></label>
  <label>Ведомое вхождение <select aria-label="Ведомое вхождение" value={followerValid?followerId:''} disabled={busy||!leader} onChange={event=>{
   setFollowerId(event.target.value);setFollowerFace(undefined);setError('');
  }}>
   <option value="">Выберите вхождение</option>
   {followers.map(instance=><option key={instance.id} value={instance.id}>{displayPath(instance)}</option>)}
  </select></label>
  {kind==='planar'&&<>
   <PlanarFaceField label="Ведущая грань" value={leaderIndex} catalog={leaderCatalog} disabled={busy} onSelect={index=>setLeaderFace(leaderBody&&{sourceBodyId:leaderBody.id,brep:leaderBody.brep,index})}/>
   <PlanarFaceField label="Ведомая грань" value={followerIndex} catalog={followerCatalog} disabled={busy} onSelect={index=>setFollowerFace(followerBody&&{sourceBodyId:followerBody.id,brep:followerBody.brep,index})}/>
  </>}
  {kind!=='fixed'&&kind!=='planar'&&<MateParameterField kind={kind} value={value} onChange={value=>{setValue(value);setError('');}}/>}
  {kind==='fixed'
   ? <p>Ведомое вхождение сохранит текущее положение относительно ведущего при перемещении ведущего или его подсборки.</p>
   : kind==='angular'
     ? <p>Угол задаётся от оси +X ведущего до проекции оси +X ведомого на плоскость XY ведущего. Положение, наклон и крен ведомого сохраняются относительно ведущего.</p>
     : kind==='planar'
      ? <p>Плоскости совмещаются, а внешние нормали направляются навстречу друг другу.</p>
      : <p>Расстояние измеряется между началами координат вхождений. Сопряжение сохраняет направление и относительный поворот. Для совпадающих начал используется ось +X ведущего вхождения.</p>}
  {error&&<p role="alert">{error}</p>}
 </Dialog>;
}


function PlanarFaceField({label,value,catalog,disabled,onSelect}:{
 label:string;
 value:string;
 catalog:ReturnType<typeof usePlanarFaces>;
 disabled:boolean;
 onSelect:(value:string)=>void;
}) {
 const {faces,error,loading}=catalog;
 return <>
  <label>{label} <select aria-label={label} value={value} disabled={disabled||!faces?.length} onChange={event=>onSelect(event.target.value)}>
   <option value="">Выберите плоскую грань</option>
   {faces?.map(face=><option key={face.faceIndex} value={String(face.faceIndex)}>
    №{face.faceIndex+1} · n({face.normal.map(axis=>axis.toFixed(3)).join(', ')}) · p({face.origin.map(axis=>axis.toFixed(3)).join(', ')})
   </option>)}
  </select></label>
  {error&&<p role="alert">{error}</p>}
  {loading&&<p role="status">Загрузка плоских граней…</p>}
  {faces?.length===0&&<p>Плоских граней нет.</p>}
 </>;
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
