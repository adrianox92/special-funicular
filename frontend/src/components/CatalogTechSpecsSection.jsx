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
  CATALOG_TECH_SPEC_AXLE_LENGTH_PAIR,
  CATALOG_TECH_SPEC_LEAD_TEXT_KEYS,
  CATALOG_TECH_SPEC_LIGHT_FIELDS,
  CATALOG_TECH_SPEC_NUM_FIELDS,
  CATALOG_TECH_SPEC_RIM_FIELDS,
  CATALOG_TECH_SPEC_TEXT_FIELDS,
  CATALOG_TECH_SPEC_TRACK_PAIR,
  formatTechSpecNumber,
  hasCatalogTechSpecs,
  labelCatalogTechSpecRim,
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
  spec_front_axle_length_mm: MoveHorizontal,
  spec_rear_axle_length_mm: MoveHorizontal,
  spec_weight_g: Scale,
  spec_magnet: Magnet,
  spec_motor: Gauge,
  motor_position: Cog,
  traction: Car,
  spec_pinion_gear: Cog,
  spec_front_wheels: CircleDot,
  spec_rear_wheels: CircleDot,
  spec_front_rim: Disc,
  spec_rear_rim: Disc,
  spec_front_rim_diameter_mm: Disc,
  spec_rear_rim_diameter_mm: Disc,
  spec_front_lights: Lightbulb,
  spec_rear_lights: Lightbulb,
};

const NUM_BY_KEY = Object.fromEntries(CATALOG_TECH_SPEC_NUM_FIELDS.map((f) => [f.key, f]));
const TEXT_BY_KEY = Object.fromEntries(CATALOG_TECH_SPEC_TEXT_FIELDS.map((f) => [f.key, f]));
const LIGHT_BY_KEY = Object.fromEntries(CATALOG_TECH_SPEC_LIGHT_FIELDS.map((f) => [f.key, f]));
const RIM_BY_KEY = Object.fromEntries(CATALOG_TECH_SPEC_RIM_FIELDS.map((f) => [f.key, f]));

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

function makeRow(key, label, value) {
  if (value == null || String(value).trim() === '' || value === '—') return null;
  return { key, label, value };
}

function pushSingle(blocks, row) {
  if (!row) return;
  blocks.push({ type: 'single', ...row });
}

function pushPair(blocks, pairKey, left, right) {
  const items = [left, right].filter(Boolean);
  if (!items.length) return;
  blocks.push({ type: 'pair', key: pairKey, items });
}

export default function CatalogTechSpecsSection({ item, embedded = false }) {
  const { t } = useTranslation('catalog');

  const blocks = useMemo(() => {
    if (!hasCatalogTechSpecs(item)) return [];
    const out = [];
    const label = (i18nKey) => t(`techSpecs.fields.${i18nKey}`);
    const numRow = (key) => {
      const f = NUM_BY_KEY[key];
      return makeRow(key, label(f.i18n), formatTechSpecNumber(item[key]));
    };
    const textRow = (key) => {
      const f = TEXT_BY_KEY[key];
      return makeRow(key, label(f.i18n), item[key]);
    };
    const lightRow = (key) => {
      if (item[key] !== true) return null;
      const f = LIGHT_BY_KEY[key];
      return makeRow(key, label(f.i18n), t('techSpecs.yes'));
    };
    const rimRow = (key) => {
      const f = RIM_BY_KEY[key];
      return makeRow(key, label(f.i18n), labelCatalogTechSpecRim(item[key], t));
    };

    for (const f of CATALOG_TECH_SPEC_TEXT_FIELDS) {
      if (!CATALOG_TECH_SPEC_LEAD_TEXT_KEYS.includes(f.key)) continue;
      pushSingle(out, textRow(f.key));
    }
    pushSingle(out, makeRow('spec_system', label('system'), labelCatalogTechSpecSystem(item.spec_system, t)));
    pushSingle(out, numRow('spec_length_mm'));
    pushSingle(out, numRow('spec_height_mm'));
    pushSingle(out, numRow('spec_wheelbase_mm'));
    pushPair(out, 'track', numRow(CATALOG_TECH_SPEC_TRACK_PAIR[0]), numRow(CATALOG_TECH_SPEC_TRACK_PAIR[1]));
    pushPair(
      out,
      'axleLength',
      numRow(CATALOG_TECH_SPEC_AXLE_LENGTH_PAIR[0]),
      numRow(CATALOG_TECH_SPEC_AXLE_LENGTH_PAIR[1]),
    );
    pushSingle(out, numRow('spec_weight_g'));
    if (item.spec_magnet === true) {
      pushSingle(out, makeRow('spec_magnet', label('magnet'), t('techSpecs.yes')));
    } else if (item.spec_magnet === false) {
      pushSingle(out, makeRow('spec_magnet', label('magnet'), t('techSpecs.no')));
    }
    pushSingle(out, textRow('spec_motor'));
    if (item.motor_position) {
      pushSingle(
        out,
        makeRow('motor_position', label('motorMount'), labelMotorPosition(item.motor_position, t)),
      );
    }
    if (item.traction) {
      pushSingle(
        out,
        makeRow(
          'traction',
          label('drivetrain'),
          t(`values.traction.${item.traction}`, { defaultValue: item.traction }),
        ),
      );
    }
    pushSingle(out, textRow('spec_pinion_gear'));
    pushPair(out, 'wheels', textRow('spec_front_wheels'), textRow('spec_rear_wheels'));
    {
      const rimItems = [
        rimRow('spec_front_rim'),
        numRow('spec_front_rim_diameter_mm'),
        rimRow('spec_rear_rim'),
        numRow('spec_rear_rim_diameter_mm'),
      ].filter(Boolean);
      if (rimItems.length) {
        out.push({ type: 'pair', key: 'rims', items: rimItems });
      }
    }
    pushPair(out, 'lights', lightRow('spec_front_lights'), lightRow('spec_rear_lights'));
    return out;
  }, [item, t]);

  if (!blocks.length) return null;

  const list = (
    <dl className="grid grid-cols-1 md:grid-cols-2 md:gap-x-8">
      {blocks.map((block) => {
        if (block.type === 'pair') {
          return (
            <div
              key={block.key}
              data-testid={`tech-spec-pair-${block.key}`}
              className="grid grid-cols-1 md:col-span-2 md:grid-cols-2 md:gap-x-8"
            >
              {block.items.map((row) => (
                <DetailRow key={row.key} icon={SPEC_ICONS[row.key]} label={row.label} value={row.value} />
              ))}
            </div>
          );
        }
        return (
          <DetailRow key={block.key} icon={SPEC_ICONS[block.key]} label={block.label} value={block.value} />
        );
      })}
    </dl>
  );

  if (embedded) {
    return (
      <div className="pt-2">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('techSpecs.title')}
        </p>
        {list}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <h2 className="text-xl font-semibold leading-none tracking-tight">{t('techSpecs.title')}</h2>
      </CardHeader>
      <CardContent>{list}</CardContent>
    </Card>
  );
}
