import React from 'react';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { CATALOG_TRACTION_OPTIONS } from '../data/catalogTractionOptions';

/**
 * Tracción del catálogo: solo valores fijos; si el ítem tenía texto libre distinto, se muestra como opción legacy.
 */
export default function CatalogTractionSelect({
  label = 'Tracción',
  value,
  onChange,
  id = 'catalog-traction',
  disabled,
}) {
  const v = value != null ? String(value) : '';
  const isLegacy = v !== '' && !CATALOG_TRACTION_OPTIONS.includes(v);

  const selectValue = v === '' ? '__none__' : isLegacy ? v : v;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={selectValue}
        onValueChange={(nv) => {
          if (nv === '__none__') onChange('');
          else onChange(nv);
        }}
        disabled={disabled}
      >
        <SelectTrigger id={id}>
          <SelectValue placeholder="Opcional" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">— Sin especificar —</SelectItem>
          {isLegacy && (
            <SelectItem value={v}>
              {v} (valor anterior)
            </SelectItem>
          )}
          {CATALOG_TRACTION_OPTIONS.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
