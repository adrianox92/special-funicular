import React, { useState, useEffect, useCallback } from 'react';
import api from '../lib/axios';
import { ChangelogMarkdown } from '../components/ChangelogMarkdown';
import { CHANGELOG_SEEN_EVENT } from '../components/ChangelogBell';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import { Spinner } from '../components/ui/spinner';
import { Alert, AlertDescription } from '../components/ui/alert';

const CATEGORY_LABEL = {
  feature: 'Novedad',
  fix: 'Corrección',
  improvement: 'Mejora',
  breaking: 'Cambio importante',
};

function monthKey(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
}

function groupEntriesByMonth(entries) {
  const groups = [];
  let currentKey = null;
  for (const e of entries) {
    if (!e.published_at) continue;
    const k = monthKey(e.published_at);
    if (k !== currentKey) {
      currentKey = k;
      groups.push({ key: k, label: monthLabel(e.published_at), items: [] });
    }
    groups[groups.length - 1].items.push(e);
  }
  return groups;
}

const Changelog = () => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/changelog', { params: { limit: 100 } });
      setEntries(Array.isArray(data?.entries) ? data.entries : []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'No se pudo cargar');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await api.post('/changelog/mark-read');
        if (!cancelled) window.dispatchEvent(new CustomEvent(CHANGELOG_SEEN_EVENT));
      } catch {
        /* noop */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const groups = groupEntriesByMonth(entries);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Novedades</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cambios y mejoras recientes en Slot Database.
        </p>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <Spinner className="size-8" />
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!loading && !error && entries.length === 0 && (
        <p className="text-sm text-muted-foreground">Aún no hay publicaciones.</p>
      )}

      {!loading &&
        !error &&
        groups.map((g) => (
          <section key={g.key} className="space-y-4">
            <h2 className="text-lg font-semibold capitalize text-muted-foreground">{g.label}</h2>
            <div className="space-y-4">
              {g.items.map((e) => (
                <Card key={e.id} id={e.id} className="scroll-mt-24">
                  <CardHeader className="space-y-2 pb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{CATEGORY_LABEL[e.category] || e.category}</Badge>
                      {e.version ? (
                        <span className="text-xs text-muted-foreground">{e.version}</span>
                      ) : null}
                      {e.is_featured ? (
                        <Badge variant="default" className="text-[10px]">
                          Destacado
                        </Badge>
                      ) : null}
                      <time
                        className="ml-auto text-xs text-muted-foreground"
                        dateTime={e.published_at || undefined}
                      >
                        {e.published_at
                          ? new Date(e.published_at).toLocaleDateString('es-ES', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                          : ''}
                      </time>
                    </div>
                    <h3 className="text-base font-semibold leading-snug">{e.title}</h3>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ChangelogMarkdown>{e.body_md}</ChangelogMarkdown>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))}
    </div>
  );
};

export default Changelog;
