import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Smartphone } from 'lucide-react';
import api from '../lib/axios';
import { useAuth } from '../context/AuthContext';
import { isLicenseAdminUser } from '../lib/licenseAdmin';
import { useLapTimerPremium } from '../hooks/useLapTimerPremium';
import LapTimerPremiumNotice from './LapTimerPremiumNotice';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Spinner } from './ui/spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { buildAppTimingRedirectUrl, DEFAULT_GUIDED_TARGET_MS } from '../utils/appTimingLink';

/**
 * PB + CTA para abrir Slot Lap Timer con entrenamiento guiado.
 */
export default function LapTimerTrainingCard({
  vehicleId,
  circuits = [],
  initialCircuitId = '',
  initialLane = '',
  compact = false,
}) {
  const { t } = useTranslation('common');
  const { t: tTimings } = useTranslation('timings');
  const { user } = useAuth();
  const isAdmin = isLicenseAdminUser(user);
  const { isPremium, loading: premiumLoading } = useLapTimerPremium();

  const [circuitId, setCircuitId] = useState(initialCircuitId || '');
  const [lane, setLane] = useState(initialLane && initialLane !== tTimings('noLane') ? String(initialLane) : '1');
  const [baseline, setBaseline] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (initialCircuitId) setCircuitId(initialCircuitId);
  }, [initialCircuitId]);

  useEffect(() => {
    if (initialLane && initialLane !== tTimings('noLane')) setLane(String(initialLane));
  }, [initialLane, tTimings]);

  const selectedCircuit = useMemo(
    () => circuits.find((c) => c.id === circuitId),
    [circuits, circuitId],
  );

  const laneOptions = useMemo(() => {
    const n = selectedCircuit?.num_lanes ?? 4;
    return Array.from({ length: Math.max(1, n) }, (_, i) => String(i + 1));
  }, [selectedCircuit]);

  const fetchBaseline = useCallback(async () => {
    if (!vehicleId || !circuitId) {
      setBaseline(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/vehicles/${vehicleId}/training-baseline`, {
        params: { circuit_id: circuitId, lane },
      });
      setBaseline(data);
    } catch (e) {
      setBaseline(null);
      setError(e.response?.data?.error || t('training.loadError'));
    } finally {
      setLoading(false);
    }
  }, [vehicleId, circuitId, lane, t]);

  useEffect(() => {
    fetchBaseline();
  }, [fetchBaseline]);

  const targetSeconds = useMemo(() => {
    if (baseline?.best_lap_seconds == null) return null;
    const pbGap = DEFAULT_GUIDED_TARGET_MS / 1000;
    const consistency = baseline.consistency_score != null ? Number(baseline.consistency_score) : null;
    let gap = pbGap;
    if (consistency != null && !Number.isNaN(consistency)) {
      if (consistency >= 92) gap = pbGap * 0.4;
      else if (consistency >= 85) gap = pbGap * 0.65;
    }
    return Math.max(0, baseline.best_lap_seconds - gap);
  }, [baseline]);

  const redirectUrl = buildAppTimingRedirectUrl({
    vehicleId,
    circuitId: circuitId || undefined,
    lane,
    guided: true,
  });

  if (!isAdmin) return null;

  if (compact) {
    return (
      <Button
        variant="outline"
        size="sm"
        asChild
        disabled={!vehicleId || !circuitId}
        title={
          !premiumLoading && !isPremium
            ? t('training.compactTitlePremium')
            : t('training.compactTitle')
        }
      >
        <Link to={redirectUrl}>
          <Smartphone className="size-3.5 mr-1" />
          {t('training.lapTimerBtn')}
        </Link>
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Smartphone className="size-4" />
          {t('training.cardTitle')}
        </CardTitle>
        <p className="text-sm text-muted-foreground font-normal pt-1">
          {t('training.cardHint')}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t('training.circuit')}</Label>
            <Select value={circuitId || undefined} onValueChange={setCircuitId}>
              <SelectTrigger>
                <SelectValue placeholder={t('training.circuitPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {circuits.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('training.lane')}</Label>
            <Select value={lane} onValueChange={setLane}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {laneOptions.map((l) => (
                  <SelectItem key={l} value={l}>
                    {tTimings('lane', { lane: l })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner className="size-4" />
            {t('training.loadingBaseline')}
          </div>
        )}

        {!loading && error && (
          <p className="text-sm text-muted-foreground">{error}</p>
        )}

        {!loading && baseline?.best_lap_time && (
          <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
            <p>
              <span className="text-muted-foreground">{t('training.bestLapPb')} </span>
              <span className="font-mono font-semibold">{baseline.best_lap_time}</span>
              {baseline.lane_fallback && (
                <span className="text-muted-foreground text-xs ml-2">{t('training.noExactLane')}</span>
              )}
            </p>
            {targetSeconds != null && (
              <p className="text-muted-foreground">
                {t('training.targetDelta', { delta: (baseline.best_lap_seconds - targetSeconds).toFixed(3) })}
                {baseline.consistency_score != null && (
                  <span className="text-xs ml-1">
                    {t('training.consistencyParen', { score: Number(baseline.consistency_score).toFixed(1) })}
                  </span>
                )}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {t('training.referenceSessions', { count: baseline.timings_count })}
            </p>
          </div>
        )}

        {!loading && !baseline?.best_lap_time && circuitId && !error && (
          <p className="text-sm text-muted-foreground">
            {t('training.noBaseline')}
          </p>
        )}

        {!premiumLoading && !isPremium && <LapTimerPremiumNotice />}

        <Button asChild disabled={!vehicleId || !circuitId} className="w-full sm:w-auto">
          <Link to={redirectUrl}>
            <Smartphone className="size-4 mr-2" />
            {t('training.startTiming')}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
