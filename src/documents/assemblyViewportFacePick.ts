import type {ExactBody, KernelMesh} from '../kernel/types';

export type AssemblyViewportFacePick = {
  occurrenceId: string;
  sourceBodyId: string;
  brep: string;
  accept: (faceIndex: number) => void;
  report: (message: string) => void;
};

export function matchesFacePickSource(request: AssemblyViewportFacePick, occurrenceId: string, body: ExactBody): boolean {
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
