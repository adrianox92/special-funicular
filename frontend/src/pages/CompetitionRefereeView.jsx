import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { isLicenseAdminUser } from '../lib/licenseAdmin';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Flag,
  Smartphone,
  AlertTriangle,
  Ban,
  Clock,
} from 'lucide-react';
import axios from '../lib/axios';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Spinner } from '../components/ui/spinner';
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

const CompetitionRefereeView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [competition, setCompetition] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [timings, setTimings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [round, setRound] = useState(1);

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

  const canUseOrganizerTools = useMemo(
    () =>
      Boolean(
        (user?.id && competition?.organizer === user.id) || isLicenseAdminUser(user),
      ),
    [user, competition?.organizer],
  );

  const timingsByRound = useMemo(() => {
    const map = {};
    (timings || []).forEach((t) => {
      if (!map[t.round_number]) map[t.round_number] = [];
      map[t.round_number].push(t);
    });
    return map;
  }, [timings]);

  const loadCompetitionData = useCallback(async () => {
    try {
      setLoading(true);
      const [compResponse, partResponse, timingsResponse] = await Promise.all([
        axios.get(`/competitions/${id}`),
        axios.get(`/competitions/${id}/participants`),
        axios.get(`/competitions/${id}/timings`),
      ]);
      setCompetition(compResponse.data);
      setParticipants(partResponse.data || []);
      setTimings(timingsResponse.data || []);
      setError(null);
    } catch (e) {
      console.error(e);
      setError(e.response?.data?.error || 'Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadCompetitionData();
  }, [loadCompetitionData]);

  useEffect(() => {
    if (!competition?.rounds) return;
    setRound((r) => Math.min(Math.max(1, r), competition.rounds));
  }, [competition?.rounds]);

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
        await axios.put(`/competitions/${id}/timings/${timing.id}`, payload);
        toast.success('Tiempo actualizado');
      } else {
        await axios.post(`/competitions/${id}/timings`, payload);
        toast.success('Tiempo registrado');
      }
      closeTimingModal();
      loadCompetitionData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'No se pudo guardar');
    } finally {
      setSavingTiming(false);
    }
  };

  const handleMarkNP = async (participantId) => {
    try {
      await axios.post(`/competitions/${id}/timings`, {
        participant_id: participantId,
        round_number: round,
        did_not_participate: true,
      });
      toast.success('Marcado como NP');
      loadCompetitionData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al marcar NP');
    }
  };

  const savePenalty = async () => {
    const t = penaltyModal.timing;
    if (!t) return;
    setPenaltyLoading(true);
    try {
      await axios.patch(`/competitions/competition-timings/${t.id}/penalty`, {
        penalty_seconds: Number(penaltyValue) || 0,
      });
      setPenaltyModal({ open: false, timing: null });
      setPenaltyValue('0');
      loadCompetitionData();
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

  if (loading) {
    return (
      <div className="mt-4 flex flex-col items-center justify-center gap-3 min-h-[40vh]">
        <Spinner className="size-8" />
        <p className="text-muted-foreground">Cargando…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-4 p-4">
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button variant="outline" className="mt-4" onClick={() => navigate(`/competitions/${id}/timings`)}>
          Volver a tiempos
        </Button>
      </div>
    );
  }

  if (!canUseOrganizerTools) {
    return (
      <div className="mt-4 p-4 max-w-lg mx-auto space-y-4">
        <Alert>
          <AlertDescription>No tienes permiso para usar el modo árbitro en esta competición.</AlertDescription>
        </Alert>
        <Button variant="outline" onClick={() => navigate(`/competitions/${id}/timings`)}>
          <ArrowLeft className="size-4 mr-2" />
          Volver
        </Button>
      </div>
    );
  }

  if (!participants.length) {
    return (
      <div className="mt-4 p-4 space-y-4">
        <Alert>
          <AlertDescription>Añade participantes antes de registrar tiempos.</AlertDescription>
        </Alert>
        <Button variant="outline" onClick={() => navigate(`/competitions/${id}/participants`)}>
          Ir a participantes
        </Button>
      </div>
    );
  }

  const maxRound = competition?.rounds || 1;
  const roundCompleteCount = (timingsByRound[round] || []).length;

  return (
    <div className="mx-auto max-w-lg px-3 pb-10 pt-4 space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => navigate(`/competitions/${id}/timings`)} aria-label="Volver">
          <ArrowLeft className="size-4" />
        </Button>
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
                    {!dnp && t && canUseOrganizerTools ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="gap-1"
                        onClick={() => {
                          setPenaltyModal({ open: true, timing: t });
                          setPenaltyValue(String(t.penalty_seconds ?? 0));
                        }}
                        disabled={Boolean(dnp)}
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
            <div className="space-y-2">
              <Label htmlFor="ref-total">Tiempo total (mm:ss.mmm)</Label>
              <Input
                id="ref-total"
                placeholder="01:23.456"
                value={form.total_time}
                onChange={(e) => setForm((f) => ({ ...f, total_time: e.target.value }))}
                autoComplete="off"
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
              <Input
                id="ref-best"
                placeholder="00:12.345"
                value={form.best_lap_time}
                onChange={(e) => setForm((f) => ({ ...f, best_lap_time: e.target.value }))}
                autoComplete="off"
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
};

export default CompetitionRefereeView;
