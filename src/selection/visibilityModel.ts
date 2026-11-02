export type VisibleItem = { id: string; visible: boolean };
export type VisibilityHistory<T extends VisibleItem> = { present: T[]; past: T[][]; future: T[][] };
export type VisibilityAction = 'hide' | 'show' | 'isolate' | 'show-all';

/** One set operation produces one undo step; no-op operations preserve redo. */
export function changeVisibility<T extends VisibleItem>(history: VisibilityHistory<T>, selectedIds: readonly string[], action: VisibilityAction): VisibilityHistory<T> {
  const selected = new Set(selectedIds);
  if (action === 'isolate' && !history.present.some(item => selected.has(item.id))) return history;
  let changed = false;
  const present = history.present.map(item => {
    const visible = action === 'show-all' ? true : action === 'isolate' ? selected.has(item.id) : selected.has(item.id) ? action === 'show' : item.visible;
    if (visible === item.visible) return item;
    changed = true;
    return { ...item, visible };
  });
  return changed ? { present, past: [...history.past, history.present], future: [] } : history;
}
export function undoVisibility<T extends VisibleItem>(history: VisibilityHistory<T>): VisibilityHistory<T> {
  const present = history.past.at(-1);
  return present ? { present, past: history.past.slice(0, -1), future: [history.present, ...history.future] } : history;
}
export function redoVisibility<T extends VisibleItem>(history: VisibilityHistory<T>): VisibilityHistory<T> {
  const present = history.future[0];
  return present ? { present, past: [...history.past, history.present], future: history.future.slice(1) } : history;
}
