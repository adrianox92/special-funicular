import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { LayoutDashboard, RefreshCw, Search, Users, UserCheck, Car, Trophy, Timer } from 'lucide-react';
import api from '../lib/axios';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { isLicenseAdminUser } from '../lib/licenseAdmin';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Spinner } from '../components/ui/spinner';
import { Badge } from '../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import VehicleCatalogCoverageChart from '../components/charts/VehicleCatalogCoverageChart';
import { Switch } from '../components/ui/switch';
import CatalogBrandSelect from '../components/CatalogBrandSelect';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';

const REFS_PAGE_SIZE = 25;
const REFS_SEARCH_MAX = 100;

function adminRefsSearchParams(search) {
  const raw = typeof search === 'string' ? search : '';
  return new URLSearchParams(raw.startsWith('?') ? raw.slice(1) : raw);
}

function clipRefsFilter(value) {
  return String(value || '').trim().slice(0, REFS_SEARCH_MAX);
}

/** Deep-link: ?ref=FOO (alias ?q=). Contains sobre ref normalizada (trim + lower) en el API. */
function readAdminRefsQueryFromSearch(search) {
  const sp = adminRefsSearchParams(search);
  return clipRefsFilter(sp.get('ref') || sp.get('q') || '');
}

/** Deep-link: ?manufacturer=Ninco (alias ?mfg=). Contains sobre fabricante de garaje. */
function readAdminRefsManufacturerFromSearch(search) {
  const sp = adminRefsSearchParams(search);
  return clipRefsFilter(sp.get('manufacturer') || sp.get('mfg') || '');
}

function withAdminRefsQueryParams(search, { q, manufacturer }) {
  const sp = adminRefsSearchParams(search);
  const nextQ = clipRefsFilter(q);
  const nextMfg = clipRefsFilter(manufacturer);
  if (nextQ) sp.set('ref', nextQ);
  else sp.delete('ref');
  sp.delete('q');
  if (nextMfg) sp.set('manufacturer', nextMfg);
  else sp.delete('manufacturer');
  sp.delete('mfg');
  return sp.toString();
}

