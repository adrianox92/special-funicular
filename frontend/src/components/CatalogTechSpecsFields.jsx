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
  CATALOG_TECH_SPEC_LIGHT_FIELDS,
  CATALOG_TECH_SPEC_NUM_FIELDS,
  CATALOG_TECH_SPEC_RIM_FIELDS,
  CATALOG_TECH_SPEC_RIM_VALUES,
  CATALOG_TECH_SPEC_SYSTEM_VALUES,
  CATALOG_TECH_SPEC_TEXT_FIELDS,
} from '../data/catalogTechSpecs';

const NUM_BY_KEY = Object.fromEntries(CATALOG_TECH_SPEC_NUM_FIELDS.map((f) => [f.key, f]));
const TEXT_BY_KEY = Object.fromEntries(CATALOG_TECH_SPEC_TEXT_FIELDS.map((f) => [f.key, f]));

function FieldPair({ children }) {
  return <div className="grid grid-cols-1 gap-4 sm:col-span-2 sm:grid-cols-2">{children}</div>;
}

function TextSpecField({ field, form, setField, idPrefix, t }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={`${idPrefix}-${field.key}`}>{t(`techSpecs.fields.${field.i18n}`)}</Label>
      <Input
        id={`${idPrefix}-${field.key}`}
        value={form[field.key] ?? ''}
        maxLength={field.maxLength}
        onChange={(e) => setField(field.key, e.target.value)}
      />
    </div>
  );
}

function NumSpecField({ field, form, setField, idPrefix, t }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={`${idPrefix}-${field.key}`}>{t(`techSpecs.fields.${field.i18n}`)}</Label>
      <Input
        id={`${idPrefix}-${field.key}`}
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        value={form[field.key] ?? ''}
        onChange={(e) => setField(field.key, e.target.value)}
      />
    </div>
  );
}

function LightSpecField({ field, form, setField, idPrefix, t }) {
  return (
    <label
      htmlFor={`${idPrefix}-${field.key}`}
      className="flex items-center gap-2 rounded-lg border p-3 text-sm font-medium leading-none"
    >
      <input
        id={`${idPrefix}-${field.key}`}
        type="checkbox"
        className="size-4 shrink-0 rounded border-input accent-primary"
        checked={form[field.key] === true}
        onChange={(e) => setField(field.key, e.target.checked)}
      />
      {t(`techSpecs.fields.${field.i18n}`)}
    </label>
  );
}

