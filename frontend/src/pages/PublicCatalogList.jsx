import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api from '../lib/axios';
import PublicCatalogShell from '../components/PublicCatalogShell';
import CatalogThirdPartyNotice from '../components/CatalogThirdPartyNotice';
import PageRangePagination from '../components/PageRangePagination';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
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
import {
  applyPublicCatalogListSeo,
  clearCatalogItemPageSeo,
} from '../utils/catalogItemSeo';
import {
  parseCatalogPath,
  buildCatalogPath,
  migrateLegacyQueryToPath,
} from '../utils/catalogPath';
import {
  VEHICLE_TYPE_SLUG_TO_LABEL,
  TRACTION_SLUG_TO_LABEL,
  vehicleTypeToSlug,
  tractionToSlug,
  vehicleTypeSlugToLabel,
  tractionSlugToLabel,
} from '../utils/catalogFilterSlugs';
import { labelMotorPosition } from '../data/motorPosition';
import { Package, Search, Star, X } from 'lucide-react';

const EMPTY   = '__all__';
const PAGE_SIZE = 24;

// Opciones fijas de ordenación
const SORT_OPTIONS = [
  { value: 'manufacturer', label: 'Marca / Referencia' },
  { value: 'year_desc',    label: 'Año (más reciente)' },
  { value: 'rating_desc',  label: 'Mejor valorado' },
  { value: 'newest',       label: 'Añadido recientemente' },
];

