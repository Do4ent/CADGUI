import {validateAssemblyMates,type AssemblyMate} from './assemblyMates';
import {validateAssemblyInstances,type AssemblyInstance} from './assemblyInstances';
import {resolveAssemblyHierarchy,validateAssemblyGroups,type AssemblyGroup} from './assemblyHierarchy';
import {ownedSketchBodyIds} from '../sketch/cutGraph';
import {createSketchModelState,validateSketchModelState,validateSketchReferences} from '../sketch/model';
import type {SketchModelState} from '../sketch/types';
import {createExactModelState,validateExactModelState,type ExactModelState} from '../kernel/model';
import {createModelAnnotationState,validateModelAnnotationState,resolveModelAnnotation,type ModelAnnotationState} from '../modelAnnotations/model';
import {createDrawingDocument, validateDrawingDocument} from '../drawing/model';
import {type DrawingDocument} from '../drawing/types';
export const DOCUMENT_SCHEMA_VERSION = 21;
export type CadItem = {
  id: string; name: string; kind: 'box' | 'cylinder' | 'shaft' | 'gear' | 'pipe';
  pos: [number, number, number]; size: [number, number, number];
  color: string; visible: boolean; group: string;
};
export type CadDocument = {schemaVersion: typeof DOCUMENT_SCHEMA_VERSION; assemblyGroups?: AssemblyGroup[]; assemblyFixedMates?: AssemblyMate[]; assemblyInstances?: AssemblyInstance[]; sketchModel: SketchModelState; exactModel: ExactModelState; modelAnnotations: ModelAnnotationState; drawing: DrawingDocument; id: string; name: string; items: CadItem[]; modifiedAt: string};
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
  if (typeof value.schemaVersion !== 'number' || !Number.isInteger(value.schemaVersion) || value.schemaVersion < 1 || value.schemaVersion > DOCUMENT_SCHEMA_VERSION) throw new Error('Unsupported document schema version');
  if (!text(value.id) || !text(value.name) || typeof value.modifiedAt !== 'string' || !Number.isFinite(Date.parse(value.modifiedAt))) throw new Error('Malformed document metadata');
  const modelAnnotations=(Number(value.schemaVersion) >= 3) ? validateModelAnnotationState(value.modelAnnotations) : createModelAnnotationState();
  const items=validateItems(value.items);
  validateSceneAnnotationReferences(items,modelAnnotations);
  const exactModel=Number(value.schemaVersion)>=4?validateExactModelState(value.exactModel):createExactModelState();
  const sketchModel=Number(value.schemaVersion)>=5?validateSketchModelState(value.sketchModel):createSketchModelState();
  if(Number(value.schemaVersion)<13 && sketchModel.suppressedFeatures!==undefined) throw new Error('Suppression requires document schema 13');
  if(Number(value.schemaVersion)<14 && sketchModel.suppressedFeatures?.some(item=>item.groupId)) throw new Error('Grouped suppression requires document schema 14');
  validateSketchReferences(sketchModel,exactModel);
  const hasAssembly = Object.hasOwn(value,'assemblyInstances');
  if (hasAssembly && Number(value.schemaVersion) < 15) throw Error('Вхождения требуют схему 15');
  const sources = new Set([...exactModel.bodies.map(body=>body.id),...ownedSketchBodyIds(sketchModel)]);
  const assemblyInstances = hasAssembly ? validateAssemblyInstances(value.assemblyInstances,sources) : undefined;
  const hasMates = Object.hasOwn(value,'assemblyFixedMates');
  if(hasMates && Number(value.schemaVersion)<16) throw Error('Сопряжения требуют схему 16');
  const assemblyFixedMates = hasMates ? validateAssemblyMates(value.assemblyFixedMates) : undefined;
  const hasGroups = Object.hasOwn(value,'assemblyGroups');
  if ((hasGroups || assemblyInstances?.some(instance => instance.parentId !== undefined)) && value.schemaVersion < 17) throw Error('Подсборки требуют схему 17');
  const assemblyGroups = hasGroups ? validateAssemblyGroups(value.assemblyGroups) : undefined;
  if (value.schemaVersion < 18 && assemblyFixedMates?.length && assemblyInstances?.some(instance =>
    instance.parentId !== undefined && assemblyFixedMates.some(mate => mate.leaderId === instance.id || mate.followerId === instance.id))) {
    throw Error('Сопряжения в подсборках требуют схему 18');
  }
  if (value.schemaVersion < 19 && assemblyFixedMates?.length) {
    const parents = new Map(assemblyInstances?.map(instance => [instance.id, instance.parentId]));
    if (assemblyFixedMates.some(mate => parents.get(mate.leaderId) !== parents.get(mate.followerId))) {
      throw Error('Сопряжения между подсборками требуют схему 19');
    }
  }
  if (value.schemaVersion < 20 && assemblyFixedMates?.some(mate => 'distance' in mate)) {
    throw Error('Сопряжение по расстоянию требует схему 20');
  }
  if (value.schemaVersion < 21 && assemblyFixedMates?.some(mate => 'angle' in mate)) {
    throw Error('Угловое сопряжение требует схему 21');
  }
  resolveAssemblyHierarchy(assemblyInstances??[],assemblyGroups??[],assemblyFixedMates??[]);
  return {schemaVersion: DOCUMENT_SCHEMA_VERSION, ...(hasGroups ? {assemblyGroups}:{}), ...(hasMates ? {assemblyFixedMates}:{}), ...(hasAssembly ? {assemblyInstances}:{}), sketchModel, exactModel, modelAnnotations, drawing: value.schemaVersion === 1 ? createDrawingDocument() : validateDrawingDocument(value.drawing), id: value.id, name: value.name, items, modifiedAt: value.modifiedAt};
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
  return validateDocument({schemaVersion: DOCUMENT_SCHEMA_VERSION, sketchModel:createSketchModelState(), exactModel: createExactModelState(), modelAnnotations: createModelAnnotationState(), drawing: createDrawingDocument(), id, name, items: [], modifiedAt: new Date().toISOString()});
}
