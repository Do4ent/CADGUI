import {sha256} from '@noble/hashes/sha256';
import {bytesToHex} from '@noble/hashes/utils';
import type {ExactBody, PlanarFaceDescriptor, PlanarFaceInspection} from '../kernel/types';
import type {AssemblyInstance} from './assemblyInstances';

export type AssemblyPlanarFaceReference = Readonly<{
  version: 1;
  occurrenceId: string;
  sourceBodyId: string;
  snapshotDigest: string;
  faceIndex: number;
}>;

type FaceSources = {
  instances: readonly AssemblyInstance[];
  bodies: readonly ExactBody[];
};
export type InspectPlanarFaces = (brep: string) => Promise<PlanarFaceInspection>;
type Resolution =
  | {status: 'resolved'; face: PlanarFaceDescriptor}
  | {status: 'broken' | 'stale' | 'unavailable'};

const referenceKeys = ['version','occurrenceId','sourceBodyId','snapshotDigest','faceIndex'] as const;
const validId = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= 256;
const validIndex = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

export function validateAssemblyPlanarFaceReference(value: unknown): AssemblyPlanarFaceReference {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Некорректная ссылка на грань');
  const source = value as Record<string, unknown>;
  if (Object.keys(source).length !== referenceKeys.length || !referenceKeys.every(key => Object.hasOwn(source,key)) ||
      source.version !== 1 || !validId(source.occurrenceId) || !validId(source.sourceBodyId) ||
      typeof source.snapshotDigest !== 'string' || !/^[0-9a-f]{64}$/.test(source.snapshotDigest) ||
      !validIndex(source.faceIndex)) {
    throw Error('Некорректная ссылка на грань');
  }
  return {
    version: 1, occurrenceId: source.occurrenceId, sourceBodyId: source.sourceBodyId,
    snapshotDigest: source.snapshotDigest, faceIndex: source.faceIndex,
  };
}

const bodyDigests = new WeakMap<ExactBody, {brep: string; digest: string}>();

export function exactBodySnapshotDigest(body: ExactBody): string {
  const {brep} = body;
  const cached = bodyDigests.get(body);
  if (cached?.brep === brep) return cached.digest;
  if (/[\ud800-\udfff]/u.test(brep)) throw Error('Снимок тела содержит некорректный Unicode');
  const digest = bytesToHex(sha256(brep));
  bodyDigests.set(body, {brep,digest});
  return digest;
}

export function assertAssemblyPlanarFaceSource(sources: FaceSources, reference: AssemblyPlanarFaceReference): void {
  const occurrence = sources.instances.find(item => item.id === reference.occurrenceId);
  const body = sources.bodies.find(item => item.id === reference.sourceBodyId);
  if (!body || occurrence?.sourceBodyId !== reference.sourceBodyId || exactBodySnapshotDigest(body) !== reference.snapshotDigest) {
    throw Error('Геометрия плоской грани изменилась. Сначала отсоедините сопряжение.');
  }
}

async function planarFace(brep: string, faceIndex: number, inspect: InspectPlanarFaces): Promise<PlanarFaceDescriptor | undefined> {
  const result = await inspect(brep);
  if (result.kind !== 'planar-faces' || result.brep !== brep) throw Error('Результат проверки относится к другому снимку тела');
  const faces = result.faces.filter(face => face.faceIndex === faceIndex);
  if (faces.length > 1) throw Error('Неоднозначный индекс плоской грани');
  const face = faces[0];
  if (!face) return;
  const finiteVector = (value: readonly number[]) =>
    Array.isArray(value) && value.length === 3 && Array.from(value).every(Number.isFinite);
  if (!finiteVector(face.origin) || !finiteVector(face.normal) || Math.abs(Math.hypot(...face.normal) - 1) > 1e-9) {
    throw Error('Некорректная опорная плоскость грани');
  }
  return {faceIndex, origin: [...face.origin], normal: [...face.normal]};
}

/** Capture against immutable command inputs. Confirm against the current document before committing. */
export async function captureAssemblyPlanarFaceReference(
  sources: FaceSources, occurrenceId: string, faceIndex: number, inspect: InspectPlanarFaces,
): Promise<AssemblyPlanarFaceReference> {
  if (!validIndex(faceIndex)) throw Error('Некорректный индекс грани');
  const instance = sources.instances.find(item => item.id === occurrenceId);
  const body = sources.bodies.find(item => item.id === instance?.sourceBodyId);
  if (!body) throw Error('Исходное тело вхождения не найдено');
  const {brep, id: sourceBodyId} = body;
  const snapshotDigest = exactBodySnapshotDigest(body);
  if (!await planarFace(brep, faceIndex, inspect)) throw Error('Плоская грань не найдена');
  return validateAssemblyPlanarFaceReference({
    version: 1, occurrenceId, sourceBodyId, snapshotDigest, faceIndex,
  });
}

/** Resolve only in the supplied document snapshot. A changed BREP is never searched by similarity. */
export async function resolveAssemblyPlanarFaceReference(
  sources: FaceSources, value: AssemblyPlanarFaceReference, inspect: InspectPlanarFaces,
): Promise<Resolution> {
  const reference = validateAssemblyPlanarFaceReference(value);
  const instance = sources.instances.find(item => item.id === reference.occurrenceId);
  if (!instance) return {status: 'broken'};
  if (instance.sourceBodyId !== reference.sourceBodyId) return {status: 'stale'};
  const body = sources.bodies.find(item => item.id === reference.sourceBodyId);
  if (!body) return {status: 'broken'};
  const {brep} = body;
  if (exactBodySnapshotDigest(body) !== reference.snapshotDigest) return {status: 'stale'};
  const face = await planarFace(brep, reference.faceIndex, inspect);
  return face ? {status:'resolved', face} : {status:'unavailable'};
}
