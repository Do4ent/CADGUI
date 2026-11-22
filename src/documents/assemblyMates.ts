import {Euler, Matrix4, Quaternion, Vector3} from 'three';

type Triple = readonly [number, number, number];
type Rotation = readonly [number, number, number, number];
export interface AssemblyPlacement {
  id: string;
  position: Triple;
  rotation: Triple;
}
export interface FixedAssemblyMate {
  leaderId: string;
  followerId: string;
  translation: Triple;
  quaternion: Rotation;
}
export interface AssemblyWorldPose {
  position: Triple;
  quaternion: Rotation;
}
const radians = Math.PI / 180;
const finite = (values: readonly number[], size: number) =>
  Array.isArray(values) && values.length === size && Array.from(values).every(Number.isFinite);

/** Apply fixed constraints in dependency order without altering stored poses. */
export function resolveAssemblyPoses(
  placements: readonly AssemblyPlacement[],
  mates: readonly FixedAssemblyMate[],
): Map<string, AssemblyWorldPose> {
  const base = new Map<string, AssemblyWorldPose>();
  for (const {id, position, rotation} of placements) {
    if (!id || base.has(id) || !finite(position, 3) || !finite(rotation, 3)) {
      throw new Error('Invalid assembly placement');
    }
    const euler = new Euler(rotation[0] * radians, rotation[1] * radians, rotation[2] * radians, 'XYZ');
    base.set(id, {position: [...position], quaternion: new Quaternion().setFromEuler(euler).toArray()});
  }

  const incoming = new Map<string, FixedAssemblyMate>();
  const children = new Map<string, FixedAssemblyMate[]>();
  for (const mate of mates) {
    const {leaderId, followerId, translation, quaternion} = mate;
    if (leaderId === followerId || !base.has(leaderId) || !base.has(followerId) || incoming.has(followerId)) {
      throw new Error('Invalid fixed mate endpoints or multiple leaders');
    }
    if (!finite(translation, 3) || !finite(quaternion, 4) || Math.abs(Math.hypot(...quaternion) - 1) > 1e-9) {
      throw new Error('Invalid relative pose');
    }
    incoming.set(followerId, mate);
    const siblings = children.get(leaderId) ?? [];
    siblings.push(mate);
    children.set(leaderId, siblings);
  }

  const resolved = new Map([...base].filter(([id]) => !incoming.has(id)));
  const order = [...resolved.keys()];
  for (const id of order) {
    const leader = resolved.get(id)!;
    const orientation = new Quaternion(...leader.quaternion);
    for (const mate of children.get(id) ?? []) {
      const position = new Vector3(...mate.translation).applyQuaternion(orientation)
        .add(new Vector3(...leader.position)).toArray();
      if (!finite(position, 3)) throw new Error('Invalid resolved position');
      const quaternion = orientation.clone().multiply(new Quaternion(...mate.quaternion)).normalize().toArray();
      resolved.set(mate.followerId, {position, quaternion});
      order.push(mate.followerId);
    }
  }
  if (resolved.size !== base.size) throw new Error('Fixed mate cycle');
  return resolved;
}

/** Capture the current world poses so attaching a mate causes no movement. */
export function createFixedAssemblyMate(
  placements: readonly AssemblyPlacement[],
  mates: readonly FixedAssemblyMate[],
  leaderId: string,
  followerId: string,
): FixedAssemblyMate {
  const world = resolveAssemblyPoses(placements, mates);
  const leader = world.get(leaderId);
  const follower = world.get(followerId);
  if (!leader || !follower) throw new Error('Missing assembly occurrence');
  const inverse = new Quaternion(...leader.quaternion).invert();
  const translation = new Vector3(...follower.position).sub(new Vector3(...leader.position))
    .applyQuaternion(inverse).toArray();
  const quaternion = inverse.clone().multiply(new Quaternion(...follower.quaternion)).normalize().toArray();
  const mate = {leaderId, followerId, translation, quaternion};
  resolveAssemblyPoses(placements, [...mates, mate]);
  return mate;
}

/** Materialize the solved pose in the existing placement format for detach. */
export function materializeAssemblyPlacement(id: string, pose: AssemblyWorldPose): {id: string; position: [number, number, number]; rotation: [number, number, number]} {
  const matrix = new Matrix4().makeRotationFromQuaternion(new Quaternion(...pose.quaternion));
  const [m11, m21, , , m12, m22, , , m13, m23, m33] = matrix.elements;
  const cosY = Math.hypot(m11, m12);
  const y = Math.atan2(m13, cosY);
  // Only use the singular solution at the singularity. Early rounding here
  // would change the solved orientation on detach near a 90 degree Y angle.
  const x = cosY > 1e-12 ? Math.atan2(-m23, m33) : Math.atan2(Math.sign(m13) * m21, m22);
  const z = cosY > 1e-12 ? Math.atan2(-m12, m11) : 0;
  return {
    id,
    position: [...pose.position],
    rotation: [x / radians, y / radians, z / radians],
  };
}

/** Strict native document validation and detached storage values. */
export function validateFixedAssemblyMates(placements: readonly AssemblyPlacement[], value: unknown): FixedAssemblyMate[] {
  if (!Array.isArray(value) || value.length > 99) throw Error('Некорректные сопряжения');
  const keys = ['leaderId', 'followerId', 'translation', 'quaternion'];
  const mates: FixedAssemblyMate[] = Array.from(value, raw => {
    if (!raw || typeof raw !== 'object' || Object.keys(raw).length !== keys.length ||
        !keys.every(key => Object.hasOwn(raw, key)) || typeof raw.leaderId !== 'string' ||
        typeof raw.followerId !== 'string' || !finite(raw.translation, 3) || !finite(raw.quaternion, 4)) {
      throw Error('Некорректное фиксированное сопряжение');
    }
    return {...raw, translation: [...raw.translation], quaternion: [...raw.quaternion]};
  });
  for (const pose of resolveAssemblyPoses(placements, mates).values()) {
    if (pose.position.some(value => Math.abs(value) > 1e6)) throw Error('Размещение выходит за пределы ±1 000 000 мм');
  }
  return mates;
}

/** When sources disappear, preserve world poses of newly detached survivors. */
export function pruneAssemblyMates<T extends AssemblyPlacement>(
  previous: readonly T[], survivors: T[], mates: FixedAssemblyMate[],
): {placements: T[]; mates: FixedAssemblyMate[]} {
  const ids = new Set(survivors.map(item => item.id));
  const retained = mates.filter(mate => ids.has(mate.leaderId) && ids.has(mate.followerId));
  if (retained.length === mates.length) return {placements: survivors, mates};
  const detached = new Set(mates.filter(mate => !ids.has(mate.leaderId)).map(mate => mate.followerId));
  const world = resolveAssemblyPoses(previous, mates);
  return {
    mates: retained,
    placements: survivors.map(item => detached.has(item.id) ?
      {...item, ...materializeAssemblyPlacement(item.id, world.get(item.id)!)} : item),
  };
}
