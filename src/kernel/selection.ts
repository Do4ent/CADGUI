import type {ExactBody,ExactModelState,ExactSelection,KernelBodyResult} from './types';

export function exactBodySelection(documentId:string,body:ExactBody,faceId:number|null=null,meshSource:KernelBodyResult|null=null,renderScope:string|null=null):ExactSelection {
 return {documentId,bodyId:body.id,brepSource:body.brep,faceId,meshSource:faceId===null?null:meshSource,renderScope:faceId===null?null:renderScope};
}

/** Rejects candidates emitted by an old document, body, or rendered BREP. */
export function validateExactSelection(documentId:string,state:ExactModelState,selection:ExactSelection|null):ExactSelection|null {
 if(!selection||selection.documentId!==documentId)return null;
 const body=state.bodies.find(candidate=>candidate.id===selection.bodyId);
 return body?.visible&&body.brep===selection.brepSource?selection:null;
}

/** Keeps a body selected across a rebuild, but never transfers a revision-local face ID. */
export function reconcileExactSelection(documentId:string,state:ExactModelState,selection:ExactSelection|null):ExactSelection|null {
 if(!selection||selection.documentId!==documentId)return null;
 const body=state.bodies.find(candidate=>candidate.id===selection.bodyId);
 if(!body?.visible)return null;
 if(body.brep===selection.brepSource)return selection;
 return exactBodySelection(documentId,body);
}
