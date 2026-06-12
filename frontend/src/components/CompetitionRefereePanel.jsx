import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Flag,
  Smartphone,
  Ban,
  Clock,
} from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { TimeInput, TimeInputHint } from './ui/TimeInput';
import { Label } from './ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { toast } from 'sonner';

function averageTimeFromTotalAndLaps(totalTimeStr, lapsStr) {
  if (!totalTimeStr || lapsStr === '' || lapsStr === undefined || lapsStr === null) {
    return '';
  }
  const match = totalTimeStr.match(/^(\d{2}):(\d{2})\.(\d{3})$/);
  if (!match) return '';
  const [, min, sec, ms] = match.map(Number);
  const totalSeconds = min * 60 + sec + ms / 1000;
  if (totalSeconds <= 0) return '';
  const laps = parseInt(lapsStr, 10);
  if (!Number.isFinite(laps) || laps <= 0) return '';
  const averageSeconds = totalSeconds / laps;
  const avgMinutes = Math.floor(averageSeconds / 60);
  const avgSeconds = Math.floor(averageSeconds % 60);
  const avgMilliseconds = Math.floor((averageSeconds % 1) * 1000);
  return `${String(avgMinutes).padStart(2, '0')}:${String(avgSeconds).padStart(2, '0')}.${String(avgMilliseconds).padStart(3, '0')}`;
}

/**
 * @param {object} props
 * @param {object|null} props.competition
 * @param {Array} props.participants
 * @param {Array} props.timings
 * @param {number} props.round
 * @param {(n: number) => void} props.setRound
 * @param {() => Promise<void>} props.onReload
 * @param {(method: string, path: string, body?: object) => Promise<import('axios').AxiosResponse>} props.apiRequest
 * @param {() => void} [props.onBack]
 * @param {boolean} [props.showBackButton]
 */
