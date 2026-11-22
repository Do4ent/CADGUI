import {validateAssemblyPlanarFaceReference,type AssemblyPlanarFaceReference} from './assemblyFaceReferences';
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
export interface DistanceAssemblyMate {
  leaderId: string;
  followerId: string;
  direction: Triple;
  distance: number;
  quaternion: Rotation;
}
export interface AngularAssemblyMate extends FixedAssemblyMate {
  angle: number;
}
export interface PlanarAssemblyMate extends FixedAssemblyMate {
  leaderFace: AssemblyPlanarFaceReference;
  followerFace: AssemblyPlanarFaceReference;
}
export type AssemblyMate = FixedAssemblyMate | DistanceAssemblyMate | AngularAssemblyMate | PlanarAssemblyMate;
export type MateParameter = {kind: 'distance' | 'angular'; value: number};
export const MAX_MATE_ANGLE = 180;
export const validMateAngle = (angle: number) => Number.isFinite(angle) && Math.abs(angle) <= MAX_MATE_ANGLE;
export const MAX_MATE_DISTANCE = Math.hypot(2e6, 2e6, 2e6);
export const validMateDistance = (distance: number) =>
  Number.isFinite(distance) && distance >= 0 && distance <= MAX_MATE_DISTANCE;

export interface AssemblyWorldPose {
  position: Triple;
  quaternion: Rotation;
}
const radians = Math.PI / 180;
const zAxis = new Vector3(0, 0, 1);
const zRotation = (degrees: number) => new Quaternion().setFromAxisAngle(zAxis, degrees * radians);
const heading = (orientation: Quaternion) => {
  const axis = new Vector3(1, 0, 0).applyQuaternion(orientation);
  return Math.hypot(axis.x, axis.y) < 1e-9 ? undefined : Math.atan2(axis.y, axis.x) / radians;
};
const finite = (values: readonly number[], size: number) =>
  Array.isArray(values) && values.length === size && Array.from(values).every(Number.isFinite);

/** Apply assembly constraints in dependency order without altering stored poses. */
export function resolveAssemblyPoses(
  placements: readonly AssemblyPlacement[],
  mates: readonly AssemblyMate[],
): Map<string, AssemblyWorldPose> {
  const base = new Map<string, AssemblyWorldPose>();
  for (const {id, position, rotation} of placements) {
    if (!id || base.has(id) || !finite(position, 3) || !finite(rotation, 3)) {
      throw new Error('Invalid assembly placement');
    }
    const euler = new Euler(rotation[0] * radians, rotation[1] * radians, rotation[2] * radians, 'XYZ');
    base.set(id, {position: [...position], quaternion: new Quaternion().setFromEuler(euler).toArray()});
  }

  const incoming = new Map<string, AssemblyMate>();
  const children = new Map<string, AssemblyMate[]>();
  for (const mate of mates) {
    const {leaderId, followerId, quaternion} = mate;
    if (leaderId === followerId || !base.has(leaderId) || !base.has(followerId) || incoming.has(followerId)) {
      throw new Error('Invalid mate endpoints or multiple leaders');
    }
    const validOffset = 'distance' in mate
      ? validMateDistance(mate.distance) && finite(mate.direction, 3) && Math.abs(Math.hypot(...mate.direction) - 1) <= 1e-9
      : finite(mate.translation, 3);
    if (!validOffset || !finite(quaternion, 4) || Math.abs(Math.hypot(...quaternion) - 1) > 1e-9) {
      throw new Error('Invalid relative pose');
    }
    if ('angle' in mate) {
      const capturedHeading = heading(new Quaternion(...quaternion).normalize());
      if (!validMateAngle(mate.angle) || capturedHeading === undefined || Math.abs(capturedHeading) > 1e-4) {
        throw new Error('Некорректный угол сопряжения');
      }
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
      const offset = 'distance' in mate
        ? new Vector3(...mate.direction).setLength(mate.distance)
        : new Vector3(...mate.translation);
      const position = offset.applyQuaternion(orientation)
        .add(new Vector3(...leader.position)).toArray();
      if (!finite(position, 3)) throw new Error('Invalid resolved position');
      const relative = new Quaternion(...mate.quaternion);
      if ('angle' in mate) relative.premultiply(zRotation(mate.angle));
      const quaternion = orientation.clone().multiply(relative).normalize().toArray();
      resolved.set(mate.followerId, {position, quaternion});
      order.push(mate.followerId);
    }
  }
  if (resolved.size !== base.size) throw new Error('Assembly mate cycle');
  return resolved;
}