function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function PublicCatalogList() {
  const params         = useParams();
  const navigate       = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // --- Parseo del path SEO ---
  const pathSegments = useMemo(() => {
    const wildcard = params['*'] || '';
    return wildcard ? wildcard.split('/').filter(Boolean) : [];
  }, [params]);

  const pathFilters = useMemo(() => parseCatalogPath(pathSegments), [pathSegments]);

  // --- Filtros extra (query string) ---
  const qParam           = searchParams.get('q')              || '';
  const motorParam       = searchParams.get('motor_position') || '';
  const discontinuedParam = searchParams.get('discontinued')  || '';
  const upcomingParam    = searchParams.get('upcoming_release') || '';
  const yearFromParam    = searchParams.get('year_from')       || '';
  const yearToParam      = searchParams.get('year_to')         || '';
  const sortParam        = searchParams.get('sort')            || 'manufacturer';
  const pageParam        = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);

  // Texto de búsqueda local (con debounce)
  const [qInput, setQInput] = useState(qParam);
  const debouncedQ = useDebounce(qInput, 300);
  const isFirstQRender = useRef(true);

  useEffect(() => {
    if (isFirstQRender.current) { isFirstQRender.current = false; return; }
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (debouncedQ) next.set('q', debouncedQ); else next.delete('q');
      next.delete('page');
      return next;
    }, { replace: true });
  }, [debouncedQ]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sincronizar qInput si el parámetro cambia externamente (p. ej. al limpiar filtros)
  useEffect(() => { setQInput(qParam); }, [qParam]);

  // --- Datos remotos ---
  const [items,      setItems]      = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total,      setTotal]      = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [facets,     setFacets]     = useState({ manufacturers: [], vehicle_types: [], tractions: [], motor_positions: [], years: [] });
  const [brands,     setBrands]     = useState([]); // { id, name, slug, logo_url }[]
  /** Borrador del año en path: no navegar hasta tener un año válido (evita borrar "202" al escribir "2024"). */
  const [pathYearDraft, setPathYearDraft] = useState('');

  // --- Redirect 301 legacy (query string → path) ---
  useEffect(() => {
    const migration = migrateLegacyQueryToPath(searchParams);
    if (migration) {
      const qs = migration.cleanSearchParams.toString();
      navigate(`${migration.path}${qs ? `?${qs}` : ''}`, { replace: true });
    }
  }, [navigate, searchParams]);

  // Cargar facetas y brands una sola vez
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get('/public/catalog/facets').then((r) => r.data).catch(() => ({ manufacturers: [], vehicle_types: [], tractions: [], motor_positions: [], years: [] })),
      api.get('/public/catalog/brands').then((r) => r.data.brands ?? []).catch(() => []),
    ]).then(([f, b]) => {
      if (!cancelled) { setFacets(f); setBrands(b); }
    });
    return () => { cancelled = true; };
  }, []);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const apiParams = {
        page: pageParam,
        limit: PAGE_SIZE,
        sort: sortParam !== 'manufacturer' ? sortParam : undefined,
      };

      // Filtros básicos del path
      if (pathFilters.manufacturerSlug) apiParams.manufacturer_slug = pathFilters.manufacturerSlug;
      if (pathFilters.vehicleTypeSlug) {
        apiParams.vehicle_type = vehicleTypeSlugToLabel(pathFilters.vehicleTypeSlug);
      }
      if (pathFilters.tractionSlug) {
        apiParams.traction = tractionSlugToLabel(pathFilters.tractionSlug);
      }
      if (pathFilters.year)             apiParams.year              = pathFilters.year;

      // Filtros extra del query string
      if (qParam)             apiParams.q               = qParam;
      if (motorParam)         apiParams.motor_position  = motorParam;
      if (discontinuedParam)  apiParams.discontinued    = discontinuedParam;
      if (upcomingParam)      apiParams.upcoming_release = upcomingParam;
      if (yearFromParam)      apiParams.year_from       = yearFromParam;
      if (yearToParam)        apiParams.year_to         = yearToParam;

      const { data } = await api.get('/public/catalog/items', { params: apiParams });
      setItems(data.items ?? []);
      setTotalPages(data.totalPages ?? 1);
      setTotal(data.total ?? 0);
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Error al cargar');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [pathFilters, qParam, motorParam, discontinuedParam, upcomingParam, yearFromParam, yearToParam, sortParam, pageParam]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // SEO
  useEffect(() => {
    const mfgBrand = brands.find((b) => b.slug === pathFilters.manufacturerSlug);
    const mfgName  = mfgBrand?.name ?? pathFilters.manufacturerSlug ?? null;
    const vtLabel  = pathFilters.vehicleTypeSlug ? (VEHICLE_TYPE_SLUG_TO_LABEL[pathFilters.vehicleTypeSlug] ?? pathFilters.vehicleTypeSlug) : null;
    const trLabel  = pathFilters.tractionSlug    ? (TRACTION_SLUG_TO_LABEL[pathFilters.tractionSlug]        ?? pathFilters.tractionSlug)    : null;

    applyPublicCatalogListSeo({
      manufacturerName: mfgName,
      vehicleTypeLabel: vtLabel,
      tractionLabel:    trLabel,
      year:             pathFilters.year,
      total,
      canonicalPath:    buildCatalogPath(pathFilters),
    });
    return clearCatalogItemPageSeo;
  }, [pathFilters, brands, total]);

  // ---- Helpers para cambiar filtros del PATH ----
  const setPathFilter = useCallback((key, value) => {
    const next = { ...pathFilters, [key]: value || null };
    const path = buildCatalogPath(next);
    const qs   = new URLSearchParams(searchParams);
    qs.delete('page');
    navigate(`${path}${qs.toString() ? `?${qs.toString()}` : ''}`, { replace: true });
  }, [pathFilters, searchParams, navigate]);

  useEffect(() => {
    setPathYearDraft(pathFilters.year != null ? String(pathFilters.year) : '');
  }, [pathFilters.year]);

  const commitPathYearDraft = useCallback(() => {
    const digits = pathYearDraft.replace(/\D/g, '').slice(0, 4);
    if (!digits) {
      if (pathFilters.year != null) setPathFilter('year', null);
      return;
    }
    const n = parseInt(digits, 10);
    if (Number.isFinite(n) && n >= 1900 && n <= 2100) {
      setPathFilter('year', n);
    } else {
      setPathYearDraft(pathFilters.year != null ? String(pathFilters.year) : '');
    }
  }, [pathYearDraft, pathFilters.year, setPathFilter]);

  // ---- Helpers para filtros extra (query string) ----
  const setQsFilter = useCallback((key, value) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value && value !== EMPTY) next.set(key, value); else next.delete(key);
      next.delete('page');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const setPage = useCallback((p) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (p <= 1) next.delete('page'); else next.set('page', String(p));
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const clearAllFilters = () => {
    navigate('/catalogo', { replace: true });
    setQInput('');
  };

  // ---- Opciones de los desplegables ----
  const manufacturerOptions = useMemo(() => brands, [brands]);

  const vehicleTypeOptions = useMemo(() => {
    const fromFacets = (facets.vehicle_types || []).map((v) => {
      const n = typeof v === 'string' ? v : v.name;
      return { slug: vehicleTypeToSlug(n), label: VEHICLE_TYPE_SLUG_TO_LABEL[vehicleTypeToSlug(n)] ?? n };
    });
    // Incluir el activo aunque no esté en facetas
    if (pathFilters.vehicleTypeSlug && !fromFacets.find((o) => o.slug === pathFilters.vehicleTypeSlug)) {
      fromFacets.push({ slug: pathFilters.vehicleTypeSlug, label: VEHICLE_TYPE_SLUG_TO_LABEL[pathFilters.vehicleTypeSlug] ?? pathFilters.vehicleTypeSlug });
    }
    return fromFacets;
  }, [facets.vehicle_types, pathFilters.vehicleTypeSlug]);

  const tractionOptions = useMemo(() => {
    const fromFacets = (facets.tractions || []).map((t) => {
      const n = typeof t === 'string' ? t : t.name;
      return { slug: tractionToSlug(n), label: TRACTION_SLUG_TO_LABEL[tractionToSlug(n)] ?? n };
    });
    if (pathFilters.tractionSlug && !fromFacets.find((o) => o.slug === pathFilters.tractionSlug)) {
      fromFacets.push({ slug: pathFilters.tractionSlug, label: TRACTION_SLUG_TO_LABEL[pathFilters.tractionSlug] ?? pathFilters.tractionSlug });
    }
    return fromFacets;
  }, [facets.tractions, pathFilters.tractionSlug]);

  const motorPositionOptions = useMemo(() => {
    return (facets.motor_positions || []).map((row) => {
      const value = typeof row === 'string' ? row : row.name;
      return { value, label: labelMotorPosition(value) };
    });
  }, [facets.motor_positions]);

  const hasActiveFilters = Boolean(
    pathFilters.manufacturerSlug || pathFilters.vehicleTypeSlug ||
    pathFilters.tractionSlug     || pathFilters.year            ||
    qParam || motorParam || discontinuedParam || upcomingParam  ||
    yearFromParam || yearToParam
  );

  return (
    <PublicCatalogShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Encabezado */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Package className="size-8 shrink-0" />
            Catálogo de referencias
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Modelos de slot catalogados: referencia, marca, tipo y año de comercialización.
          </p>
        </div>

        {/* Panel de filtros */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          {/* Búsqueda libre */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="Buscar por referencia, modelo o marca…"
              className="pl-9"
            />
            {qInput && (
              <button
                type="button"
                onClick={() => setQInput('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Limpiar búsqueda"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          {/* Filtros básicos (SEO) */}
          <div className="flex flex-wrap gap-3 items-end">
            {/* Marca */}
            <div className="space-y-1.5 min-w-[160px]">
              <Label>Marca</Label>
              <Select
                value={pathFilters.manufacturerSlug || EMPTY}
                onValueChange={(v) => setPathFilter('manufacturerSlug', v === EMPTY ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas las marcas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EMPTY}>Todas las marcas</SelectItem>
                  {manufacturerOptions.map((b) => (
                    <SelectItem key={b.slug || b.name} value={b.slug || b.name.toLowerCase()}>
                      <span className="flex items-center gap-2">
                        {b.logo_url && (
                          <img src={b.logo_url} alt="" className="h-4 w-6 object-contain" />
                        )}
                        {b.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tipo */}
            <div className="space-y-1.5 min-w-[140px]">
              <Label>Tipo</Label>
              <Select
                value={pathFilters.vehicleTypeSlug || EMPTY}
                onValueChange={(v) => setPathFilter('vehicleTypeSlug', v === EMPTY ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos los tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EMPTY}>Todos los tipos</SelectItem>
                  {vehicleTypeOptions.map((o) => (
                    <SelectItem key={o.slug} value={o.slug}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tracción */}
            <div className="space-y-1.5 min-w-[130px]">
              <Label>Tracción</Label>
              <Select
                value={pathFilters.tractionSlug || EMPTY}
                onValueChange={(v) => setPathFilter('tractionSlug', v === EMPTY ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EMPTY}>Todas</SelectItem>
                  {tractionOptions.map((o) => (
                    <SelectItem key={o.slug} value={o.slug}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Año (path): se aplica al salir del campo o Enter; mientras tanto se edita libremente */}
            <div className="space-y-1.5 w-[110px]">
              <Label htmlFor="catalog-filter-year">Año</Label>
              <Input
                id="catalog-filter-year"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={4}
                placeholder="2026"
                value={pathYearDraft}
                onChange={(e) => setPathYearDraft(e.target.value.replace(/\D/g, '').slice(0, 4))}
                onBlur={commitPathYearDraft}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  e.preventDefault();
                  commitPathYearDraft();
                  e.currentTarget.blur();
                }}
              />
            </div>
          </div>

          {/* Filtros extra (query string) */}
          <details className="group">
            <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground select-none flex items-center gap-1.5">
              <span className="text-[10px] border rounded px-1 py-0.5 group-open:hidden">+</span>
              <span className="text-[10px] border rounded px-1 py-0.5 hidden group-open:inline">−</span>
              Filtros avanzados
            </summary>
            <div className="mt-3 flex flex-wrap gap-3 items-end">
              {/* Motor */}
              <div className="space-y-1.5 min-w-[150px]">
                <Label>Posición motor</Label>
                <Select
                  value={motorParam || EMPTY}
                  onValueChange={(v) => setQsFilter('motor_position', v === EMPTY ? '' : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={EMPTY}>Todas</SelectItem>
                    {motorPositionOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Descatalogado */}
              <div className="space-y-1.5 min-w-[150px]">
                <Label>Estado</Label>
                <Select
                  value={discontinuedParam || upcomingParam ? (discontinuedParam === 'true' ? 'discontinued' : upcomingParam === 'true' ? 'upcoming' : EMPTY) : EMPTY}
                  onValueChange={(v) => {
                    setSearchParams((prev) => {
                      const next = new URLSearchParams(prev);
                      next.delete('discontinued');
                      next.delete('upcoming_release');
                      next.delete('page');
                      if (v === 'discontinued') next.set('discontinued', 'true');
                      if (v === 'upcoming')     next.set('upcoming_release', 'true');
                      return next;
                    }, { replace: true });
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={EMPTY}>Todos</SelectItem>
                    <SelectItem value="discontinued">Descatalogados</SelectItem>
                    <SelectItem value="upcoming">Próximos lanzamientos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Rango de años */}
              <div className="space-y-1.5">
                <Label>Rango de años</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={4}
                    placeholder="Desde"
                    className="w-24"
                    value={yearFromParam}
                    onChange={(e) => setQsFilter('year_from', e.target.value.replace(/\D/g, '').slice(0, 4))}
                  />
                  <span className="text-muted-foreground text-sm">–</span>
                  <Input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={4}
                    placeholder="Hasta"
                    className="w-24"
                    value={yearToParam}
                    onChange={(e) => setQsFilter('year_to', e.target.value.replace(/\D/g, '').slice(0, 4))}
                  />
                </div>
              </div>
            </div>
          </details>

          {/* Fila inferior: ordenación + limpiar */}
          <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-border">
            <div className="flex items-center gap-2">
              <Label className="text-xs shrink-0">Ordenar por</Label>
              <Select
                value={sortParam}
                onValueChange={(v) => setQsFilter('sort', v === 'manufacturer' ? '' : v)}
              >
                <SelectTrigger className="h-8 text-xs w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {hasActiveFilters && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={clearAllFilters}
              >
                <X className="size-3 mr-1" />
                Limpiar filtros
              </Button>
            )}
          </div>
        </div>

        {/* Resultados */}
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
                        <div className="flex items-center gap-1.5">
                          {row.manufacturer_logo_url && (
                            <img
                              src={row.manufacturer_logo_url}
                              alt=""
                              className="h-4 w-6 object-contain"
                            />
                          )}
                          <p className="text-sm text-muted-foreground">{row.manufacturer}</p>
                        </div>
                        {row.rating_avg != null && Number(row.rating_count) > 0 && (
                          <p className="text-xs flex items-center gap-1 text-amber-600 dark:text-amber-500">
                            <Star className="size-3.5 shrink-0 fill-current" aria-hidden />
                            <span>
                              {Number(row.rating_avg).toFixed(1)} ({row.rating_count})
                            </span>
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2 pt-1 text-xs">
                          {row.discontinued && (
                            <span className="rounded-md bg-muted px-2 py-0.5">Descatalogado</span>
                          )}
                          {row.upcoming_release && (
                            <span className="rounded-md bg-primary/15 text-primary px-2 py-0.5">
                              Próximo lanzamiento
                            </span>
                          )}
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

            <PageRangePagination
              className="pt-4"
              page={pageParam}
              totalPages={totalPages}
              onPageChange={setPage}
              disabled={loading}
            />
          </>
        )}

        <CatalogThirdPartyNotice />
      </div>
    </PublicCatalogShell>
  );
}

export default PublicCatalogList;