export default function CompetitionRefereePanel({
  competition,
  participants,
  timings,
  round,
  setRound,
  onReload,
  apiRequest,
  onBack,
  showBackButton = true,
}) {
  const [timingModal, setTimingModal] = useState({ open: false, timing: null, participant: null });
  const [form, setForm] = useState({
    best_lap_time: '',
    total_time: '',
    laps: '',
    lane: '',
  });
  const [penaltyModal, setPenaltyModal] = useState({ open: false, timing: null });
  const [penaltyValue, setPenaltyValue] = useState('0');
  const [penaltyLoading, setPenaltyLoading] = useState(false);
  const [savingTiming, setSavingTiming] = useState(false);

  const timingsByRound = React.useMemo(() => {
    const map = {};
    (timings || []).forEach((t) => {
      if (!map[t.round_number]) map[t.round_number] = [];
      map[t.round_number].push(t);
    });
    return map;
  }, [timings]);

  const openTimingModal = (participant, existingTiming) => {
    if (existingTiming && !existingTiming.did_not_participate) {
      setForm({
        best_lap_time: existingTiming.best_lap_time || '',
        total_time: existingTiming.total_time || '',
        laps: existingTiming.laps != null ? String(existingTiming.laps) : '',
        lane: existingTiming.lane || '',
      });
    } else {
      setForm({
        best_lap_time: '',
        total_time: '',
        laps: '',
        lane: '',
      });
    }
    setTimingModal({ open: true, timing: existingTiming || null, participant });
  };

  const closeTimingModal = () => {
    setTimingModal({ open: false, timing: null, participant: null });
    setForm({
      best_lap_time: '',
      total_time: '',
      laps: '',
      lane: '',
    });
  };

  const submitTiming = async (e) => {
    e.preventDefault();
    const { participant, timing } = timingModal;
    if (!participant) return;

    const average_time = averageTimeFromTotalAndLaps(form.total_time, form.laps);
    if (!average_time) {
      toast.error('Tiempo total (00:00.000) y vueltas obligatorios.');
      return;
    }

    const payload = {
      participant_id: participant.id,
      round_number: round,
      best_lap_time: form.best_lap_time,
      total_time: form.total_time,
      laps: form.laps,
      average_time,
      lane: form.lane || '',
      did_not_participate: false,
    };
    if (competition?.circuit_id) {
      payload.circuit_id = String(competition.circuit_id);
    }

    setSavingTiming(true);
    try {
      if (timing?.id) {
        await apiRequest('put', `/timings/${timing.id}`, payload);
        toast.success('Tiempo actualizado');
      } else {
        await apiRequest('post', '/timings', payload);
        toast.success('Tiempo registrado');
      }
      closeTimingModal();
      await onReload();
    } catch (err) {
      toast.error(err.response?.data?.error || 'No se pudo guardar');
    } finally {
      setSavingTiming(false);
    }
  };

  const handleMarkNP = async (participantId) => {
    try {
      await apiRequest('post', '/timings', {
        participant_id: participantId,
        round_number: round,
        did_not_participate: true,
      });
      toast.success('Marcado como NP');
      await onReload();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al marcar NP');
    }
  };

  const savePenalty = async () => {
    const t = penaltyModal.timing;
    if (!t) return;
    setPenaltyLoading(true);
    try {
      await apiRequest('patch', `/timings/${t.id}/penalty`, {
        penalty_seconds: Number(penaltyValue) || 0,
      });
      setPenaltyModal({ open: false, timing: null });
      setPenaltyValue('0');
      await onReload();
      toast.success('Penalización guardada');
    } catch {
      toast.error('Error al guardar la penalización');
    } finally {
      setPenaltyLoading(false);
    }
  };

  const getTimingForParticipant = (participantId) => {
    const list = timingsByRound[round] || [];
    return list.find((x) => x.participant_id === participantId) || null;
  };

  const maxRound = competition?.rounds || 1;
  const roundCompleteCount = (timingsByRound[round] || []).length;

  return (
    <div className="mx-auto max-w-lg px-3 pb-10 pt-4 space-y-4">
      <div className="flex items-center gap-2">
        {showBackButton && onBack ? (
          <Button variant="outline" size="icon" onClick={onBack} aria-label="Volver">
            <ChevronLeft className="size-4" />
          </Button>
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold leading-tight flex items-center gap-2">
            <Smartphone className="size-5 shrink-0" />
            Modo árbitro
          </h1>
          <p className="text-sm text-muted-foreground truncate">{competition?.name}</p>
        </div>
      </div>

      <Card>
        <CardContent className="flex items-center justify-between gap-3 pt-6">
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={round <= 1}
            onClick={() => setRound((r) => Math.max(1, r - 1))}
            aria-label="Ronda anterior"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <div className="text-center">
            <p className="text-2xl font-bold tabular-nums">Ronda {round}</p>
            <p className="text-xs text-muted-foreground">
              {roundCompleteCount}/{participants.length} registrados
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={round >= maxRound}
            onClick={() => setRound((r) => Math.min(maxRound, r + 1))}
            aria-label="Ronda siguiente"
          >
            <ChevronRight className="size-4" />
          </Button>
        </CardContent>
      </Card>

      <ul className="space-y-3">
        {participants.map((p) => {
          const t = getTimingForParticipant(p.id);
          const dnp = t?.did_not_participate;
          const hasTime = t && !dnp;
          return (
            <li key={p.id}>
              <Card className="overflow-hidden">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold leading-snug">{p.driver_name || 'Piloto'}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {p.vehicles
                          ? `${p.vehicles.manufacturer} ${p.vehicles.model}`
                          : p.vehicle_model || '—'}
                      </p>
                    </div>
                    {dnp ? (
                      <Badge variant="secondary">NP</Badge>
                    ) : hasTime ? (
                      <Badge variant="default" className="shrink-0">
                        <Clock className="size-3 mr-1" />
                        OK
                      </Badge>
                    ) : (
                      <Badge variant="outline">Pendiente</Badge>
                    )}
                  </div>

                  {hasTime ? (
                    <div className="text-sm space-y-1 rounded-md bg-muted/40 p-2">
                      <p>
                        <span className="text-muted-foreground">Total: </span>
                        {t.total_time || '—'}
                      </p>
                      <p>
                        <span className="text-muted-foreground">MV: </span>
                        {t.best_lap_time || '—'}
                      </p>
                      {Number(t.penalty_seconds) > 0 ? (
                        <p className="text-amber-700 dark:text-amber-400">
                          Penalización: +{t.penalty_seconds}s
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="flex-1 min-w-[100px]"
                      onClick={() => openTimingModal(p, t)}
                    >
                      {hasTime || dnp ? 'Cambiar tiempo' : 'Tiempo'}
                    </Button>
                    {!dnp && t ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="gap-1"
                        onClick={() => {
                          setPenaltyModal({ open: true, timing: t });
                          setPenaltyValue(String(t.penalty_seconds ?? 0));
                        }}
                      >
                        <Flag className="size-3.5" />
                        Pena
                      </Button>
                    ) : null}
                    {!dnp ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-1 text-destructive border-destructive/30"
                        onClick={() => handleMarkNP(p.id)}
                      >
                        <Ban className="size-3.5" />
                        NP
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>

      <Dialog open={timingModal.open} onOpenChange={(o) => !o && closeTimingModal()}>
        <DialogContent className="max-h-[min(90dvh,calc(100dvh-2rem))] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Ronda {round} — {timingModal.participant?.driver_name || ''}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={submitTiming} className="grid gap-4 py-2">
            <TimeInputHint />
            <div className="space-y-2">
              <Label htmlFor="ref-total">Tiempo total (mm:ss.mmm)</Label>
              <TimeInput
                id="ref-total"
                value={form.total_time}
                onChange={(val) => setForm((f) => ({ ...f, total_time: val }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ref-laps">Vueltas</Label>
              <Input
                id="ref-laps"
                type="number"
                min={1}
                value={form.laps}
                onChange={(e) => setForm((f) => ({ ...f, laps: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ref-best">Mejor vuelta (mm:ss.mmm)</Label>
              <TimeInput
                id="ref-best"
                value={form.best_lap_time}
                onChange={(val) => setForm((f) => ({ ...f, best_lap_time: val }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ref-lane">Carril (opcional)</Label>
              <Input
                id="ref-lane"
                value={form.lane}
                onChange={(e) => setForm((f) => ({ ...f, lane: e.target.value }))}
              />
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={closeTimingModal} disabled={savingTiming}>
                Cancelar
              </Button>
              <Button type="submit" disabled={savingTiming}>
                {savingTiming ? 'Guardando…' : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={penaltyModal.open} onOpenChange={(o) => !o && setPenaltyModal({ open: false, timing: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Penalización (segundos)</DialogTitle>
          </DialogHeader>
          <Input
            type="number"
            step="0.001"
            min={0}
            value={penaltyValue}
            onChange={(e) => setPenaltyValue(e.target.value)}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPenaltyModal({ open: false, timing: null })}>
              Cancelar
            </Button>
            <Button type="button" onClick={savePenalty} disabled={penaltyLoading}>
              {penaltyLoading ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
