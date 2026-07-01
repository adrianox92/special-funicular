import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Trophy, Users, Flag, Car, Zap, GitCompare } from 'lucide-react';
import api from '../lib/axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Spinner } from '../components/ui/spinner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { formatDate } from '../utils/formatUtils';

const PublicPilotProfile = () => {
  const { slug } = useParams();
  const { t } = useTranslation('public');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [compareSlug, setCompareSlug] = useState('');
  const [compareData, setCompareData] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState(null);

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
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <Alert variant="destructive">
          <AlertDescription>{error || t('pilot.notFound')}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const title = data.display_name?.trim() || t('pilot.title');

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground mt-1">
          {t('pilot.title')} · {data.slug}
        </p>
      </div>

      {data.palmares?.length > 0 && (
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
                    <TableHead>Competición</TableHead>
                    <TableHead>{t('pilot.circuit')}</TableHead>
                    <TableHead>{t('pilot.points')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.palmares.map((row) => (
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
      )}

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
              placeholder={`${t('pilot.compareWith')} (slug)`}
              value={compareSlug}
              onChange={(e) => setCompareSlug(e.target.value)}
              className="max-w-xs"
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

      {data.vehicles?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Car className="size-5" />
              {t('pilot.vehicles')}
            </CardTitle>
            <CardDescription>{t('pilot.vehiclesHint')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-1 sm:grid-cols-2">
              {data.vehicles.map((v) => (
                <li key={v.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="text-foreground font-medium">
                    {v.manufacturer} {v.model}
                  </span>
                  {v.type ? <Badge variant="secondary">{v.type}</Badge> : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Flag className="size-5" />
            {t('pilot.bestTimes')}
          </CardTitle>
          <CardDescription>{t('pilot.bestTimesHint')}</CardDescription>
        </CardHeader>
        <CardContent>
          {data.best_times_by_circuit?.length ? (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('pilot.circuit')}</TableHead>
                    <TableHead>{t('pilot.bestLap')}</TableHead>
                    <TableHead>{t('pilot.vehicle')}</TableHead>
                    <TableHead>{t('pilot.date')}</TableHead>
                    <TableHead>{t('pilot.mode')}</TableHead>
                    <TableHead>V (V)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.best_times_by_circuit.map((row, i) => (
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

      {data.competitions_organized?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Trophy className="size-5" />
              {t('pilot.organized')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.competitions_organized.map((c) => (
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
      )}

      {data.competitions_participated?.length > 0 && (
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
              {data.competitions_participated.map((p) => (
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
      )}
    </div>
  );
};

export default PublicPilotProfile;
