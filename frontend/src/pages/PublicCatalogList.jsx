import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../lib/axios';
import PublicCatalogShell from '../components/PublicCatalogShell';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Spinner } from '../components/ui/spinner';
import { Alert, AlertDescription } from '../components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { catalogSlugify } from '../utils/catalogSlug';
import { applyPublicCatalogListSeo, clearCatalogItemPageSeo } from '../utils/catalogItemSeo';
import { Package, Star } from 'lucide-react';

const EMPTY = '__all__';

function PublicCatalogList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [facets, setFacets] = useState({ manufacturers: [], vehicle_types: [], years: [] });

  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const manufacturer = searchParams.get('manufacturer') || '';
  const vehicleType = searchParams.get('vehicle_type') || '';
  const year = searchParams.get('year') || '';

  const manufacturersOptions = useMemo(() => {
    const s = new Set(facets.manufacturers);
    if (manufacturer && !s.has(manufacturer)) s.add(manufacturer);
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'es'));
  }, [facets.manufacturers, manufacturer]);

  const vehicleTypesOptions = useMemo(() => {
    const s = new Set(facets.vehicle_types);
    if (vehicleType && !s.has(vehicleType)) s.add(vehicleType);
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'es'));
  }, [facets.vehicle_types, vehicleType]);

  const yearsOptions = useMemo(() => {
    const s = new Set((facets.years || []).map((n) => String(n)));
    if (year && !s.has(year)) s.add(year);
    return Array.from(s).sort((a, b) => parseInt(b, 10) - parseInt(a, 10));
  }, [facets.years, year]);

  const setFacetsFilter = (key, value) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value === '' || value === EMPTY) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
      next.set('page', '1');
      return next;
    }, { replace: true });
  };

  const setPage = (p) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (p <= 1) next.delete('page');
      else next.set('page', String(p));
      return next;
    }, { replace: true });
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/public/catalog/facets');
        if (!cancelled) setFacets(data);
      } catch {
        if (!cancelled) setFacets({ manufacturers: [], vehicle_types: [], years: [] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/public/catalog/items', {
        params: {
          page,
          limit: 24,
          manufacturer: manufacturer || undefined,
          vehicle_type: vehicleType || undefined,
          year: year || undefined,
        },
      });
      setItems(data.items ?? []);
      setTotalPages(data.totalPages ?? 1);
      setTotal(data.total ?? 0);
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Error al cargar');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [page, manufacturer, vehicleType, year]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    applyPublicCatalogListSeo();
    return () => {
      clearCatalogItemPageSeo();
    };
  }, []);

  return (
    <PublicCatalogShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Package className="size-8 shrink-0" />
            Catálogo de referencias
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Modelos de slot catalogados: referencia, marca, tipo y año de comercialización.
          </p>
        </div>

        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-2 min-w-[180px]">
            <Label>Marca</Label>
            <Select
              value={manufacturer || EMPTY}
              onValueChange={(v) => setFacetsFilter('manufacturer', v === EMPTY ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EMPTY}>Todas las marcas</SelectItem>
                {manufacturersOptions.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 min-w-[180px]">
            <Label>Tipo</Label>
            <Select
              value={vehicleType || EMPTY}
              onValueChange={(v) => setFacetsFilter('vehicle_type', v === EMPTY ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EMPTY}>Todos los tipos</SelectItem>
                {vehicleTypesOptions.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 min-w-[140px]">
            <Label>Año</Label>
            <Select
              value={year || EMPTY}
              onValueChange={(v) => setFacetsFilter('year', v === EMPTY ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EMPTY}>Todos los años</SelectItem>
                {yearsOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setSearchParams({}, { replace: true });
            }}
          >
            Limpiar filtros
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner className="size-8" />
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {total === 0 ? 'Sin resultados' : `${total} resultado${total === 1 ? '' : 's'}`}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {items.map((row) => {
                const slug = catalogSlugify(row.model_name || row.reference);
                return (
                  <Link key={row.id} to={`/catalogo/${row.id}/${slug}`} className="group block">
                    <Card className="h-full overflow-hidden transition-shadow hover:shadow-md">
                      <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                        {row.image_url ? (
                          <img
                            src={row.image_url}
                            alt=""
                            className="absolute inset-0 size-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
                            Sin imagen
                          </div>
                        )}
                      </div>
                      <CardContent className="p-4 space-y-1">
                        <p className="font-mono text-xs text-muted-foreground">{row.reference}</p>
                        <p className="font-semibold line-clamp-2 group-hover:text-primary transition-colors">
                          {row.model_name}
                        </p>
                        <p className="text-sm text-muted-foreground">{row.manufacturer}</p>
                        {row.rating_avg != null && Number(row.rating_count) > 0 && (
                          <p className="text-xs flex items-center gap-1 text-amber-600 dark:text-amber-500">
                            <Star className="size-3.5 shrink-0 fill-current" aria-hidden />
                            <span>
                              {Number(row.rating_avg).toFixed(1)} ({row.rating_count})
                            </span>
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2 pt-1 text-xs">
                          {row.vehicle_type && (
                            <span className="rounded-md bg-secondary px-2 py-0.5">{row.vehicle_type}</span>
                          )}
                          {row.commercial_release_year != null && (
                            <span className="rounded-md bg-secondary px-2 py-0.5">{row.commercial_release_year}</span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  Anterior
                </Button>
                <span className="text-sm text-muted-foreground px-2">
                  Página {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Siguiente
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </PublicCatalogShell>
  );
}

export default PublicCatalogList;
