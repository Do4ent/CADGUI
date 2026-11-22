import {Euler,Quaternion,Vector3} from 'three';
import {assemblyVector, type AssemblyInstance} from './assemblyInstances';
import {assemblyPoseRelativeTo,materializeAssemblyPlacement,resolveAssemblyPoses,type AssemblyMate,type AssemblyPlacement,type AssemblyWorldPose,type FixedAssemblyMate} from './assemblyMates';

export type AssemblyGroup = AssemblyPlacement & {name: string; parentId?: string};
export const MAX_ASSEMBLY_GROUPS = 100;
const placementLimit = 1e6;
// Rotating a pose at the coordinate boundary can add a few ulps.
const placementTolerance = 32 * Number.EPSILON * placementLimit;
const exceedsPlacementLimit = (pose: AssemblyWorldPose) =>
  pose.position.some(value => Math.abs(value) > placementLimit + placementTolerance);

/** Express the same draft pose in a different parent's local frame. */
export function rebaseAssemblyPose(values:string[], from:AssemblyWorldPose|undefined, to:AssemblyWorldPose|undefined):string[] {
  if (values.some(value => !value.trim() || !Number.isFinite(Number(value)))) throw Error('Сначала заполните координаты');
  const [x,y,z,rx,ry,rz]=values.map(Number);
  const radians=Math.PI/180;
  const position=new Vector3(x,y,z);
  const orientation=new Quaternion().setFromEuler(new Euler(rx*radians,ry*radians,rz*radians,'XYZ'));
  if (from) {
    const rotation=new Quaternion(...from.quaternion);
    position.applyQuaternion(rotation).add(new Vector3(...from.position));
    orientation.premultiply(rotation);
  }
  if (to) {
    const inverse=new Quaternion(...to.quaternion).invert();
    position.sub(new Vector3(...to.position)).applyQuaternion(inverse);
    orientation.premultiply(inverse);
  }
  const {position:localPosition,rotation}=materializeAssemblyPlacement('',{position:position.toArray(),quaternion:orientation.normalize().toArray()});
  return [...localPosition,...rotation].map(String);
}

export function validateAssemblyGroups(value: unknown): AssemblyGroup[] {
  if (!Array.isArray(value) || value.length > MAX_ASSEMBLY_GROUPS) throw Error('Допускается до 100 подсборок');
  return Array.from(value, raw => {
    const hasParent = !!raw && Object.hasOwn(raw, 'parentId');
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) ||
        Object.keys(raw).length !== (hasParent ? 5 : 4) ||
        !['id', 'name', 'position', 'rotation'].every(key => Object.hasOwn(raw, key)) ||
        (hasParent && typeof raw.parentId !== 'string') ||
        typeof raw.id !== 'string' || !raw.id.trim() || raw.id.length > 256 ||
        typeof raw.name !== 'string' || !raw.name.trim() || raw.name.length > 200 || /[\u0000-\u001f]/.test(raw.name)) {
      throw Error('Некорректная подсборка');
    }
    return {id:raw.id, name:raw.name, ...(hasParent ? {parentId:raw.parentId} : {}),
      position:assemblyVector(raw.position, 1e6), rotation:assemblyVector(raw.rotation, 360)};
  });
}

export function resolveAssemblyHierarchy(
  instances: readonly AssemblyInstance[], groups: readonly AssemblyGroup[], mates: readonly AssemblyMate[],
) {
  const placements = [...groups, ...instances];
  const local = resolveAssemblyPoses(placements, []);
  const groupById = new Map(groups.map(group => [group.id, group]));
  const byId = new Map(placements.map(item => [item.id, item]));
  const instanceIds = new Set(instances.map(instance => instance.id));
  const followers = new Set<string>();
  for (const mate of mates) {
    if (!instanceIds.has(mate.leaderId) || !instanceIds.has(mate.followerId)) {
      throw Error('Не найдено вхождение сопряжения');
    }
    followers.add(mate.followerId);
  }

  const hierarchyEdges: FixedAssemblyMate[] = [];
  for (const item of placements) {
    if (item.parentId === undefined) continue;
    if (!groupById.has(item.parentId)) throw Error('Родительская подсборка не найдена');
    // A mate determines the follower pose independently of its parent frame.
    if (followers.has(item.id)) continue;
    const pose = local.get(item.id)!;
    hierarchyEdges.push({leaderId:item.parentId, followerId:item.id, translation:pose.position, quaternion:pose.quaternion});
  }

  const paths = new Map<string, string[]>();
  for (const item of placements) {
    const path = [item.id];
    let parentId = item.parentId;
    while (parentId !== undefined) {
      if (path.includes(parentId)) throw Error('Циклическая вложенность подсборок');
      path.push(parentId);
      parentId = byId.get(parentId)!.parentId;
    }
    paths.set(item.id, path.reverse());
  }
  const world = resolveAssemblyPoses(placements, [...mates, ...hierarchyEdges]);
  if ([...world.values()].some(exceedsPlacementLimit)) {
    throw Error('Размещение выходит за пределы ±1 000 000 мм');
  }
  for (const instance of instances) {
    if (followers.has(instance.id)) detachableLocalPose(instance, world);
  }
  return {paths, world};
}

function detachableLocalPose(instance: AssemblyInstance, world: ReadonlyMap<string, AssemblyWorldPose>): AssemblyWorldPose {
  const pose = world.get(instance.id)!;
  const local = instance.parentId === undefined ? pose : assemblyPoseRelativeTo(pose, world.get(instance.parentId)!);
  if (exceedsPlacementLimit(local)) {
    throw Error('Локальное размещение ведомого вхождения выходит за пределы ±1 000 000 мм');
  }
  const [x,y,z] = local.position;
  const clamp = (value: number) => Math.min(placementLimit, Math.max(-placementLimit, value));
  return {...local, position: [clamp(x), clamp(y), clamp(z)]};
}

export function detachAssemblyInstance(instance: AssemblyInstance, world: ReadonlyMap<string, AssemblyWorldPose>): AssemblyInstance {
  return {...instance, ...materializeAssemblyPlacement(instance.id, detachableLocalPose(instance, world))};
}

/** Preserve the placement of surviving followers when their leaders are deleted. */
export function pruneAssemblyMates(
  previous: readonly AssemblyInstance[], survivors: AssemblyInstance[], groups: readonly AssemblyGroup[], mates: AssemblyMate[],
): {placements: AssemblyInstance[]; mates: AssemblyMate[]} {
  const ids = new Set(survivors.map(item => item.id));
  const retained = mates.filter(mate => ids.has(mate.leaderId) && ids.has(mate.followerId));
  if (retained.length === mates.length) return {placements: survivors, mates};
  const detached = new Set(mates.filter(mate => !ids.has(mate.leaderId)).map(mate => mate.followerId));
  const {world} = resolveAssemblyHierarchy(previous, groups, mates);
  return {
    mates: retained,
    placements: survivors.map(item => detached.has(item.id) ? detachAssemblyInstance(item, world) : item),
  };
}
