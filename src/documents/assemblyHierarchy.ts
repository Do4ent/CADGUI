import {Euler,Quaternion,Vector3} from 'three';
import {assemblyVector, type AssemblyInstance} from './assemblyInstances';
import {materializeAssemblyPlacement,resolveAssemblyPoses,type AssemblyPlacement,type AssemblyWorldPose,type FixedAssemblyMate} from './assemblyMates';

export type AssemblyGroup = AssemblyPlacement & {name: string; parentId?: string};
export const MAX_ASSEMBLY_GROUPS = 100;

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
  instances: readonly AssemblyInstance[], groups: readonly AssemblyGroup[], mates: readonly FixedAssemblyMate[],
) {
  const placements = [...groups, ...instances];
  const local = resolveAssemblyPoses(placements, []);
  const groupById = new Map(groups.map(group => [group.id, group]));
  const byId = new Map(placements.map(item => [item.id, item]));
  const instancesById = new Map(instances.map(instance => [instance.id, instance]));
  const followers = new Set<string>();
  for (const mate of mates) {
    const leader = instancesById.get(mate.leaderId);
    const follower = instancesById.get(mate.followerId);
    if (!leader || !follower || leader.parentId !== follower.parentId) {
      throw Error('Фиксированное сопряжение требует общую родительскую подсборку');
    }
    followers.add(follower.id);
  }

  const hierarchyEdges: FixedAssemblyMate[] = [];
  for (const item of placements) {
    if (item.parentId === undefined) continue;
    if (!groupById.has(item.parentId)) throw Error('Родительская подсборка не найдена');
    // A mated follower inherits the shared parent frame through its leader.
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
  if ([...world.values()].some(pose => pose.position.some(value => Math.abs(value) > 1e6))) {
    throw Error('Размещение выходит за пределы ±1 000 000 мм');
  }
  return {paths, world};
}
