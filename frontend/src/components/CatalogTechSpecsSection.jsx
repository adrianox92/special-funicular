import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader } from './ui/card';
import { labelMotorPosition } from '../data/motorPosition';
import {
  CATALOG_TECH_SPEC_LEAD_TEXT_KEYS,
  CATALOG_TECH_SPEC_NUM_FIELDS,
  CATALOG_TECH_SPEC_TEXT_FIELDS,
  formatTechSpecNumber,
  hasCatalogTechSpecs,
} from '../data/catalogTechSpecs';

function DetailRow({ label, value }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[minmax(8rem,40%)_1fr] gap-1 sm:gap-4 py-3 first:pt-0">
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  );
}

function pushRow(rows, key, label, value) {
  if (value == null || String(value).trim() === '' || value === '—') return;
  rows.push({ key, label, value });
}

export default function CatalogTechSpecsSection({ item }) {
  const { t } = useTranslation('catalog');

  const rows = useMemo(() => {
    if (!hasCatalogTechSpecs(item)) return [];
    const out = [];
    const label = (i18nKey) => t(`techSpecs.fields.${i18nKey}`);

    for (const f of CATALOG_TECH_SPEC_TEXT_FIELDS) {
      if (!CATALOG_TECH_SPEC_LEAD_TEXT_KEYS.includes(f.key) || f.key === 'spec_motor') continue;
      pushRow(out, f.key, label(f.i18n), item[f.key]);
    }
    for (const f of CATALOG_TECH_SPEC_NUM_FIELDS) {
      pushRow(out, f.key, label(f.i18n), formatTechSpecNumber(item[f.key]));
    }
    if (item.spec_magnet === true) {
      pushRow(out, 'spec_magnet', label('magnet'), t('techSpecs.yes'));
    } else if (item.spec_magnet === false) {
      pushRow(out, 'spec_magnet', label('magnet'), t('techSpecs.no'));
    }
    pushRow(out, 'spec_motor', label('motor'), item.spec_motor);
    if (item.motor_position) {
      pushRow(out, 'motor_position', label('motorMount'), labelMotorPosition(item.motor_position, t));
    }
    if (item.traction) {
      pushRow(
        out,
        'traction',
        label('drivetrain'),
        t(`values.traction.${item.traction}`, { defaultValue: item.traction }),
      );
    }
    for (const f of CATALOG_TECH_SPEC_TEXT_FIELDS) {
      if (CATALOG_TECH_SPEC_LEAD_TEXT_KEYS.includes(f.key)) continue;
      pushRow(out, f.key, label(f.i18n), item[f.key]);
    }
    return out;
  }, [item, t]);

  if (!rows.length) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <h2 className="text-xl font-semibold leading-none tracking-tight">{t('techSpecs.title')}</h2>
      </CardHeader>
      <CardContent>
        <dl className="space-y-0 divide-y divide-border">
          {rows.map((row) => (
            <DetailRow key={row.key} label={row.label} value={row.value} />
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
