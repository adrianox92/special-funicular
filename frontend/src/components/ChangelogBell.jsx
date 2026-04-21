import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bell } from 'lucide-react';
import api from '../lib/axios';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

const CHANGELOG_SEEN_EVENT = 'slotdb-changelog-seen';

const CATEGORY_LABEL = {
  feature: 'Novedad',
  fix: 'Corrección',
  improvement: 'Mejora',
  breaking: 'Cambio importante',
};

function formatRelativeTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Hace ${days} d`;
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function ChangelogBell() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [entries, setEntries] = useState([]);
  const [loadingList, setLoadingList] = useState(false);

  const fetchCount = useCallback(async () => {
    try {
      const { data } = await api.get('/changelog/unread-count');
      setCount(typeof data?.count === 'number' ? data.count : 0);
    } catch {
      setCount(0);
    }
  }, []);

  const fetchPreview = useCallback(async () => {
    setLoadingList(true);
    try {
      const { data } = await api.get('/changelog', { params: { limit: 5 } });
      setEntries(Array.isArray(data?.entries) ? data.entries : []);
    } catch {
      setEntries([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void fetchCount();
  }, [fetchCount, location.pathname]);

  useEffect(() => {
    const t = setInterval(() => void fetchCount(), 60_000);
    return () => clearInterval(t);
  }, [fetchCount]);

  useEffect(() => {
    const onSeen = () => void fetchCount();
    window.addEventListener(CHANGELOG_SEEN_EVENT, onSeen);
    return () => window.removeEventListener(CHANGELOG_SEEN_EVENT, onSeen);
  }, [fetchCount]);

  useEffect(() => {
    if (open) void fetchPreview();
  }, [open, fetchPreview]);

  const handleMarkRead = async () => {
    try {
      await api.post('/changelog/mark-read');
      setCount(0);
      window.dispatchEvent(new CustomEvent(CHANGELOG_SEEN_EVENT));
    } catch {
      /* noop */
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative shrink-0"
          aria-label="Novedades"
        >
          <Bell className="size-5" aria-hidden />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(calc(100vw-2rem),22rem)] p-0">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <span className="text-sm font-semibold">Novedades</span>
          {count > 0 && (
            <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={handleMarkRead}>
              Marcar leídas
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[min(60vh,320px)]">
          <div className="p-2">
            {loadingList && (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">Cargando…</p>
            )}
            {!loadingList && entries.length === 0 && (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                No hay entradas publicadas todavía.
              </p>
            )}
            {!loadingList &&
              entries.map((e) => (
                <div key={e.id} className="rounded-md px-2 py-2 hover:bg-accent/60">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary" className="text-[10px] font-normal">
                      {CATEGORY_LABEL[e.category] || e.category}
                    </Badge>
                    {e.version ? (
                      <span className="text-[10px] text-muted-foreground">{e.version}</span>
                    ) : null}
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {formatRelativeTime(e.published_at)}
                    </span>
                  </div>
                  <Link
                    to={`/changelog#${e.id}`}
                    className="mt-1 block text-sm font-medium leading-snug text-foreground hover:underline"
                    onClick={() => setOpen(false)}
                  >
                    {e.title}
                  </Link>
                </div>
              ))}
          </div>
        </ScrollArea>
        <Separator />
        <div className="p-2">
          <Button variant="outline" size="sm" className="w-full" asChild>
            <Link to="/changelog" onClick={() => setOpen(false)}>
              Ver todas
            </Link>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { CHANGELOG_SEEN_EVENT };
