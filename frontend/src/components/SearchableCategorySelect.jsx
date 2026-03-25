import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from './ui/utils';
import { Button } from './ui/button';
import { Input } from './ui/input';

/**
 * Selector de categoría con búsqueda por texto (etiqueta o valor interno).
 * El panel se renderiza en el mismo árbol DOM que el trigger (sin portal) para que el foco
 * funcione dentro de diálogos con focus trap de Radix. La lista usa scroll nativo.
 *
 * @param {{ value: string, onValueChange: (v: string) => void, options: { value: string, label: string }[], id?: string, 'aria-labelledby'?: string }} props
 */
export function SearchableCategorySelect({ value, onValueChange, options, id, 'aria-labelledby': ariaLabelledBy }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const reactId = useId();
  const panelDomId = `searchable-cat-panel-${reactId.replace(/:/g, '')}`;

  const selected = options.find((o) => o.value === value);

  const normalized = useCallback((s) => {
    return String(s)
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '');
  }, []);

  const filtered = useMemo(() => {
    const q = normalized(query.trim());
    if (!q) return options;
    return options.filter((o) => {
      const label = normalized(o.label);
      const val = normalized(o.value);
      return label.includes(q) || val.includes(q);
    });
  }, [options, query, normalized]);

  useEffect(() => {
    if (!open) return;
    const t = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e) => {
      const root = rootRef.current;
      if (root?.contains(e.target)) return;
      setOpen(false);
      setQuery('');
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open]);

  const handleOpen = () => {
    setQuery('');
    setOpen((prev) => !prev);
  };

  const handlePick = (v) => {
    onValueChange(v);
    setOpen(false);
    setQuery('');
  };

  const listId = id ? `${id}-listbox` : 'searchable-category-listbox';

  return (
    <div ref={rootRef} className="relative z-0 w-full">
      <Button
        type="button"
        variant="outline"
        id={id}
        aria-labelledby={ariaLabelledBy}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        className={cn(
          'h-9 w-full justify-between font-normal shadow-sm',
          !selected && 'text-muted-foreground',
        )}
        onClick={handleOpen}
      >
        <span className="truncate">{selected ? selected.label : 'Seleccionar categoría'}</span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </Button>

      {open && (
        <div
          id={panelDomId}
          role="presentation"
          className="absolute left-0 right-0 top-full z-[100] mt-1 rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
          onMouseDown={(e) => {
            // Evita que el foco vuelva al trigger al pulsar la lista; no interferir con el campo de búsqueda.
            if (e.target.closest('input, textarea')) return;
            e.preventDefault();
          }}
        >
          <div className="border-b border-border p-2">
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre…"
              className="h-8"
              aria-label="Filtrar categorías"
              autoComplete="off"
            />
          </div>
          <div
            className="max-h-[min(280px,45vh)] overflow-y-auto overscroll-y-contain p-1"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <ul id={listId} role="listbox" className="space-y-0">
              {filtered.length === 0 ? (
                <li className="px-2 py-3 text-center text-sm text-muted-foreground">Sin coincidencias</li>
              ) : (
                filtered.map((o) => (
                  <li key={o.value} role="option" aria-selected={o.value === value}>
                    <button
                      type="button"
                      className={cn(
                        'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
                        o.value === value && 'bg-accent/60',
                      )}
                      onClick={() => handlePick(o.value)}
                    >
                      <span className="line-clamp-2">{o.label}</span>
                      {o.value === value && (
                        <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
                          <Check className="h-4 w-4" />
                        </span>
                      )}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
