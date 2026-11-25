import React from 'react';
import { useTranslation } from 'react-i18next';
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
  label,
  value,
  onChange,
  id = 'catalog-traction',
  disabled,
  showLabel = true,
  triggerClassName,
}) {
  const { t } = useTranslation('catalog');
  const resolvedLabel = label ?? t('detail.fieldTraction');
  const v = value != null ? String(value) : '';
  const isLegacy = v !== '' && !CATALOG_TRACTION_OPTIONS.includes(v);

  const selectValue = v === '' ? '__none__' : isLegacy ? v : v;

  return (
    <div className={showLabel ? 'space-y-2' : undefined}>
      {showLabel ? <Label htmlFor={id}>{resolvedLabel}</Label> : null}
      <Select
        value={selectValue}
        onValueChange={(nv) => {
          if (nv === '__none__') onChange('');
          else onChange(nv);
        }}
        disabled={disabled}
      >
        <SelectTrigger
          id={id}
          className={triggerClassName}
          aria-label={showLabel ? undefined : resolvedLabel}
        >
          <SelectValue placeholder={t('detail.optional')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">{t('detail.unspecified')}</SelectItem>
          {isLegacy && (
            <SelectItem value={v}>
              {t('detail.legacyValue', { value: v })}
            </SelectItem>
          )}
          {CATALOG_TRACTION_OPTIONS.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {t(`values.traction.${opt}`, { defaultValue: opt })}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
