export type NumericParameter = {name: string; value: number; unit: 'mm' | 'deg'; min?: number; max?: number};
export type CommandKind = 'box' | 'cylinder' | 'pipe';
export type CommandDraft = {kind: CommandKind; parameters: NumericParameter[]};
export const commandParameters: Record<CommandKind, readonly string[]> = {
  box: ['width', 'height', 'depth'], cylinder: ['radius', 'height'],
  pipe: ['outerRadius', 'innerRadius', 'height'],
};
export function validateNumericParameter(parameter: NumericParameter): string | null {
  const {name, value, min, max} = parameter;
  if (!Number.isFinite(value)) return name + ': value must be finite';
  if (min !== undefined && !Number.isFinite(min) || max !== undefined && !Number.isFinite(max)) return name + ': bounds must be finite';
  if (min !== undefined && max !== undefined && min > max) return name + ': invalid bounds';
  if (min !== undefined && value < min) return name + ': below minimum ' + min;
  if (max !== undefined && value > max) return name + ': above maximum ' + max;
  return null;
}
export function validateCommandDraft(draft: CommandDraft): string[] {
  if (!Object.prototype.hasOwnProperty.call(commandParameters, draft.kind)) return ['Unsupported command'];
  const required = commandParameters[draft.kind];
  const names = new Set<string>();
  const errors: string[] = [];
  for (const p of draft.parameters) {
    if (names.has(p.name)) errors.push('Duplicate parameter: ' + p.name);
    names.add(p.name);
    if (!required.includes(p.name)) errors.push('Unexpected parameter: ' + p.name);
    if (p.unit !== 'mm') errors.push(p.name + ': expected mm');
    const error = validateNumericParameter(p);
    if (error) errors.push(error);
    if (Number.isFinite(p.value) && p.value <= 0) errors.push(p.name + ': must be greater than zero');
  }
  for (const name of required) if (!names.has(name)) errors.push('Missing parameter: ' + name);
  if (draft.kind === 'pipe') {
    const inner = draft.parameters.find(p => p.name === 'innerRadius')?.value;
    const outer = draft.parameters.find(p => p.name === 'outerRadius')?.value;
    if (inner !== undefined && outer !== undefined && inner >= outer) errors.push('innerRadius: must be smaller than outerRadius');
  }
  return errors;
}
export function createCommandDraft(kind: CommandKind): CommandDraft {
  return {kind, parameters: commandParameters[kind].map(name => ({name, value: name === 'innerRadius' ? 0.25 : name.includes('Radius') || name === 'radius' ? 0.5 : 1, unit: 'mm'}))};
}
/** Bounding dimensions for the prototype renderer, not exact CAD geometry.
 * Pipe wall thickness is validated but is not represented by the current scene Item size. */
export function draftToSize(draft: CommandDraft): [number, number, number] {
  const errors = validateCommandDraft(draft);
  if (errors.length) throw new Error(errors.join('; '));
  const values = Object.fromEntries(draft.parameters.map(p => [p.name, p.value]));
  if (draft.kind === 'box') return [values.width, values.height, values.depth];
  const radius = draft.kind === 'pipe' ? values.outerRadius : values.radius;
  return [radius * 2, values.height, radius * 2];
}
