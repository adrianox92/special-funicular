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
import { Input } from './ui/input';
import { buildAppTimingRedirectUrl, DEFAULT_GUIDED_TARGET_MS } from '../utils/appTimingLink';
import { formatCircuitSelectLabel } from '../utils/formatUtils';
import { computeSuggestedTrainingTarget } from '../utils/setupIntelligence';
import { toast } from 'sonner';

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
  const [guidedHistory, setGuidedHistory] = useState([]);
  const [goals, setGoals] = useState([]);
  const [goalSaving, setGoalSaving] = useState(false);
  const [goalTarget, setGoalTarget] = useState('');

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

  const fetchGuidedAndGoals = useCallback(async () => {
    if (!vehicleId) return;
    try {
      const [timingsRes, goalsRes] = await Promise.all([
        api.get(`/vehicles/${vehicleId}/timings`),
        api.get(`/vehicles/${vehicleId}/training-goals`),
      ]);
      const guided = (timingsRes.data || [])
        .filter((t) => t.guided_session && (!circuitId || t.circuit_id === circuitId))
        .slice(0, 5);
      setGuidedHistory(guided);
      setGoals((goalsRes.data?.goals || []).filter((g) => g.active && !g.achieved_at));
    } catch {
      setGuidedHistory([]);
    }
  }, [vehicleId, circuitId]);

  useEffect(() => {
    fetchGuidedAndGoals();
  }, [fetchGuidedAndGoals]);

  const suggestedGoal = useMemo(() => {
    if (!baseline?.best_lap_seconds) return null;
    return computeSuggestedTrainingTarget({
      best_lap_seconds: baseline.best_lap_seconds,
      consistency_score: baseline.consistency_score,
    });
  }, [baseline]);

  useEffect(() => {
    if (suggestedGoal?.targetSeconds != null && !goalTarget) {
      setGoalTarget(suggestedGoal.targetSeconds.toFixed(3));
    }
  }, [suggestedGoal, goalTarget]);

  const handleCreateGoal = async () => {
    if (!vehicleId || !circuitId || !goalTarget) return;
    setGoalSaving(true);
    try {
      await api.post(`/vehicles/${vehicleId}/training-goals`, {
        circuit_id: circuitId,
        lane,
        goal_type: 'lap_time',
        target_value: parseFloat(goalTarget),
      });
      toast.success(t('training.goalCreated'));
      await fetchGuidedAndGoals();
    } catch (e) {
      toast.error(e.response?.data?.error || t('training.goalError'));
    } finally {
      setGoalSaving(false);
    }
  };

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
                    {formatCircuitSelectLabel(c)}
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

        {guidedHistory.length > 0 && (
          <div className="rounded-md border bg-muted/20 p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">{t('training.guidedHistoryTitle')}</p>
            <ul className="text-sm space-y-1">
              {guidedHistory.map((s) => (
                <li key={s.id} className="flex justify-between gap-2 font-mono text-xs">
                  <span>{new Date(s.timing_date).toLocaleDateString()}</span>
                  <span>
                    {t('training.guidedHistoryLine', {
                      on: s.guided_session?.laps_on_target ?? 0,
                      total: s.guided_session?.total_laps ?? s.laps ?? '—',
                      best: s.best_lap_time,
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {baseline?.best_lap_seconds != null && circuitId && (
          <div className="rounded-md border p-3 space-y-3">
            <p className="text-sm font-medium">{t('training.createGoalTitle')}</p>
            {suggestedGoal && (
              <p className="text-xs text-muted-foreground">
                {t('training.suggestedTarget', {
                  time: suggestedGoal.targetSeconds.toFixed(3),
                  delta: suggestedGoal.deltaSeconds.toFixed(3),
                })}
              </p>
            )}
            <div className="flex flex-wrap gap-2 items-end">
              <div className="space-y-1 flex-1 min-w-[120px]">
                <Label className="text-xs">{t('training.goalTargetLap')}</Label>
                <Input
                  value={goalTarget}
                  onChange={(e) => setGoalTarget(e.target.value)}
                  placeholder="12.100"
                  className="font-mono"
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                disabled={goalSaving || !goalTarget}
                onClick={handleCreateGoal}
              >
                {goalSaving ? t('training.goalSaving') : t('training.createGoalBtn')}
              </Button>
            </div>
            {goals.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {t('training.activeGoals', { count: goals.length })}
              </p>
            )}
          </div>
        )}

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
