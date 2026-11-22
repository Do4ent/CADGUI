import type {Vec3} from '../kernel/types';

export type AssemblyInstance = {
  id: string;
  sourceBodyId: string;
  name: string;
  parentId?: string;
  position: Vec3;
  rotation: Vec3;
};

export function assemblyVector(value: unknown, limit: number): Vec3 {
  if (!Array.isArray(value) || value.length !== 3 ||
      !Array.from(value).every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= limit)) {
    throw Error('Некорректное размещение вхождения');
  }
  return [value[0], value[1], value[2]];
}

export function validateAssemblyInstances(value: unknown, sourceIds: ReadonlySet<string>): AssemblyInstance[] {
  if (!Array.isArray(value) || value.length > 100) throw Error('Допускается до 100 вхождений');
  const ids = new Set<string>();
  return Array.from(value, raw => {
    const hasParent = !!raw && Object.hasOwn(raw, 'parentId');
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) ||
        Object.keys(raw).length !== (hasParent ? 6 : 5) || !['id','sourceBodyId','name','position','rotation'].every(key => Object.hasOwn(raw,key)) ||
        (hasParent && typeof raw.parentId !== 'string') ||
        typeof raw.id !== 'string' || !raw.id.trim() || raw.id.length > 256 || ids.has(raw.id) ||
        typeof raw.sourceBodyId !== 'string' || !sourceIds.has(raw.sourceBodyId) ||
        typeof raw.name !== 'string' || !raw.name.trim() || raw.name.length > 200 || /[\u0000-\u001f]/.test(raw.name)) {
      throw Error('Некорректное вхождение или отсутствует исходное тело');
    }
    ids.add(raw.id);
    return {id:raw.id, sourceBodyId:raw.sourceBodyId, name:raw.name, ...(hasParent ? {parentId:raw.parentId} : {}),
      position:assemblyVector(raw.position,1e6), rotation:assemblyVector(raw.rotation,360)};
  });
}