function syncAdminRefsQueryInUrl({ q, manufacturer }) {
  if (typeof window === 'undefined') return;
  const qs = withAdminRefsQueryParams(window.location.search, { q, manufacturer });
  const next = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash || ''}`;
  window.history.replaceState(null, '', next);
}

function uniqueCatalogMatch(row) {
  if (!row?.in_catalog) return false;
  const count = Number(row.catalog_item_count);
  return count === 1 && !!row.catalog_manufacturer_id && !!row.catalog_item_id;
}

const CATALOG_MATCH_LABEL = {
  exact: 'Misma referencia',
  alias: 'Alias',
  ean: 'EAN',
  prefix: 'Prefijo de marca',
  suffix: 'Termina en la ref. del garaje',
};

/** Una sola ficha clara: la única, o la única de la misma marca de garaje. */
function pickSuggestedCatalogItem(suggestions) {
  if (!Array.isArray(suggestions) || suggestions.length === 0) return null;
  if (suggestions.length === 1) return suggestions[0];
  const ranks = suggestions
    .map((item) => Number(item?.manufacturer_rank))
    .filter((rank) => Number.isFinite(rank));
  if (ranks.length === 0) return null;
  const best = Math.min(...ranks);
  if (best > 1) return null;
  const top = suggestions.filter((item) => Number(item?.manufacturer_rank) === best);
  return top.length === 1 ? top[0] : null;
}

const PRESETS = [
  { value: '7d', label: 'Últimos 7 días', ms: 7 * 24 * 60 * 60 * 1000 },
  { value: '30d', label: 'Últimos 30 días', ms: 30 * 24 * 60 * 60 * 1000 },
  { value: '90d', label: 'Últimos 90 días (≈ trimestre)', ms: 90 * 24 * 60 * 60 * 1000 },
];

function rollingRange(ms) {
  const to = new Date();
  const from = new Date(to.getTime() - ms);
  return { from, to };
}

/** Rango [from, to) desde fechas YYYY-MM-DD (interpretadas en UTC). */
function customRangeFromInputs(fromStr, toStr) {
  if (!fromStr || !toStr) return null;
  const [fy, fm, fd] = fromStr.split('-').map(Number);
  const [ty, tm, td] = toStr.split('-').map(Number);
  if (![fy, fm, fd, ty, tm, td].every((n) => Number.isFinite(n))) return null;
  const from = new Date(Date.UTC(fy, fm - 1, fd, 0, 0, 0, 0));
  const to = new Date(Date.UTC(ty, tm - 1, td + 1, 0, 0, 0, 0));
  return from.getTime() < to.getTime() ? { from, to } : null;
}

function formatRangeLabel(from, to) {
  try {
    const opts = { dateStyle: 'short', timeStyle: 'short' };
    return `${from.toLocaleString('es-ES', opts)} — ${to.toLocaleString('es-ES', opts)}`;
  } catch {
    return '';
  }
}

function formatEsPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${n.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}

const MCP_CATALOG_OUTCOME = {
  found: 'Encontrada',
  not_found: 'No encontrada',
  ambiguous: 'Ambigua',
  rate_limited: 'Límite por minuto',
  daily_limited: 'Límite diario',
};

function mcpCatalogOutcomeLabel(outcome) {
  return MCP_CATALOG_OUTCOME[outcome] || outcome || '—';
}

function catalogTopRows(data, historic, periodKey, allKey) {
  const rows = historic ? data?.[allKey] : data?.[periodKey];
  return Array.isArray(rows) ? rows : [];
}

function formatCatalogDelta(count, historic) {
  const n = Number(count) || 0;
  return historic ? String(n) : `+${n}`;
}

function CatalogAssignmentTops({ data, historic, onHistoricChange }) {
  const brands = catalogTopRows(data, historic, 'catalog_brands_period', 'catalog_brands_all');
  const refs = catalogTopRows(data, historic, 'catalog_refs_period', 'catalog_refs_all');
  const emptyLabel = historic
    ? 'Sin vehículos enlazados al catálogo.'
    : 'Sin asignaciones en este periodo.';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {historic
            ? 'Total histórico de vehículos con enlace a catálogo, sin filtro de fechas.'
            : 'Variación del periodo: vehículos creados en el intervalo de arriba que ya tienen ficha de catálogo.'}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Variación del periodo</span>
          <Switch
            id="catalog-tops-historic"
            checked={historic}
            onCheckedChange={(v) => onHistoricChange(!!v)}
          />
          <Label htmlFor="catalog-tops-historic" className="text-sm font-normal cursor-pointer">
            Total histórico
          </Label>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="space-y-1 pb-3">
            <CardTitle className="text-base">Marcas en el catálogo</CardTitle>
            <CardDescription>
              Top 10 por vehículos asignados. Entre paréntesis, usuarios distintos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {brands.length === 0 ? (
              <p className="text-sm text-muted-foreground">{emptyLabel}</p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Marca</TableHead>
                      <TableHead className="text-right w-[140px]">Vehículos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {brands.map((row) => (
                      <TableRow key={row.brand_name}>
                        <TableCell>{row.brand_name}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCatalogDelta(row.vehicle_count, historic)} ({Number(row.user_count) || 0})
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="space-y-1 pb-3">
            <CardTitle className="text-base">Referencias en el catálogo</CardTitle>
            <CardDescription>Top 10 por usuarios que tienen ese coche.</CardDescription>
          </CardHeader>
          <CardContent>
            {refs.length === 0 ? (
              <p className="text-sm text-muted-foreground">{emptyLabel}</p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Referencia</TableHead>
                      <TableHead className="text-right w-[120px]">Usuarios</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {refs.map((row) => (
                      <TableRow key={`${row.brand_name}:${row.reference}`}>
                        <TableCell>
                          <span className="font-mono">{row.reference}</span>
                          <span className="block text-xs text-muted-foreground truncate">
                            {[row.model_name, row.brand_name].filter(Boolean).join(' · ')}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCatalogDelta(row.user_count, historic)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const AdminPlatformDashboard = () => {
  const { user } = useAuth();
  const isAdmin = isLicenseAdminUser(user);

  const [preset, setPreset] = useState('7d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const range = useMemo(() => {
    if (preset === 'custom') {
      const r = customRangeFromInputs(customFrom, customTo);
      return r;
    }
    const p = PRESETS.find((x) => x.value === preset);
    return p ? rollingRange(p.ms) : rollingRange(PRESETS[0].ms);
  }, [preset, customFrom, customTo]);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [retention, setRetention] = useState(null);
  const [retentionLoading, setRetentionLoading] = useState(false);
  const [retentionError, setRetentionError] = useState(null);

  const [mcpUsage, setMcpUsage] = useState(null);
  const [mcpUsageLoading, setMcpUsageLoading] = useState(false);
  const [mcpUsageError, setMcpUsageError] = useState(null);
  const [catalogTopsHistoric, setCatalogTopsHistoric] = useState(false);

  const [refsPage, setRefsPage] = useState(1);
  const [refsOnlyUnlinked, setRefsOnlyUnlinked] = useState(false);
  const [refsSearchInput, setRefsSearchInput] = useState(() =>
    readAdminRefsQueryFromSearch(typeof window !== 'undefined' ? window.location.search : ''),
  );
  const [refsQuery, setRefsQuery] = useState(() =>
    readAdminRefsQueryFromSearch(typeof window !== 'undefined' ? window.location.search : ''),
  );
  const [refsManufacturerInput, setRefsManufacturerInput] = useState(() =>
    readAdminRefsManufacturerFromSearch(
      typeof window !== 'undefined' ? window.location.search : '',
    ),
  );
  const [refsManufacturer, setRefsManufacturer] = useState(() =>
    readAdminRefsManufacturerFromSearch(
      typeof window !== 'undefined' ? window.location.search : '',
    ),
  );
  const [refsData, setRefsData] = useState(null);
  const [refsLoading, setRefsLoading] = useState(false);
  const [refsError, setRefsError] = useState(null);

  const [linkDialogRow, setLinkDialogRow] = useState(null);
  const [linkCatalogManufacturerId, setLinkCatalogManufacturerId] = useState('');
  const [linkCatalogReference, setLinkCatalogReference] = useState('');
  const [linkCatalogItemId, setLinkCatalogItemId] = useState('');
  const [linkSuggestions, setLinkSuggestions] = useState([]);
  const [linkSuggestionsLoading, setLinkSuggestionsLoading] = useState(false);
  const [linkSuggestionsError, setLinkSuggestionsError] = useState(null);
  const [linkRestrictMfg, setLinkRestrictMfg] = useState(true);
  const [linkSaving, setLinkSaving] = useState(false);
  const [linkFeedback, setLinkFeedback] = useState(null);
  const [refsLinkBanner, setRefsLinkBanner] = useState(null);
  const linkSelectionTouchedRef = useRef(false);

  const fetchMetrics = useCallback(async () => {
    if (!range) return;
    setLoading(true);
    setError(null);
    try {
      const { data: res } = await api.get('/admin/platform-metrics', {
        params: {
          from: range.from.toISOString(),
          to: range.to.toISOString(),
        },
      });
      setData(res);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Error al cargar métricas';
      setError(msg);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [range]);

  const fetchRetention = useCallback(async () => {
    setRetentionLoading(true);
    setRetentionError(null);
    try {
      const { data: res } = await api.get('/admin/timing-retention');
      setRetention(res);
    } catch (err) {
      const msg =
        err.response?.data?.error || err.message || 'Error al cargar retención de timings';
      setRetentionError(msg);
      setRetention(null);
    } finally {
      setRetentionLoading(false);
    }
  }, []);

  const fetchMcpUsage = useCallback(async () => {
    setMcpUsageLoading(true);
    setMcpUsageError(null);
    try {
      const { data: res } = await api.get('/admin/mcp-catalog-usage');
      setMcpUsage(res);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Error al cargar el uso del MCP';
      setMcpUsageError(msg);
      setMcpUsage(null);
    } finally {
      setMcpUsageLoading(false);
    }
  }, []);

  const fetchRefsReport = useCallback(async () => {
    if (!isAdmin) return;
    setRefsLoading(true);
    setRefsError(null);
    const offset = (refsPage - 1) * REFS_PAGE_SIZE;
    try {
      const { data: res } = await api.get('/admin/vehicle-refs-not-in-catalog', {
        params: {
          limit: REFS_PAGE_SIZE,
          offset,
          only_unlinked: refsOnlyUnlinked ? 'true' : 'false',
          ...(refsQuery ? { q: refsQuery } : {}),
          ...(refsManufacturer ? { manufacturer: refsManufacturer } : {}),
        },
      });
      setRefsData(res);
    } catch (err) {
      const msg =
        err.response?.data?.error || err.message || 'Error al cargar referencias ausentes del catálogo';
      setRefsError(msg);
      setRefsData(null);
    } finally {
      setRefsLoading(false);
    }
  }, [isAdmin, refsPage, refsOnlyUnlinked, refsQuery, refsManufacturer]);

  const applyRefsSearch = ({ q = refsSearchInput, manufacturer = refsManufacturerInput } = {}) => {
    const nextQ = clipRefsFilter(q);
    const nextMfg = clipRefsFilter(manufacturer);
    setRefsSearchInput(nextQ);
    setRefsQuery(nextQ);
    setRefsManufacturerInput(nextMfg);
    setRefsManufacturer(nextMfg);
    setRefsPage(1);
    syncAdminRefsQueryInUrl({ q: nextQ, manufacturer: nextMfg });
  };

  const linkPreviewCounts = (row, restrictMfg) => {
    if (!row) return { vehicles: 0, users: 0 };
    const hasSampleMfg = row.sample_manufacturer != null && String(row.sample_manufacturer).trim() !== '';
    if (restrictMfg && hasSampleMfg) {
      return {
        vehicles: row.linkable_vehicle_count_sample_mfg ?? row.linkable_vehicle_count ?? 0,
        users: row.linkable_distinct_user_count_sample_mfg ?? row.linkable_distinct_user_count ?? 0,
      };
    }
    return {
      vehicles: row.linkable_vehicle_count ?? row.vehicle_count ?? 0,
      users: row.linkable_distinct_user_count ?? row.distinct_user_count ?? 0,
    };
  };

  const applyCatalogSuggestion = (item, { userChosen = false } = {}) => {
    if (!item?.id) return;
    if (userChosen) linkSelectionTouchedRef.current = true;
    setLinkCatalogItemId(String(item.id));
    setLinkCatalogManufacturerId(String(item.manufacturer_id || ''));
    setLinkCatalogReference(String(item.reference || ''));
    setLinkFeedback(null);
  };

  const openLinkDialog = (row) => {
    setRefsLinkBanner(null);
    setLinkFeedback(null);
    setLinkSuggestions([]);
    setLinkSuggestionsError(null);
    setLinkSuggestionsLoading(String(row.reference || '').trim().length >= 2);
    linkSelectionTouchedRef.current = false;
    setLinkDialogRow(row);
    if (uniqueCatalogMatch(row)) {
      setLinkCatalogManufacturerId(String(row.catalog_manufacturer_id));
      setLinkCatalogReference(String(row.catalog_reference || row.reference || ''));
      setLinkCatalogItemId(String(row.catalog_item_id));
    } else {
      setLinkCatalogManufacturerId('');
      setLinkCatalogReference('');
      setLinkCatalogItemId('');
    }
    setLinkRestrictMfg(!!(row.sample_manufacturer && String(row.sample_manufacturer).trim()));
  };

  const submitLinkGarageToCatalog = async () => {
    if (!linkDialogRow) return;
    const catRef = linkCatalogReference.trim();
    const itemId = linkCatalogItemId.trim();
    if (!itemId && (!linkCatalogManufacturerId?.trim() || !catRef)) {
      setLinkFeedback({
        variant: 'destructive',
        text: 'Elige una coincidencia, o indica la marca y la referencia del catálogo.',
      });
      return;
    }
    setLinkSaving(true);
    setLinkFeedback(null);
    try {
      const payload = {
        garage_reference: linkDialogRow.reference ?? '',
      };
      if (itemId) payload.catalog_item_id = itemId;
      if (catRef) payload.catalog_reference = catRef;
      if (linkCatalogManufacturerId?.trim()) {
        payload.catalog_manufacturer_id = linkCatalogManufacturerId.trim();
      }
      const sm = linkDialogRow.sample_manufacturer;
      if (linkRestrictMfg && sm != null && String(sm).trim() !== '') {
        payload.garage_manufacturer = String(sm).trim();
      }
      const { data: res } = await api.post('/admin/link-garage-refs-to-catalog', payload);
      setRefsLinkBanner({
        text: `Enlazados ${res.updated_count ?? 0} vehículo(s) a la referencia de catálogo.`,
      });
      setLinkDialogRow(null);
      setLinkFeedback(null);
      void fetchRefsReport();
    } catch (err) {
      setLinkFeedback({
        variant: 'destructive',
        text: err.response?.data?.error || err.message || 'Error al enlazar',
      });
    } finally {
      setLinkSaving(false);
    }
  };

  useEffect(() => {
    if (!linkDialogRow) return undefined;
    const reference = String(linkDialogRow.reference || '').trim();
    if (reference.length < 2) return undefined;

    let cancelled = false;
    const manufacturer = String(linkDialogRow.sample_manufacturer || '').trim();
    setLinkSuggestionsLoading(true);
    setLinkSuggestionsError(null);

    api
      .get('/admin/catalog-link-suggestions', {
        params: {
          reference,
          ...(manufacturer ? { manufacturer } : {}),
        },
      })
      .then(({ data: res }) => {
        if (cancelled) return;
        const list = Array.isArray(res?.suggestions) ? res.suggestions : [];
        setLinkSuggestions(list);
        if (!linkSelectionTouchedRef.current && !uniqueCatalogMatch(linkDialogRow)) {
          const pick = pickSuggestedCatalogItem(list);
          if (pick) applyCatalogSuggestion(pick);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setLinkSuggestions([]);
        setLinkSuggestionsError(
          err.response?.data?.error || err.message || 'No se pudieron cargar las coincidencias',
        );
      })
      .finally(() => {
        if (!cancelled) setLinkSuggestionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [linkDialogRow]);

  useEffect(() => {
    if (isAdmin && range) void fetchMetrics();
  }, [isAdmin, range, fetchMetrics]);

  useEffect(() => {
    if (isAdmin) void fetchRetention();
  }, [isAdmin, fetchRetention]);

  useEffect(() => {
    if (isAdmin) void fetchMcpUsage();
  }, [isAdmin, fetchMcpUsage]);

  useEffect(() => {
    if (isAdmin) void fetchRefsReport();
  }, [isAdmin, fetchRefsReport]);

  useEffect(() => {
    setRefsPage(1);
  }, [refsOnlyUnlinked]);

  useEffect(() => {
    if (!refsData || refsLoading) return;
    const pages = Math.max(1, Math.ceil(Number(refsData.total) / REFS_PAGE_SIZE));
    if (refsPage > pages) setRefsPage(pages);
  }, [refsData, refsLoading, refsPage]);

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const refsTotalPages =
    refsData?.total != null
      ? Math.max(1, Math.ceil(Number(refsData.total) / REFS_PAGE_SIZE))
      : 1;

  const kpis = [
    {
      key: 'users_created',
      title: 'Usuarios creados',
      value: data?.users_created ?? '—',
      hint: 'Cuentas nuevas registradas en el intervalo.',
      icon: Users,
    },
    {
      key: 'users_active',
      title: 'Usuarios activos',
      value: data?.users_active ?? '—',
      hint: 'Inicios de sesión (last_sign_in_at) en el intervalo.',
      icon: UserCheck,
    },
    {
      key: 'vehicles_in_period',
      title: 'Vehículos creados',
      value: data?.vehicles_in_period ?? '—',
      hint: 'Vehículos añadidos a la colección en el intervalo.',
      icon: Car,
    },
    {
      key: 'competitions_created',
      title: 'Competiciones creadas',
      value: data?.competitions_created ?? '—',
      hint: 'Competiciones con fecha de creación en el intervalo.',
      icon: Trophy,
    },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <LayoutDashboard className="size-7" />
            Métricas de plataforma
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Solo administradores. Intervalo semiabierto [inicio, fin): el fin es exclusivo.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            void fetchMetrics();
            void fetchRetention();
            void fetchMcpUsage();
          }}
          disabled={loading || retentionLoading || mcpUsageLoading || !range}
        >
          <RefreshCw className={loading || retentionLoading || mcpUsageLoading ? 'size-4 animate-spin' : 'size-4'} />
          Actualizar
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between space-y-0 pb-2">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <Timer className="size-4 text-muted-foreground" aria-hidden />
              Retención timings (30d)
            </CardTitle>
            <CardDescription>
              Ventana móvil de 30 días (independiente del periodo de abajo). Misma definición que la
              rutina SQL semanal:{' '}
              <span className="font-mono">
                coalesce(timing_date::timestamptz, created_at) &gt;= now() - 30 days
              </span>
              , join timings → vehicles.
            </CardDescription>
          </div>
          {retention && (
            <Badge
              variant={
                Number(retention.timing_30d_pct) >= (retention.goal?.target_min_pct ?? 8)
                  ? 'default'
                  : 'secondary'
              }
            >
              {Number(retention.timing_30d_pct) >= (retention.goal?.target_min_pct ?? 8)
                ? 'En objetivo'
                : 'Por debajo del objetivo'}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {retentionError && (
            <Alert variant="destructive">
              <AlertDescription>{retentionError}</AlertDescription>
            </Alert>
          )}
          {retentionLoading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Spinner className="size-5" />
              Cargando retención…
            </div>
          )}
          {retention && !retentionLoading && (
            <>
              <div>
                <div className="text-3xl font-bold tabular-nums">
                  {formatEsPercent(retention.timing_30d_pct)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {retention.users_with_timing_30d} de {retention.registered_users} usuarios
                  registrados con ≥1 timing en 30 días.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    label: 'Registrados',
                    value: retention.registered_users,
                    hint: 'auth.users',
                  },
                  {
                    label: 'Con ≥1 vehículo',
                    value: retention.users_with_vehicle,
                    hint: formatEsPercent(retention.users_with_vehicle_pct),
                  },
                  {
                    label: 'Con timing alguna vez',
                    value: retention.users_with_timing_ever,
                    hint: formatEsPercent(retention.users_with_timing_ever_pct),
                  },
                  {
                    label: 'Con timing 30d',
                    value: retention.users_with_timing_30d,
                    hint: formatEsPercent(retention.timing_30d_pct),
                  },
                ].map((row) => (
                  <div key={row.label} className="rounded-md border px-3 py-2">
                    <p className="text-xs text-muted-foreground">{row.label}</p>
                    <p className="text-xl font-semibold tabular-nums">{row.value}</p>
                    <p className="text-xs text-muted-foreground">{row.hint}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Baseline {formatEsPercent(retention.goal?.baseline_2026_09_11_pct)} (11/09/2026) /{' '}
                {formatEsPercent(retention.goal?.baseline_2026_09_15_pct)} (15/09/2026). Objetivo ≥{' '}
                {retention.goal?.target_min_pct ?? 8}–{retention.goal?.target_max_pct ?? 10} %.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Consultas MCP al catálogo</CardTitle>
          <CardDescription>
            Últimas 24 horas. Cada ficha pedida por un asistente queda registrada con la cuenta, la
            referencia y la marca. Máximo 10 por minuto y 100 al día.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {mcpUsageError && (
            <Alert variant="destructive">
              <AlertDescription>{mcpUsageError}</AlertDescription>
            </Alert>
          )}
          {mcpUsageLoading && !mcpUsage && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner className="size-4" />
              Cargando consultas…
            </div>
          )}
          {mcpUsage && !mcpUsage.ready && (
            <p className="text-sm text-muted-foreground">
              Falta la tabla de registro. Ejecuta{' '}
              <span className="font-mono">backend/scripts/create-mcp-catalog-usage.sql</span> en
              Supabase.
            </p>
          )}
          {mcpUsage?.ready && (
            <>
              <p className="text-sm">
                <span className="text-2xl font-semibold tabular-nums">{mcpUsage.lookups_24h ?? 0}</span>
                <span className="ml-2 text-muted-foreground">consultas en 24 h</span>
              </p>
              {(mcpUsage.users || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nadie ha consultado el catálogo en las últimas 24 horas.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cuenta</TableHead>
                      <TableHead className="text-right">Consultas</TableHead>
                      <TableHead className="text-right">Referencias</TableHead>
                      <TableHead>Última</TableHead>
                      <TableHead>Resultado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mcpUsage.users.map((row) => (
                      <TableRow key={row.user_id}>
                        <TableCell className="max-w-[16rem] truncate">
                          {row.email || row.user_id}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{row.lookups}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.distinct_refs}</TableCell>
                        <TableCell className="max-w-[14rem] truncate">
                          {row.last_reference} · {row.last_manufacturer}
                        </TableCell>
                        <TableCell>{mcpCatalogOutcomeLabel(row.last_outcome)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Periodo</CardTitle>
          <CardDescription>
            Elige un periodo predefinido o un rango personalizado (fechas en UTC).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="space-y-2 min-w-[200px]">
            <Label htmlFor="preset-period">Periodo predefinido</Label>
            <Select
              value={preset}
              onValueChange={(v) => {
                setPreset(v);
                if (v === 'custom') {
                  const seed = rollingRange(PRESETS[0].ms);
                  setCustomFrom(seed.from.toISOString().slice(0, 10));
                  setCustomTo(seed.to.toISOString().slice(0, 10));
                }
              }}
            >
              <SelectTrigger id="preset-period">
                <SelectValue placeholder="Periodo" />
              </SelectTrigger>
              <SelectContent>
                {PRESETS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Personalizado…</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {preset === 'custom' && (
            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-2">
                <Label htmlFor="custom-from">Desde (UTC)</Label>
                <Input
                  id="custom-from"
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="custom-to">Hasta (UTC, día inclusive)</Label>
                <Input
                  id="custom-to"
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                />
              </div>
            </div>
          )}
          {range && (
            <p className="text-xs text-muted-foreground sm:flex-1 sm:min-w-[240px]">
              {formatRangeLabel(range.from, range.to)}
            </p>
          )}
        </CardContent>
      </Card>

      {preset === 'custom' && !range && (
        <Alert>
          <AlertDescription>
            Indica dos fechas válidas: el día final cuenta como inclusive (internamente el fin es el día siguiente 00:00 UTC).
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Spinner className="size-5" />
          Cargando…
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {kpis.map(({ key, title, value, hint, icon: Icon }) => (
          <Card key={key}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{title}</CardTitle>
              <Icon className="size-4 text-muted-foreground" aria-hidden />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tabular-nums">{value}</div>
              <p className="text-xs text-muted-foreground mt-2">{hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {data && !loading && (
        <>
          <VehicleCatalogCoverageChart
            vehiclesTotal={data.vehicles_total ?? 0}
            withCatalogItemId={data.vehicles_with_catalog_item_id ?? 0}
          />
          <CatalogAssignmentTops
            data={data}
            historic={catalogTopsHistoric}
            onHistoricChange={setCatalogTopsHistoric}
          />
        </>
      )}

      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-base">Referencias de garaje ausentes del catálogo</CardTitle>
          <CardDescription>
            {refsQuery ? (
              <>
                Búsqueda: contains sobre la referencia de garaje normalizada (espacios y
                mayúsculas/minúsculas). Incluye grupos que ya existen en el catálogo para poder enlazar
                vehículos con <span className="font-mono">catalog_item_id</span> vacío. El match exacto sale
                primero.
                {refsManufacturer ? (
                  <>
                    {' '}
                    El fabricante filtra el texto libre de garaje y agrupa cada marca por separado.
                  </>
                ) : null}
              </>
            ) : refsManufacturer ? (
              <>
                Ranking de huecos filtrado por fabricante de garaje (contains, espacios y
                mayúsculas/minúsculas). Los grupos son <span className="font-mono">referencia + marca</span>{' '}
                para ir resolviendo una marca cada vez.
              </>
            ) : (
              <>
                Agrupadas por referencia normalizada (espacios y mayúsculas/minúsculas). Si algún ítem del
                catálogo público comparte la misma referencia normalizada, no aparece aquí — usa la búsqueda
                para localizarlas y enlazar. Filtra por fabricante para agrupar por marca. Ejemplares y
                usuarios muestran solo vehículos sin enlace a catálogo (
                <span className="font-mono">catalog_item_id</span> vacío), alineados con la acción Enlazar. No
                depende del periodo de fechas de arriba.
              </>
            )}
          </CardDescription>
          <form
            className="flex flex-col gap-3 pt-3"
            onSubmit={(e) => {
              e.preventDefault();
              applyRefsSearch();
            }}
          >
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-2 min-w-[220px] flex-1 max-w-sm">
                <Label htmlFor="refs-search">Buscar referencia</Label>
                <Input
                  id="refs-search"
                  type="search"
                  value={refsSearchInput}
                  onChange={(e) => setRefsSearchInput(e.target.value)}
                  placeholder="ej. AV52802"
                  maxLength={REFS_SEARCH_MAX}
                  className="font-mono"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2 min-w-[200px] flex-1 max-w-sm">
                <Label htmlFor="refs-manufacturer">Fabricante</Label>
                <Input
                  id="refs-manufacturer"
                  type="search"
                  value={refsManufacturerInput}
                  onChange={(e) => setRefsManufacturerInput(e.target.value)}
                  placeholder="ej. Ninco"
                  maxLength={REFS_SEARCH_MAX}
                  autoComplete="off"
                />
              </div>
              <Button type="submit" variant="secondary" size="sm" disabled={refsLoading}>
                <Search className="size-4" aria-hidden />
                Buscar
              </Button>
              {refsQuery || refsManufacturer ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => applyRefsSearch({ q: '', manufacturer: '' })}
                  disabled={refsLoading}
                >
                  Limpiar
                </Button>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              Deep-link:{' '}
              <span className="font-mono">/admin/dashboard?ref=FOO&amp;manufacturer=Ninco</span>. Sin
              referencia se muestra el ranking de huecos; con referencia también salen refs ya presentes en el
              catálogo. El fabricante es opcional y se combina con la referencia.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  id="refs-only-unlinked"
                  checked={refsOnlyUnlinked}
                  onCheckedChange={(v) => setRefsOnlyUnlinked(!!v)}
                />
                <Label htmlFor="refs-only-unlinked" className="text-sm font-normal cursor-pointer">
                  Sólo vehículos sin enlace a catálogo (<span className="font-mono">catalog_item_id</span>{' '}
                  vacío)
                </Label>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void fetchRefsReport()}
                disabled={refsLoading}
              >
                Actualizar listado
              </Button>
            </div>
          </form>
        </CardHeader>
        <CardContent className="space-y-4">
          {refsError && (
            <Alert variant="destructive">
              <AlertDescription>{refsError}</AlertDescription>
            </Alert>
          )}
          {refsLinkBanner && (
            <Alert>
              <AlertDescription>{refsLinkBanner.text}</AlertDescription>
            </Alert>
          )}
          {refsLoading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Spinner className="size-5" />
              Cargando referencias…
            </div>
          )}
          {!refsLoading && !refsError && refsData && (
            <>
              <p className="text-sm text-muted-foreground">
                {refsData.total === 0
                  ? refsQuery || refsManufacturer
                    ? 'Ningún grupo de garaje coincide con esos filtros.'
                    : 'Ningún grupo cumple los criterios.'
                  : `Mostrando ${refsData.rows?.length ?? 0} grupo(s) de ${refsData.total} (ordenados por nº de ejemplares enlazables${refsQuery ? '; exactos primero' : ''}${refsManufacturer ? '; agrupados por marca' : ''}).`}
              </p>
              {refsData.total > 0 && (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right w-[110px]">Ejemplares</TableHead>
                        <TableHead>Referencia</TableHead>
                        {refsQuery ? <TableHead className="w-[140px]">Catálogo</TableHead> : null}
                        <TableHead className="text-right w-[100px]">Usuarios</TableHead>
                        <TableHead>Fabricante (ej.)</TableHead>
                        <TableHead>Modelo (ej.)</TableHead>
                        <TableHead className="text-right w-[120px]">Acción</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(refsData.rows || []).map((row, idx) => {
                        const linkableVehicles = row.linkable_vehicle_count ?? row.vehicle_count ?? 0;
                        const linkableUsers =
                          row.linkable_distinct_user_count ?? row.distinct_user_count ?? '—';
                        const totalVehicles = row.vehicle_count ?? 0;
                        const showTotalHint =
                          !refsOnlyUnlinked &&
                          Number.isFinite(totalVehicles) &&
                          totalVehicles > linkableVehicles;
                        const catalogCount = Number(row.catalog_item_count) || 0;
                        return (
                        <TableRow key={`${refsData.offset}-${idx}`}>
                          <TableCell className="text-right tabular-nums font-semibold">
                            {linkableVehicles}
                            {showTotalHint && (
                              <span className="block text-xs font-normal text-muted-foreground">
                                de {totalVehicles} tot.
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-sm">{row.reference || '—'}</TableCell>
                          {refsQuery ? (
                            <TableCell>
                              {row.in_catalog ? (
                                <Badge variant="secondary">
                                  {catalogCount > 1 ? `En catálogo (${catalogCount})` : 'En catálogo'}
                                </Badge>
                              ) : (
                                <Badge variant="outline">Ausente</Badge>
                              )}
                            </TableCell>
                          ) : null}
                          <TableCell className="text-right tabular-nums">
                            {linkableUsers}
                          </TableCell>
                          <TableCell className="text-sm">{row.sample_manufacturer ?? '—'}</TableCell>
                          <TableCell className="text-sm">{row.sample_model ?? '—'}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={linkableVehicles <= 0}
                              onClick={() => openLinkDialog(row)}
                            >
                              Enlazar
                            </Button>
                          </TableCell>
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
              {refsData.total > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    Página {refsPage} de {refsTotalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={refsPage <= 1 || refsLoading}
                      onClick={() => setRefsPage((p) => Math.max(1, p - 1))}
                    >
                      Anterior
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={refsLoading || refsPage >= refsTotalPages}
                      onClick={() => setRefsPage((p) => p + 1)}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!linkDialogRow} onOpenChange={(open) => !open && setLinkDialogRow(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Enlazar referencia de garaje al catálogo</DialogTitle>
            <DialogDescription>
              Se actualizarán todos los vehículos con la misma referencia de garaje (y filtro de fabricante si
              aplica) que tengan <span className="font-mono">catalog_item_id</span> vacío. Si la ficha no
              coincide al pie de la letra, también aparecen las que terminan en ese código.
            </DialogDescription>
          </DialogHeader>
          {linkDialogRow && (
            <div className="space-y-4 py-2">
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm space-y-1">
                <p>
                  <span className="text-muted-foreground">Referencia en garajes:</span>{' '}
                  <span className="font-mono font-medium">{linkDialogRow.reference || '—'}</span>
                </p>
                <p className="text-muted-foreground tabular-nums">
                  Vehículos a enlazar: {linkPreviewCounts(linkDialogRow, linkRestrictMfg).vehicles} ·
                  Usuarios: {linkPreviewCounts(linkDialogRow, linkRestrictMfg).users}
                </p>
              </div>
              {linkDialogRow.sample_manufacturer != null && String(linkDialogRow.sample_manufacturer).trim() !== '' && (
                <div className="flex items-center gap-2">
                  <Switch id="link-restrict-mfg" checked={linkRestrictMfg} onCheckedChange={(v) => setLinkRestrictMfg(!!v)} />
                  <Label htmlFor="link-restrict-mfg" className="text-sm font-normal cursor-pointer leading-tight">
                    Sólo vehículos con fabricante «{String(linkDialogRow.sample_manufacturer).trim()}» (recomendado)
                  </Label>
                </div>
              )}
              {uniqueCatalogMatch(linkDialogRow) && (
                <p className="text-xs text-muted-foreground">
                  Hay un ítem único en el catálogo
                  {linkDialogRow.catalog_manufacturer
                    ? ` (${linkDialogRow.catalog_manufacturer} ${linkDialogRow.catalog_reference || ''})`
                    : ''}
                  ; se han prellenado marca y referencia.
                </p>
              )}
              {linkDialogRow.in_catalog && Number(linkDialogRow.catalog_item_count) > 1 && (
                <p className="text-xs text-muted-foreground">
                  Hay {linkDialogRow.catalog_item_count} ítems de catálogo con esta referencia; elige la marca
                  correcta.
                </p>
              )}
              <div className="space-y-2">
                <p className="text-sm font-medium">Coincidencias</p>
                {linkSuggestionsLoading && (
                  <p className="text-xs text-muted-foreground">Buscando fichas…</p>
                )}
                {linkSuggestionsError && (
                  <p className="text-xs text-destructive">{linkSuggestionsError}</p>
                )}
                {!linkSuggestionsLoading && !linkSuggestionsError && linkSuggestions.length === 0 && !uniqueCatalogMatch(linkDialogRow) && (
                  <p className="text-xs text-muted-foreground">
                    Ninguna ficha tiene esta referencia ni termina en ella. Indica la marca y la referencia
                    exacta del catálogo.
                  </p>
                )}
                {linkSuggestions.length > 0 && (
                  <div className="max-h-48 space-y-2 overflow-y-auto">
                    {linkSuggestions.map((item) => {
                      const selected = linkCatalogItemId === String(item.id);
                      const label = CATALOG_MATCH_LABEL[item.match] || 'Coincidencia';
                      return (
                        <Button
                          key={item.id}
                          type="button"
                          variant="outline"
                          aria-pressed={selected}
                          className={cn(
                            'h-auto w-full justify-start whitespace-normal px-3 py-2 text-left',
                            selected && 'border-primary bg-primary/10',
                          )}
                          onClick={() => applyCatalogSuggestion(item, { userChosen: true })}
                        >
                          <span className="flex w-full flex-col gap-0.5">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-sm">{item.reference}</span>
                              <Badge variant={selected ? 'default' : 'secondary'}>{label}</Badge>
                            </span>
                            <span className="text-xs font-normal text-muted-foreground">
                              {item.manufacturer || '—'}
                              {item.model_name ? ` · ${item.model_name}` : ''}
                            </span>
                          </span>
                        </Button>
                      );
                    })}
                  </div>
                )}
              </div>
              <CatalogBrandSelect
                id="admin-gap-link-catalog-brand"
                label="Marca en el catálogo"
                value={linkCatalogManufacturerId}
                onChange={(id) => {
                  linkSelectionTouchedRef.current = true;
                  setLinkCatalogManufacturerId(id);
                  setLinkCatalogItemId('');
                }}
                required={!linkCatalogItemId}
              />
              <div className="space-y-2">
                <Label htmlFor="admin-gap-link-catalog-ref">Referencia en el catálogo</Label>
                <Input
                  id="admin-gap-link-catalog-ref"
                  value={linkCatalogReference}
                  onChange={(e) => {
                    linkSelectionTouchedRef.current = true;
                    setLinkCatalogReference(e.target.value);
                    setLinkCatalogItemId('');
                  }}
                  placeholder="ej. AV52802"
                  className="font-mono"
                />
              </div>
              {linkFeedback?.variant === 'destructive' && (
                <Alert variant="destructive">
                  <AlertDescription>{linkFeedback.text}</AlertDescription>
                </Alert>
              )}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setLinkDialogRow(null)}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void submitLinkGarageToCatalog()} disabled={linkSaving}>
              {linkSaving ? 'Enlazando…' : 'Confirmar enlace'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vehículos creados por usuario</CardTitle>
          <CardDescription>
            Top 50 usuarios por número de vehículos creados en el intervalo (según fecha de creación del vehículo).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!data?.vehicles_by_user?.length ? (
            <p className="text-sm text-muted-foreground">Sin datos en este periodo.</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-right w-[120px]">Vehículos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.vehicles_by_user.map((row) => (
                    <TableRow key={row.user_id}>
                      <TableCell className="font-mono text-sm">{row.email || '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPlatformDashboard;
