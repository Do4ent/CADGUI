import {orderedSketchBodyFeatures, type SketchBodyFeature} from './cutGraph';
import type {SketchModelState} from './types';

function operands(node: SketchBodyFeature): string[] {
  return node.kind === 'cut'
    ? [node.feature.targetBodyId]
    : [node.feature.aBodyId, node.feature.bBodyId];
}

/** Swap adjacent siblings without changing any other position in rebuild order. */
export function planSiblingFeatureMove(
  state: SketchModelState, featureId: string, direction: -1 | 1,
): SketchModelState | null {
  const order = orderedSketchBodyFeatures(state);
  const index = order.findIndex(node => node.feature.id === featureId);
  const neighborIndex = index + direction;
  const current = order[index];
  const neighbor = order[neighborIndex];
  if (!current || !neighbor || current.kind !== neighbor.kind) return null;

  const currentInputs = operands(current);
  const neighborInputs = operands(neighbor);
  if (!currentInputs.some(id => neighborInputs.includes(id))) return null;
  if (currentInputs.includes(neighbor.feature.bodyId) ||
      neighborInputs.includes(current.feature.bodyId)) return null;
  if (state.suppressedFeatures?.some(record =>
    record.featureId === featureId || record.featureId === neighbor.feature.id)) return null;

  const swap = <T extends {id: string}>(features: readonly T[]) => {
    const first = features.find(feature => feature.id === featureId)!;
    const second = features.find(feature => feature.id === neighbor.feature.id)!;
    return features.map(feature => feature === first ? second : feature === second ? first : feature);
  };
  const next = current.kind === 'cut' ? {...state, cuts: swap(state.cuts ?? [])}
    : current.kind === 'fusion' ? {...state, fusions: swap(state.fusions ?? [])}
    : {...state, bodyBooleans: swap(state.bodyBooleans ?? [])};
  const expected = order.map(node => node.feature.id);
  [expected[index], expected[neighborIndex]] = [expected[neighborIndex], expected[index]];
  return orderedSketchBodyFeatures(next).every((node, i) => node.feature.id === expected[i])
    ? next
    : null;
}
