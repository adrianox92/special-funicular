import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { isLicenseAdminUser } from '../lib/licenseAdmin';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Plus,
  ArrowLeft,
  AlertTriangle,
  Trophy,
  Users,
  FileSpreadsheet,
  FileText,
  Flag,
  Pencil,
  Trash2,
  Ban,
  Clock,
} from 'lucide-react';
import axios from '../lib/axios';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../components/ui/tooltip';
import { Spinner } from '../components/ui/spinner';
import { Switch } from '../components/ui/switch';
import { formatTimeDiff } from '../utils/formatTimeDiff';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';

/** Promedio por vuelta = tiempo total / vueltas (formato mm:ss.mmm). */
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

/** Misma lógica que en backend: ignorar 00:00.000 e inválidos. */
function lapTimeStringToSeconds(str) {
  if (!str || typeof str !== 'string') return null;
  const parts = str.split(':');
  if (parts.length < 2) return null;
  const min = parseFloat(parts[0]);
  const rest = parseFloat(parts[1]);
  if (Number.isNaN(min) || Number.isNaN(rest)) return null;
  return min * 60 + rest;
}

function isUsableBestLapTimeString(str) {
  const s = lapTimeStringToSeconds(str);
  return s != null && s > 0;
}

const CompetitionTimings = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [competition, setCompetition] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [timings, setTimings] = useState([]);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Estados para el formulario
  const [showModal, setShowModal] = useState(false);
  const [editingTiming, setEditingTiming] = useState(null);
  const [activeTab, setActiveTab] = useState('aggregated');

  const [circuits, setCircuits] = useState([]);
  const [formData, setFormData] = useState({
    participant_id: '',
    round_number: '',
    best_lap_time: '',
    total_time: '',
    laps: '',
    average_time: '',
    lane: '',
    circuit_id: '',
    did_not_participate: false,
  });

  const [, setRules] = useState([]);
  const [pointsByParticipant, setPointsByParticipant] = useState({});

  // Estados para el modal de penalización
  const [showPenaltyModal, setShowPenaltyModal] = useState(false);
  const [penaltyTiming, setPenaltyTiming] = useState(null);
  const [penaltyValue, setPenaltyValue] = useState(0);
  const [penaltyLoading, setPenaltyLoading] = useState(false);
  const [deleteTimingConfirm, setDeleteTimingConfirm] = useState({ open: false, timingId: null });

  // Memo: Mapa de participantes por ID
  const canUseOrganizerTools = useMemo(
    () =>
      Boolean(
        (user?.id && competition?.organizer === user.id) || isLicenseAdminUser(user),
      ),
    [user, competition?.organizer],
  );

  const participantsMap = useMemo(() => {
    const map = {};
    participants.forEach((p) => {
      map[p.id] = p;
    });
    return map;
  }, [participants]);

  // Memo: Timings agrupados por participante
  const timingsByParticipant = useMemo(() => {
    const map = {};
    timings.forEach((t) => {
      if (!map[t.participant_id]) map[t.participant_id] = [];
      map[t.participant_id].push(t);
    });
    return map;
  }, [timings]);

  // Memo: Timings agrupados por ronda
  const timingsByRound = useMemo(() => {
    const map = {};
    timings.forEach((t) => {
      if (!map[t.round_number]) map[t.round_number] = [];
      map[t.round_number].push(t);
    });
    return map;
  }, [timings]);

  const aggregatedTimes = useMemo(() => {
    const aggregatedData = {};
    timings.forEach((timing) => {
      const key = String(timing.participant_id);
      if (!aggregatedData[key]) {
        aggregatedData[key] = {
          id: key,
          participant_id: key,
          total_time_seconds: 0,
          penalty_seconds: 0,
          best_lap_time: null,
          rounds_completed: 0,
          rounds_dnp: 0,
          total_laps: 0,
        };
      }
      // Cada fila en BD cuenta como ronda registrada (incluye NP).
      aggregatedData[key].rounds_completed += 1;
      if (timing.did_not_participate) {
        aggregatedData[key].rounds_dnp += 1;
        return;
      }
      const timeInSeconds = timeStringToSeconds(timing.total_time);
      const penalty = Number(timing.penalty_seconds) || 0;
      aggregatedData[key].total_time_seconds += timeInSeconds + penalty;
      aggregatedData[key].penalty_seconds += penalty;
      if (isUsableBestLapTimeString(timing.best_lap_time)) {
        const curLap = lapTimeStringToSeconds(timing.best_lap_time);
        const bestSoFar =
          aggregatedData[key].best_lap_time != null
            ? lapTimeStringToSeconds(aggregatedData[key].best_lap_time)
            : null;
        if (bestSoFar == null || (curLap != null && curLap < bestSoFar)) {
          aggregatedData[key].best_lap_time = timing.best_lap_time;
        }
      }
      aggregatedData[key].total_laps += timing.laps;
    });
    return Object.values(aggregatedData)
      .sort((a, b) => {
        const ptsA = pointsByParticipant[a.participant_id] ?? 0;
        const ptsB = pointsByParticipant[b.participant_id] ?? 0;
        if (ptsA !== ptsB) return ptsB - ptsA;
        if (a.total_time_seconds && b.total_time_seconds) {
          return a.total_time_seconds - b.total_time_seconds;
        }
        if (a.total_time_seconds && !b.total_time_seconds) return -1;
        if (!a.total_time_seconds && b.total_time_seconds) return 1;
        const racedA = a.rounds_completed - a.rounds_dnp;
        const racedB = b.rounds_completed - b.rounds_dnp;
        if (racedA !== racedB) {
          return racedB - racedA;
        }
        return 0;
      })
      .map((data, index) => {
        const totalMinutes = Math.floor(data.total_time_seconds / 60);
        const totalSeconds = (data.total_time_seconds % 60).toFixed(3);
        const totalTimeFormatted = `${String(totalMinutes).padStart(2, '0')}:${totalSeconds.padStart(6, '0')}`;
        return {
          ...data,
          position: index + 1,
          total_time_formatted: totalTimeFormatted,
          has_completed_all_rounds:
            data.rounds_completed - data.rounds_dnp >=
            (competition?.rounds || 0),
        };
      });
  }, [timings, competition, pointsByParticipant]);

  /** Mismo criterio que la clasificación agregada: puntos → tiempo. */
  const participantsDisplayOrder = useMemo(() => {
    const seen = new Set();
    const ordered = [];
    for (const row of aggregatedTimes) {
      const p = participants.find((x) => x.id === row.participant_id);
      if (p && !seen.has(p.id)) {
        seen.add(p.id);
        ordered.push(p);
      }
    }
    for (const p of participants) {
      if (!seen.has(p.id)) ordered.push(p);
    }
    return ordered;
  }, [participants, aggregatedTimes]);

  // Cargar datos de la competición
  useEffect(() => {
    loadCompetitionData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!showModal) return;
    if (formData.did_not_participate) return;
    const avg = averageTimeFromTotalAndLaps(formData.total_time, formData.laps);
    setFormData((prev) => {
      if ((prev.average_time || '') === (avg || '')) return prev;
      return { ...prev, average_time: avg };
    });
  }, [showModal, formData.total_time, formData.laps, formData.did_not_participate]);

  const loadCompetitionData = async () => {
    try {
      setLoading(true);
      const compResponse = await axios.get(`/competitions/${id}`);
      const organizerId = compResponse.data?.organizer;
      const [
        partResponse,
        timingsResponse,
        progressResponse,
        rulesResponse,
        circuitsResponse,
      ] = await Promise.all([
        axios.get(`/competitions/${id}/participants`),
        axios.get(`/competitions/${id}/timings`),
        axios.get(`/competitions/${id}/progress`),
        axios.get(`/competitions/${id}/rules`),
        organizerId
          ? axios.get('/circuits', { params: { owner_user_id: organizerId } })
          : axios.get('/circuits'),
      ]);
      setCompetition(compResponse.data);
      setParticipants(partResponse.data);
      setTimings(timingsResponse.data);
      setProgress(progressResponse.data);
      setRules(rulesResponse.data);
      setCircuits(circuitsResponse.data || []);
      // Obtener puntos calculados del backend usando el endpoint de progreso
      const pointsByParticipant = {};
      if (progressResponse.data.participant_stats) {
        progressResponse.data.participant_stats.forEach((participant) => {
          pointsByParticipant[participant.participant_id] =
            participant.points || 0;
        });
      }
      setPointsByParticipant(pointsByParticipant);
    } catch (error) {
      console.error('Error al cargar datos:', error);
      setError(error.response?.data?.error || 'Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const handleShowModal = (timing = null, preset = null) => {
    if (timing) {
      setEditingTiming(timing);
      const isDnp = Boolean(timing.did_not_participate);
      setFormData({
        participant_id: timing.participant_id,
        round_number: timing.round_number,
        circuit_id: timing.circuit_id || '',
        best_lap_time: isDnp ? '' : timing.best_lap_time,
        total_time: isDnp ? '' : timing.total_time,
        laps: isDnp ? '' : timing.laps,
        average_time: isDnp ? '' : timing.average_time,
        lane: timing.lane || '',
        did_not_participate: isDnp,
      });
    } else if (
      preset &&
      preset.participant_id != null &&
      preset.participant_id !== '' &&
      preset.round_number != null &&
      preset.round_number !== ''
    ) {
      setEditingTiming(null);
      setFormData({
        participant_id: String(preset.participant_id),
        round_number: String(preset.round_number),
        best_lap_time: '',
        total_time: '',
        laps: '',
        average_time: '',
        lane: '',
        circuit_id: '',
        did_not_participate: false,
      });
    } else {
      setEditingTiming(null);
      setFormData({
        participant_id: '',
        round_number: '',
        best_lap_time: '',
        total_time: '',
        laps: '',
        average_time: '',
        lane: '',
        circuit_id: '',
        did_not_participate: false,
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingTiming(null);
    setFormData({
      participant_id: '',
      round_number: '',
      best_lap_time: '',
      total_time: '',
      laps: '',
      average_time: '',
      lane: '',
      circuit_id: '',
      did_not_participate: false,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validar que hay participantes disponibles para la ronda seleccionada (solo alta nueva)
    if (
      !editingTiming &&
      formData.round_number &&
      getAvailableParticipantsForRound(formData.round_number).length === 0
    ) {
      toast.warning(
        'No hay participantes disponibles para esta ronda. Todos ya tienen tiempo registrado.'
      );
      return;
    }

    let payload;
    if (formData.did_not_participate) {
      payload = {
        participant_id: formData.participant_id,
        round_number: formData.round_number,
        did_not_participate: true,
      };
    } else {
      const average_time = averageTimeFromTotalAndLaps(
        formData.total_time,
        formData.laps
      );
      if (!average_time) {
        toast.error(
          'Introduce el tiempo total en formato 00:00.000 y un número de vueltas válido.'
        );
        return;
      }
      payload = { ...formData, average_time, did_not_participate: false };
    }

    try {
      if (editingTiming) {
        // Actualizar tiempo existente
        await axios.put(
          `/competitions/${id}/timings/${editingTiming.id}`,
          payload
        );
      } else {
        // Crear nuevo tiempo
        await axios.post(`/competitions/${id}/timings`, payload);
      }

      handleCloseModal();
      loadCompetitionData(); // Recargar datos
    } catch (error) {
      console.error('Error al guardar tiempo:', error);
      setError(error.response?.data?.error || 'Error al guardar el tiempo');
    }
  };

  const confirmDeleteTiming = async () => {
    if (!deleteTimingConfirm.timingId) return;
    try {
      await axios.delete(`/competitions/${id}/timings/${deleteTimingConfirm.timingId}`);
      setDeleteTimingConfirm({ open: false, timingId: null });
      loadCompetitionData();
    } catch (error) {
      console.error('Error al eliminar tiempo:', error);
      toast.error(error.response?.data?.error || 'Error al eliminar el tiempo');
    }
  };

  // Marcar rápidamente a un participante como No Participado (NP) en una ronda.
  const handleMarkNP = async (participantId, roundNumber) => {
    try {
      await axios.post(`/competitions/${id}/timings`, {
        participant_id: participantId,
        round_number: roundNumber,
        did_not_participate: true,
      });
      toast.success('Participante marcado como NP');
      loadCompetitionData();
    } catch (error) {
      console.error('Error al marcar NP:', error);
      toast.error(error.response?.data?.error || 'Error al marcar NP');
    }
  };

  // Usar los mapas en vez de buscar en cada render
  const getParticipantName = (participantId) => {
    return participantsMap[participantId]?.driver_name || 'Desconocido';
  };

  const getVehicleInfo = (participantId) => {
    const participant = participantsMap[participantId];
    if (!participant) return 'Desconocido';
    if (participant.vehicles) {
      return `${participant.vehicles.manufacturer} ${participant.vehicles.model}`;
    } else if (participant.vehicle_model) {
      return participant.vehicle_model;
    }
    return 'Sin vehículo';
  };

  // Función para obtener participantes disponibles para una ronda específica
  const getAvailableParticipantsForRound = (roundNumber) => {
    if (!roundNumber) return participants;

    // Obtener los IDs de participantes que ya tienen tiempo en esta ronda
    const participantsWithTimeInRound = timings
      .filter((timing) => timing.round_number === parseInt(roundNumber))
      .map((timing) => timing.participant_id);

    // Filtrar participantes que no tienen tiempo en esta ronda
    return participants.filter(
      (participant) => !participantsWithTimeInRound.includes(participant.id)
    );
  };

  // Función para verificar si todos los pilotos han completado todas las rondas
  const isCompetitionComplete = () => {
    if (!competition || participants.length === 0) return false;

    const totalRequiredTimes = participants.length * competition.rounds;
    const actualTimes = timings.length;

    return actualTimes >= totalRequiredTimes;
  };

  // Función para obtener participantes que han completado todas las rondas
  const getParticipantsWithAllRounds = () => { // eslint-disable-line no-unused-vars
    const participantRounds = {};

    // Contar rondas completadas por cada participante
    timings.forEach((timing) => {
      const participantId = timing.participant_id;
      if (!participantRounds[participantId]) {
        participantRounds[participantId] = new Set();
      }
      participantRounds[participantId].add(timing.round_number);
    });

    // Filtrar participantes que han completado todas las rondas
    return participants.filter(
      (participant) =>
        participantRounds[participant.id] &&
        participantRounds[participant.id].size >= competition.rounds
    );
  };

  // Función para convertir mm:ss.mmm a segundos
  function timeStringToSeconds(str) {
    if (!str) return 0;
    const match = str.match(/^(\d{2}):(\d{2})\.(\d{3})$/);
    if (!match) return 0;
    const [, min, sec, ms] = match.map(Number);
    return min * 60 + sec + ms / 1000;
  }

  /** Tiempo de carrera + penalización; usa total_time si falta total_time_timestamp. */
  function adjustedRaceTimeSeconds(timing) {
    if (timing.did_not_participate) return null;
    const base =
      Number(timing.total_time_timestamp) || timeStringToSeconds(timing.total_time);
    return base + (Number(timing.penalty_seconds) || 0);
  }

  // Función para convertir segundos a mm:ss.mmm
  function secondsToTimeString(seconds) {
    if (typeof seconds !== 'number' || isNaN(seconds)) return '00:00.000';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = (seconds % 60).toFixed(3);
    return `${String(minutes).padStart(2, '0')}:${remainingSeconds.padStart(6, '0')}`;
  }

  const formatTime = (time) => {
    if (!time) return '-';
    return time;
  };

  const getRoundStatus = (roundNumber) => {
    const roundTimings = timingsByRound[roundNumber] || [];
    const totalParticipants = participants.length;

    if (roundTimings.length === 0) {
      return { status: 'pending', text: 'Pendiente', color: 'secondary' };
    } else if (roundTimings.length === totalParticipants) {
      return { status: 'completed', text: 'Completada', color: 'success' };
    } else {
      return { status: 'partial', text: 'Parcial', color: 'warning' };
    }
  };

  // Funciones de exportación
  const handleExportCSV = async () => {
    try {
      const response = await axios.get(`/competitions/${id}/export/csv`, {
        responseType: 'blob',
      });

      // Crear enlace de descarga
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `competicion_${competition.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error al exportar CSV:', error);
      toast.error('Error al exportar los datos a CSV');
    }
  };

  const handleExportPDF = async () => {
    try {
      const response = await axios.get(`/competitions/${id}/export/pdf`, {
        responseType: 'blob',
      });

      // Crear enlace de descarga
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `competicion_${competition.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error al exportar PDF:', error);
      toast.error('Error al exportar los datos a PDF');
    }
  };

  const handleOpenPenaltyModal = (timing) => {
    setPenaltyTiming(timing);
    setPenaltyValue(timing.penalty_seconds || 0);
    setShowPenaltyModal(true);
  };

  const handleClosePenaltyModal = () => {
    setShowPenaltyModal(false);
    setPenaltyTiming(null);
    setPenaltyValue(0);
  };

  const handleSavePenalty = async () => {
    if (!penaltyTiming) return;
    setPenaltyLoading(true);
    try {
      await axios.patch(
        `/competitions/competition-timings/${penaltyTiming.id}/penalty`,
        { penalty_seconds: Number(penaltyValue) }
      );
      handleClosePenaltyModal();
      loadCompetitionData();
    } catch (err) {
      toast.error('Error al guardar la penalización');
    } finally {
      setPenaltyLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="mt-4 flex flex-col items-center justify-center gap-3">
        <Spinner className="size-8" />
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-4">
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  // Verificar que la competición tenga al menos un participante antes de permitir gestionar tiempos
  if (competition && participants.length === 0) {
    const showOrganizerEmptyActions = canUseOrganizerTools;
    return (
      <div className="mt-4 max-w-4xl mx-auto space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <Button
            variant="outline"
            onClick={() => navigate(`/competitions/${id}/participants`)}
          >
            <ArrowLeft className="size-4 mr-2" />
            Volver
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Tiempos de Competición</h1>
            <p className="text-muted-foreground">{competition?.name}</p>
          </div>
        </div>

        <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
          <AlertTriangle className="size-12 text-amber-600 dark:text-amber-400 mb-3" />
          <AlertTitle className="text-lg">Sin Participantes</AlertTitle>
          <AlertDescription>
            <p className="mb-3">
              {showOrganizerEmptyActions
                ? 'No puedes gestionar tiempos hasta que haya al menos un participante registrado.'
                : 'Aún no hay participantes confirmados en esta competición.'}
            </p>
            <div className="flex items-center justify-center gap-2 mb-3">
              <Badge
                variant="secondary"
                className="bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100"
              >
                {participants.length}/{competition.num_slots} participantes
              </Badge>
              <span className="text-muted-foreground">
                {showOrganizerEmptyActions
                  ? 'Añade al menos un participante para comenzar'
                  : 'Consulta de nuevo cuando el organizador confirme la lista'}
              </span>
            </div>
            {showOrganizerEmptyActions && (
              <Button
                onClick={() => navigate(`/competitions/${id}/participants`)}
                className="flex items-center gap-2"
              >
                <Users className="size-4" />
                Añadir Participantes
              </Button>
            )}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <AlertDialog open={deleteTimingConfirm.open} onOpenChange={(open) => !open && setDeleteTimingConfirm({ open: false, timingId: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar tiempo?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que quieres eliminar este tiempo? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteTiming} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="mt-4 max-w-7xl mx-auto space-y-4">
        {isLicenseAdminUser(user) && competition?.organizer && user?.id !== competition.organizer && (
          <Alert>
            <AlertDescription>
              Modo depuración (admin): gestionas tiempos con permisos de organizador; el circuito y datos son los del organizador de la competición.
            </AlertDescription>
          </Alert>
        )}
        {/* Header */}
        <div className="flex flex-col gap-4 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => navigate(`/competitions/${id}/participants`)}
              >
                <ArrowLeft className="size-4 mr-2" />
                Volver
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Tiempos de Competición</h1>
                <p className="text-muted-foreground">{competition?.name}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {isCompetitionComplete() && (
                <>
                  <Button
                    variant="outline"
                    onClick={handleExportCSV}
                    className="flex items-center gap-2"
                  >
                    <FileSpreadsheet className="size-4" />
                    CSV
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleExportPDF}
                    className="flex items-center gap-2"
                  >
                    <FileText className="size-4" />
                    PDF
                  </Button>
                </>
              )}
              {canUseOrganizerTools && (
                <Button
                  onClick={() => handleShowModal()}
                  className="flex items-center gap-2"
                  disabled={
                    participants.length === 0 || isCompetitionComplete()
                  }
                >
                  <Plus className="size-4" />
                  {isCompetitionComplete()
                    ? 'Competición Completada'
                    : 'Registrar Tiempo'}
                  {participants.length > 0 && !isCompetitionComplete() && (
                    <Badge variant="secondary" className="ml-2">
                      {participants.length} participantes
                    </Badge>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Progreso de la competición */}
        {progress && (
          <Card>
            <CardContent className="pt-6">
              <h5 className="font-semibold mb-3">
                Progreso de la Competición
              </h5>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${progress.progress_percentage}%` }}
                  />
                </div>
                <span className="text-muted-foreground text-sm">
                  {progress.progress_percentage}%
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="text-center">
                  <small className="text-muted-foreground block">Participantes</small>
                  <h6 className="font-semibold">{progress.participants_count}</h6>
                </div>
                <div className="text-center">
                  <small className="text-muted-foreground block">Rondas</small>
                  <h6 className="font-semibold">{progress.rounds}</h6>
                </div>
                <div className="text-center">
                  <small className="text-muted-foreground block">
                    Tiempos Registrados
                  </small>
                  <h6 className="font-semibold">
                    {progress.times_registered} / {progress.total_required_times}
                  </h6>
                </div>
                <div className="text-center">
                  <small className="text-muted-foreground block">Estado</small>
                  <Badge
                    variant={progress.is_completed ? 'default' : 'secondary'}
                    className={
                      progress.is_completed
                        ? 'bg-green-600 hover:bg-green-600'
                        : 'bg-amber-500 hover:bg-amber-500'
                    }
                  >
                    {progress.is_completed ? 'Completada' : 'En Progreso'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Mensaje cuando la competición está completa */}
        {isCompetitionComplete() && (
          <Alert className="border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-100">
            <Trophy className="size-5" />
            <AlertTitle>¡Competición Completada!</AlertTitle>
            <AlertDescription>
              <p className="mb-0 mt-1">
                Todos los participantes han completado todas las rondas. Ya no
                se pueden registrar más tiempos. Revisa la pestaña "Tiempos
                Agregados" para ver la clasificación final.
              </p>
            </AlertDescription>
          </Alert>
        )}

        {/* Tabs para diferentes vistas */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 gap-1">
            <TabsTrigger value="rounds" className="text-xs sm:text-sm px-1 sm:px-3">
              <span className="sm:hidden">Rondas</span>
              <span className="hidden sm:inline">Vista por Rondas</span>
            </TabsTrigger>
            <TabsTrigger value="participants" className="text-xs sm:text-sm px-1 sm:px-3">
              <span className="sm:hidden">Pilotos</span>
              <span className="hidden sm:inline">Vista por Participantes</span>
            </TabsTrigger>
            <TabsTrigger value="aggregated" className="text-xs sm:text-sm px-1 sm:px-3">
              <span className="sm:hidden">Clasif.</span>
              <span className="hidden sm:inline">Tiempos Agregados</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rounds" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from(
                { length: competition?.rounds || 0 },
                (_, i) => i + 1
              ).map((roundNumber) => {
                const roundStatus = getRoundStatus(roundNumber);

                // Ordenar por tiempo ajustado. Los NP se mandan al final (no se
                // ordenan entre sí ni reciben posición competitiva).
                const sortedTimings = [
                  ...(timingsByRound[roundNumber] || []),
                ].sort((a, b) => {
                  if (a.did_not_participate && !b.did_not_participate) return 1;
                  if (!a.did_not_participate && b.did_not_participate) return -1;
                  if (a.did_not_participate && b.did_not_participate) return 0;
                  const aAdj = adjustedRaceTimeSeconds(a) ?? 0;
                  const bAdj = adjustedRaceTimeSeconds(b) ?? 0;
                  return aAdj - bAdj;
                });

                // Encontrar el mejor tiempo de vuelta de la ronda (ignorando NP y 00:00.000)
                const participatingTimings = sortedTimings.filter(
                  (t) => !t.did_not_participate
                );
                const withUsableLap = participatingTimings.filter((t) =>
                  isUsableBestLapTimeString(t.best_lap_time)
                );
                const bestLapTime =
                  withUsableLap.length > 0
                    ? withUsableLap.reduce((best, current) => {
                        const cur = lapTimeStringToSeconds(current.best_lap_time);
                        const bestS = lapTimeStringToSeconds(best.best_lap_time);
                        if (cur == null || bestS == null) return best;
                        return cur < bestS ? current : best;
                      }, withUsableLap[0])
                    : null;

                return (
                  <Card key={roundNumber}>
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-center mb-3">
                        <h6 className="font-semibold">Ronda {roundNumber}</h6>
                        <Badge
                          variant="secondary"
                          className={
                            roundStatus.color === 'success'
                              ? 'bg-green-600 hover:bg-green-600'
                              : roundStatus.color === 'warning'
                                ? 'bg-amber-500 hover:bg-amber-500'
                                : ''
                          }
                        >
                          {roundStatus.text}
                        </Badge>
                      </div>

                      {sortedTimings.length > 0 ? (
                        <>
                          <div className="hidden md:block overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-center w-[60px]">
                                    Pos
                                  </TableHead>
                                  <TableHead className="text-center w-[120px]">
                                    Piloto
                                  </TableHead>
                                  <TableHead className="text-center w-[80px]">
                                    Total
                                  </TableHead>
                                  <TableHead className="text-center w-[60px]">
                                    Dif
                                  </TableHead>
                                  <TableHead className="text-center w-[75px]">
                                    Vuelta
                                  </TableHead>
                                  {canUseOrganizerTools && (
                                    <TableHead className="text-center w-[140px]">
                                      Acciones
                                    </TableHead>
                                  )}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {sortedTimings.map((timing, index) => {
                                  const isDnp = Boolean(timing.did_not_participate);
                                  const isBestLap =
                                    !isDnp && bestLapTime && timing.id === bestLapTime.id;
                                  const leader = participatingTimings[0];
                                  const leaderTime = leader
                                    ? adjustedRaceTimeSeconds(leader) ?? 0
                                    : 0;
                                  const currentTime = isDnp
                                    ? 0
                                    : adjustedRaceTimeSeconds(timing) ?? 0;
                                  const diff = currentTime - leaderTime;
                                  const timeDiff =
                                    isDnp || !leader || timing.id === leader.id
                                      ? '-'
                                      : formatTimeDiff(diff);
                                  const base = timeStringToSeconds(
                                    timing.total_time
                                  );
                                  const penalty =
                                    Number(timing.penalty_seconds) || 0;
                                  const adjusted = base + penalty;
                                  const penaltyTooltip = `Original: ${timing.total_time} + ${penalty.toFixed(3)}s penalización`;

                                  return (
                                    <TableRow key={timing.id}>
                                      <TableCell className="text-center p-1 text-sm">
                                        {isDnp ? (
                                          <Badge
                                            variant="secondary"
                                            className="bg-muted text-muted-foreground"
                                          >
                                            NP
                                          </Badge>
                                        ) : (
                                          <Badge
                                            variant={
                                              index === 0 ? 'default' : 'secondary'
                                            }
                                            className={
                                              index === 0
                                                ? 'bg-green-600 hover:bg-green-600'
                                                : ''
                                            }
                                          >
                                            {index + 1}
                                          </Badge>
                                        )}
                                      </TableCell>
                                      <TableCell
                                        className="text-center p-1 text-sm break-words"
                                      >
                                        {getParticipantName(
                                          timing.participant_id
                                        )}
                                      </TableCell>
                                      <TableCell className="font-bold text-center p-1 text-sm">
                                        {isDnp ? (
                                          <span className="text-muted-foreground">—</span>
                                        ) : penalty > 0 ? (
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <span className="cursor-pointer">
                                                {secondsToTimeString(adjusted)}{' '}
                                                <AlertTriangle
                                                  className="inline size-3.5 align-middle text-amber-600"
                                                  aria-hidden
                                                />
                                              </span>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              {penaltyTooltip}
                                            </TooltipContent>
                                          </Tooltip>
                                        ) : (
                                          <span>
                                            {secondsToTimeString(adjusted)}
                                          </span>
                                        )}
                                      </TableCell>
                                      <TableCell className="text-center p-1 text-sm text-muted-foreground">
                                        {timeDiff}
                                      </TableCell>
                                      <TableCell
                                        className={`text-center p-1 text-sm ${
                                          isBestLap
                                            ? 'font-bold text-amber-600 bg-amber-500/10'
                                            : ''
                                        }`}
                                      >
                                        {isDnp ? (
                                          <span className="text-muted-foreground">—</span>
                                        ) : (
                                          <>
                                            {formatTime(timing.best_lap_time)}
                                            {isBestLap && (
                                              <Badge
                                                variant="secondary"
                                                className="ml-1 inline-flex items-center gap-0.5 bg-amber-500/20 text-amber-800 dark:text-amber-200"
                                              >
                                                <Trophy className="size-3" aria-hidden />
                                              </Badge>
                                            )}
                                          </>
                                        )}
                                      </TableCell>
                                      {canUseOrganizerTools && (
                                        <TableCell className="text-center p-1">
                                          <div className="flex items-center justify-center gap-1">
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  aria-label="Editar tiempo"
                                                  onClick={() =>
                                                    handleShowModal(timing)
                                                  }
                                                  className="text-blue-600 hover:text-blue-700 p-0 h-auto"
                                                >
                                                  <Pencil className="size-4" />
                                                </Button>
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                Editar tiempo
                                              </TooltipContent>
                                            </Tooltip>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <span className="inline-flex">
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    aria-label="Editar penalización"
                                                    onClick={() =>
                                                      handleOpenPenaltyModal(
                                                        timing
                                                      )
                                                    }
                                                    disabled={isDnp}
                                                    className="text-amber-600 hover:text-amber-700 p-0 h-auto disabled:opacity-40"
                                                  >
                                                    <Flag className="size-4" />
                                                  </Button>
                                                </span>
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                {isDnp
                                                  ? 'No aplica penalización en NP'
                                                  : 'Editar penalización'}
                                              </TooltipContent>
                                            </Tooltip>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  aria-label="Eliminar tiempo"
                                                  onClick={() =>
                                                    setDeleteTimingConfirm({
                                                      open: true,
                                                      timingId: timing.id,
                                                    })
                                                  }
                                                  className="text-destructive hover:text-destructive/80 p-0 h-auto"
                                                >
                                                  <Trash2 className="size-4" />
                                                </Button>
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                Eliminar tiempo
                                              </TooltipContent>
                                            </Tooltip>
                                          </div>
                                        </TableCell>
                                      )}
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                          <div className="md:hidden overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Pos</TableHead>
                                  <TableHead>Piloto</TableHead>
                                  <TableHead>Total</TableHead>
                                  <TableHead>Dif</TableHead>
                                  <TableHead>Vuelta</TableHead>
                                  <TableHead>V</TableHead>
                                  {canUseOrganizerTools && <TableHead>Acciones</TableHead>}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {sortedTimings.map((timing, index) => {
                                  const isDnp = Boolean(timing.did_not_participate);
                                  const isBestLap =
                                    !isDnp && bestLapTime && timing.id === bestLapTime.id;
                                  const leader = participatingTimings[0];
                                  const leaderTime = leader
                                    ? adjustedRaceTimeSeconds(leader) ?? 0
                                    : 0;
                                  const currentTime = isDnp
                                    ? 0
                                    : adjustedRaceTimeSeconds(timing) ?? 0;
                                  const diff = currentTime - leaderTime;
                                  const timeDiff =
                                    isDnp || !leader || timing.id === leader.id
                                      ? '-'
                                      : formatTimeDiff(diff);
                                  const base = timeStringToSeconds(
                                    timing.total_time
                                  );
                                  const penalty =
                                    Number(timing.penalty_seconds) || 0;
                                  const adjusted = base + penalty;
                                  const penaltyTooltip = `${timing.total_time} + ${penalty.toFixed(3)}s penalización`;

                                  return (
                                    <TableRow key={timing.id}>
                                      <TableCell className="text-center p-1 text-sm">
                                        {isDnp ? (
                                          <Badge
                                            variant="secondary"
                                            className="bg-muted text-muted-foreground"
                                          >
                                            NP
                                          </Badge>
                                        ) : (
                                          <Badge
                                            variant={
                                              index === 0 ? 'default' : 'secondary'
                                            }
                                            className={
                                              index === 0
                                                ? 'bg-green-600 hover:bg-green-600'
                                                : ''
                                            }
                                          >
                                            {index + 1}
                                          </Badge>
                                        )}
                                      </TableCell>
                                      <TableCell
                                        className="text-center p-1 text-sm break-words"
                                      >
                                        {getParticipantName(
                                          timing.participant_id
                                        )}
                                      </TableCell>
                                      <TableCell className="font-bold text-center p-1 text-sm">
                                        {isDnp ? (
                                          <span className="text-muted-foreground">—</span>
                                        ) : penalty > 0 ? (
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <span className="cursor-pointer">
                                                {secondsToTimeString(adjusted)}{' '}
                                                <AlertTriangle
                                                  className="inline size-3.5 align-middle text-amber-600"
                                                  aria-hidden
                                                />
                                              </span>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              {penaltyTooltip}
                                            </TooltipContent>
                                          </Tooltip>
                                        ) : (
                                          <span>
                                            {secondsToTimeString(adjusted)}
                                          </span>
                                        )}
                                      </TableCell>
                                      <TableCell className="text-center p-1 text-sm text-muted-foreground">
                                        {timeDiff}
                                      </TableCell>
                                      <TableCell
                                        className={`text-center p-1 text-sm ${
                                          isBestLap
                                            ? 'font-bold text-amber-600 bg-amber-500/10'
                                            : ''
                                        }`}
                                      >
                                        {isDnp ? (
                                          <span className="text-muted-foreground">—</span>
                                        ) : (
                                          <>
                                            {formatTime(timing.best_lap_time)}
                                            {isBestLap && (
                                              <Badge
                                                variant="secondary"
                                                className="ml-1 inline-flex items-center gap-0.5 bg-amber-500/20 text-amber-800 dark:text-amber-200"
                                              >
                                                <Trophy className="size-3" aria-hidden />
                                              </Badge>
                                            )}
                                          </>
                                        )}
                                      </TableCell>
                                      <TableCell className="text-center p-1 text-sm">
                                        {isDnp ? (
                                          <span className="text-muted-foreground">—</span>
                                        ) : (
                                          timing.laps
                                        )}
                                      </TableCell>
                                      {canUseOrganizerTools && (
                                        <TableCell className="text-center p-1">
                                          <div className="flex items-center justify-center gap-1">
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  aria-label="Editar tiempo"
                                                  onClick={() =>
                                                    handleShowModal(timing)
                                                  }
                                                  className="text-blue-600 hover:text-blue-700 p-0 h-auto"
                                                >
                                                  <Pencil className="size-4" />
                                                </Button>
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                Editar tiempo
                                              </TooltipContent>
                                            </Tooltip>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <span className="inline-flex">
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    aria-label="Editar penalización"
                                                    onClick={() =>
                                                      handleOpenPenaltyModal(
                                                        timing
                                                      )
                                                    }
                                                    disabled={isDnp}
                                                    className="text-amber-600 hover:text-amber-700 p-0 h-auto disabled:opacity-40"
                                                  >
                                                    <Flag className="size-4" />
                                                  </Button>
                                                </span>
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                {isDnp
                                                  ? 'No aplica penalización en NP'
                                                  : 'Editar penalización'}
                                              </TooltipContent>
                                            </Tooltip>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  aria-label="Eliminar tiempo"
                                                  onClick={() =>
                                                    setDeleteTimingConfirm({
                                                      open: true,
                                                      timingId: timing.id,
                                                    })
                                                  }
                                                  className="text-destructive hover:text-destructive/80 p-0 h-auto"
                                                >
                                                  <Trash2 className="size-4" />
                                                </Button>
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                Eliminar tiempo
                                              </TooltipContent>
                                            </Tooltip>
                                          </div>
                                        </TableCell>
                                      )}
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        </>
                      ) : (
                        <p className="text-muted-foreground text-sm">
                          No hay tiempos registrados
                        </p>
                      )}

                      {canUseOrganizerTools && !isCompetitionComplete() && (() => {
                        const pending = getAvailableParticipantsForRound(
                          String(roundNumber)
                        );
                        if (pending.length === 0) return null;
                        return (
                          <div className="mt-4 border-t pt-3">
                            <p className="text-xs font-medium text-muted-foreground mb-2">
                              Pendientes en esta ronda
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {pending.map((p) => (
                                <div
                                  key={p.id}
                                  className="inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1 text-xs"
                                >
                                  <span className="font-medium">
                                    {p.driver_name}
                                  </span>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        aria-label={`Registrar tiempo para ${p.driver_name} en la ronda ${roundNumber}`}
                                        onClick={() =>
                                          handleShowModal(null, {
                                            participant_id: p.id,
                                            round_number: roundNumber,
                                          })
                                        }
                                        className="h-6 px-1.5 text-blue-600 hover:text-blue-700"
                                      >
                                        <Clock className="size-3 mr-1" />
                                        Tiempos
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      Abrir el formulario con esta ronda y este
                                      piloto ya elegidos
                                    </TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        aria-label="Marcar como No Participado (NP)"
                                        onClick={() =>
                                          handleMarkNP(p.id, roundNumber)
                                        }
                                        className="h-6 px-1.5 text-destructive hover:text-destructive/80"
                                      >
                                        <Ban className="size-3 mr-1" />
                                        NP
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      Marcar NP: no corrió esta ronda, 0 puntos
                                      y sin tiempos válidos
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="participants" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {participantsDisplayOrder.map((participant) => {
                const completedRounds =
                  timingsByParticipant[participant.id]?.length || 0;
                const totalRounds = competition?.rounds || 0;

                return (
                  <Card key={participant.id}>
                    <CardContent className="pt-6">
                      <h6 className="font-semibold">{participant.driver_name}</h6>
                      <p className="text-muted-foreground text-sm mb-3">
                        {getVehicleInfo(participant.id)}
                      </p>

                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{
                              width: `${(completedRounds / totalRounds) * 100}%`,
                            }}
                          />
                        </div>
                        <small className="text-muted-foreground">
                          {completedRounds}/{totalRounds}
                        </small>
                      </div>

                      {timingsByParticipant[participant.id]?.length > 0 ? (
                        <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Ronda</TableHead>
                                <TableHead>Mejor</TableHead>
                                <TableHead>Total</TableHead>
                                <TableHead>Promedio</TableHead>
                                <TableHead>Vueltas</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {timingsByParticipant[participant.id].map(
                                (timing) => {
                                  const isDnp = Boolean(
                                    timing.did_not_participate
                                  );
                                  return (
                                    <TableRow key={timing.id}>
                                      <TableCell>{timing.round_number}</TableCell>
                                      {isDnp ? (
                                        <TableCell colSpan={4}>
                                          <Badge
                                            variant="secondary"
                                            className="bg-muted text-muted-foreground"
                                          >
                                            NP — No participó
                                          </Badge>
                                        </TableCell>
                                      ) : (
                                        <>
                                          <TableCell>
                                            {formatTime(timing.best_lap_time)}
                                          </TableCell>
                                          <TableCell>
                                            {formatTime(timing.total_time)}
                                          </TableCell>
                                          <TableCell>
                                            {formatTime(timing.average_time)}
                                          </TableCell>
                                          <TableCell>{timing.laps}</TableCell>
                                        </>
                                      )}
                                    </TableRow>
                                  );
                                }
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-sm">
                          Sin tiempos registrados
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="aggregated" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                <h6 className="font-semibold mb-3 flex items-center gap-2">
                  <Trophy className="size-4" />
                  Clasificación General
                </h6>
                {aggregatedTimes.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Pos</TableHead>
                          <TableHead>Piloto</TableHead>
                          <TableHead>Vehículo</TableHead>
                          <TableHead>Mejor Vuelta</TableHead>
                          <TableHead>Tiempo Total</TableHead>
                          <TableHead>Dif. Líder</TableHead>
                          <TableHead>Dif. Anterior</TableHead>
                          <TableHead>Rondas</TableHead>
                          <TableHead>Vueltas</TableHead>
                          <TableHead>Puntos</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {aggregatedTimes.map((data, index) => {
                          const leaderDiff =
                            index === 0
                              ? '-'
                              : formatTimeDiff(
                                  data.total_time_seconds -
                                    aggregatedTimes[0].total_time_seconds
                                );

                          const previousDiff =
                            index === 0
                              ? '-'
                              : formatTimeDiff(
                                  data.total_time_seconds -
                                    aggregatedTimes[index - 1].total_time_seconds
                                );

                          const base =
                            data.total_time_seconds - data.penalty_seconds;
                          const penalty = data.penalty_seconds;
                          const adjusted = data.total_time_seconds;
                          const penaltyTooltip = `Original: ${secondsToTimeString(base)} + ${penalty.toFixed(3)}s penalización`;

                          return (
                            <TableRow key={data.id}>
                              <TableCell>
                                <Badge
                                  variant="secondary"
                                  className={
                                    data.position === 1
                                      ? 'bg-green-600 hover:bg-green-600'
                                      : data.position === 2
                                        ? 'bg-amber-500 hover:bg-amber-500'
                                        : data.position === 3
                                          ? 'bg-blue-600 hover:bg-blue-600'
                                          : ''
                                  }
                                >
                                  {data.position}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-bold">
                                {getParticipantName(data.participant_id)}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {getVehicleInfo(data.participant_id)}
                              </TableCell>
                              <TableCell className="text-amber-600 font-bold">
                                {isUsableBestLapTimeString(data.best_lap_time)
                                  ? formatTime(data.best_lap_time)
                                  : '—'}
                              </TableCell>
                              <TableCell className="font-bold">
                                {penalty > 0 ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="cursor-pointer">
                                        {secondsToTimeString(adjusted)}{' '}
                                        <AlertTriangle
                                          className="inline size-3.5 align-middle text-amber-600"
                                          aria-hidden
                                        />
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {penaltyTooltip}
                                    </TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <span>
                                    {secondsToTimeString(adjusted)}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="difference-column difference-leader">
                                {leaderDiff}
                              </TableCell>
                              <TableCell className="difference-column difference-previous">
                                {previousDiff}
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="bg-blue-600/20 text-blue-800 dark:text-blue-200">
                                  {data.rounds_completed - data.rounds_dnp}/
                                  {competition?.rounds || 0}
                                </Badge>
                              </TableCell>
                              <TableCell>{data.total_laps}</TableCell>
                              <TableCell>
                                {pointsByParticipant[data.participant_id] ?? 0}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">
                      No hay tiempos registrados para mostrar clasificación
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Modal para añadir/editar tiempo */}
        <Dialog open={showModal} onOpenChange={(open) => !open && handleCloseModal()}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingTiming ? 'Editar Tiempo' : 'Registrar Nuevo Tiempo'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                {!editingTiming &&
                  !(formData.round_number && formData.participant_id) && (
                  <Alert className="border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100">
                    <AlertDescription>
                      <strong>Consejo:</strong> Selecciona primero la ronda y
                      luego el participante. Solo se mostrarán los participantes
                      que aún no tienen tiempo registrado para esa ronda.
                    </AlertDescription>
                  </Alert>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="round_number">Ronda *</Label>
                    <Select
                      value={formData.round_number ? String(formData.round_number) : undefined}
                      onValueChange={(value) =>
                        setFormData({
                          ...formData,
                          round_number: value,
                          participant_id: '',
                        })
                      }
                    >
                      <SelectTrigger id="round_number">
                        <SelectValue placeholder="Seleccionar ronda" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from(
                          { length: competition?.rounds || 0 },
                          (_, i) => i + 1
                        ).map((round) => (
                          <SelectItem key={round} value={String(round)}>
                            Ronda {round}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="participant_id">Participante *</Label>
                    {(() => {
                      const available = formData.round_number
                        ? getAvailableParticipantsForRound(formData.round_number)
                        : participants;
                      // Al editar, incluir el piloto actual aunque ya tenga tiempo
                      // registrado para esa ronda.
                      let selectable = available;
                      if (editingTiming) {
                        const current = participantsMap[editingTiming.participant_id];
                        if (
                          current &&
                          !available.some((p) => p.id === current.id)
                        ) {
                          selectable = [current, ...available];
                        }
                      }
                      return (
                        <>
                          <Select
                            value={
                              formData.participant_id
                                ? String(formData.participant_id)
                                : undefined
                            }
                            onValueChange={(value) =>
                              setFormData({ ...formData, participant_id: value })
                            }
                            disabled={!formData.round_number || Boolean(editingTiming)}
                          >
                            <SelectTrigger id="participant_id">
                              <SelectValue
                                placeholder={
                                  !formData.round_number
                                    ? 'Selecciona primero una ronda'
                                    : 'Seleccionar participante'
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {selectable.map((participant) => (
                                <SelectItem
                                  key={participant.id}
                                  value={String(participant.id)}
                                >
                                  {participant.driver_name} -{' '}
                                  {getVehicleInfo(participant.id)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {!editingTiming &&
                            formData.round_number &&
                            available.length === 0 && (
                              <p className="text-sm text-amber-600">
                                Todos los participantes ya tienen tiempo
                                registrado para esta ronda
                              </p>
                            )}
                        </>
                      );
                    })()}
                  </div>

                  <div className="sm:col-span-2 flex items-center justify-between rounded-md border bg-muted/40 p-3">
                    <div>
                      <Label htmlFor="did_not_participate" className="font-medium">
                        No participó en esta ronda (NP)
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        El piloto recibirá 0 puntos en esta ronda y sus tiempos no contarán para la clasificación general.
                      </p>
                    </div>
                    <Switch
                      id="did_not_participate"
                      checked={formData.did_not_participate}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          did_not_participate: checked,
                          ...(checked && {
                            best_lap_time: '',
                            total_time: '',
                            laps: '',
                            average_time: '',
                            lane: '',
                            circuit_id: '',
                          }),
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="best_lap_time">Mejor Vuelta {!formData.did_not_participate && '*'}</Label>
                    <Input
                      id="best_lap_time"
                      type="text"
                      value={formData.best_lap_time}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          best_lap_time: e.target.value,
                        })
                      }
                      placeholder="00:00.000"
                      required={!formData.did_not_participate}
                      disabled={formData.did_not_participate}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="total_time">Tiempo Total {!formData.did_not_participate && '*'}</Label>
                    <Input
                      id="total_time"
                      type="text"
                      value={formData.total_time}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          total_time: e.target.value,
                        })
                      }
                      placeholder="00:00.000"
                      required={!formData.did_not_participate}
                      disabled={formData.did_not_participate}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="laps">Número de Vueltas {!formData.did_not_participate && '*'}</Label>
                    <Input
                      id="laps"
                      type="number"
                      value={formData.laps}
                      onChange={(e) =>
                        setFormData({ ...formData, laps: e.target.value })
                      }
                      required={!formData.did_not_participate}
                      disabled={formData.did_not_participate}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="average_time">Tiempo promedio (calculado)</Label>
                    <Input
                      id="average_time"
                      type="text"
                      readOnly
                      value={formData.average_time}
                      placeholder="00:00.000"
                      className="bg-muted"
                      disabled={formData.did_not_participate}
                    />
                    <p className="text-xs text-muted-foreground">
                      Tiempo total dividido entre el número de vueltas. Se guarda automáticamente al registrar.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lane">Carril</Label>
                    <Input
                      id="lane"
                      type="text"
                      value={formData.lane}
                      onChange={(e) =>
                        setFormData({ ...formData, lane: e.target.value })
                      }
                      disabled={formData.did_not_participate}
                    />
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="circuit_id">Circuito</Label>
                    <Select
                      value={formData.circuit_id || 'none'}
                      onValueChange={(v) =>
                        setFormData({ ...formData, circuit_id: v === 'none' ? '' : v })
                      }
                      disabled={formData.did_not_participate}
                    >
                      <SelectTrigger id="circuit_id">
                        <SelectValue placeholder="Seleccionar circuito (opcional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Ninguno</SelectItem>
                        {circuits.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseModal}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={
                    !formData.round_number ||
                    !formData.participant_id ||
                    isCompetitionComplete()
                  }
                >
                  {isCompetitionComplete()
                    ? 'Competición Completada'
                    : formData.did_not_participate
                      ? editingTiming
                        ? 'Guardar NP'
                        : 'Registrar NP'
                      : editingTiming
                        ? 'Guardar Tiempo'
                        : 'Registrar Tiempo'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modal para editar penalización */}
        <Dialog
          open={showPenaltyModal}
          onOpenChange={(open) => !open && handleClosePenaltyModal()}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Penalización</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="penalty">Penalización (segundos)</Label>
                <Input
                  id="penalty"
                  type="number"
                  min="0"
                  step="0.001"
                  value={penaltyValue}
                  onChange={(e) => setPenaltyValue(e.target.value)}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  Introduce los segundos de penalización que se sumarán al tiempo
                  total de este piloto en esta ronda.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={handleClosePenaltyModal}
                disabled={penaltyLoading}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSavePenalty}
                disabled={penaltyLoading}
              >
                {penaltyLoading ? 'Guardando...' : 'Guardar penalización'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
};

export default CompetitionTimings;
