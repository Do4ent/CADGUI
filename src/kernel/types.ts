import type {SketchPlane,SketchCurveProfile,SketchMixedEdge,SketchRegion} from '../sketch/types';
export type Vec3=[number,number,number];
export type ExactBody={id:string;name:string;brep:string;color:string;visible:boolean};
export type ExactModelState={version:1;kernel:'occt-wasm';kernelVersion:'5.15.0';units:'mm';bodies:ExactBody[]};
export type KernelMesh={positions:Float32Array;normals:Float32Array;indices:Uint32Array;faceGroups:Int32Array};
export type KernelBodyResult={brep:string;mesh:KernelMesh;lines:Float32Array;volume:number;area:number;bounds:[Vec3,Vec3];center:Vec3;topology:{solids:number;faces:number;edges:number;vertices:number}};
export type KernelRequest=
 |{op:'revolve-region';region:SketchRegion;plane:SketchPlane;origin:Vec3;axis:'u'|'v';offset:number;angle:number}
 |{op:'cut-region';target:string;region:SketchRegion;plane:SketchPlane;origin:Vec3;depth:number}
 |{op:'extrude-region';region:SketchRegion;plane:SketchPlane;origin:Vec3;depth:number}
 |{op:'extrude-mixed';edges:SketchMixedEdge[];plane:SketchPlane;origin:Vec3;depth:number}
 |{op:'extrude-curve';profile:SketchCurveProfile;plane:SketchPlane;origin:Vec3;depth:number}
 |{op:'extrude-sketch';points:[number,number][];plane:SketchPlane;origin:Vec3;depth:number}
 |{op:'box';size:Vec3;origin:Vec3}
 |{op:'cylinder';radius:number;height:number;origin:Vec3}
 |{op:'boolean';kind:'fuse'|'cut'|'common';a:string;b:string}
 |{op:'inspect';brep:string}
 |{op:'import-step';text:string}
 |{op:'export-step';brep:string};
export type KernelOutput=KernelBodyResult|string;
export type KernelWorkerReply={id:number;result:KernelOutput}|{id:number;error:string};
/** Transient selection. Face IDs belong to one BREP inspection result only. */
export type ExactSelection={documentId:string;bodyId:string;brepSource:string;faceId:number|null;meshSource:KernelBodyResult|null;renderScope:string|null};
