import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import CatalogTractionSelect from './CatalogTractionSelect';
import { Input } from './ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { TableCell } from './ui/table';
import { VEHICLE_TYPES } from '../data/vehicleTypes';
import { MOTOR_POSITION_OPTIONS } from '../data/motorPosition';

const TRIGGER_CLASS = 'h-8 w-full min-w-[7.5rem] px-2 text-xs';
const YEAR_MESSAGE = 'El año tiene que ser un valor entre 1900 y 2100.';

export function catalogInlineFieldEquals(a, b) {
  const norm = (v) => (v == null || String(v).trim() === '' ? '' : String(v).trim());
  return norm(a) === norm(b);
}

/** Año vacío (borrar) o de cuatro cifras entre 1900 y 2100. */
export function parseCatalogInlineYear(raw) {
  const s = String(raw ?? '').trim();
  if (s === '') return { ok: true, value: '' };
  if (!/^\d{4}$/.test(s)) return { ok: false, value: s };
  const n = Number(s);
  if (n < 1900 || n > 2100) return { ok: false, value: s };
  return { ok: true, value: s };
}

function displayValue(value) {
  return value == null ? '' : String(value);
}

function InlineDraftInput({
  id,
  label,
  value,
  disabled,
  className,
  type = 'text',
  inputMode,
  min,
  max,
  normalize,
  invalidMessage,
  onCommit,
}) {
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(value);
  }, [value]);

  const commit = (raw) => {
    const result = normalize(raw);
    if (!result.ok) {
      toast.error(invalidMessage);
      setDraft(value);
      return;
    }
    if (catalogInlineFieldEquals(result.value, value)) {
      setDraft(value);
      return;
    }
    onCommit(result.value);
  };

  return (
    <Input
      id={id}
      aria-label={label}
      type={type}
      inputMode={inputMode}
      min={min}
      max={max}
      disabled={disabled}
      value={draft}
      className={className}
      onFocus={() => {
        focused.current = true;
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => {
        focused.current = false;
        commit(e.target.value);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
    />
  );
}

/**
 * Celdas editables del listado admin: tipo, tracción, motor, año y dorsal.
 * El padre serializa el PUT y revierte la fila si falla.
 */
export default function CatalogListingInlineCells({ row, onPatch }) {
  const [savingField, setSavingField] = useState(null);
  const typeValue = displayValue(row.vehicle_type);
  const motorValue = displayValue(row.motor_position);
  const typeIsLegacy = typeValue !== '' && !VEHICLE_TYPES.includes(typeValue);
  const motorIsLegacy = motorValue !== '' && !MOTOR_POSITION_OPTIONS.some((o) => o.value === motorValue);

  const save = (field, value) => {
    if (catalogInlineFieldEquals(row[field], value)) return;
    setSavingField(field);
    onPatch(row.id, { [field]: value })
      .catch(() => {})
      .finally(() => {
        setSavingField((current) => (current === field ? null : current));
      });
  };

  return (
    <>
      <TableCell className="min-w-[8.5rem] p-1.5">
        <Select
          value={typeValue === '' ? '__none__' : typeValue}
          onValueChange={(v) => save('vehicle_type', v === '__none__' ? '' : v)}
          disabled={savingField === 'vehicle_type'}
        >
          <SelectTrigger id={`catalog-inline-type-${row.id}`} className={TRIGGER_CLASS} aria-label={`Tipo ${row.reference}`}>
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— Sin tipo —</SelectItem>
            {typeIsLegacy && <SelectItem value={typeValue}>{typeValue}</SelectItem>}
            {VEHICLE_TYPES.map((typeName) => (
              <SelectItem key={typeName} value={typeName}>
                {typeName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="min-w-[8.5rem] p-1.5">
        <CatalogTractionSelect
          id={`catalog-inline-traction-${row.id}`}
          label={`Tracción ${row.reference}`}
          showLabel={false}
          triggerClassName={TRIGGER_CLASS}
          value={displayValue(row.traction)}
          disabled={savingField === 'traction'}
          onChange={(traction) => save('traction', traction)}
        />
      </TableCell>
      <TableCell className="min-w-[8.5rem] p-1.5">
        <Select
          value={motorValue === '' ? '__none__' : motorValue}
          onValueChange={(v) => save('motor_position', v === '__none__' ? '' : v)}
          disabled={savingField === 'motor_position'}
        >
          <SelectTrigger id={`catalog-inline-motor-${row.id}`} className={TRIGGER_CLASS} aria-label={`Motor ${row.reference}`}>
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— Sin especificar —</SelectItem>
            {motorIsLegacy && <SelectItem value={motorValue}>{motorValue}</SelectItem>}
            {MOTOR_POSITION_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="p-1.5">
        <InlineDraftInput
          id={`catalog-inline-year-${row.id}`}
          label={`Año ${row.reference}`}
          value={displayValue(row.commercial_release_year)}
          disabled={savingField === 'commercial_release_year'}
          type="number"
          inputMode="numeric"
          min={1900}
          max={2100}
          className="h-8 w-[5.25rem] px-2 text-xs tabular-nums"
          normalize={parseCatalogInlineYear}
          invalidMessage={YEAR_MESSAGE}
          onCommit={(value) => save('commercial_release_year', value)}
        />
      </TableCell>
      <TableCell className="p-1.5">
        <InlineDraftInput
          id={`catalog-inline-dorsal-${row.id}`}
          label={`Dorsal ${row.reference}`}
          value={displayValue(row.dorsal)}
          disabled={savingField === 'dorsal'}
          className="h-8 w-16 px-2 text-xs"
          normalize={(raw) => ({ ok: true, value: String(raw ?? '').trim() })}
          onCommit={(value) => save('dorsal', value)}
        />
      </TableCell>
    </>
  );
}
