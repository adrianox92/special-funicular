import React, { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { LineChart, RefreshCw } from 'lucide-react';
import api from '../lib/axios';
import { useAuth } from '../context/AuthContext';
import { isLicenseAdminUser } from '../lib/licenseAdmin';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Spinner } from '../components/ui/spinner';
import { Badge } from '../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';

const PAGE_SIZE = 50;

const RARITY_LABELS = {
  '0': 'Sin dueños',
  '1': '1 dueño',
  '2_4': '2–4 dueños',
  '5_14': '5–14 dueños',
  '15_plus': '15 o más',
};

function formatEsPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${n.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}

function formatEur(value) {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function formatRange(low, high) {
  if (low == null && high == null) return '—';
  return `${formatEur(low)} – ${formatEur(high)}`;
}

function errorMessage(err, fallback) {
  return err?.response?.data?.error || err?.message || fallback;
}

const AdminSlotIntelligence = () => {
  const { user } = useAuth();
  const isAdmin = isLicenseAdminUser(user);

  const [sort, setSort] = useState('owners');
  const [manufacturerId, setManufacturerId] = useState('');
  const [publishableOnly, setPublishableOnly] = useState(false);
  const [page, setPage] = useState(0);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        sort,
      };
      if (manufacturerId) params.manufacturer_id = manufacturerId;
      if (publishableOnly) params.publishable = 'true';
      const { data: res } = await api.get('/admin/slot-intelligence', { params });
      setData(res);
    } catch (err) {
      setError(errorMessage(err, 'No se ha podido cargar la inteligencia.'));
    } finally {
      setLoading(false);
    }
  }, [manufacturerId, page, publishableOnly, sort]);

  useEffect(() => {
    if (!isAdmin) return;
    void load();
  }, [isAdmin, load]);

  const refresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      await api.post('/admin/slot-intelligence/refresh');
      await load();
    } catch (err) {
      setError(errorMessage(err, 'No se ha podido recalcular la inteligencia.'));
    } finally {
      setRefreshing(false);
    }
  };

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const summary = data?.summary;
  const brands = Array.isArray(data?.brands) ? data.brands : [];
  const items = data?.items;
  const rows = Array.isArray(items?.rows) ? items.rows : [];
  const total = items?.total ?? 0;
  const histogram = Array.isArray(summary?.rarity_histogram) ? summary.rarity_histogram : [];
  const histogramMax = histogram.reduce((max, entry) => Math.max(max, Number(entry.item_count) || 0), 0);
  const globalPlaces = Array.isArray(data?.places?.global) ? data.places.global : [];
  const brandPlaces = Array.isArray(data?.places?.brand) ? data.places.brand : [];
  const selectedBrand = brands.find((brand) => brand.manufacturer_id === manufacturerId);
  const offset = page * PAGE_SIZE;
  const busy = loading || refreshing;

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <LineChart className="size-7" />
            Slot Database Intelligence
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Popularidad de las fichas enlazadas y precios declarados. El precio de garaje es el
            importe guardado en el coche, sin divisa, y solo entra si es mayor que 0 y el coche no
            está modificado. La mediana global sale de esos coches.
          </p>
          <p className="text-sm mt-2">
            <Link to="/admin/dashboard" className="underline underline-offset-4">
              Volver a métricas
            </Link>
            {summary?.computed_at ? (
              <span className="text-muted-foreground">
                {' '}
                · Calculado{' '}
                {new Date(summary.computed_at).toLocaleString('es-ES', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </span>
            ) : null}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => refresh()} disabled={busy}>
          <RefreshCw className={refreshing ? 'size-4 animate-spin' : 'size-4'} />
          Recalcular
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && !data && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Spinner className="size-5" />
          Cargando…
        </div>
      )}

      {summary && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Cobertura del catálogo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tabular-nums">{formatEsPercent(summary.coverage_pct)}</div>
                <p className="text-xs text-muted-foreground mt-2">
                  {summary.catalog_items_with_owners.toLocaleString('es-ES')} de{' '}
                  {summary.catalog_items_total.toLocaleString('es-ES')} fichas con al menos un dueño.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Coches con precio</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tabular-nums">
                  {summary.vehicles_with_price.toLocaleString('es-ES')}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {formatEsPercent(summary.price_coverage_pct)} de los{' '}
                  {summary.linked_vehicle_count.toLocaleString('es-ES')} coches enlazados. Precio
                  declarado, tratado como EUR.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Mediana global</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tabular-nums">{formatEur(summary.global_price_median)}</div>
                <p className="text-xs text-muted-foreground mt-2">
                  p25–p75 {formatRange(summary.global_price_p25, summary.global_price_p75)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Fichas publicables</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tabular-nums">
                  {summary.publishable_item_count.toLocaleString('es-ES')}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Al menos 5 usuarios distintos. Los precios solo se publicarían con 5 observaciones o más.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="space-y-1">
                <CardTitle className="text-base">Rareza</CardTitle>
                <CardDescription>
                  Fichas del catálogo según cuántos usuarios distintos tienen un coche enlazado. Las 10
                  referencias con más coches concentran {formatEsPercent(summary.top10_refs_vehicle_share_pct)}{' '}
                  de los enlazados. Las 5 marcas con más coches,{' '}
                  {formatEsPercent(summary.top5_brands_vehicle_share_pct)}.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {histogram.map((entry) => {
                  const count = Number(entry.item_count) || 0;
                  const width = histogramMax > 0 ? Math.max(2, Math.round((count / histogramMax) * 100)) : 0;
                  return (
                    <div key={entry.bucket} className="grid grid-cols-[7.5rem_1fr_4rem] items-center gap-3">
                      <span className="text-sm">{RARITY_LABELS[entry.bucket] || entry.bucket}</span>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
                      </div>
                      <span className="text-sm text-right tabular-nums">{count.toLocaleString('es-ES')}</span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="space-y-1">
                <CardTitle className="text-base">Lugares de compra</CardTitle>
                <CardDescription>
                  El mismo comercio cuenta una sola vez aunque el texto cambie: espacios, guiones, mayúsculas,
                  «shop», «online» o el dominio. Solo visible aquí.
                  {selectedBrand ? ` Marca filtrada: ${selectedBrand.brand_name}.` : ' Top global.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {(selectedBrand ? brandPlaces : globalPlaces).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin lugares de compra declarados.</p>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Lugar</TableHead>
                          <TableHead className="text-right">Coches</TableHead>
                          <TableHead className="text-right">Usuarios</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(selectedBrand ? brandPlaces : globalPlaces).map((place) => (
                          <TableRow key={`${place.scope}:${place.manufacturer_id || 'all'}:${place.place_label}`}>
                            <TableCell>{place.place_label}</TableCell>
                            <TableCell className="text-right tabular-nums">{place.vehicle_count}</TableCell>
                            <TableCell className="text-right tabular-nums">{place.user_count}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-base">Marcas</CardTitle>
              <CardDescription>
                Cobertura sobre las fichas de esa marca. La mediana de garaje sale de los precios declarados
                en los coches de esa marca.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {brands.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin marcas en el catálogo.</p>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Marca</TableHead>
                        <TableHead className="text-right">Cobertura</TableHead>
                        <TableHead className="text-right">Con dueño</TableHead>
                        <TableHead className="text-right">Coches</TableHead>
                        <TableHead className="text-right">Usuarios</TableHead>
                        <TableHead className="text-right">Mediana garaje</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {brands.map((brand) => (
                        <TableRow key={brand.manufacturer_id}>
                          <TableCell>
                            <button
                              type="button"
                              className="underline underline-offset-4 text-left"
                              onClick={() => {
                                setPage(0);
                                setManufacturerId(brand.manufacturer_id);
                              }}
                            >
                              {brand.brand_name}
                            </button>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatEsPercent(brand.coverage_pct)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {brand.items_with_owners}/{brand.catalog_item_count}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{brand.vehicle_count}</TableCell>
                          <TableCell className="text-right tabular-nums">{brand.user_count}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatEur(brand.garage_price_median)}
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
            <CardHeader className="space-y-1">
              <CardTitle className="text-base">Referencias</CardTitle>
              <CardDescription>
                Una ficha es publicable con al menos 5 usuarios distintos. Si no llega, se marca como no
                publicable. La penetración es el porcentaje de usuarios con algún coche enlazado que tienen
                esa referencia.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                <div className="space-y-2 min-w-[12rem]">
                  <Label htmlFor="intelligence-brand">Marca</Label>
                  <select
                    id="intelligence-brand"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={manufacturerId}
                    onChange={(event) => {
                      setPage(0);
                      setManufacturerId(event.target.value);
                    }}
                  >
                    <option value="">Todas las marcas</option>
                    {brands.map((brand) => (
                      <option key={brand.manufacturer_id} value={brand.manufacturer_id}>
                        {brand.brand_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2 min-w-[12rem]">
                  <Label htmlFor="intelligence-sort">Orden</Label>
                  <select
                    id="intelligence-sort"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={sort}
                    onChange={(event) => {
                      setPage(0);
                      setSort(event.target.value);
                    }}
                  >
                    <option value="owners">Dueños</option>
                    <option value="garage_price">Mediana de garaje</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 pb-2">
                  <input
                    id="intelligence-publishable-only"
                    type="checkbox"
                    className="size-4"
                    checked={publishableOnly}
                    onChange={(event) => {
                      setPage(0);
                      setPublishableOnly(event.target.checked);
                    }}
                  />
                  <Label htmlFor="intelligence-publishable-only" className="font-normal">
                    Solo publicables
                  </Label>
                </div>
              </div>

              {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin fichas para este filtro.</p>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Referencia</TableHead>
                        <TableHead className="text-right">Dueños</TableHead>
                        <TableHead className="text-right">Coches</TableHead>
                        <TableHead className="text-right">Mediana garaje</TableHead>
                        <TableHead className="text-right">p25–p75</TableHead>
                        <TableHead className="text-right">n</TableHead>
                        <TableHead>Publicación</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => (
                        <TableRow key={row.catalog_item_id}>
                          <TableCell>
                            <span className="font-mono">{row.reference}</span>
                            <span className="block text-xs text-muted-foreground truncate max-w-[16rem]">
                              {[row.model_name, row.brand_name].filter(Boolean).join(' · ')}
                            </span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.owner_count}
                            <span className="block text-xs text-muted-foreground">
                              {formatEsPercent(row.penetration_pct)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{row.vehicle_count}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatEur(row.garage_price_median)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums whitespace-nowrap">
                            {formatRange(row.garage_price_p25, row.garage_price_p75)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{row.garage_price_n}</TableCell>
                          <TableCell>
                            {row.publishable ? (
                              <span className="text-sm text-muted-foreground">Publicable</span>
                            ) : (
                              <Badge variant="secondary">No publicable</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  {total === 0
                    ? '0 fichas'
                    : `${(offset + 1).toLocaleString('es-ES')}–${Math.min(offset + rows.length, total).toLocaleString('es-ES')} de ${total.toLocaleString('es-ES')}`}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy || page === 0}
                    onClick={() => setPage((current) => Math.max(0, current - 1))}
                  >
                    Anterior
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy || offset + rows.length >= total}
                    onClick={() => setPage((current) => current + 1)}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default AdminSlotIntelligence;