/** Express a world pose in another rigid frame. */
export function assemblyPoseRelativeTo(pose: AssemblyWorldPose, frame: AssemblyWorldPose): AssemblyWorldPose {
  const inverse = new Quaternion(...frame.quaternion).invert();
  const position = new Vector3(...pose.position).sub(new Vector3(...frame.position)).applyQuaternion(inverse).toArray();
  const quaternion = inverse.multiply(new Quaternion(...pose.quaternion)).normalize().toArray();
  return {position, quaternion};
}

/** Capture the current world poses so attaching a mate causes no movement. */
export function fixedAssemblyMateFromPoses(
  world: ReadonlyMap<string, AssemblyWorldPose>, leaderId: string, followerId: string,
): FixedAssemblyMate {
  const leader = world.get(leaderId);
  const follower = world.get(followerId);
  if (!leader || !follower) throw new Error('Missing assembly occurrence');
  const relative = assemblyPoseRelativeTo(follower, leader);
  return {leaderId, followerId, translation: relative.position, quaternion: relative.quaternion};
}

/** Capture the bearing and orientation in the leader frame. Coincident origins use leader +X. */
export function distanceAssemblyMateFromPoses(
  world: ReadonlyMap<string, AssemblyWorldPose>, leaderId: string, followerId: string, distance: number,
): DistanceAssemblyMate {
  const {translation, quaternion} = fixedAssemblyMateFromPoses(world, leaderId, followerId);
  const position = new Vector3(...translation);
  const direction = position.lengthSq() === 0 ? [1, 0, 0] as const : position.normalize().toArray();
  return {leaderId, followerId, direction, distance, quaternion};
}

/** Capture relative position and remove the heading while preserving tilt and roll. */
export function angularAssemblyMateFromPoses(
  world: ReadonlyMap<string, AssemblyWorldPose>, leaderId: string, followerId: string, angle: number,
): AngularAssemblyMate {
  const fixed = fixedAssemblyMateFromPoses(world, leaderId, followerId);
  const orientation = new Quaternion(...fixed.quaternion);
  const capturedHeading = heading(orientation);
  if (capturedHeading === undefined) {
    throw Error('Ось +X ведомого вхождения параллельна оси Z ведущего. Задайте исходное направление.');
  }
  return {...fixed, angle, quaternion: orientation.premultiply(zRotation(-capturedHeading)).normalize().toArray()};
}

export function createFixedAssemblyMate(
  placements: readonly AssemblyPlacement[],
  mates: readonly AssemblyMate[],
  leaderId: string,
  followerId: string,
): FixedAssemblyMate {
  const mate = fixedAssemblyMateFromPoses(resolveAssemblyPoses(placements, mates), leaderId, followerId);
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
export function validateAssemblyMates(value: unknown): AssemblyMate[] {
  if (!Array.isArray(value) || value.length > 99) throw Error('Некорректные сопряжения');
  return Array.from(value, raw => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('Некорректное сопряжение');
    const isDistance = Object.hasOwn(raw, 'distance');
    const isAngular = Object.hasOwn(raw, 'angle');
    const keys = ['leaderId', 'followerId', 'quaternion', ...(isDistance ? ['direction', 'distance'] : ['translation'])];
    if (isAngular) keys.push('angle');
    const isPlanar = Object.hasOwn(raw, 'leaderFace') || Object.hasOwn(raw, 'followerFace');
    if (isPlanar) keys.push('leaderFace','followerFace');
    if ((Number(isDistance) + Number(isAngular) + Number(isPlanar) > 1) || Object.keys(raw).length !== keys.length || !keys.every(key => Object.hasOwn(raw, key)) ||
        typeof raw.leaderId !== 'string' || typeof raw.followerId !== 'string' || !finite(raw.quaternion, 4)) {
      throw Error('Некорректное сопряжение');
    }
    if (isDistance) {
      if (!validMateDistance(raw.distance) || !finite(raw.direction, 3)) throw Error('Некорректное расстояние сопряжения');
      return {...raw, direction: [...raw.direction], quaternion: [...raw.quaternion]};
    }
    if (isAngular && !validMateAngle(raw.angle)) throw Error('Некорректный угол сопряжения');
    if (!finite(raw.translation, 3)) throw Error('Некорректное фиксированное сопряжение');
    if (isPlanar) {
      const leaderFace = validateAssemblyPlanarFaceReference(raw.leaderFace);
      const followerFace = validateAssemblyPlanarFaceReference(raw.followerFace);
      if (leaderFace.occurrenceId !== raw.leaderId || followerFace.occurrenceId !== raw.followerId) {
        throw Error('Ссылки на грани не соответствуют вхождениям сопряжения');
      }
      return {...raw, leaderFace, followerFace, translation: [...raw.translation], quaternion: [...raw.quaternion]};
    }
    return {...raw, translation: [...raw.translation], quaternion: [...raw.quaternion]};
  });
}
