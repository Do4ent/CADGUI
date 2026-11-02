import {validateCommandDraft, type CommandDraft} from './parameterValidation';
export type CommandTransaction = {draft: CommandDraft; targetId?: string};
export type CommandHistory<T> = {present: T; past: T[]; future: T[]};
const copyDraft = (draft: CommandDraft): CommandDraft => ({kind: draft.kind, parameters: draft.parameters.map(p => ({...p}))});
/** Opening and editing a transaction never mutates scene/history. Preview is UI-only. */
export function beginCommand(draft: CommandDraft, targetId?: string): CommandTransaction {
  return {draft: copyDraft(draft), targetId};
}
export function updateCommand(transaction: CommandTransaction, name: string, value: number): CommandTransaction {
  return {...transaction, draft: {...transaction.draft, parameters: transaction.draft.parameters.map(p => p.name === name ? {...p, value} : {...p})}};
}
export function cancelCommand(): null { return null; }
export function createCommandHistory<T>(present: T): CommandHistory<T> { return {present, past: [], future: []}; }
/** apply must be pure; invalid drafts cannot reach it. Keep transaction open on errors. */
export function confirmCommand<T>(history: CommandHistory<T>, transaction: CommandTransaction, apply: (present: T, draft: CommandDraft, targetId?: string) => T): {history: CommandHistory<T>; transaction: CommandTransaction | null; errors: string[]} {
  const errors = validateCommandDraft(transaction.draft);
  if (errors.length) return {history, transaction, errors};
  const next = apply(history.present, copyDraft(transaction.draft), transaction.targetId);
  if (Object.is(next, history.present)) return {history, transaction: null, errors: []};
  return {history: {present: next, past: [...history.past.slice(-49), history.present], future: []}, transaction: null, errors: []};
}
export function undoCommand<T>(history: CommandHistory<T>): CommandHistory<T> {
  if (!history.past.length) return history;
  return {present: history.past[history.past.length - 1], past: history.past.slice(0, -1), future: [history.present, ...history.future]};
}
export function redoCommand<T>(history: CommandHistory<T>): CommandHistory<T> {
  if (!history.future.length) return history;
  return {present: history.future[0], past: [...history.past, history.present], future: history.future.slice(1)};
}
