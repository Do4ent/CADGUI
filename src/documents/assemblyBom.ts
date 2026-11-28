import type {ExactBody} from '../kernel/types';
import type {AssemblyGroup} from './assemblyHierarchy';
import type {AssemblyInstance} from './assemblyInstances';

export type AssemblyBomRow = {
  sourceBodyId: string;
  name: string;
  quantity: number;
  placements: {path: string[]; quantity: number}[];
  available: boolean;
};

export function buildAssemblyBom(
  instances: readonly AssemblyInstance[],
  groups: readonly AssemblyGroup[],
  bodies: readonly ExactBody[],
): AssemblyBomRow[] {
  const bodyById = new Map(bodies.map(body => [body.id,body]));
  const groupById = new Map(groups.map(group => [group.id,group]));
  const locationByParent = new Map<string | undefined, {key: string; path: string[]}>();
  locationByParent.set(undefined,{key:'[]',path:[]});
  function assemblyLocation(parentId: string | undefined) {
    const cached = locationByParent.get(parentId);
    if (cached) return cached;
    const ids: string[] = [];
    const path: string[] = [];
    const visited = new Set<string>();
    for (let id = parentId; id !== undefined;) {
      if (visited.has(id)) throw Error('Циклическая вложенность подсборок');
      const group = groupById.get(id);
      if (!group) throw Error('Родительская подсборка не найдена');
      visited.add(id);
      ids.push(id);
      path.push(group.name);
      id = group.parentId;
    }
    const location = {key:JSON.stringify(ids.reverse()),path:path.reverse()};
    locationByParent.set(parentId,location);
    return location;
  }

  const totals = new Map<string, {row: AssemblyBomRow; byLocation: Map<string, AssemblyBomRow['placements'][number]>}>();
  for (const {name,sourceBodyId,parentId} of instances) {
    let entry = totals.get(sourceBodyId);
    if (!entry) {
      const body = bodyById.get(sourceBodyId);
      entry = {row:{sourceBodyId,name:body?.name??name,quantity:0,placements:[],available:!!body},byLocation:new Map()};
      totals.set(sourceBodyId,entry);
    }
    const {key,path} = assemblyLocation(parentId);
    let placement = entry.byLocation.get(key);
    if (!placement) {
      placement = {path:[...path],quantity:0};
      entry.byLocation.set(key,placement);
      entry.row.placements.push(placement);
    }
    placement.quantity++;
    entry.row.quantity++;
  }
  return Array.from(totals.values(), entry => entry.row);
}

const csvCell = (value: string) => {
  // Quoting alone still lets spreadsheet applications evaluate formula-like values.
  const safe = /^[\s\u0000-\u001f]*[=+\-@]/u.test(value) || /^[\t\r\n]/.test(value) ? "'" + value : value;
  return '"' + safe.replaceAll('"','""') + '"';
};

export function exportAssemblyBomCsv(rows: readonly AssemblyBomRow[]): string {
  const lines = ['Деталь,Идентификатор источника,Количество,Размещения,Статус'];
  for (const {sourceBodyId,name,quantity,placements,available} of rows) {
    const locations = placements.map(({path,quantity}) =>
      (path.length ? path.join(' / ') : 'Корень сборки') + ' × ' + quantity).join('\n');
    lines.push([csvCell(name),csvCell(sourceBodyId),quantity,csvCell(locations),
      csvCell(available ? 'Доступно' : 'Тело недоступно')].join(','));
  }
  return lines.join('\r\n') + '\r\n';
}
