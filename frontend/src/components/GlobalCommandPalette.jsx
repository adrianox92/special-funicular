import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useCommandPalette } from '../context/CommandPaletteContext';
import {
  Car,
  Trophy,
  Flag,
  Loader2,
  Package,
  ChevronRight,
  MousePointer2,
  Search,
  X,
} from 'lucide-react';
import api from '../lib/axios';
import { formatInventoryCategory } from '../utils/formatUtils';
import { cn } from '../lib/utils';

const DEBOUNCE_MS = 280;

function Kbd({ children, className }) {
  return (
    <kbd
      className={cn(
        'pointer-events-none inline-flex h-5 min-h-5 min-w-[1.35rem] select-none items-center justify-center rounded border border-border/80 bg-background px-1 font-mono text-[10px] font-semibold leading-none text-foreground shadow-sm',
        className,
      )}
    >
      {children}
    </kbd>
  );
}

function PaletteFooter({ hasResults }) {
  return (
    <div className="shrink-0 border-t border-border bg-muted/50 px-3 py-2.5">
      <p className="mb-2 text-center text-xs leading-snug text-muted-foreground">
        {hasResults ? (
          <>
            <span className="font-medium text-foreground/90">Abrir:</span> pulsa{' '}
            <Kbd className="mx-0.5 align-middle">Intro</Kbd> con el resultado resaltado, o{' '}
            <span className="inline-flex items-center gap-0.5 align-middle font-medium text-foreground/90">
              <MousePointer2 className="size-3.5 opacity-70" aria-hidden />
              haz clic
            </span>{' '}
            en la fila.
          </>
        ) : (
          <>
            Cuando aparezcan resultados, usa{' '}
            <Kbd className="mx-0.5 align-middle">↑</Kbd>
            <Kbd className="mx-0.5 align-middle">↓</Kbd> para moverte y{' '}
            <Kbd className="mx-0.5 align-middle">Intro</Kbd> para abrir, o el ratón.
          </>
        )}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd>
          <span>navegar</span>
        </span>
        <span className="text-border">·</span>
        <span className="inline-flex items-center gap-1">
          <Kbd>Intro</Kbd>
          <span>abrir</span>
        </span>
        <span className="text-border">·</span>
        <span className="inline-flex items-center gap-1">
          <Kbd>Esc</Kbd>
          <span>cerrar</span>
        </span>
      </div>
    </div>
  );
}

function SectionHeading({ children }) {
  return (
    <div className="px-2 pb-1 pt-2 text-xs font-medium text-muted-foreground first:pt-1">{children}</div>
  );
}

function ResultRowButton({ icon: Icon, children, onOpen }) {
  return (
    <button
      type="button"
      data-palette-result="true"
      className={cn(
        'group flex w-full cursor-pointer items-start gap-2 rounded-md border border-transparent px-2 py-2.5 text-left text-sm outline-none transition-colors',
        'hover:border-border/60 hover:bg-accent/50 focus-visible:border-border/80 focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring',
      )}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (process.env.NODE_ENV === 'development') {
          console.log('[GlobalCommandPalette] result click');
        }
        onOpen();
      }}
    >
      {Icon ? <Icon className="mt-0.5 size-4 shrink-0 opacity-60" aria-hidden /> : null}
      <span className="min-w-0 flex-1">{children}</span>
      <span className="ml-auto flex shrink-0 items-center gap-1 self-center pl-2">
        <span className="hidden text-[10px] font-medium text-muted-foreground/80 sm:inline">Abrir</span>
        <ChevronRight
          className="size-4 text-muted-foreground/70 opacity-60 transition-opacity group-hover:opacity-100"
          aria-hidden
        />
      </span>
    </button>
  );
}

