export type SketchPlane='XY'|'XZ'|'YZ';
export type SketchPoint={id:string;x:number;y:number};
export type SketchConstraint=
 |{id:string;kind:'horizontal'|'vertical'|'coincident';a:string;b:string}
 |{id:string;kind:'dx'|'dy';a:string;b:string;value:number}
 |{id:string;kind:'distance';a:string;b:string;value:number}
 |{id:string;kind:'equal-length';a:string;b:string;c:string;d:string}
 |{id:string;kind:'fixed';pointId:string;x:number;y:number};
export type SketchGeometry={kind:'circle';center:string;rim:string}|{kind:'arc';center:string;start:string;end:string;ccw:boolean};
export type Sketch={id:string;name:string;plane:SketchPlane;origin:[number,number,number];points:SketchPoint[];closed:boolean;constraints:SketchConstraint[];geometry?:SketchGeometry};
export type SketchExtrusion={id:string;sketchId:string;bodyId:string;depth:number};
export type SketchModelState={version:1;units:'mm';sketches:Sketch[];extrusions:SketchExtrusion[]};
export type SketchSolveResult={status:'fully-constrained'|'under-constrained'|'inconsistent';dof:number;rank:number;points:SketchPoint[];residual:number;redundant:number;message?:string};
