import {Quaternion, Vector3} from 'three';
import {assemblyPoseRelativeTo, type AssemblyWorldPose} from './assemblyMates';
import type {PlanarFaceDescriptor} from '../kernel/types';

/** Align outward normals in opposition and close the gap along the leader's plane normal. */
export function planarMateTransform(
  leader: AssemblyWorldPose,
  follower: AssemblyWorldPose,
  leaderFace: PlanarFaceDescriptor,
  followerFace: PlanarFaceDescriptor,
): AssemblyWorldPose {
  const relative = assemblyPoseRelativeTo(follower, leader);
  const orientation = new Quaternion(...relative.quaternion);
  const leaderNormal = new Vector3(...leaderFace.normal).normalize();
  const targetNormal = leaderNormal.clone().negate();
  const followerNormal = new Vector3(...followerFace.normal).applyQuaternion(orientation).normalize();
  const axis = new Vector3().crossVectors(followerNormal, targetNormal);
  const sine = axis.length();
  const correction = sine > 1e-14
    ? new Quaternion().setFromAxisAngle(axis.divideScalar(sine), Math.atan2(sine, followerNormal.dot(targetNormal)))
    : new Quaternion().setFromUnitVectors(followerNormal, targetNormal);
  orientation.premultiply(correction).normalize();

  const position = new Vector3(...relative.position);
  const contact = new Vector3(...followerFace.origin).applyQuaternion(orientation).add(position);
  const gap = new Vector3(...leaderFace.origin).sub(contact).dot(leaderNormal);
  position.addScaledVector(leaderNormal, gap);
  return {position: position.toArray(), quaternion: orientation.toArray()};
}

/** Verify a saved transform against freshly resolved body-space planes. */
export function planarMateTransformMatches(
  relative: AssemblyWorldPose,
  leaderFace: PlanarFaceDescriptor,
  followerFace: PlanarFaceDescriptor,
): boolean {
  const orientation = new Quaternion(...relative.quaternion);
  const normal = new Vector3(...leaderFace.normal);
  const opposed = new Vector3(...followerFace.normal).applyQuaternion(orientation).negate();
  const contact = new Vector3(...followerFace.origin).applyQuaternion(orientation)
    .add(new Vector3(...relative.position));
  return normal.distanceTo(opposed) <= 1e-8 &&
    Math.abs(contact.sub(new Vector3(...leaderFace.origin)).dot(normal)) <= 1e-7;
}
