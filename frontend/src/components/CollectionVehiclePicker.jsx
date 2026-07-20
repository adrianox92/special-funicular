import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { cn } from '../lib/utils';

function vehicleLabel(vehicle) {
  if (!vehicle) return '';
  const base = `${vehicle.manufacturer ?? ''} ${vehicle.model ?? ''}`.trim();
  if (!base) return String(vehicle.id);
  return vehicle.type ? `${base} (${vehicle.type})` : base;
}

/**
 * Selector de vehículos de colección con filtro de texto.
 * @param {{
 *   vehicles: Array<{ id: string, manufacturer?: string, model?: string, type?: string }>,
 *   value: string,
 *   onChange: (vehicleId: string) => void,
 *   disabled?: boolean,
 *   placeholder?: string,
 *   id?: string,
 *   className?: string,
 * }} props
 */
const CollectionVehiclePicker = ({
  vehicles = [],
  value = '',
  onChange,
  disabled = false,
  placeholder = 'Selecciona un vehículo de tu colección',
  id,
  className,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const rootRef = useRef(null);
  const searchInputRef = useRef(null);

  const selected = useMemo(
    () => vehicles.find((v) => String(v.id) === String(value)) || null,
    [vehicles, value],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return vehicles;
    return vehicles.filter((v) => {
      const haystack = [v.manufacturer, v.model, v.type, v.traction]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [vehicles, search]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    const t = window.setTimeout(() => searchInputRef.current?.focus(), 0);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.clearTimeout(t);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <Button
        id={id}
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled || vehicles.length === 0}
        className="h-9 w-full justify-between font-normal"
        onClick={() => setOpen((o) => !o)}
      >
        <span className={cn('truncate text-left', !selected && 'text-muted-foreground')}>
          {selected ? vehicleLabel(selected) : placeholder}
        </span>
        <ChevronDown className="ml-2 size-4 shrink-0 opacity-50" aria-hidden />
      </Button>
      {open ? (
        <div
          className="absolute left-0 right-0 top-full z-[200] mt-1 flex flex-col rounded-md border border-border bg-popover text-popover-foreground shadow-lg"
          role="listbox"
          aria-label="Lista de vehículos"
        >
          <div className="relative border-b px-3 py-2">
            <Search
              className="pointer-events-none absolute left-5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              ref={searchInputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por marca, modelo o tipo…"
              className="h-9 pl-8"
              autoComplete="off"
            />
          </div>
          <div className="max-h-[280px] overflow-y-auto overscroll-contain p-1">
            {filtered.length === 0 ? (
              <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                Ningún vehículo coincide con «{search.trim()}»
              </p>
            ) : (
              filtered.map((vehicle) => {
                const idStr = String(vehicle.id);
                const isSelected = String(value) === idStr;
                return (
                  <button
                    key={vehicle.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={cn(
                      'flex w-full cursor-pointer rounded-sm px-2 py-2.5 text-left text-sm outline-none transition-colors',
                      'hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground',
                      isSelected ? 'bg-accent/80 text-accent-foreground' : null,
                    )}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onChange?.(idStr);
                      setOpen(false);
                    }}
                  >
                    {vehicleLabel(vehicle)}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default CollectionVehiclePicker;
