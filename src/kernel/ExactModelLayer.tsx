import {useEffect,useLayoutEffect,useMemo,useState} from 'react';
import {Html,useBounds} from '@react-three/drei';
import * as THREE from 'three';
import {kernelClient} from './client';
import type {ExactBody,ExactModelState,ExactSelection,KernelBodyResult} from './types';
import {exactBodySelection} from './selection';

/** OCCT faceGroups describe index ranges, not triangle ranges. IDs are revision-local. */
export function faceAtTriangle(groups:Int32Array,triangle:number):number|null {
 const index=triangle*3;
 for(let i=0;i+2<groups.length;i+=3)if(index>=groups[i]&&index<groups[i]+groups[i+1])return groups[i+2];
 return null;
}
export function createBodyGeometry(result:KernelBodyResult):THREE.BufferGeometry {
 const {positions,normals,indices}=result.mesh;
 if(!positions.length||!indices.length||Array.from(positions).some(v=>!Number.isFinite(v))||Array.from(normals).some(v=>!Number.isFinite(v))||positions.length%3||normals.length!==positions.length||indices.length%3||Array.from(indices).some(i=>i>=positions.length/3))throw new Error('Некорректная сетка BREP');
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
 geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));
 geometry.setIndex(new THREE.BufferAttribute(indices,1));
 geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}
export function faceHighlightGeometry(result:KernelBodyResult,faceId:number):THREE.BufferGeometry {
 const geometry=new THREE.BufferGeometry();const indices:number[]=[];
 const groups=result.mesh.faceGroups;
 for(let i=0;i+2<groups.length;i+=3)if(groups[i+2]===faceId)for(let j=groups[i];j<groups[i]+groups[i+1]&&j<result.mesh.indices.length;j++)indices.push(result.mesh.indices[j]);
 geometry.setAttribute('position',new THREE.BufferAttribute(result.mesh.positions,3));
 geometry.setIndex(indices);return geometry;
}
export function hasFace(result:KernelBodyResult,faceId:number):boolean {
 const groups=result.mesh.faceGroups;
 for(let i=0;i+2<groups.length;i+=3)if(groups[i+2]===faceId)return true;
 return false;
}
export function selectedFaceForResult(documentId:string,body:ExactBody,result:KernelBodyResult,selected:ExactSelection|null):number|null {
 if(!selected||selected.documentId!==documentId||selected.bodyId!==body.id||selected.brepSource!==body.brep||selected.meshSource!==result||selected.faceId===null)return null;
 return hasFace(result,selected.faceId)?selected.faceId:null;
}
export function exactClippingPlanes(section='off',offset=0):THREE.Plane[]{return section==='off'?[]:[new THREE.Plane(section==='XY'?new THREE.Vector3(0,0,-1):section==='XZ'?new THREE.Vector3(0,-1,0):new THREE.Vector3(-1,0,0),offset)];}
export type ExactModelLayerProps={documentId:string;renderScope:string;state:ExactModelState;selected:ExactSelection|null;onSelect:(selection:ExactSelection)=>void;section?:string;sectionOffset?:number;wire?:boolean;edges?:boolean};
function BodyMesh({documentId,renderScope,body,result,selected,onSelect,section,sectionOffset,wire,edges}:Omit<ExactModelLayerProps,'state'>&{body:ExactBody;result:KernelBodyResult}){
 const geometry=useMemo(()=>createBodyGeometry(result),[result]);const bounds=useBounds();useLayoutEffect(()=>{bounds.refresh().clip().fit();},[bounds,geometry]);
 const lines=useMemo(()=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(result.lines,3));return g},[result]);
 const revisionMatches=selected?.documentId===documentId&&selected.bodyId===body.id&&selected.brepSource===body.brep;
 const selectedFace=selectedFaceForResult(documentId,body,result,selected);
 const highlight=useMemo(()=>selectedFace!==null?faceHighlightGeometry(result,selectedFace):null,[result,selectedFace]);
 useEffect(()=>{if(revisionMatches&&selected?.renderScope===renderScope&&selected.faceId!==null&&selectedFace===null)onSelect(exactBodySelection(documentId,body))},[body,documentId,onSelect,renderScope,revisionMatches,selected?.faceId,selected?.renderScope,selectedFace]);
 useEffect(()=>()=>geometry.dispose(),[geometry]);useEffect(()=>()=>lines.dispose(),[lines]);useEffect(()=>()=>highlight?.dispose(),[highlight]);
 const planes=useMemo(()=>exactClippingPlanes(section,sectionOffset),[section,sectionOffset]);const active=revisionMatches;
 return <group userData={{modelGeometry:true,exactBodyId:body.id}}>
  <mesh geometry={geometry} dispose={null} onClick={event=>{event.stopPropagation();const faceId=event.faceIndex==null?null:faceAtTriangle(result.mesh.faceGroups,event.faceIndex);onSelect(exactBodySelection(documentId,body,faceId,faceId===null?null:result,renderScope))}} castShadow receiveShadow>
   <meshStandardMaterial color={active?'#ffb347':body.color} metalness={.42} roughness={.35} wireframe={wire} side={THREE.DoubleSide} clippingPlanes={planes}/>
  </mesh>
  {highlight&&<mesh geometry={highlight} dispose={null} raycast={()=>{}}><meshBasicMaterial color="#ffd477" side={THREE.DoubleSide} clippingPlanes={planes} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1}/></mesh>}
  {(edges||wire)&&result.lines.length>0&&<lineSegments geometry={lines} dispose={null} raycast={()=>{}}><lineBasicMaterial color={active?'#ffdd82':'#243e55'} clippingPlanes={planes}/></lineSegments>}
  <Html style={{pointerEvents:'none'}}><span hidden data-kernel-render-body={body.id} data-exact-body-state="ready" data-exact-body-bounds={JSON.stringify(result.bounds)} data-exact-body-volume={result.volume} data-exact-body-triangles={result.mesh.indices.length/3} data-exact-body-faces={result.topology.faces} data-exact-selected-face={selectedFace??undefined} data-exact-body-units="mm"/></Html>
 </group>;
}
function InspectedBody(props:Omit<ExactModelLayerProps,'state'>&{body:ExactBody}){
 const {body}=props;const [inspection,setInspection]=useState<{brep:string;result?:KernelBodyResult;error?:string}|null>(null);
 useEffect(()=>{let current=true;setInspection(null);kernelClient.execute({op:'inspect',brep:body.brep}).then(result=>{if(!current)return;if(typeof result==='string')throw new Error('Ядро не вернуло сетку BREP');const check=createBodyGeometry(result);check.dispose();setInspection({brep:body.brep,result})}).catch(error=>{if(current)setInspection({brep:body.brep,error:error instanceof Error?error.message:String(error)})});return()=>{current=false}},[body.id,body.brep]);
 if(!body.visible)return null;
 if(inspection?.brep===body.brep&&inspection.result)return <BodyMesh {...props} result={inspection.result}/>;
 return <Html fullscreen style={{pointerEvents:'none'}}><div role="status" data-exact-body-status={body.id} style={{position:'absolute',left:8,top:8,color:inspection?.error?'#c43a3a':'#456',background:'var(--panel,#fff)',padding:4,fontSize:12}}>{inspection?.error?`${body.name}: ${inspection.error}`:`${body.name}: расчёт BREP…`}</div></Html>;
}
export function ExactModelLayer({state,...props}:ExactModelLayerProps){return <group>{state.bodies.map(body=><InspectedBody key={body.id} body={body} {...props}/>)}</group>}
