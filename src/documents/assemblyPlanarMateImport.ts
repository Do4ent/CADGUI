import {resolveAssemblyPlanarFaceReference,type InspectPlanarFaces} from './assemblyFaceReferences';
import {planarMateTransformMatches} from './planarMateTransform';
import type {CadDocument} from './documentModel';

/** Verify external native files against analytic faces before opening the document. */
export async function verifyImportedPlanarMates(document: CadDocument, inspect: InspectPlanarFaces): Promise<void> {
  const sources = {instances:document.assemblyInstances??[],bodies:document.exactModel.bodies};
  const inspections = new Map<string,ReturnType<InspectPlanarFaces>>();
  const inspectSnapshot: InspectPlanarFaces = brep => {
    const cached = inspections.get(brep);
    if (cached) return cached;
    const pending = inspect(brep);
    inspections.set(brep,pending);
    return pending;
  };
  for (const mate of document.assemblyFixedMates??[]) {
    if (!('leaderFace' in mate)) continue;
    const leader = await resolveAssemblyPlanarFaceReference(sources,mate.leaderFace,inspectSnapshot);
    const follower = await resolveAssemblyPlanarFaceReference(sources,mate.followerFace,inspectSnapshot);
    if (leader.status==='stale'||follower.status==='stale') {
      throw Error('Геометрия плоской грани изменилась. Сначала отсоедините сопряжение.');
    }
    if (leader.status!=='resolved'||follower.status!=='resolved'||
        !planarMateTransformMatches({position:mate.translation,quaternion:mate.quaternion},leader.face,follower.face)) {
      throw Error('Сохранённое сопряжение не соответствует плоским граням');
    }
  }
}
