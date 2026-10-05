import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeftRight,
  Box,
  Car,
  CircleDot,
  Cog,
  Cpu,
  Disc,
  Gauge,
  Lightbulb,
  Magnet,
  Maximize2,
  MoveHorizontal,
  Palette,
  Ruler,
  Scale,
  UnfoldVertical,
} from 'lucide-react';
import { Card, CardContent, CardHeader } from './ui/card';
import { labelMotorPosition } from '../data/motorPosition';
import {
  CATALOG_TECH_SPEC_LEAD_TEXT_KEYS,
  CATALOG_TECH_SPEC_LIGHT_FIELDS,
  CATALOG_TECH_SPEC_NUM_FIELDS,
  CATALOG_TECH_SPEC_TEXT_FIELDS,
  formatTechSpecNumber,
  hasCatalogTechSpecs,
  labelCatalogTechSpecSystem,
} from '../data/catalogTechSpecs';

const SPEC_ICONS = {
  spec_scale: Ruler,
  spec_body: Box,
  spec_color: Palette,
  spec_system: Cpu,
  spec_length_mm: Maximize2,
  spec_height_mm: UnfoldVertical,
  spec_wheelbase_mm: MoveHorizontal,
  spec_front_track_mm: ArrowLeftRight,
  spec_rear_track_mm: ArrowLeftRight,
  spec_front_axle_width_mm: MoveHorizontal,
  spec_rear_axle_width_mm: MoveHorizontal,
  spec_weight_g: Scale,
  spec_magnet: Magnet,
  spec_motor: Gauge,
  motor_position: Cog,
  traction: Car,
  spec_pinion_gear: Cog,
  spec_front_wheels: CircleDot,
  spec_rear_wheels: CircleDot,
  spec_front_tyres: Disc,
  spec_rear_tyres: Disc,
  spec_front_lights: Lightbulb,
  spec_rear_lights: Lightbulb,
};

function DetailRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 border-b border-border py-3 last:border-b-0 md:last:border-b">
      {Icon ? (
        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      ) : null}
      <div className="grid min-w-0 flex-1 grid-cols-1 gap-1 sm:grid-cols-[minmax(8rem,40%)_1fr] sm:gap-4">
        <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
        <dd className="text-sm text-foreground">{value}</dd>
      </div>
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
    pushRow(out, 'spec_system', label('system'), labelCatalogTechSpecSystem(item.spec_system, t));
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
      if (CATALOG_TECH_SPEC_LEAD_TEXT_KEYS.includes(f.key) || f.key === 'spec_motor') continue;
      pushRow(out, f.key, label(f.i18n), item[f.key]);
    }
    for (const f of CATALOG_TECH_SPEC_LIGHT_FIELDS) {
      if (item[f.key] === true) {
        pushRow(out, f.key, label(f.i18n), t('techSpecs.yes'));
      }
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
        <dl className="grid grid-cols-1 md:grid-cols-2 md:gap-x-8">
          {rows.map((row) => (
            <DetailRow key={row.key} icon={SPEC_ICONS[row.key]} label={row.label} value={row.value} />
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
