import {createSketchModelState,validateSketchModelState,validateSketchReferences} from '../sketch/model';
import type {SketchModelState} from '../sketch/types';
import {createExactModelState,validateExactModelState,type ExactModelState} from '../kernel/model';
import {createModelAnnotationState,validateModelAnnotationState,resolveModelAnnotation,type ModelAnnotationState} from '../modelAnnotations/model';
import {createDrawingDocument, validateDrawingDocument} from '../drawing/model';
import {type DrawingDocument} from '../drawing/types';
export const DOCUMENT_SCHEMA_VERSION = 11;
export type CadItem = {
  id: string; name: string; kind: 'box' | 'cylinder' | 'shaft' | 'gear' | 'pipe';
  pos: [number, number, number]; size: [number, number, number];
  color: string; visible: boolean; group: string;
};
export type CadDocument = {schemaVersion: 11; sketchModel: SketchModelState; exactModel: ExactModelState; modelAnnotations: ModelAnnotationState; drawing: DrawingDocument; id: string; name: string; items: CadItem[]; modifiedAt: string};
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
/** Missing components remain repairable; arithmetic overflow never enters autosave. */
export function validateSceneAnnotationReferences(items:readonly CadItem[],state:ModelAnnotationState):void {
 const byId=new Map(items.map(item=>[item.id,item]));
 for(const annotation of state.annotations){
  const component=annotation.anchor.kind==='component'?byId.get(annotation.anchor.componentId):undefined;
  resolveModelAnnotation(annotation,component?[component]:[]);
 }
}
export function validateDocument(value: unknown): CadDocument {
  if (!record(value)) throw new Error('Invalid document');
  if (value.schemaVersion !== 1 && value.schemaVersion !== 2 && value.schemaVersion !== 3 && value.schemaVersion !== 4 && value.schemaVersion !== 5 && value.schemaVersion !== 6 && value.schemaVersion !== 7 && value.schemaVersion !== 8 && value.schemaVersion !== 9 && value.schemaVersion !== 10 && value.schemaVersion !== DOCUMENT_SCHEMA_VERSION) throw new Error('Unsupported document schema version');
  if (!text(value.id) || !text(value.name) || typeof value.modifiedAt !== 'string' || !Number.isFinite(Date.parse(value.modifiedAt))) throw new Error('Malformed document metadata');
  const modelAnnotations=(Number(value.schemaVersion) >= 3) ? validateModelAnnotationState(value.modelAnnotations) : createModelAnnotationState();
  const items=validateItems(value.items);
  validateSceneAnnotationReferences(items,modelAnnotations);
  const exactModel=Number(value.schemaVersion)>=4?validateExactModelState(value.exactModel):createExactModelState();
  const sketchModel=Number(value.schemaVersion)>=5?validateSketchModelState(value.sketchModel):createSketchModelState();
  validateSketchReferences(sketchModel,exactModel);
  return {schemaVersion: 11, sketchModel, exactModel, modelAnnotations, drawing: value.schemaVersion === 1 ? createDrawingDocument() : validateDrawingDocument(value.drawing), id: value.id, name: value.name, items, modifiedAt: value.modifiedAt};
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
  return validateDocument({schemaVersion: 11, sketchModel:createSketchModelState(), exactModel: createExactModelState(), modelAnnotations: createModelAnnotationState(), drawing: createDrawingDocument(), id, name, items: [], modifiedAt: new Date().toISOString()});
}
