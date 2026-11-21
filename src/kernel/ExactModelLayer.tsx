import {useEffect,useLayoutEffect,useMemo,useSyncExternalStore} from 'react';
import {Html,useBounds} from '@react-three/drei';
import * as THREE from 'three';
import type {ExactBody,ExactModelState,ExactSelection,KernelBodyResult} from './types';
import {ExactSelectionRuntime,validateInspectionMesh} from './selection';
import type {CanonicalInspection} from './selection';
import type {AssemblyInstance} from '../documents/assemblyInstances';

/** OCCT faceGroups describe index ranges, not triangle ranges. IDs are revision-local. */
export function faceAtTriangle(groups:Int32Array,triangle:number):number|null {
 const index=triangle*3;
 for(let i=0;i+2<groups.length;i+=3)if(index>=groups[i]&&index<groups[i]+groups[i+1])return groups[i+2];
 return null;
}
export function createBodyGeometry(result:KernelBodyResult):THREE.BufferGeometry {
 validateInspectionMesh(result);
 const {positions,normals,indices}=result.mesh;
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
 geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));
 geometry.setIndex(new THREE.BufferAttribute(indices,1));
 geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}
/** Highlight exactly one resolved ordinal range, even when native hashes collide. */
export function faceHighlightGeometry(result:KernelBodyResult,indexStart:number,indexCount:number):THREE.BufferGeometry {
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.BufferAttribute(result.mesh.positions,3));
 geometry.setIndex(new THREE.BufferAttribute(result.mesh.indices.subarray(indexStart,indexStart+indexCount),1));return geometry;
}
export function exactClippingPlanes(section='off',offset=0):THREE.Plane[]{return section==='off'?[]:[new THREE.Plane(section==='XY'?new THREE.Vector3(0,0,-1):section==='XZ'?new THREE.Vector3(0,-1,0):new THREE.Vector3(-1,0,0),offset)];}
export type ExactModelLayerProps={runtime:ExactSelectionRuntime;renderScope:string;state:ExactModelState;selected:ExactSelection|null;onSelect:(selection:ExactSelection)=>void;section?:string;sectionOffset?:number;wire?:boolean;edges?:boolean};
function BodyMesh({runtime,renderScope,body,record,selected,onSelect,section,sectionOffset,wire,edges}:Omit<ExactModelLayerProps,'state'>&{body:ExactBody;record:CanonicalInspection}){
 const result=record.result!;
 const geometry=useMemo(()=>createBodyGeometry(result),[result]);const bounds=useBounds();useLayoutEffect(()=>{bounds.refresh().clip().fit();},[bounds,geometry]);
 const lines=useMemo(()=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(result.lines,3));return g},[result]);
 const valid=runtime.validate(selected),active=valid?.reference.bodyId===body.id&&runtime.matches(body);
 const face=runtime.selectedFace(body,record,selected);
 const highlight=useMemo(()=>face?faceHighlightGeometry(result,face.indexStart,face.indexCount):null,[result,face?.indexStart,face?.indexCount]);
 useEffect(()=>()=>geometry.dispose(),[geometry]);useEffect(()=>()=>lines.dispose(),[lines]);useEffect(()=>()=>highlight?.dispose(),[highlight]);
 const planes=useMemo(()=>exactClippingPlanes(section,sectionOffset),[section,sectionOffset]);
 return <group userData={{modelGeometry:true,exactBodyId:body.id}}>
  <mesh geometry={geometry} dispose={null} onClick={event=>{event.stopPropagation();const next=event.faceIndex==null?runtime.inspection(body)===record?runtime.captureBody(body.id):null:runtime.captureFace(body,record,event.faceIndex,renderScope);if(next)onSelect(next)}} castShadow receiveShadow>
   <meshStandardMaterial color={active?'#ffb347':body.color} metalness={.42} roughness={.35} wireframe={wire} side={THREE.DoubleSide} clippingPlanes={planes}/>
  </mesh>
  {highlight&&<mesh geometry={highlight} dispose={null} raycast={()=>{}}><meshBasicMaterial color="#ffd477" side={THREE.DoubleSide} clippingPlanes={planes} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1}/></mesh>}
  {(edges||wire)&&result.lines.length>0&&<lineSegments geometry={lines} dispose={null} raycast={()=>{}}><lineBasicMaterial color={active?'#ffdd82':'#243e55'} clippingPlanes={planes}/></lineSegments>}
  <Html style={{pointerEvents:'none'}}><span hidden data-kernel-render-body={body.id} data-exact-body-state="ready" data-exact-body-bounds={JSON.stringify(result.bounds)} data-exact-body-volume={result.volume} data-exact-body-triangles={result.mesh.indices.length/3} data-exact-body-faces={result.topology.faces} data-exact-body-revision={record.bodyRevision} data-exact-mesh-generation={record.generation} data-exact-selected-face={face?.faceId} data-exact-selected-face-group={face?.groupIndex} data-exact-body-units="mm"/></Html>
 </group>;
}
function InspectedBody(props:Omit<ExactModelLayerProps,'state'>&{body:ExactBody}){
 const {body,runtime}=props;
 const version=useSyncExternalStore(runtime.subscribe,runtime.getSnapshot,runtime.getSnapshot);
 const record=runtime.inspection(body);
 // Parent syncs in layout phase; passive subscription/loading cannot bind ahead of it.
 useEffect(()=>{runtime.ensureInspection(body)},[runtime,body.id,body.brep,body.visible,version]);
 if(!body.visible)return null;
 if(record?.status==='ready')return <BodyMesh {...props} record={record}/>;
 return <Html fullscreen style={{pointerEvents:'none'}}><div role="status" data-exact-body-status={body.id} style={{position:'absolute',left:8,top:8,color:record?.error?'#c43a3a':'#456',background:'var(--panel,#fff)',padding:4,fontSize:12}}>{record?.error?`${body.name}: ${record.error}`:`${body.name}: расчёт BREP…`}{record?.status==='error'&&<button type="button" style={{pointerEvents:'auto',borderRadius:0,marginLeft:6}} aria-label={`Повторить расчёт ${body.name}`} onClick={event=>{event.stopPropagation();runtime.retryInspection(body)}}>Повторить расчёт</button>}</div></Html>;
}
function Occurrence({instance,body,runtime,wire,section,sectionOffset}:{
 instance:AssemblyInstance;body:ExactBody;runtime:ExactSelectionRuntime;wire?:boolean;section?:string;sectionOffset?:number;
}){
 const version=useSyncExternalStore(runtime.subscribe,runtime.getSnapshot,runtime.getSnapshot);
 const record=runtime.inspection(body),result=record?.result;
 useEffect(()=>{runtime.ensureInspection(body,true);},[runtime,body,version]);
 const geometry=useMemo(()=>result?createBodyGeometry(result):null,[result]);
 const bounds=useBounds();
 useLayoutEffect(()=>{if(geometry)bounds.refresh().clip().fit();},[bounds,geometry,instance.position,instance.rotation]);
 useEffect(()=>()=>geometry?.dispose(),[geometry]);
 if(!geometry)return record?.status==='error'&&!body.visible?
  <Html position={instance.position}>
   <div role="status">{instance.name}: {record.error} <button type="button" onClick={()=>runtime.retryInspection(body)}>Повторить расчёт</button></div>
  </Html>:null;
 const [x,y,z]=instance.rotation.map(angle=>angle*Math.PI/180);
 return <group position={instance.position} rotation={[x,y,z,'XYZ']} userData={{modelGeometry:true}}>
  <mesh geometry={geometry} dispose={null} raycast={()=>{}} castShadow receiveShadow>
   <meshStandardMaterial color={body.color} wireframe={wire} clippingPlanes={exactClippingPlanes(section,sectionOffset)} side={THREE.DoubleSide}/>
  </mesh>
  <Html style={{pointerEvents:'none'}}><span hidden data-assembly-instance={instance.id}
   data-assembly-mesh-generation={record?.generation} data-assembly-position={JSON.stringify(instance.position)}
   data-assembly-rotation={JSON.stringify(instance.rotation)}/></Html>
 </group>;
}
export function ExactModelLayer({state,instances=[],...props}:ExactModelLayerProps & {instances?:readonly AssemblyInstance[]}){
 return <group>
  {state.bodies.map(body=><InspectedBody key={body.id} body={body} {...props}/>)}
  {instances.map(instance=>{
   const body=state.bodies.find(source=>source.id===instance.sourceBodyId);
   return body&&<Occurrence key={instance.id} body={body} instance={instance} {...props}/>;
  })}
 </group>;
}
