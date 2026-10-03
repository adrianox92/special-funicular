import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Trophy, Users, Flag, Car, Zap, GitCompare, Search } from 'lucide-react';
import api from '../lib/axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Spinner } from '../components/ui/spinner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
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
import Footer from '../components/Footer';
import { formatDate } from '../utils/formatUtils';
import { publicVehicleImageSrc } from '../utils/publicVehicleImageSrc';
import { BRAND } from '../utils/documentTitle';
import { useLocale } from '../hooks/useLocale';
import { localizePath } from '../i18n/localeUtils';

const ALL_TYPES = '__all__';
const BRANDS_PREVIEW = 6;

export function filterPublicVehicles(vehicles, query, typeFilter) {
  const q = String(query || '').trim().toLowerCase();
  const type = typeFilter && typeFilter !== ALL_TYPES ? typeFilter : '';
  return (vehicles || []).filter((v) => {
    if (type && String(v.type || '') !== type) return false;
    if (!q) return true;
    const hay = `${v.manufacturer || ''} ${v.model || ''} ${v.type || ''}`.toLowerCase();
    return hay.includes(q);
  });
}

export function brandCountsFromVehicles(vehicles) {
  const counts = new Map();
  for (const v of vehicles || []) {
    const name = String(v.manufacturer || '').trim();
    if (!name) continue;
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function circuitBestByVehicle(bestTimes) {
  const map = new Map();
  for (const row of bestTimes || []) {
    if (!row?.vehicle_id) continue;
    const prev = map.get(row.vehicle_id);
    if (!prev || Number(row.best_lap_seconds) < Number(prev.best_lap_seconds)) {
      map.set(row.vehicle_id, row);
    }
  }
  return map;
}

function initialsFromName(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function StatRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

function PublicVehicleCard({ vehicle, highlight, t }) {
  const title = [vehicle.manufacturer, vehicle.model].filter(Boolean).join(' ');
  const src = publicVehicleImageSrc(vehicle.image);

  return (
    <article className="group h-full overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm transition-shadow hover:shadow-md">
      <div className="relative aspect-[4/3] bg-muted overflow-hidden">
        {src ? (
          <img
            src={src}
            alt={title}
            className="absolute inset-0 size-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Car className="size-8 opacity-50" aria-hidden />
            <span className="text-xs">{t('pilot.noImage')}</span>
          </div>
        )}
      </div>
      <div className="space-y-1.5 p-3">
        {vehicle.manufacturer ? (
          <p className="text-xs text-muted-foreground truncate">{vehicle.manufacturer}</p>
        ) : null}
        <h3 className="font-semibold leading-snug line-clamp-2">{vehicle.model}</h3>
        {vehicle.type ? (
          <Badge variant="secondary" className="font-normal">
            {vehicle.type}
          </Badge>
        ) : null}
        {highlight ? (
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground pt-0.5">
            <Flag className="size-3.5 mt-0.5 shrink-0" aria-hidden />
            <span>
              {t('pilot.circuitBest', { circuit: highlight.circuit_name })}
              {highlight.best_lap_time ? (
                <span className="ml-1 font-mono text-foreground">{highlight.best_lap_time}</span>
              ) : null}
            </span>
          </p>
        ) : null}
      </div>
    </article>
  );
}

const PublicPilotProfile = () => {
  const { slug } = useParams();
  const { t } = useTranslation('public');
  const { locale } = useLocale();
  const homeHref = localizePath(locale, '/');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [compareSlug, setCompareSlug] = useState('');
  const [compareData, setCompareData] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState(null);
  const [collectionQuery, setCollectionQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState(ALL_TYPES);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: res } = await api.get(`/public/pilot/${encodeURIComponent(slug)}`);
        if (!cancelled) setData(res);
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.error || err.message || t('pilot.loadError'));
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (slug) load();
    return () => {
      cancelled = true;
    };
  }, [slug, t]);

  const vehicles = data?.vehicles || [];
  const types = useMemo(() => {
    const set = new Set();
    for (const v of vehicles) {
      if (v.type) set.add(v.type);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [vehicles]);

  const visibleVehicles = useMemo(
    () => filterPublicVehicles(vehicles, collectionQuery, typeFilter),
    [vehicles, collectionQuery, typeFilter],
  );

  const brands = useMemo(() => brandCountsFromVehicles(vehicles), [vehicles]);
  const highlights = useMemo(
    () => circuitBestByVehicle(data?.best_times_by_circuit),
    [data?.best_times_by_circuit],
  );

  const runCompare = async () => {
    const other = compareSlug.trim();
    if (!other || !slug) return;
    setCompareLoading(true);
    setCompareError(null);
    try {
      const { data: res } = await api.get(
        `/public/pilot/${encodeURIComponent(slug)}/compare/${encodeURIComponent(other)}`,
      );
      setCompareData(res);
    } catch (err) {
      setCompareData(null);
      setCompareError(err.response?.data?.error || t('pilot.loadError'));
    } finally {
      setCompareLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <div className="flex flex-1 items-center justify-center">
          <Spinner className="size-8" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col">
        <div className="max-w-2xl mx-auto px-4 py-16 flex-1">
          <Alert variant="destructive">
            <AlertDescription>{error || t('pilot.notFound')}</AlertDescription>
          </Alert>
        </div>
        <Footer />
      </div>
    );
  }

  const title = data.display_name?.trim() || t('pilot.title');
  const palmares = data.palmares || [];
  const organized = data.competitions_organized || [];
  const participated = data.competitions_participated || [];
  const bestTimes = data.best_times_by_circuit || [];
  const wins = palmares.filter((row) => row.position === 1).length;
  const podiums = palmares.filter((row) => row.position >= 1 && row.position <= 3).length;
  const extraBrands = Math.max(0, brands.length - BRANDS_PREVIEW);

  const jumpLinks = [
    { href: '#collection', label: t('pilot.collection'), show: true },
    { href: '#palmares', label: t('pilot.palmares'), show: palmares.length > 0 },
    { href: '#best-times', label: t('pilot.bestTimes'), show: true },
    { href: '#organized', label: t('pilot.organized'), show: organized.length > 0 },
    { href: '#participated', label: t('pilot.participated'), show: participated.length > 0 },
    { href: '#compare', label: t('pilot.compareTitle'), show: true },
  ].filter((item) => item.show);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b bg-card/60">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center">
          <Link to={homeHref} className="font-semibold text-foreground hover:opacity-90">
            {BRAND}
          </Link>
        </div>
      </header>

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1">
        <div className="grid gap-8 lg:grid-cols-[17.5rem_minmax(0,1fr)] lg:items-start">
          <aside className="space-y-4 lg:sticky lg:top-4">
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex flex-col items-center text-center gap-3">
                  <div
                    className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary text-xl font-semibold"
                    aria-hidden
                  >
                    {initialsFromName(title)}
                  </div>
                  <div className="space-y-1">
                    <h1 className="text-2xl font-bold tracking-tight leading-tight">{title}</h1>
                    <p className="text-sm text-muted-foreground">
                      {t('pilot.title')} · {data.slug}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t('pilot.stats')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <StatRow label={t('pilot.statVehicles')} value={vehicles.length} />
                <StatRow label={t('pilot.statCircuits')} value={bestTimes.length} />
                <StatRow label={t('pilot.statPalmares')} value={palmares.length} />
                {wins > 0 ? <StatRow label={t('pilot.statWins')} value={wins} /> : null}
                {podiums > 0 ? <StatRow label={t('pilot.statPodiums')} value={podiums} /> : null}
                {organized.length > 0 ? (
                  <StatRow label={t('pilot.statOrganized')} value={organized.length} />
                ) : null}
                {participated.length > 0 ? (
                  <StatRow label={t('pilot.statParticipated')} value={participated.length} />
                ) : null}
              </CardContent>
            </Card>

            {brands.length > 0 ? (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{t('pilot.brands')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {brands.slice(0, BRANDS_PREVIEW).map((brand) => (
                    <StatRow key={brand.name} label={brand.name} value={brand.count} />
                  ))}
                  {extraBrands > 0 ? (
                    <p className="text-xs text-muted-foreground pt-1">
                      {t('pilot.moreBrands', { count: extraBrands })}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}

            <nav aria-label={t('pilot.onThisPage')} className="hidden lg:block">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                {t('pilot.onThisPage')}
              </p>
              <ul className="space-y-1.5 text-sm">
                {jumpLinks.map((item) => (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>

          <div className="space-y-10 min-w-0">
            <section id="collection" className="scroll-mt-4 space-y-4" aria-labelledby="collection-heading">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 id="collection-heading" className="text-2xl font-bold tracking-tight">
                    {t('pilot.collection')}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t('pilot.collectionCount', { count: vehicles.length })}
                    {vehicles.length > 0 ? ` · ${t('pilot.vehiclesHint')}` : null}
                  </p>
                </div>
                {vehicles.length > 0 ? (
                  <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                    <div className="relative sm:w-64">
                      <Search
                        className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                        aria-hidden
                      />
                      <Input
                        value={collectionQuery}
                        onChange={(e) => setCollectionQuery(e.target.value)}
                        placeholder={t('pilot.collectionSearch')}
                        aria-label={t('pilot.collectionSearch')}
                        className="pl-8"
                      />
                    </div>
                    {types.length > 1 ? (
                      <Select value={typeFilter} onValueChange={setTypeFilter}>
                        <SelectTrigger className="sm:w-44" aria-label={t('pilot.allTypes')}>
                          <SelectValue placeholder={t('pilot.allTypes')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ALL_TYPES}>{t('pilot.allTypes')}</SelectItem>
                          {types.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {vehicles.length === 0 ? (
                <p className="text-sm text-muted-foreground rounded-xl border bg-card px-4 py-8 text-center">
                  {t('pilot.collectionEmpty')}
                </p>
              ) : visibleVehicles.length === 0 ? (
                <p className="text-sm text-muted-foreground rounded-xl border bg-card px-4 py-8 text-center">
                  {t('pilot.collectionNoMatch')}
                </p>
              ) : (
                <ul className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                  {visibleVehicles.map((v) => (
                    <li key={v.id}>
                      <PublicVehicleCard vehicle={v} highlight={highlights.get(v.id)} t={t} />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {palmares.length > 0 && (
              <section id="palmares" className="scroll-mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Trophy className="size-5 text-amber-500" />
                      {t('pilot.palmares')}
                    </CardTitle>
                    <CardDescription>{t('pilot.palmaresHint')}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t('pilot.position')}</TableHead>
                            <TableHead>{t('pilot.competition')}</TableHead>
                            <TableHead>{t('pilot.circuit')}</TableHead>
                            <TableHead>{t('pilot.points')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {palmares.map((row) => (
                            <TableRow key={row.competition_id}>
                              <TableCell>
                                <Badge variant={row.position === 1 ? 'default' : 'secondary'}>
                                  {row.position}/{row.total_participants}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-medium">
                                {row.public_slug ? (
                                  <Link
                                    to={`/competitions/status/${row.public_slug}`}
                                    className="text-primary underline-offset-4 hover:underline"
                                  >
                                    {row.competition_name}
                                  </Link>
                                ) : (
                                  row.competition_name
                                )}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">{row.circuit_name || '—'}</TableCell>
                              <TableCell>{row.points != null ? row.points : '—'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </section>
            )}

            <section id="best-times" className="scroll-mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Flag className="size-5" />
                    {t('pilot.bestTimes')}
                  </CardTitle>
                  <CardDescription>{t('pilot.bestTimesHint')}</CardDescription>
                </CardHeader>
                <CardContent>
                  {bestTimes.length ? (
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t('pilot.circuit')}</TableHead>
                            <TableHead>{t('pilot.bestLap')}</TableHead>
                            <TableHead>{t('pilot.vehicle')}</TableHead>
                            <TableHead>{t('pilot.date')}</TableHead>
                            <TableHead>{t('pilot.mode')}</TableHead>
                            <TableHead>{t('pilot.voltage')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {bestTimes.map((row, i) => (
                            <TableRow key={`${row.circuit_id || row.circuit_name}-${i}`}>
                              <TableCell className="font-medium">{row.circuit_name}</TableCell>
                              <TableCell className="font-mono">{row.best_lap_time}</TableCell>
                              <TableCell className="text-sm">
                                {row.vehicle_manufacturer} {row.vehicle_model}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {row.timing_date ? formatDate(row.timing_date) : '—'}
                              </TableCell>
                              <TableCell>
                                {row.session_type ? (
                                  <Badge variant="outline">
                                    {row.session_type === 'HEAT' ? t('pilot.heat') : t('pilot.practice')}
                                  </Badge>
                                ) : (
                                  '—'
                                )}
                              </TableCell>
                              <TableCell>
                                {row.supply_voltage_volts != null ? (
                                  <span className="inline-flex items-center gap-1">
                                    <Zap className="size-3.5 text-muted-foreground" aria-hidden />
                                    {Number(row.supply_voltage_volts).toFixed(2)}
                                  </span>
                                ) : (
                                  '—'
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t('pilot.noTimings')}</p>
                  )}
                </CardContent>
              </Card>
            </section>

            {organized.length > 0 && (
              <section id="organized" className="scroll-mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Trophy className="size-5" />
                      {t('pilot.organized')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {organized.map((c) => (
                        <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2 last:border-0">
                          <span className="font-medium">{c.name}</span>
                          {c.public_slug ? (
                            <Link
                              to={`/competitions/status/${c.public_slug}`}
                              className="text-sm text-primary underline-offset-4 hover:underline"
                            >
                              {t('pilot.viewStatus')}
                            </Link>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </section>
            )}

            {participated.length > 0 && (
              <section id="participated" className="scroll-mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Users className="size-5" />
                      {t('pilot.participated')}
                    </CardTitle>
                    <CardDescription>{t('pilot.participatedHint')}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {participated.map((p) => (
                        <li key={p.competition_id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2 last:border-0">
                          <div>
                            <span className="font-medium">{p.competition_name}</span>
                            {p.driver_name ? (
                              <span className="text-muted-foreground text-sm ml-2">({p.driver_name})</span>
                            ) : null}
                          </div>
                          {p.public_slug ? (
                            <Link
                              to={`/competitions/status/${p.public_slug}`}
                              className="text-sm text-primary underline-offset-4 hover:underline"
                            >
                              {t('pilot.viewStatus')}
                            </Link>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </section>
            )}

            <section id="compare" className="scroll-mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <GitCompare className="size-5" />
                    {t('pilot.compareTitle')}
                  </CardTitle>
                  <CardDescription>{t('pilot.compareHint')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Input
                      placeholder={t('pilot.compareSlugPlaceholder')}
                      value={compareSlug}
                      onChange={(e) => setCompareSlug(e.target.value)}
                      className="max-w-xs"
                      aria-label={t('pilot.compareWith')}
                    />
                    <Button type="button" onClick={runCompare} disabled={compareLoading || !compareSlug.trim()}>
                      {compareLoading ? t('common:loading') : t('pilot.compareButton')}
                    </Button>
                  </div>
                  {compareError && (
                    <Alert variant="destructive">
                      <AlertDescription>{compareError}</AlertDescription>
                    </Alert>
                  )}
                  {compareData?.circuits?.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        {t('pilot.compareWins', {
                          name: compareData.pilot_a?.display_name || slug,
                          count: compareData.wins_a,
                          total: compareData.circuits_compared,
                        })}
                      </p>
                      <div className="rounded-md border overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{t('pilot.compareCircuit')}</TableHead>
                              <TableHead>{compareData.pilot_a?.display_name || t('pilot.compareYou')}</TableHead>
                              <TableHead>{compareData.pilot_b?.display_name || t('pilot.compareThem')}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {compareData.circuits.map((row) => (
                              <TableRow key={row.circuit_key}>
                                <TableCell className="font-medium">{row.circuit_name}</TableCell>
                                <TableCell className={`font-mono ${row.leader === 'a' ? 'text-green-600 dark:text-green-400 font-semibold' : ''}`}>
                                  {row.pilot_a?.best_lap_time}
                                </TableCell>
                                <TableCell className={`font-mono ${row.leader === 'b' ? 'text-green-600 dark:text-green-400 font-semibold' : ''}`}>
                                  {row.pilot_b?.best_lap_time}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                  {compareData && !compareData.circuits?.length && !compareError && (
                    <p className="text-sm text-muted-foreground">{t('pilot.compareNoData')}</p>
                  )}
                </CardContent>
              </Card>
            </section>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default PublicPilotProfile;
