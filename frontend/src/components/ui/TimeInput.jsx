import * as React from 'react';
import { Input } from './input';
import { formatTimeOnChange, normalizeTimeOnBlur } from '../../utils/timeInputUtils';

const TimeInput = React.forwardRef(
  ({ value, onChange, onBlur, inputMode = 'numeric', placeholder = '00:00.000', ...props }, ref) => {
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
      <Input
        ref={ref}
        type="text"
        inputMode={inputMode}
        placeholder={placeholder}
        value={value ?? ''}
        onChange={handleChange}
        onBlur={handleBlur}
        autoComplete="off"
        {...props}
      />
    );
  }
);

TimeInput.displayName = 'TimeInput';

export { TimeInput };
