export const DOCUMENT_SCHEMA_VERSION = 1;
export type CadItem = {
  id: string; name: string; kind: 'box' | 'cylinder' | 'shaft' | 'gear' | 'pipe';
  pos: [number, number, number]; size: [number, number, number];
  color: string; visible: boolean; group: string;
};
export type CadDocument = {schemaVersion: 1; id: string; name: string; items: CadItem[]; modifiedAt: string};
export type LegacyDocumentMetadata = {id: string; name?: string; modifiedAt?: string};
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && !!value.trim();
const vector = (value: unknown, positive = false) => Array.isArray(value) && value.length === 3 && value.every(n => typeof n === 'number' && Number.isFinite(n) && (!positive || n > 0));
export function validateItems(value: unknown): CadItem[] {
  if (!Array.isArray(value)) throw new Error('Document items must be an array');
  const ids = new Set<string>();
  for (const item of value) {
    if (!record(item) || !text(item.id) || !text(item.name) || typeof item.kind !== 'string' || !['box', 'cylinder', 'shaft', 'gear', 'pipe'].includes(item.kind) ||
        !vector(item.pos) || !vector(item.size, true) || typeof item.color !== 'string' || !/^#[\da-f]{6}$/i.test(item.color) ||
        typeof item.visible !== 'boolean' || typeof item.group !== 'string') throw new Error('Malformed document component');
    if (ids.has(item.id)) throw new Error('Duplicate document component id: ' + item.id);
    ids.add(item.id);
  }
  return value.map(item => ({...item, pos: [...item.pos], size: [...item.size]})) as CadItem[];
}
export function validateDocument(value: unknown): CadDocument {
  if (!record(value)) throw new Error('Invalid document');
  if (value.schemaVersion !== DOCUMENT_SCHEMA_VERSION) throw new Error('Unsupported document schema version');
  if (!text(value.id) || !text(value.name) || typeof value.modifiedAt !== 'string' || !Number.isFinite(Date.parse(value.modifiedAt))) throw new Error('Malformed document metadata');
  return {schemaVersion: 1, id: value.id, name: value.name, items: validateItems(value.items), modifiedAt: value.modifiedAt};
}
/** Legacy bendcore-items arrays require explicit metadata to avoid identity loss. */
export function parseDocument(json: string, legacy?: LegacyDocumentMetadata): CadDocument {
  let value: unknown;
  try { value = JSON.parse(json); } catch { throw new Error('Invalid document JSON'); }
  if (Array.isArray(value) || (record(value) && value.format === 'bendcore-demo-v1')) {
    if (!legacy) throw new Error('Legacy document requires an id and name');
    return validateDocument({...createDocument(legacy.id, legacy.name), items: Array.isArray(value) ? value : value.items, modifiedAt: legacy.modifiedAt ?? new Date().toISOString()});
  }
  return validateDocument(value);
}
export function serializeDocument(document: CadDocument): string {return JSON.stringify(validateDocument(document), null, 2);}
export function createDocument(id: string, name = 'Без имени'): CadDocument {
  return validateDocument({schemaVersion: 1, id, name, items: [], modifiedAt: new Date().toISOString()});
}
