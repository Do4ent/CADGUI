import { useId } from 'react';
import { TechnicalIcon, type TechnicalIconKind } from '../icons/TechnicalIcon';

export interface ParameterFieldProps {
  label: string;
  icon: TechnicalIconKind;
  value: string;
  onChange: (value: string) => void;
  unit?: string;
  error?: string;
  help?: string;
}

export function ParameterField({ label, icon, value, onChange, unit, error, help }: ParameterFieldProps) {
  const id = useId();
  const descriptionId = `${id}-description`;
  return <div className="bc-parameter">
    <label htmlFor={id} title={help}><span aria-hidden="true"><TechnicalIcon kind={icon} size={18} /></span>{label}</label>
    <div className="bc-parameter-input">
      <input id={id} type="text" inputMode="decimal" value={value} required
        aria-invalid={Boolean(error)} aria-describedby={error || help || unit ? descriptionId : undefined}
        onChange={event => onChange(event.target.value)} />
      {unit && <span className="bc-parameter-unit" aria-hidden="true">{unit}</span>}
    </div>
    {(error || help || unit) && <div id={descriptionId} className={error ? 'bc-parameter-error' : 'bc-parameter-help'} role={error ? 'alert' : undefined}>
      {error || [help, unit].filter(Boolean).join(' · ')}
    </div>}
  </div>;
}
