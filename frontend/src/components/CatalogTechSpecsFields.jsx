import React from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  CATALOG_TECH_SPEC_LEAD_TEXT_KEYS,
  CATALOG_TECH_SPEC_NUM_FIELDS,
  CATALOG_TECH_SPEC_TEXT_FIELDS,
} from '../data/catalogTechSpecs';

export default function CatalogTechSpecsFields({ form, setForm, idPrefix = 'catalog-tech' }) {
  const { t } = useTranslation('catalog');

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="grid grid-cols-1 gap-4 py-2 sm:grid-cols-2">
      <p className="text-sm text-muted-foreground sm:col-span-2">{t('techSpecs.formHelp')}</p>
      {CATALOG_TECH_SPEC_TEXT_FIELDS.filter((f) =>
        CATALOG_TECH_SPEC_LEAD_TEXT_KEYS.includes(f.key),
      ).map((f) => (
        <div key={f.key} className="space-y-2">
          <Label htmlFor={`${idPrefix}-${f.key}`}>{t(`techSpecs.fields.${f.i18n}`)}</Label>
          <Input
            id={`${idPrefix}-${f.key}`}
            value={form[f.key] ?? ''}
            maxLength={f.maxLength}
            onChange={(e) => setField(f.key, e.target.value)}
          />
        </div>
      ))}
      {CATALOG_TECH_SPEC_NUM_FIELDS.map((f) => (
        <div key={f.key} className="space-y-2">
          <Label htmlFor={`${idPrefix}-${f.key}`}>{t(`techSpecs.fields.${f.i18n}`)}</Label>
          <Input
            id={`${idPrefix}-${f.key}`}
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={form[f.key] ?? ''}
            onChange={(e) => setField(f.key, e.target.value)}
          />
        </div>
      ))}
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-spec_magnet`}>{t('techSpecs.fields.magnet')}</Label>
        <Select
          value={form.spec_magnet || '__none__'}
          onValueChange={(v) => setField('spec_magnet', v === '__none__' ? '' : v)}
        >
          <SelectTrigger id={`${idPrefix}-spec_magnet`}>
            <SelectValue placeholder={t('techSpecs.unspecified')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">{t('techSpecs.unspecified')}</SelectItem>
            <SelectItem value="true">{t('techSpecs.yes')}</SelectItem>
            <SelectItem value="false">{t('techSpecs.no')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {CATALOG_TECH_SPEC_TEXT_FIELDS.filter(
        (f) => !CATALOG_TECH_SPEC_LEAD_TEXT_KEYS.includes(f.key),
      ).map((f) => (
        <div key={f.key} className="space-y-2">
          <Label htmlFor={`${idPrefix}-${f.key}`}>{t(`techSpecs.fields.${f.i18n}`)}</Label>
          <Input
            id={`${idPrefix}-${f.key}`}
            value={form[f.key] ?? ''}
            maxLength={f.maxLength}
            onChange={(e) => setField(f.key, e.target.value)}
          />
        </div>
      ))}
    </div>
  );
}
