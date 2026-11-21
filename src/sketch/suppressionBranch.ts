import {validateSketchModelState,validateSketchReferences} from './model';
import {suppressionFeatures} from './suppressionValidation';
import type {SketchModelState,SuppressedFeatureRecord} from './types';
import {validateExactModelState} from '../kernel/model';
import type {ExactModelState} from '../kernel/types';

/** Compute the affected branch in rebuild order. Suppressed descendants still
 * belong to the branch, so they can constrain a later resume. */
export function describeSuppressionBranch(state: SketchModelState, rootId: string) {
  const source = validateSketchModelState(state);
  const features = suppressionFeatures(source);
  if (!features.some(feature => feature.id === rootId)) {
    throw new Error('Операция отсутствует');
  }

  const suppressed = new Set(source.suppressedFeatures?.map(record => record.featureId));
  const affectedOutputs = new Set<string>();
  return features.flatMap(feature => {
    if (feature.id !== rootId && !feature.inputs.some(input => affectedOutputs.has(input))) {
      return [];
    }
    affectedOutputs.add(feature.bodyId);
    return [{
      featureId: feature.id,
      bodyId: feature.bodyId,
      kind: feature.kind,
      alreadySuppressed: suppressed.has(feature.id),
    }];
  });
}

export function planBranchSuppression(state: SketchModelState, exact: ExactModelState, rootId: string) {
  const branch = describeSuppressionBranch(state, rootId);
  if (branch.length < 2 || branch.some(feature => feature.alreadySuppressed)) {
    throw new Error('Ветвь содержит уже подавленную операцию или не имеет зависимых операций');
  }
  const model = validateExactModelState(exact);
  validateSketchReferences(state, model);
  const members = new Set(branch.map(feature => feature.featureId));
  const features = suppressionFeatures(state);
  const released = new Set(features.filter(feature => members.has(feature.id)).flatMap(feature => feature.inputs));
  const records: SuppressedFeatureRecord[] = branch.map(feature => {
    const {name,color,visible} = model.bodies.find(body => body.id === feature.bodyId)!;
    return {featureId:feature.featureId, groupId:rootId, output:{name,color,visible}};
  });
  const suppressed = [...state.suppressedFeatures??[], ...records];
  const suppressedIds = new Set(suppressed.map(record => record.featureId));
  const consumed = new Set(features.filter(feature => !suppressedIds.has(feature.id)).flatMap(feature => feature.inputs));
  const outputs = new Set(branch.map(feature => feature.bodyId));
  const next = validateSketchModelState({...state,suppressedFeatures:suppressed});
  const bodies = model.bodies.filter(body => !outputs.has(body.id)).map(body =>
    released.has(body.id) && !consumed.has(body.id) ? {...body,visible:true} : body,
  );
  validateSketchReferences(next, {bodies});
  return {state:next,exact:{...model,bodies}};
}

export function planBranchResume(state: SketchModelState, exact: ExactModelState, groupId: string) {
  const source = validateSketchModelState(state);
  const model = validateExactModelState(exact);
  validateSketchReferences(source, model);
  const records = source.suppressedFeatures??[];
  const group = records.filter(record => record.groupId === groupId);
  if (!group.length) throw new Error('Группа подавления отсутствует');
  const features = suppressionFeatures(source);
  const byId = new Map(features.map(feature => [feature.id, feature]));
  const inputs = new Set(group.flatMap(record => byId.get(record.featureId)!.inputs));
  const restored = new Map(group.map(record => [byId.get(record.featureId)!.bodyId,record.output]));
  const next = validateSketchModelState({...source,suppressedFeatures:records.filter(record => record.groupId !== groupId)});
  return {
    state:next,
    exact:{...model,bodies:model.bodies.map(body => inputs.has(body.id)?{...body,visible:false}:body)},
    restored,
  };
}
