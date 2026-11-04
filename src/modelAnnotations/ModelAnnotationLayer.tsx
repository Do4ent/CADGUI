import React,{useEffect,useLayoutEffect,useMemo,useState,type RefObject} from 'react';
import {Html} from '@react-three/drei';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import type {CadItem} from '../documents/documentModel';
import {resolveModelAnnotation,type ModelAnnotation,type ModelAnnotationState,type Vec3} from './model';

/** Html transform uses distanceFactor / 400 world units per CSS pixel. */
export const MODEL_ANNOTATION_CSS_PIXELS_PER_UNIT=100;
const HTML_DISTANCE_FACTOR=400/MODEL_ANNOTATION_CSS_PIXELS_PER_UNIT;
export function annotationPlaneRotation(orientation:ModelAnnotation['orientation']):[number,number,number]{
 return orientation==='XZ'?[-Math.PI/2,0,0]:orientation==='YZ'?[0,Math.PI/2,0]:[0,0,0];
}
/** Same retained half-spaces as Part clipping: z/y/x <= offset. Hide the
 * whole note if either endpoint is cut away; never display an unclipped HTML
 * label for a clipped anchor. This is endpoint clipping, not topology/PMI. */
export function annotationInSection(anchor:Vec3,position:Vec3,section='off',offset=0):boolean{
 const axis:0|1|2|null=section==='XY'?2:section==='XZ'?1:section==='YZ'?0:null;
 return axis===null||(Number.isFinite(offset)&&anchor[axis]<=offset&&position[axis]<=offset);
}
/** HTML is ray-occluded by opaque scene meshes. Grid/transparent helpers and the
 * annotation's own marker/leader must not hide its label. WebGL primitives retain
 * their normal depth testing; this is a visual note, not a visibility certificate. */
export function collectAnnotationOccluders(scene:THREE.Object3D):RefObject<THREE.Object3D>[] {
 const result:RefObject<THREE.Object3D>[]=[];
 scene.traverse(object=>{
  if(!(object instanceof THREE.Mesh))return;
  let modelGeometry=false;
  for(let ancestor:THREE.Object3D|null=object;ancestor;ancestor=ancestor.parent){
   if(!ancestor.visible||ancestor.userData.modelAnnotationLayer)return;
   if(ancestor.userData.modelGeometry)modelGeometry=true;
  }
  if(!modelGeometry)return;
  const materials=Array.isArray(object.material)?object.material:[object.material];
  if(materials.some(material=>material.visible&&material.depthTest&&(!material.transparent||material.opacity>=1)))result.push({current:object});
 });
 return result;
}
const labelBackground=(color:string)=>{
 const rgb=[1,3,5].map(start=>parseInt(color.slice(start,start+2),16));
 return rgb[0]*.299+rgb[1]*.587+rgb[2]*.114>150?'#172334':'#ffffff';
};
export function ModelAnnotationLabel({annotation,anchor,position,selected,onSelect}:{annotation:ModelAnnotation;anchor:Vec3;position:Vec3;selected:boolean;onSelect:(id:string)=>void}){
 return <button type="button" data-model-annotation-id={annotation.id} data-model-annotation-orientation={annotation.orientation} data-model-annotation-position={position.join(' ')} data-model-annotation-world-position={position.join(' ')} data-model-annotation-anchor={anchor.join(' ')} data-model-annotation-font-size={annotation.fontSize} data-model-annotation-clipping-policy="anchor-and-label" data-model-annotation-occlusion="opaque-mesh-raycast" aria-label={`3D-примечание: ${annotation.text}`} aria-pressed={selected} onPointerDown={event=>event.stopPropagation()} onDoubleClick={event=>event.stopPropagation()} onClick={event=>{event.stopPropagation();onSelect(annotation.id);}} style={{display:'block',fontFamily:'Arial, sans-serif',fontSize:annotation.fontSize*MODEL_ANNOTATION_CSS_PIXELS_PER_UNIT,lineHeight:1.2,whiteSpace:'pre',textAlign:'left',color:annotation.color,background:labelBackground(annotation.color),border:`1px solid ${selected?'#e49a17':'transparent'}`,borderRadius:0,padding:2,cursor:'pointer',backfaceVisibility:annotation.orientation==='screen'?'visible':'hidden',pointerEvents:'auto',userSelect:'none'}}>{annotation.text}</button>;
}
function AnnotationGraphic({annotation,anchor,position,selected,onSelect,occluders}:{annotation:ModelAnnotation;anchor:Vec3;position:Vec3;selected:boolean;onSelect:(id:string)=>void;occluders:RefObject<THREE.Object3D>[]}){
 const line=useMemo(()=>{
  const geometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...anchor),new THREE.Vector3(...position)]);
  const material=new THREE.LineBasicMaterial({color:annotation.color,depthTest:true,depthWrite:false});
  return new THREE.Line(geometry,material);
 },[anchor[0],anchor[1],anchor[2],position[0],position[1],position[2],annotation.color]);
 useEffect(()=>()=>{line.geometry.dispose();(line.material as THREE.Material).dispose();},[line]);
 return <group userData={{modelAnnotationLayer:true}}>
  {annotation.leader&&<primitive object={line} dispose={null}/>}
  <mesh position={anchor} onClick={event=>{event.stopPropagation();onSelect(annotation.id);}}><sphereGeometry args={[Math.max(.006,annotation.fontSize*.1),12,8]}/><meshBasicMaterial color={selected?'#e49a17':annotation.color} depthTest depthWrite={false}/></mesh>
  <Html position={position} rotation={annotationPlaneRotation(annotation.orientation)} transform sprite={annotation.orientation==='screen'} distanceFactor={HTML_DISTANCE_FACTOR} occlude={occluders} center zIndexRange={[20,0]} style={{pointerEvents:'none'}}>
   <ModelAnnotationLabel annotation={annotation} anchor={anchor} position={position} selected={selected} onSelect={onSelect}/>
  </Html>
 </group>;
}
export type ModelAnnotationLayerProps={state:ModelAnnotationState;items:CadItem[];selectedId:string|null;onSelect:(id:string)=>void;section?:string;sectionOffset?:number};
export function ModelAnnotationLayer({state,items,selectedId,onSelect,section='off',sectionOffset=0}:ModelAnnotationLayerProps){
 const {scene}=useThree();
 const [occluders,setOccluders]=useState<RefObject<THREE.Object3D>[]>([]);
 // Objects have been committed to the Three scene before this effect. Refresh on
 // source visibility/replacement; camera changes are handled by Html each frame.
 useLayoutEffect(()=>{setOccluders(collectAnnotationOccluders(scene));},[scene,items]);
 return <group userData={{modelAnnotationLayer:true}}>{state.annotations.map(annotation=>{
  try{
   const resolved=resolveModelAnnotation(annotation,items);
   if(resolved.status!=='visible'||!resolved.anchor||!resolved.position||!annotationInSection(resolved.anchor,resolved.position,section,sectionOffset))return null;
   return <AnnotationGraphic key={annotation.id} annotation={annotation} anchor={resolved.anchor} position={resolved.position} selected={selectedId===annotation.id} onSelect={onSelect} occluders={occluders}/>;
  }catch{return null;}
 })}</group>;
}
