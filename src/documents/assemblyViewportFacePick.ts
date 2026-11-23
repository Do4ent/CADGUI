import type {ExactBody, KernelMesh} from '../kernel/types';

export type AssemblyViewportFacePick = {
  occurrenceId: string;
  sourceBodyId: string;
  brep: string;
  accept: (faceIndex: number) => void;
  report: (message: string) => void;
};

export type AssemblyFaceHighlight = Pick<AssemblyViewportFacePick,'occurrenceId'|'sourceBodyId'|'brep'> & {
  role: 'leader'|'follower';
  faceIndex: number;
};

export function matchesFacePickSource(request: Pick<AssemblyViewportFacePick,'occurrenceId'|'sourceBodyId'|'brep'>, occurrenceId: string, body: ExactBody): boolean {
  return request.occurrenceId === occurrenceId && request.sourceBodyId === body.id && request.brep === body.brep;
}

/** Translate a hit triangle through its exact, snapshot-bound mesh group. */
export function exactPlaneAtTriangle(mesh: KernelMesh, triangleIndex: number): number | undefined {
  const groups = mesh.faceGroups;
  const ordinals = mesh.planarFaceIndices;
  if (!ordinals || ordinals.length * 3 !== groups.length || !Number.isSafeInteger(triangleIndex) ||
      triangleIndex < 0 || triangleIndex >= mesh.indices.length / 3) return;
  const index = triangleIndex * 3;
  for (let group = 0; group < ordinals.length; group++) {
    const offset = group * 3;
    if (index >= groups[offset] && index < groups[offset] + groups[offset + 1]) {
      return ordinals[group] >= 0 ? ordinals[group] : undefined;
    }
  }
}

/** Use only a unique mapped triangle range from the canonical render mesh. */
export function exactPlanarFaceRange(mesh: KernelMesh, faceIndex: number): {start:number;count:number}|undefined {
  const {faceGroups,planarFaceIndices}=mesh;
  if(!Number.isSafeInteger(faceIndex)||faceIndex<0||!planarFaceIndices||
      planarFaceIndices.length*3!==faceGroups.length)return;
  const group=planarFaceIndices.indexOf(faceIndex);
  if(group<0||planarFaceIndices.lastIndexOf(faceIndex)!==group)return;
  const start=faceGroups[group*3],count=faceGroups[group*3+1];
  if(start<0||count<=0||start%3||count%3||start+count>mesh.indices.length)return;
  return {start,count};
}
