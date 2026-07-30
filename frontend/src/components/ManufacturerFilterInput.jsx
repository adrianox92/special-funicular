import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Input } from './ui/input';
import { cn } from './ui/utils';

function normalizeText(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/**
 * Input de filtro por fabricante con sugerencias de autocompletado.
 * @param {{ value: string, onChange: (v: string) => void, manufacturers: string[], id?: string, placeholder?: string, className?: string }} props
 */
export function ManufacturerFilterInput({
  value,
  onChange,
  manufacturers = [],
  id,
  placeholder,
  className,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const reactId = useId();
  const listId = `manufacturer-filter-list-${reactId.replace(/:/g, '')}`;

  const suggestions = useMemo(() => {
    const q = normalizeText(value.trim());
    const sorted = [...manufacturers].filter(Boolean).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' }),
    );
    if (!q) return sorted.slice(0, 20);
    return sorted.filter((m) => normalizeText(m).includes(q)).slice(0, 20);
  }, [manufacturers, value]);

  const showPanel = open && suggestions.length > 0;

  useEffect(() => {
    if (!open) return;
    const onPointer = (e) => {
      if (rootRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  const handlePick = useCallback(
    (manufacturer) => {
      onChange(manufacturer);
      setOpen(false);
      inputRef.current?.focus();
    },
    [onChange],
  );

  return (
    <div ref={rootRef} className={cn('relative w-full', className)}>
      <Input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={showPanel ? listId : undefined}
        aria-autocomplete="list"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        className="h-9"
      />
      {showPanel ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-48 w-full overflow-auto rounded-md border border-border bg-popover py-1 text-sm shadow-md"
        >
          {suggestions.map((m) => (
            <li key={m} role="option" aria-selected={value === m}>
              <button
                type="button"
                className="flex w-full cursor-default select-none items-center px-3 py-1.5 text-left outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handlePick(m)}
              >
                {m}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
