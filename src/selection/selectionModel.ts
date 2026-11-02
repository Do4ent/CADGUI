export type SelectionState = { selectedIds: string[]; anchorId: string | null };
export type SelectionMode = 'replace' | 'toggle' | 'range' | 'add-range';
export const emptySelection: SelectionState = { selectedIds: [], anchorId: null };

/** Drop removed IDs and duplicates without mutating the caller's state. */
export function pruneSelection(state: SelectionState, validIds: readonly string[]): SelectionState {
  const valid = new Set(validIds);
  return {
    selectedIds: [...new Set(state.selectedIds)].filter(id => valid.has(id)),
    anchorId: state.anchorId !== null && valid.has(state.anchorId) ? state.anchorId : null,
  };
}

export function selectItem(state: SelectionState, id: string, orderedIds: readonly string[], mode: SelectionMode = 'replace'): SelectionState {
  if (!orderedIds.includes(id)) return state;
  const current = pruneSelection(state, orderedIds);
  if (mode === 'replace') return { selectedIds: [id], anchorId: id };
  if (mode === 'toggle') return {
    selectedIds: current.selectedIds.includes(id) ? current.selectedIds.filter(x => x !== id) : [...current.selectedIds, id],
    anchorId: id,
  };
  // A deleted anchor must fall back to the clicked item, never array index -1.
  const anchorId = current.anchorId ?? id;
  const start = orderedIds.indexOf(anchorId), end = orderedIds.indexOf(id);
  const range = orderedIds.slice(Math.min(start, end), Math.max(start, end) + 1);
  return { selectedIds: [...new Set(mode === 'add-range' ? [...current.selectedIds, ...range] : range)], anchorId };
}

/** Shared by tree and viewport; Cmd mirrors Ctrl on macOS. */
export function selectionMode(modifiers: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean }): SelectionMode {
  const additive = modifiers.ctrlKey || modifiers.metaKey;
  return modifiers.shiftKey ? additive ? 'add-range' : 'range' : additive ? 'toggle' : 'replace';
}

/** Box hit IDs are normalized into model order so hit-test order cannot affect state. */
export function selectItems(state: SelectionState, ids: readonly string[], orderedIds: readonly string[], mode: 'replace' | 'add' | 'toggle' = 'replace'): SelectionState {
  const hits = new Set(ids);
  const normalized = [...new Set(orderedIds)].filter(id => hits.has(id));
  const current = pruneSelection(state, orderedIds);
  const selected = new Set(mode === 'replace' ? [] : current.selectedIds);
  for (const id of normalized) {
    if (mode === 'toggle' && selected.has(id)) selected.delete(id);
    else selected.add(id);
  }
  return { selectedIds: [...selected], anchorId: normalized.at(-1) ?? (mode === 'replace' ? null : current.anchorId) };
}
