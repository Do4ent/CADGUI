export interface NumberRules { min?: number; max?: number; exclusiveMin?: boolean; }

/** Accept finite decimal values only; preserve raw input in the field while editing. */
export function validateNumber(raw: string, rules: NumberRules = {}): string | undefined {
  const text = raw.trim();
  if (!text) return 'Введите значение';
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text) || !Number.isFinite(Number(text))) return 'Введите конечное число';
  const value = Number(text);
  if (rules.min !== undefined && (rules.exclusiveMin ? value <= rules.min : value < rules.min)) return `Значение должно быть ${rules.exclusiveMin ? 'больше' : 'не меньше'} ${rules.min}`;
  if (rules.max !== undefined && value > rules.max) return `Значение должно быть не больше ${rules.max}`;
  return undefined;
}