/** Portal propio: sin cmdk ni Radix Dialog — solo HTML nativo para que el ratón funcione siempre. */
function SearchOverlay({ open, onOpenChange, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const onEsc = (e) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="pointer-events-auto fixed inset-0 z-[9999] flex items-center justify-center p-4"
      data-global-command-palette=""
      role="presentation"
    >
      <button
        type="button"
        aria-label="Cerrar búsqueda"
        className="pointer-events-auto absolute inset-0 bg-black/80"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-palette-title"
        className="pointer-events-auto relative z-10 flex max-h-[min(90vh,720px)] w-full max-w-xl flex-col overflow-hidden rounded-lg border bg-background shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

const GlobalCommandPalette = () => {
  const navigate = useNavigate();
  const { open, setOpen } = useCommandPalette();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState({
    vehicles: [],
    competitions: [],
    circuits: [],
    inventory: [],
  });
  const debounceRef = useRef(null);
  const reqIdRef = useRef(0);
  const inputRef = useRef(null);

  const runSearch = useCallback(async (q) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setResults({ vehicles: [], competitions: [], circuits: [], inventory: [] });
      setLoading(false);
      return;
    }
    const id = ++reqIdRef.current;
    setLoading(true);
    try {
      const { data } = await api.get('/search', { params: { q: trimmed } });
      if (id !== reqIdRef.current) return;
      setResults({
        vehicles: data?.vehicles ?? [],
        competitions: data?.competitions ?? [],
        circuits: data?.circuits ?? [],
        inventory: data?.inventory ?? [],
      });
    } catch {
      if (id !== reqIdRef.current) return;
      setResults({ vehicles: [], competitions: [], circuits: [], inventory: [] });
    } finally {
      if (id === reqIdRef.current) setLoading(false);
    }
  }, []);

  const goVehicle = useCallback(
    (id) => {
      setOpen(false);
      navigate(`/vehicles/${id}`);
    },
    [navigate, setOpen],
  );
  const goCompetition = useCallback(
    (id) => {
      setOpen(false);
      navigate(`/competitions/${id}/timings`);
    },
    [navigate, setOpen],
  );
  const goCircuit = useCallback(
    (id) => {
      setOpen(false);
      navigate(`/circuits?highlight=${encodeURIComponent(id)}`);
    },
    [navigate, setOpen],
  );
  const goInventory = useCallback(
    (id) => {
      setOpen(false);
      navigate('/inventory', { state: { openInventoryEditId: id } });
    },
    [navigate, setOpen],
  );

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults({ vehicles: [], competitions: [], circuits: [], inventory: [] });
      setLoading(false);
      return;
    }
    clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults({ vehicles: [], competitions: [], circuits: [], inventory: [] });
      setLoading(false);
      return;
    }
    debounceRef.current = setTimeout(() => runSearch(query), DEBOUNCE_MS);
    return () => clearTimeout(debounceRef.current);
  }, [open, query, runSearch]);

  useEffect(() => {
    if (!open) return;
    const t = requestAnimationFrame(() => inputRef.current?.focus());
    const t2 = setTimeout(() => inputRef.current?.focus(), 50);
    return () => {
      cancelAnimationFrame(t);
      clearTimeout(t2);
    };
  }, [open]);

  const hasResults =
    results.vehicles.length > 0 ||
    results.competitions.length > 0 ||
    results.circuits.length > 0 ||
    results.inventory.length > 0;
  const qShort = query.trim().length > 0 && query.trim().length < 2;

  return (
    <SearchOverlay open={open} onOpenChange={setOpen}>
      <div className="shrink-0 border-b border-border/60 bg-muted/20 px-3 py-2 pr-12">
        <p
          id="command-palette-title"
          className="text-center text-[11px] font-medium text-muted-foreground"
        >
          Búsqueda rápida
        </p>
        <p className="mt-0.5 text-center text-[10px] text-muted-foreground/90">
          Atajo: <Kbd className="align-middle">Ctrl</Kbd> + <Kbd className="align-middle">K</Kbd>
          {' · '}
          <Kbd className="align-middle">⌘</Kbd> + <Kbd className="align-middle">K</Kbd> en Mac
        </p>
      </div>

      <button
        type="button"
        className="absolute right-3 top-3 z-20 rounded-sm p-1 text-muted-foreground opacity-80 ring-offset-background hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring"
        onClick={() => setOpen(false)}
        aria-label="Cerrar"
      >
        <X className="size-4" />
      </button>

      <div className="flex shrink-0 items-center gap-2 border-b px-3 py-1">
        <Search className="size-4 shrink-0 opacity-50" aria-hidden />
        <input
          ref={inputRef}
          type="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Buscar vehículos, competiciones, circuitos, inventario…"
          className="h-11 w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-1 pb-1 pt-0" style={{ maxHeight: 'min(320px, 50vh)' }}>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Buscando…
          </div>
        ) : (
          <>
            {!hasResults ? (
              <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                {qShort
                  ? 'Escribe al menos 2 caracteres.'
                  : query.trim().length >= 2
                    ? 'Sin resultados.'
                    : 'Empieza a escribir para buscar.'}
              </div>
            ) : null}

            {results.vehicles.length > 0 ? (
              <div>
                <SectionHeading>Vehículos</SectionHeading>
                {results.vehicles.map((v) => (
                  <ResultRowButton key={`v-${v.id}`} icon={Car} onOpen={() => goVehicle(v.id)}>
                    {[v.manufacturer, v.model].filter(Boolean).join(' ') || `Vehículo ${v.id}`}
                  </ResultRowButton>
                ))}
              </div>
            ) : null}

            {results.competitions.length > 0 ? (
              <div>
                {results.vehicles.length > 0 ? <div className="mx-1 my-1 h-px bg-border" /> : null}
                <SectionHeading>Competiciones</SectionHeading>
                {results.competitions.map((c) => (
                  <ResultRowButton key={`c-${c.id}`} icon={Trophy} onOpen={() => goCompetition(c.id)}>
                    {c.name || `Competición ${c.id}`}
                  </ResultRowButton>
                ))}
              </div>
            ) : null}

            {results.circuits.length > 0 ? (
              <div>
                {(results.vehicles.length > 0 || results.competitions.length > 0) ? (
                  <div className="mx-1 my-1 h-px bg-border" />
                ) : null}
                <SectionHeading>Circuitos</SectionHeading>
                {results.circuits.map((c) => (
                  <ResultRowButton key={`ci-${c.id}`} icon={Flag} onOpen={() => goCircuit(c.id)}>
                    {c.name || `Circuito ${c.id}`}
                  </ResultRowButton>
                ))}
              </div>
            ) : null}

            {results.inventory.length > 0 ? (
              <div>
                {(results.vehicles.length > 0 ||
                  results.competitions.length > 0 ||
                  results.circuits.length > 0) ? (
                  <div className="mx-1 my-1 h-px bg-border" />
                ) : null}
                <SectionHeading>Inventario</SectionHeading>
                {results.inventory.map((it) => (
                  <ResultRowButton key={`inv-${it.id}`} icon={Package} onOpen={() => goInventory(it.id)}>
                    <span className="block w-full min-w-0 text-left">
                      <span className="font-medium">{it.name || `Ítem ${it.id}`}</span>
                      {it.reference ? (
                        <span className="text-muted-foreground"> · {it.reference}</span>
                      ) : null}
                      <span className="block text-xs font-normal text-muted-foreground">
                        {formatInventoryCategory(it.category)}
                      </span>
                    </span>
                  </ResultRowButton>
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>

      <PaletteFooter hasResults={hasResults && !loading} />
    </SearchOverlay>
  );
};

export default GlobalCommandPalette;
