import {validateSketchModelState} from './model';
import {suppressionFeatures} from './suppressionValidation';
import type {SketchModelState} from './types';

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
