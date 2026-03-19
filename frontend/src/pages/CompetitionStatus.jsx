import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Trophy, Users, Flag, Clock, Check, Download, Tv, Star, Route, AlertTriangle } from 'lucide-react';
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
import { Spinner } from '../components/ui/spinner';

const CompetitionStatus = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [competitionData, setCompetitionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [rules, setRules] = useState([]);

  useEffect(() => {
    loadCompetitionStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

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
      {/* Header */}
      <Card className="competition-status-header overflow-hidden">
        <CardContent className="pt-6 pb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="text-center md:text-left">
              <h1 className="text-2xl md:text-3xl font-bold mb-3">{competition.name}</h1>
              <div className="flex flex-wrap justify-center md:justify-start gap-2 mb-3">
                <Badge variant={isCompleted ? 'secondary' : 'default'} className="text-sm px-3 py-1">
                  {isCompleted ? <><Check className="size-4 mr-1" /> Finalizada</> : <><Clock className="size-4 mr-1" /> En Curso</>}
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

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Users, label: 'Participantes', value: status.participants_count },
          { icon: Flag, label: 'Rondas', value: competition.rounds },
          { icon: Clock, label: 'Tiempos', value: status.times_registered },
          { icon: Star, label: 'Progreso', value: `${status.progress_percentage}%` }
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

      {/* Progress bar */}
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

      {/* Global best lap */}
      {global_best_lap && (
        <Card className="global-best-lap">
          <CardContent className="pt-6 text-center">
            <Trophy className="size-10 mx-auto mb-2 text-primary" />
            <h4 className="font-semibold mb-2">Mejor Vuelta Global</h4>
            <div className="text-2xl font-bold text-primary mb-2">{formatTime(global_best_lap.time)}</div>
            <p className="text-muted-foreground">Por <strong>{global_best_lap.driver}</strong></p>
          </CardContent>
        </Card>
      )}

      {/* Ranking */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <h5 className="font-semibold flex items-center gap-2">
            <Trophy className="size-5" />
            Clasificación General
          </h5>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePresentationMode}>
              <Tv className="size-4 mr-1" />
              Modo Presentación
            </Button>
            {isCompleted && (
              <Button variant="outline" size="sm" onClick={() => setShowPdfModal(true)}>
                <Download className="size-4 mr-1" />
                Exportar PDF
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {participants.length > 0 ? (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Piloto</TableHead>
                    <TableHead>Vehículo</TableHead>
                    <TableHead>Rondas</TableHead>
                    <TableHead>Mejor vuelta</TableHead>
                    <TableHead>Tiempo total</TableHead>
                    <TableHead>Dif. Líder</TableHead>
                    <TableHead>Dif. Anterior</TableHead>
                    {rules.length > 0 && <TableHead>Puntos</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {participants.map((participant, idx) => {
                    const totalTimeSeconds = timeStringToSeconds(participant.total_time);
                    const penalty = Number(participant.penalty_seconds) || 0;
                    let leaderDiff = '-';
                    let previousDiff = '-';
                    if (idx > 0 && participants[0].total_time) {
                      const diff = totalTimeSeconds - timeStringToSeconds(participants[0].total_time);
                      const m = Math.floor(diff / 60);
                      const s = (diff % 60).toFixed(3);
                      leaderDiff = m > 0 ? `+${m}:${s.padStart(6, '0')}` : `+${s}`;
                    }
                    if (idx > 0 && participants[idx - 1].total_time) {
                      const diff = totalTimeSeconds - timeStringToSeconds(participants[idx - 1].total_time);
                      const m = Math.floor(diff / 60);
                      const s = (diff % 60).toFixed(3);
                      previousDiff = m > 0 ? `+${m}:${s.padStart(6, '0')}` : `+${s}`;
                    }
                    return (
                      <TableRow key={participant.participant_id}>
                        <TableCell><Badge variant={getPositionVariant(participant.position)}>{participant.position}</Badge></TableCell>
                        <TableCell>{participant.driver_name}</TableCell>
                        <TableCell>{participant.vehicle_info}</TableCell>
                        <TableCell>{participant.rounds_completed}</TableCell>
                        <TableCell className="font-medium">{formatTime(participant.best_lap_time)}</TableCell>
                        <TableCell>
                          {penalty > 0 ? (
                            <span title={`Original: ${secondsToTimeString(totalTimeSeconds)}`} className="cursor-help">
                              {participant.total_time}{' '}
                              <AlertTriangle className="inline size-3.5 align-middle text-amber-600" aria-hidden />
                            </span>
                          ) : (
                            participant.total_time
                          )}
                        </TableCell>
                        <TableCell>{leaderDiff}</TableCell>
                        <TableCell>{previousDiff}</TableCell>
                        {rules.length > 0 && <TableCell>{participant.points || 0}</TableCell>}
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

      {/* Participant details */}
      {participants.length > 0 && (
        <Card>
          <CardHeader>
            <h5 className="font-semibold flex items-center gap-2">
              <Users className="size-5" />
              Detalles por Participante
            </h5>
          </CardHeader>
          <CardContent>
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
                          <span>{participant.rounds_completed}/{competition.rounds}</span>
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
                              <span title={`Original: ${secondsToTimeString(totalTimeSeconds)}`} className="cursor-help">
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
                              <div key={timing.id} className="round-timing-chip rounded p-2 text-center">
                                <small className="font-semibold block">R{timing.round_number}</small>
                                <small className="text-muted-foreground">
                                  {Number(timing.penalty_seconds) > 0 ? (
                                    <span title={`Original: ${secondsToTimeString(timeStringToSeconds(timing.total_time))}`} className="cursor-help">
                                      {timing.total_time}{' '}
                                      <AlertTriangle className="inline size-3.5 align-middle text-amber-600" aria-hidden />
                                    </span>
                                  ) : (
                                    timing.total_time
                                  )}
                                </small>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {competitionData.best_time_ties_message && (
        <Alert variant="destructive">
          <AlertDescription>
            {competitionData.best_time_ties_message}
            {competitionData.best_time_ties?.length > 0 && (
              <ul className="mt-2 list-disc list-inside">
                {competitionData.best_time_ties.map(tie => (
                  <li key={tie.round}>Ronda {tie.round}: tiempo {tie.time}</li>
                ))}
              </ul>
            )}
          </AlertDescription>
        </Alert>
      )}

      <Dialog open={showPdfModal} onOpenChange={setShowPdfModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exportar Resultados</DialogTitle>
            <DialogDescription>
              Funcionalidad de exportación PDF en desarrollo. Permitirá descargar un reporte completo de la competición.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPdfModal(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CompetitionStatus;