function RimSpecField({ field, form, setField, idPrefix, t }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={`${idPrefix}-${field.key}`}>{t(`techSpecs.fields.${field.i18n}`)}</Label>
      <Select
        value={form[field.key] || '__none__'}
        onValueChange={(v) => setField(field.key, v === '__none__' ? '' : v)}
      >
        <SelectTrigger id={`${idPrefix}-${field.key}`}>
          <SelectValue placeholder={t('techSpecs.unspecified')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">{t('techSpecs.unspecified')}</SelectItem>
          {CATALOG_TECH_SPEC_RIM_VALUES.map((value) => (
            <SelectItem key={value} value={value}>
              {t(`techSpecs.rimValues.${value}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default function CatalogTechSpecsFields({
  form,
  setForm,
  idPrefix = 'catalog-tech',
  omitKeys = [],
}) {
  const { t } = useTranslation('catalog');
  const hidden = new Set(omitKeys);
  const show = (key) => !hidden.has(key);

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const frontRim = CATALOG_TECH_SPEC_RIM_FIELDS.find((f) => f.key === 'spec_front_rim');
  const rearRim = CATALOG_TECH_SPEC_RIM_FIELDS.find((f) => f.key === 'spec_rear_rim');

  return (
    <div className="grid grid-cols-1 gap-4 py-2 sm:grid-cols-2">
      {omitKeys.length === 0 && (
        <p className="text-sm text-muted-foreground sm:col-span-2">{t('techSpecs.formHelp')}</p>
      )}
      {CATALOG_TECH_SPEC_TEXT_FIELDS.filter((f) =>
        CATALOG_TECH_SPEC_LEAD_TEXT_KEYS.includes(f.key),
      ).map((f) => (
        <TextSpecField key={f.key} field={f} form={form} setField={setField} idPrefix={idPrefix} t={t} />
      ))}
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-spec_system`}>{t('techSpecs.fields.system')}</Label>
        <Select
          value={form.spec_system || '__none__'}
          onValueChange={(v) => setField('spec_system', v === '__none__' ? '' : v)}
        >
          <SelectTrigger id={`${idPrefix}-spec_system`}>
            <SelectValue placeholder={t('techSpecs.unspecified')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">{t('techSpecs.unspecified')}</SelectItem>
            {CATALOG_TECH_SPEC_SYSTEM_VALUES.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`techSpecs.systemValues.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {['spec_length_mm', 'spec_height_mm', 'spec_wheelbase_mm'].map((key) => (
        <NumSpecField
          key={key}
          field={NUM_BY_KEY[key]}
          form={form}
          setField={setField}
          idPrefix={idPrefix}
          t={t}
        />
      ))}
      <FieldPair>
        {['spec_front_track_mm', 'spec_rear_track_mm'].map((key) => (
          <NumSpecField
            key={key}
            field={NUM_BY_KEY[key]}
            form={form}
            setField={setField}
            idPrefix={idPrefix}
            t={t}
          />
        ))}
      </FieldPair>
      <FieldPair>
        {['spec_front_axle_length_mm', 'spec_rear_axle_length_mm'].map((key) => (
          <NumSpecField
            key={key}
            field={NUM_BY_KEY[key]}
            form={form}
            setField={setField}
            idPrefix={idPrefix}
            t={t}
          />
        ))}
      </FieldPair>
      <NumSpecField
        field={NUM_BY_KEY.spec_weight_g}
        form={form}
        setField={setField}
        idPrefix={idPrefix}
        t={t}
      />
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
      {['spec_motor', 'spec_pinion_gear'].filter(show).map((key) => (
        <TextSpecField
          key={key}
          field={TEXT_BY_KEY[key]}
          form={form}
          setField={setField}
          idPrefix={idPrefix}
          t={t}
        />
      ))}
      {['spec_front_wheels', 'spec_rear_wheels'].some(show) && (
        <FieldPair>
          {['spec_front_wheels', 'spec_rear_wheels'].filter(show).map((key) => (
            <TextSpecField
              key={key}
              field={TEXT_BY_KEY[key]}
              form={form}
              setField={setField}
              idPrefix={idPrefix}
              t={t}
            />
          ))}
        </FieldPair>
      )}
      {(show('spec_front_rim') || show('spec_front_rim_diameter_mm')) && (
        <FieldPair>
          {show('spec_front_rim') && (
            <RimSpecField
              field={frontRim}
              form={form}
              setField={setField}
              idPrefix={idPrefix}
              t={t}
            />
          )}
          {show('spec_front_rim_diameter_mm') && (
            <NumSpecField
              field={NUM_BY_KEY.spec_front_rim_diameter_mm}
              form={form}
              setField={setField}
              idPrefix={idPrefix}
              t={t}
            />
          )}
        </FieldPair>
      )}
      {(show('spec_rear_rim') || show('spec_rear_rim_diameter_mm')) && (
        <FieldPair>
          {show('spec_rear_rim') && (
            <RimSpecField
              field={rearRim}
              form={form}
              setField={setField}
              idPrefix={idPrefix}
              t={t}
            />
          )}
          {show('spec_rear_rim_diameter_mm') && (
            <NumSpecField
              field={NUM_BY_KEY.spec_rear_rim_diameter_mm}
              form={form}
              setField={setField}
              idPrefix={idPrefix}
              t={t}
            />
          )}
        </FieldPair>
      )}
      <FieldPair>
        {CATALOG_TECH_SPEC_LIGHT_FIELDS.map((f) => (
          <LightSpecField key={f.key} field={f} form={form} setField={setField} idPrefix={idPrefix} t={t} />
        ))}
      </FieldPair>
    </div>
  );
}
