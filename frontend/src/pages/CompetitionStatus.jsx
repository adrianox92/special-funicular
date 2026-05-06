import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Trophy,
  Users,
  Flag,
  Clock,
  Check,
  Tv,
  Star,
  Route,
  AlertTriangle,
  FileSpreadsheet,
  FileText,
  Table2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import axios from '../lib/axios';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Spinner } from '../components/ui/spinner';
import { formatTimeDiff } from '../utils/formatTimeDiff';
import {
  buildRoundLeaderboard,
  ROUND_TIME_PLACEHOLDER,
  timingAdjustedSeconds,
  usableBestLapSeconds,
} from '../utils/competitionRoundStandings';
import { toast } from 'sonner';

async function toastBlobError(err, fallback) {
  try {
    const data = err.response?.data;
    if (data instanceof Blob) {
      const t = await data.text();
      const j = JSON.parse(t);
      if (j?.error && typeof j.error === 'string') {
        toast.error(j.error);
        return;
      }
    }
  } catch (_) {}
  toast.error(err.response?.data?.error || fallback);
}

const CompetitionStatus = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [competitionData, setCompetitionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [roundDetail, setRoundDetail] = useState(null);
  const [rules, setRules] = useState([]);
  const [selectedRound, setSelectedRound] = useState(1);
  const [showGeneralExtraColumns, setShowGeneralExtraColumns] = useState(false);
  const [participantDetailsOpen, setParticipantDetailsOpen] = useState(false);

  useEffect(() => {
    loadCompetitionStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useEffect(() => {
    setSelectedRound(1);
  }, [slug]);

  useEffect(() => {
    const max = competitionData?.competition?.rounds;
    if (typeof max === 'number' && max >= 1 && selectedRound > max) {
      setSelectedRound(max);
    }
  }, [competitionData?.competition?.rounds, selectedRound]);

  const roundBoard = useMemo(() => {
    if (!competitionData?.participants) {
      return { isComplete: true, leaderAdjustedSeconds: null, rows: [] };
    }
    return buildRoundLeaderboard(competitionData.participants, selectedRound);
  }, [competitionData, selectedRound]);

  const loadCompetitionStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`/public-signup/${slug}/status`);
      setCompetitionData(response.data);
      const rulesResponse = await axios.get(`/public-signup/${slug}/rules`);
      setRules(rulesResponse.data);
    } catch (err) {
      console.error('Error al cargar el estado:', err);
      setError(err.response?.data?.error || 'Error al cargar los datos de la competición');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (time) => time || '-';
  const formatDate = (dateString) =>
    new Date(dateString).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });

  const timeStringToSeconds = (str) => {
    if (!str) return 0;
    const match = str.match(/^(\d{2}):(\d{2})\.(\d{3})$/);
    if (!match) return 0;
    const [, min, sec, ms] = match.map(Number);
    return min * 60 + sec + ms / 1000;
  };

  const secondsToTimeString = (seconds) => {
    if (typeof seconds !== 'number' || isNaN(seconds)) return '00:00.000';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = (seconds % 60).toFixed(3);
    return `${String(minutes).padStart(2, '0')}:${remainingSeconds.padStart(6, '0')}`;
  };

  const getPositionVariant = (position) => {
    if (position === 1) return 'default';
    if (position === 2) return 'secondary';
    if (position === 3) return 'outline';
    return 'secondary';
  };

  const handlePresentationMode = () => navigate(`/competitions/presentation/${slug}`);

  const triggerBlobDownload = (data, filename) => {
    const blob = data instanceof Blob ? data : new Blob([data]);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleExportCsv = async () => {
    try {
      const response = await axios.get(`/public-signup/${slug}/export/csv`, { responseType: 'blob' });
      const name =
        competitionData?.competition?.name?.replace(/[^a-zA-Z0-9]/g, '_') ||
        slug ||
        'competicion';
      triggerBlobDownload(response.data, `competicion_${name}_${new Date().toISOString().split('T')[0]}.csv`);
    } catch (err) {
      console.error(err);
      await toastBlobError(err, 'Error al exportar CSV');
    }
  };

  const handleExportPdf = async () => {
    try {
      const response = await axios.get(`/public-signup/${slug}/export/pdf`, { responseType: 'blob' });
      const name =
        competitionData?.competition?.name?.replace(/[^a-zA-Z0-9]/g, '_') ||
        slug ||
        'competicion';
      triggerBlobDownload(response.data, `competicion_${name}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error(err);
      await toastBlobError(err, 'Error al exportar PDF');
    }
  };

  const handleExportXlsx = async () => {
    try {
      const response = await axios.get(`/public-signup/${slug}/export/xlsx`, { responseType: 'blob' });
      const name =
        competitionData?.competition?.name?.replace(/[^a-zA-Z0-9]/g, '_') ||
        slug ||
        'competicion';
      triggerBlobDownload(response.data, `competicion_${name}_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) {
      console.error(err);
      await toastBlobError(err, 'Error al exportar Excel');
    }
  };

  const roundTotalAdjustedSeconds = (timing) => {
    const base = timeStringToSeconds(timing.total_time);
    const penalty = Number(timing.penalty_seconds) || 0;
    return base + penalty;
  };

  const roundChipLabel = (timing) => {
    if (timing.did_not_participate) return 'NP';
    const penalty = Number(timing.penalty_seconds) || 0;
    if (penalty > 0) {
      return secondsToTimeString(roundTotalAdjustedSeconds(timing));
    }
    return timing.total_time || '-';
  };

  const roundPenaltyTitle = (timing) => {
    const penalty = Number(timing.penalty_seconds) || 0;
    if (penalty <= 0) return undefined;
    return `Original: ${timing.total_time} + ${penalty.toFixed(3)}s penalización`;
  };

  const renderGeneralTotalCell = (participant) => {
    const totalTimeSeconds = timeStringToSeconds(participant.total_time);
    const penalty = Number(participant.penalty_seconds) || 0;
    if (penalty > 0) {
      return (
        <span title={`Original: ${secondsToTimeString(totalTimeSeconds)}`} className="cursor-help tabular-nums">
          {participant.total_time}{' '}
          <AlertTriangle className="inline size-3.5 align-middle text-amber-600" aria-hidden />
        </span>
      );
    }
    return <span className="tabular-nums">{participant.total_time || '—'}</span>;
  };

  const formatBestLapFromSeconds = (sec) => {
    if (sec == null || !Number.isFinite(sec) || sec <= 0) return '—';
    const minutes = Math.floor(sec / 60);
    const seconds = Math.floor(sec % 60);
    const ms = Math.round((sec - Math.floor(sec)) * 1000);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
  };

  /** Mejor vuelta de una fila de ronda (solo carrera efectiva). */
  const roundRowBestLapDisplay = (timing) => {
    if (!timing) return ROUND_TIME_PLACEHOLDER;
    const s = usableBestLapSeconds(timing.best_lap_time);
    if (s == null) return ROUND_TIME_PLACEHOLDER;
    return formatBestLapFromSeconds(s);
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[50vh] py-12">
        <Spinner className="size-8 mb-4" />
        <p className="text-muted-foreground">Cargando estado de la competición...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!competitionData) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Competición no encontrada</AlertDescription>
      </Alert>
    );
  }

  const { competition, status, participants, global_best_lap } = competitionData;
  const isCompleted = status.is_completed;

  return (
    <div className="space-y-6 py-6">
      <Card className="competition-status-header overflow-hidden">
        <CardContent className="pt-6 pb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="text-center md:text-left">
              <h1 className="text-2xl md:text-3xl font-bold mb-3">{competition.name}</h1>
              <div className="flex flex-wrap justify-center md:justify-start gap-2 mb-3">
                <Badge variant={isCompleted ? 'secondary' : 'default'} className="text-sm px-3 py-1">
                  {isCompleted ? (
                    <>
                      <Check className="size-4 mr-1" /> Finalizada
                    </>
                  ) : (
                    <>
                      <Clock className="size-4 mr-1" /> En Curso
                    </>
                  )}
                </Badge>
                {competition.circuit_name && (
                  <Badge variant="secondary" className="text-sm px-3 py-1">
                    <Route className="size-4 mr-1" />
                    {competition.circuit_name}
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground text-sm">Creada el {formatDate(competition.created_at)}</p>
            </div>
            <div className="flex justify-center">
              <div className="text-center">
                <Trophy className="size-12 text-primary mb-2" />
                <p className="text-sm font-medium">Competición Pública</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="summary" className="w-full">
        <TabsList className="grid w-full max-w-xl grid-cols-3">
          <TabsTrigger value="summary">Resumen</TabsTrigger>
          <TabsTrigger value="general">Clasificación general</TabsTrigger>
          <TabsTrigger value="round">Por ronda</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-6 mt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Users, label: 'Participantes', value: status.participants_count },
              { icon: Flag, label: 'Rondas', value: competition.rounds },
              { icon: Clock, label: 'Tiempos', value: status.times_registered },
              { icon: Star, label: 'Progreso', value: `${status.progress_percentage}%` },
            ].map(({ icon: Icon, label, value }) => (
              <Card key={label} className="text-center">
                <CardContent className="pt-6">
                  <Icon className="size-8 mx-auto mb-2 text-primary" />
                  <h4 className="text-2xl font-bold">{value}</h4>
                  <p className="text-sm text-muted-foreground">{label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardContent className="pt-6">
              <div className="flex justify-between items-center mb-2">
                <h5 className="font-semibold">Progreso de la Competición</h5>
                <span className="text-muted-foreground text-sm">
                  {status.times_registered} de {status.total_required_times} tiempos
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${isCompleted ? 'bg-green-500' : 'bg-primary'}`}
                  style={{ width: `${status.progress_percentage}%` }}
                />
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {isCompleted ? '¡Competición completada!' : `${status.times_remaining} tiempos restantes`}
              </p>
            </CardContent>
          </Card>

          {global_best_lap && (
            <Card className="global-best-lap">
              <CardContent className="pt-6 text-center">
                <Trophy className="size-10 mx-auto mb-2 text-primary" />
                <h4 className="font-semibold mb-2">Mejor Vuelta Global</h4>
                <div className="text-2xl font-bold text-primary mb-2">{formatTime(global_best_lap.time)}</div>
                <p className="text-muted-foreground">
                  Por <strong>{global_best_lap.driver}</strong>
                </p>
              </CardContent>
            </Card>
          )}

          <div className="rounded-lg border bg-card">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 p-4 text-left font-semibold hover:bg-muted/60 transition-colors"
              onClick={() => setParticipantDetailsOpen((v) => !v)}
              aria-expanded={participantDetailsOpen}
            >
              <span className="flex items-center gap-2">
                <Users className="size-5 shrink-0" />
                Participantes y vueltas por ronda
              </span>
              {participantDetailsOpen ? (
                <ChevronDown className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              ) : (
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              )}
            </button>
            {participantDetailsOpen && participants.length > 0 && (
              <div className="border-t px-4 pb-4 pt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {participants.map((participant) => {
                    const totalTimeSeconds = timeStringToSeconds(participant.total_time);
                    const penalty = Number(participant.penalty_seconds) || 0;
                    const progress = (participant.rounds_completed / competition.rounds) * 100;
                    return (
                      <Card key={participant.participant_id} className="participant-detail-card">
                        <CardContent className="pt-4">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h6 className="font-semibold">{participant.driver_name}</h6>
                              <p className="text-sm text-muted-foreground">{participant.vehicle_info}</p>
                            </div>
                            <Badge variant={getPositionVariant(participant.position)}>{participant.position}º</Badge>
                          </div>
                          <div className="mb-3">
                            <div className="flex justify-between text-sm text-muted-foreground mb-1">
                              <span>Progreso:</span>
                              <span>
                                {participant.rounds_completed}/{competition.rounds}
                              </span>
                            </div>
                            <div className="h-2 rounded-full bg-muted overflow-hidden">
                              <div
                                className={`h-full rounded-full ${participant.rounds_completed >= competition.rounds ? 'bg-green-500' : 'bg-primary'}`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-center">
                            <div>
                              <div className="font-semibold text-primary">{formatTime(participant.best_lap_time)}</div>
                              <small className="text-muted-foreground">Mejor Vuelta</small>
                            </div>
                            <div>
                              <div className="font-semibold">
                                {penalty > 0 ? (
                                  <span
                                    title={`Original: ${secondsToTimeString(totalTimeSeconds)}`}
                                    className="cursor-help"
                                  >
                                    {participant.total_time}{' '}
                                    <AlertTriangle className="inline size-3.5 align-middle text-amber-600" aria-hidden />
                                  </span>
                                ) : (
                                  participant.total_time
                                )}
                              </div>
                              <small className="text-muted-foreground">Total</small>
                            </div>
                          </div>
                          {participant.timings?.length > 0 && (
                            <div className="mt-3">
                              <small className="text-muted-foreground block mb-2">Tiempos por ronda:</small>
                              <div className="grid grid-cols-2 gap-2">
                                {participant.timings.map((timing) => (
                                  <button
                                    key={timing.id}
                                    type="button"
                                    className="round-timing-chip rounded border border-border bg-muted/40 p-2 text-center transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    onClick={() =>
                                      setRoundDetail({ driverName: participant.driver_name, timing })
                                    }
                                    aria-label={`Ver detalle ronda ${timing.round_number}, ${participant.driver_name}`}
                                  >
                                    <small className="font-semibold block">R{timing.round_number}</small>
                                    <small className="text-muted-foreground">
                                      {timing.did_not_participate ? (
                                        <span className="text-muted-foreground">NP</span>
                                      ) : Number(timing.penalty_seconds) > 0 ? (
                                        <span title={roundPenaltyTitle(timing)} className="cursor-help">
                                          {roundChipLabel(timing)}{' '}
                                          <AlertTriangle className="inline size-3.5 align-middle text-amber-600" aria-hidden />
                                        </span>
                                      ) : (
                                        roundChipLabel(timing)
                                      )}
                                    </small>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {competitionData.best_time_ties_message && (
            <Alert variant="destructive">
              <AlertDescription>
                {competitionData.best_time_ties_message}
                {competitionData.best_time_ties?.length > 0 && (
                  <ul className="mt-2 list-disc list-inside">
                    {competitionData.best_time_ties.map((tie) => (
                      <li key={tie.round}>
                        Ronda {tie.round}: tiempo {tie.time}
                      </li>
                    ))}
                  </ul>
                )}
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="general" className="space-y-4 mt-6">
          <Card>
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h5 className="font-semibold flex items-center gap-2">
                <Trophy className="size-5" />
                Clasificación general
              </h5>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={handlePresentationMode}>
                  <Tv className="size-4 mr-1" />
                  Modo Presentación
                </Button>
                {isCompleted && (
                  <>
                    <Button variant="outline" size="sm" onClick={handleExportCsv}>
                      <FileSpreadsheet className="size-4 mr-1" />
                      CSV
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExportPdf}>
                      <FileText className="size-4 mr-1" />
                      PDF
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExportXlsx}>
                      <Table2 className="size-4 mr-1" />
                      Excel
                    </Button>
                  </>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={showGeneralExtraColumns ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setShowGeneralExtraColumns((v) => !v)}
                >
                  {showGeneralExtraColumns ? 'Ocultar columnas extra' : 'Ver más columnas'}
                </Button>
              </div>
              {participants.length > 0 ? (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pos.</TableHead>
                        <TableHead>Piloto</TableHead>
                        <TableHead>Vehículo</TableHead>
                        <TableHead className="tabular-nums">Rondas</TableHead>
                        <TableHead className="tabular-nums">Tiempo total</TableHead>
                        {rules.length > 0 && <TableHead className="tabular-nums">Puntos</TableHead>}
                        {showGeneralExtraColumns && (
                          <>
                            <TableHead className="tabular-nums">Mejor vuelta</TableHead>
                            <TableHead className="tabular-nums">Dif. líder</TableHead>
                            <TableHead className="tabular-nums">Dif. anterior</TableHead>
                          </>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {participants.map((participant, idx) => {
                        const totalTimeSeconds = timeStringToSeconds(participant.total_time);
                        let leaderDiff = '-';
                        let previousDiff = '-';
                        if (idx > 0 && participants[0].total_time) {
                          leaderDiff = formatTimeDiff(
                            totalTimeSeconds - timeStringToSeconds(participants[0].total_time)
                          );
                        }
                        if (idx > 0 && participants[idx - 1].total_time) {
                          previousDiff = formatTimeDiff(
                            totalTimeSeconds - timeStringToSeconds(participants[idx - 1].total_time)
                          );
                        }
                        const top3Style =
                          participant.position <= 3
                            ? 'bg-muted/30 border-l-2 border-l-primary/60'
                            : '';

                        return (
                          <TableRow key={participant.participant_id} className={top3Style}>
                            <TableCell>
                              <Badge variant={getPositionVariant(participant.position)}>{participant.position}</Badge>
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{participant.driver_name}</div>
                                {participant.team_name ? (
                                  <div className="text-muted-foreground text-sm">{participant.team_name}</div>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell className="max-w-[220px]">{participant.vehicle_info}</TableCell>
                            <TableCell className="tabular-nums text-muted-foreground">
                              {participant.rounds_completed}/{competition.rounds}
                            </TableCell>
                            <TableCell>{renderGeneralTotalCell(participant)}</TableCell>
                            {rules.length > 0 && (
                              <TableCell className="tabular-nums font-medium">{participant.points || 0}</TableCell>
                            )}
                            {showGeneralExtraColumns && (
                              <>
                                <TableCell className="tabular-nums">{formatTime(participant.best_lap_time)}</TableCell>
                                <TableCell className="tabular-nums">{leaderDiff}</TableCell>
                                <TableCell className="tabular-nums">{previousDiff}</TableCell>
                              </>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No hay participantes registrados</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="round" className="space-y-4 mt-6">
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h5 className="font-semibold flex items-center gap-2 mb-2">
                  <Flag className="size-5" />
                  Clasificación por ronda
                </h5>
                <label htmlFor="round-select" className="sr-only">
                  Seleccionar ronda
                </label>
                <select
                  id="round-select"
                  className="flex h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={selectedRound}
                  onChange={(e) => setSelectedRound(Number(e.target.value))}
                >
                  {Array.from({ length: competition.rounds }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      Ronda {n}
                    </option>
                  ))}
                </select>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!roundBoard.isComplete && (
                <Alert>
                  <AlertDescription>
                    Esta ronda aún no está completa: faltan registros de tiempo de algunos participantes. La tabla
                    siguiente es provisional.
                  </AlertDescription>
                </Alert>
              )}
              {participants.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No hay participantes registrados</p>
              ) : roundBoard.rows.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No hay datos para esta ronda.</p>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Pos.</TableHead>
                        <TableHead>Piloto</TableHead>
                        <TableHead className="tabular-nums">Total</TableHead>
                        <TableHead className="tabular-nums">Dif.</TableHead>
                        <TableHead className="tabular-nums">Mejor vuelta</TableHead>
                        <TableHead className="tabular-nums text-right">Vueltas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {roundBoard.rows.map((row) => {
                        const top3 =
                          row.kind === 'raced' && row.position <= 3
                            ? 'bg-muted/30 border-l-2 border-l-primary/60'
                            : '';

                        let posDisplay;
                        if (row.kind === 'raced') {
                          posDisplay = <Badge variant={getPositionVariant(row.position)}>{row.position}</Badge>;
                        } else if (row.kind === 'np') {
                          posDisplay = (
                            <Badge variant="secondary" className="font-normal">
                              NP
                            </Badge>
                          );
                        } else {
                          posDisplay = <span className="text-muted-foreground">—</span>;
                        }

                        let totalCell;
                        let difCell = <span className="text-muted-foreground">—</span>;
                        let lapsCell = '—';

                        if (row.kind === 'missing') {
                          totalCell = (
                            <span className="text-muted-foreground tabular-nums">{ROUND_TIME_PLACEHOLDER}</span>
                          );
                        } else if (row.kind === 'np') {
                          totalCell = (
                            <span className="text-muted-foreground tabular-nums">{ROUND_TIME_PLACEHOLDER}</span>
                          );
                        } else {
                          const t = row.timing;
                          const penalty = Number(t?.penalty_seconds) || 0;
                          const adjSec = timingAdjustedSeconds(t);
                          totalCell =
                            penalty > 0 ? (
                              <span
                                title={`Original: ${t.total_time} + ${penalty.toFixed(3)}s penalización`}
                                className="cursor-help tabular-nums inline-flex items-center gap-1"
                              >
                                {secondsToTimeString(adjSec)}
                                <AlertTriangle className="size-3.5 shrink-0 text-amber-600" aria-hidden />
                              </span>
                            ) : (
                              <span className="tabular-nums">{t?.total_time || '—'}</span>
                            );
                          if (row.position === 1) {
                            difCell = <span className="tabular-nums">—</span>;
                          } else if (row.leaderGapSeconds != null && Number.isFinite(row.leaderGapSeconds)) {
                            difCell = (
                              <span className="tabular-nums">{formatTimeDiff(row.leaderGapSeconds)}</span>
                            );
                          }
                          lapsCell = row.timing?.laps ?? '—';
                        }

                        const bestDisp =
                          row.kind === 'raced' ? roundRowBestLapDisplay(row.timing) : ROUND_TIME_PLACEHOLDER;

                        return (
                          <TableRow key={row.participant.participant_id + String(row.kind)} className={top3}>
                            <TableCell>{posDisplay}</TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{row.participant.driver_name}</div>
                                {row.participant.team_name ? (
                                  <div className="text-muted-foreground text-sm">{row.participant.team_name}</div>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell>{totalCell}</TableCell>
                            <TableCell>{difCell}</TableCell>
                            <TableCell className="tabular-nums">{bestDisp}</TableCell>
                            <TableCell className="tabular-nums text-right">{lapsCell}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!roundDetail} onOpenChange={(open) => !open && setRoundDetail(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {roundDetail ? `Ronda ${roundDetail.timing.round_number} — ${roundDetail.driverName}` : ''}
            </DialogTitle>
            <DialogDescription className="sr-only">Detalle de tiempos y datos de la ronda seleccionada</DialogDescription>
          </DialogHeader>
          {roundDetail && (
            <div className="space-y-3 text-sm">
              {roundDetail.timing.did_not_participate ? (
                <Badge variant="secondary" className="bg-muted text-muted-foreground">
                  NP — No participó
                </Badge>
              ) : (
                <dl className="grid gap-2">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Mejor vuelta</dt>
                    <dd className="font-medium tabular-nums">{formatTime(roundDetail.timing.best_lap_time)}</dd>
                  </div>
                  {Number(roundDetail.timing.penalty_seconds) > 0 ? (
                    <>
                      <div className="flex justify-between gap-4">
                        <dt className="text-muted-foreground">Tiempo sin penalización</dt>
                        <dd className="font-medium tabular-nums">{formatTime(roundDetail.timing.total_time)}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-muted-foreground">Penalización</dt>
                        <dd className="font-medium tabular-nums text-amber-700 dark:text-amber-500">
                          +{Number(roundDetail.timing.penalty_seconds).toFixed(3)} s
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4 border-t border-border pt-2 mt-1">
                        <dt className="text-muted-foreground font-medium">Tiempo total</dt>
                        <dd className="font-semibold tabular-nums">
                          <span className="inline-flex items-center gap-1">
                            {secondsToTimeString(roundTotalAdjustedSeconds(roundDetail.timing))}
                            <AlertTriangle className="size-3.5 shrink-0 text-amber-600" aria-hidden />
                          </span>
                        </dd>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Tiempo total</dt>
                      <dd className="font-medium tabular-nums">{formatTime(roundDetail.timing.total_time)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Media</dt>
                    <dd className="font-medium tabular-nums">{formatTime(roundDetail.timing.average_time)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Vueltas</dt>
                    <dd className="font-medium">{roundDetail.timing.laps ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Carril</dt>
                    <dd className="font-medium">{roundDetail.timing.lane ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Fecha</dt>
                    <dd className="font-medium">
                      {roundDetail.timing.timing_date ? formatDate(roundDetail.timing.timing_date) : '—'}
                    </dd>
                  </div>
                  {roundDetail.timing.driver ? (
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Piloto (registro)</dt>
                      <dd className="font-medium text-right break-words">{roundDetail.timing.driver}</dd>
                    </div>
                  ) : null}
                  {roundDetail.timing.circuit ? (
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Circuito (registro)</dt>
                      <dd className="font-medium text-right break-words">{roundDetail.timing.circuit}</dd>
                    </div>
                  ) : null}
                </dl>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoundDetail(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CompetitionStatus;
