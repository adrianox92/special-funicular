import * as React from 'react';
import { Input } from './input';
import { cn } from './utils';
import { formatTimeOnChange, normalizeTimeOnBlur } from '../../utils/timeInputUtils';

export const TIME_INPUT_HINT =
  'Escribe solo dígitos (sin : ni .). Se interpretan de derecha a izquierda: milisegundos, segundos y minutos. Ej.: 11324 → 00:11.324.';

export function TimeInputHint({ className }) {
  return <p className={cn('text-xs text-muted-foreground', className)}>{TIME_INPUT_HINT}</p>;
}

const TimeInput = React.forwardRef(
  (
    {
      value,
      onChange,
      onBlur,
      inputMode = 'numeric',
      placeholder = '00:00.000',
      showHint = false,
      hint = TIME_INPUT_HINT,
      className,
      ...props
    },
    ref
  ) => {
    const handleChange = (event) => {
      const digits = event.target.value.replace(/\D/g, '').slice(0, 7);
      const formatted =
        digits.length === 7 ? normalizeTimeOnBlur(digits) : formatTimeOnChange(event.target.value);
      onChange?.(formatted);
    };

    const handleBlur = (event) => {
      const normalized = normalizeTimeOnBlur(value ?? event.target.value);
      if (normalized !== (value ?? '')) {
        onChange?.(normalized);
      }
      onBlur?.(event);
    };

    return (
      <div className="space-y-1">
        <Input
          ref={ref}
          type="text"
          inputMode={inputMode}
          placeholder={placeholder}
          value={value ?? ''}
          onChange={handleChange}
          onBlur={handleBlur}
          autoComplete="off"
          className={className}
          {...props}
        />
        {showHint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
    );
  }
);

TimeInput.displayName = 'TimeInput';

export { TimeInput };
