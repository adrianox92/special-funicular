import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, Wrench, GitCompare, BarChart3 } from 'lucide-react';
import api from '../lib/axios';
import TimingSpecsModal from './TimingSpecsModal';
import SessionComparisonModal from './SessionComparisonModal';
import SessionPerformanceModal from './SessionPerformanceModal';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { Spinner } from './ui/spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { Card, CardContent } from './ui/card';
import './TimingsList.css';
import { formatDistance } from '../utils/formatUtils';

/** Vista móvil: una tarjeta por grupo (misma agrupación que la tabla desktop). */
function TimingMobileGroupCard({
  group,
  expandedGroups,
  toggleGroup,
  getLaneBadgeVariant,
  setSelectedTiming,
  setShowSpecsModal,
  setPerformanceTiming,
  setShowPerformanceModal,
  setComparisonSessions,
  setShowComparisonModal,
  getSeconds,
  getTotalSeconds,
}) {
  const expanded = expandedGroups.has(group.key);
  return (
    <Card>
      <CardContent className="space-y-3 pt-4">
        <div className="flex items-start gap-2">
          {group.sessions.length > 1 ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => toggleGroup(group.key)}
              title={expanded ? 'Ocultar historial' : 'Ver historial'}
            >
              {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            </Button>
          ) : (
            <span className="w-8 shrink-0" aria-hidden />
          )}
          <div className="min-w-0 flex-1 space-y-1">
            <Link to={`/vehicles/${group.vehicle_id}`} className="text-primary hover:underline font-medium break-words">
              {group.vehicle_manufacturer} {group.vehicle_model}
            </Link>
            <p className="text-sm text-muted-foreground break-words">{group.circuit}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={getLaneBadgeVariant(group.lane)}>Carril {group.lane}</Badge>
              <Badge variant="secondary">{group.best_time.laps || 'N/A'} vueltas</Badge>
              {group.circuit_ranking ? (
                <Badge variant={group.circuit_ranking.position === 1 ? 'default' : 'secondary'}>
                  P{group.circuit_ranking.position}
                </Badge>
              ) : null}
              <Badge>{group.total_sessions} ses.</Badge>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground block text-xs">Distancia</span>
            {formatDistance(group.best_time.total_distance_meters)}
          </div>
          <div>
            <span className="text-muted-foreground block text-xs">Velocidad</span>
            {group.best_time.avg_speed_kmh != null && group.best_time.avg_speed_scale_kmh != null
              ? `${Number(group.best_time.avg_speed_kmh).toFixed(1)} km/h (${Number(group.best_time.avg_speed_scale_kmh).toFixed(0)} eq.)`
              : '—'}
          </div>
          <div>
            <span className="text-muted-foreground block text-xs">Mejor vuelta</span>
            <span className="font-mono font-medium">{group.best_time.best_lap_time}</span>
            {group.circuit_ranking && group.circuit_ranking.position > 1 && (
              <div className="mt-1 text-xs text-muted-foreground">
                <span className="text-destructive">+{group.circuit_ranking.gap_to_leader}s líder</span>
                <br />
                <span className="text-amber-600">+{group.circuit_ranking.gap_to_previous}s ant.</span>
              </div>
            )}
          </div>
          <div>
            <span className="text-muted-foreground block text-xs">Total</span>
            <span className="font-mono font-medium">{group.best_time.total_time}</span>
          </div>
          <div className="col-span-2">
            <span className="text-muted-foreground block text-xs">Última sesión</span>
            {new Date(group.last_session.timing_date).toLocaleDateString()}
          </div>
        </div>

        {group.improvement ? (
          <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-2">
            <div>
              <strong className="text-primary">Mejor vuelta:</strong>{' '}
              <span className="text-green-600 font-medium">-{group.improvement.lap_time_diff}s</span>
              <span className="text-muted-foreground"> ({group.improvement.lap_percentage}%)</span>
            </div>
            <div>
              <strong className="text-primary">Mejor total:</strong>{' '}
              <span className="text-green-600 font-medium">-{group.improvement.total_time_diff}s</span>
              <span className="text-muted-foreground"> ({group.improvement.total_percentage}%)</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Primera sesión</p>
        )}

        <div className="flex flex-wrap gap-2">
          {group.best_time.setup_snapshot && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedTiming(group.best_time);
                setShowSpecsModal(true);
              }}
            >
              <Wrench className="size-4 mr-1" />
              Config.
            </Button>
          )}
          {group.best_time?.has_laps && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPerformanceTiming(group.best_time);
                setShowPerformanceModal(true);
              }}
            >
              <BarChart3 className="size-4 mr-1" />
              Rendimiento
            </Button>
          )}
          {group.sessions.length >= 2 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setComparisonSessions(group.sessions);
                setShowComparisonModal(true);
              }}
            >
              <GitCompare className="size-4 mr-1" />
              Comparar
            </Button>
          )}
        </div>

        {expanded && group.sessions.length > 1 && (
          <div className="space-y-2 border-t pt-3">
            <p className="text-xs font-medium text-muted-foreground">Historial de sesiones</p>
            {group.sessions
              .map((s) => ({ ...s, lapSeconds: getSeconds(s.best_lap_time), totalSeconds: getTotalSeconds(s.total_time) }))
              .sort((a, b) => (a.lapSeconds !== b.lapSeconds ? a.lapSeconds - b.lapSeconds : a.totalSeconds - b.totalSeconds))
              .map((session, index) => (
                <div key={`${session.id}-${index}`} className="rounded-md border p-3 text-sm space-y-2 bg-muted/20">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="text-muted-foreground">{new Date(session.timing_date).toLocaleDateString()}</span>
                    <Badge variant={getLaneBadgeVariant(session.lane)}>Carril {session.lane}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                    <div>
                      Mejor: {session.best_lap_time}
                      {index === 0 && <Badge variant="secondary" className="ml-1 text-[10px]">MV</Badge>}
                    </div>
                    <div>
                      Total: {session.total_time}
                      {session.totalSeconds === group.improvement?.best_total_session?.totalSeconds && (
                        <Badge variant="secondary" className="ml-1 text-[10px]">MT</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {session.setup_snapshot && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setSelectedTiming(session);
                          setShowSpecsModal(true);
                        }}
                        title="Especificaciones"
                      >
                        <Wrench className="size-4" />
                      </Button>
                    )}
                    {session.has_laps && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setPerformanceTiming(session);
                          setShowPerformanceModal(true);
                        }}
                        title="Rendimiento"
                      >
                        <BarChart3 className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const TimingsList = () => {
  const [timings, setTimings] = useState([]);
  const [vehicles, setVehicles] = useState({});
  const [circuits, setCircuits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTiming, setSelectedTiming] = useState(null);
  const [showSpecsModal, setShowSpecsModal] = useState(false);
  const [showComparisonModal, setShowComparisonModal] = useState(false);
  const [comparisonSessions, setComparisonSessions] = useState([]);
  const [showPerformanceModal, setShowPerformanceModal] = useState(false);
  const [performanceTiming, setPerformanceTiming] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [filter, setFilter] = useState({
    vehicle: '',
    dateFrom: '',
    dateTo: '',
    circuit_id: '',
    lane: ''
  });

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [vehiclesResponse, timingsResponse, circuitsResponse] = await Promise.allSettled([
        api.get('/vehicles'),
        api.get('/timings'),
        api.get('/circuits')
      ]);
      if (vehiclesResponse.status === 'rejected') throw vehiclesResponse.reason;
      if (timingsResponse.status === 'rejected') throw timingsResponse.reason;

      const vehiclesMap = {};
      vehiclesResponse.value.data.vehicles.forEach(vehicle => {
        vehiclesMap[vehicle.id] = vehicle;
      });
      setVehicles(vehiclesMap);
      setTimings(timingsResponse.value.data);
      setCircuits(circuitsResponse.status === 'fulfilled' ? (circuitsResponse.value.data || []) : []);
    } catch (err) {
      console.error('Error al cargar datos:', err);
      setError(err.response?.data?.error || 'Error al cargar los tiempos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getSeconds = (timeStr) => {
    const [minutes, seconds] = timeStr.split(':');
    const [secs, ms] = seconds?.split('.') || ['0', '0'];
    return parseInt(minutes) * 60 + parseInt(secs) + parseInt(ms) / 1000;
  };

  const getTotalSeconds = (timeStr) => {
    if (!timeStr) return 0;
    const [minutes, seconds] = timeStr.split(':');
    const [secs, ms] = seconds?.split('.') || ['0', '0'];
    return parseInt(minutes) * 60 + parseInt(secs) + parseInt(ms) / 1000;
  };

  const groupTimings = (timings) => {
    const groups = {};
    timings.forEach(timing => {
      const circuitName = timing.circuit || timing.circuits?.name || 'Sin circuito';
      const key = `${timing.vehicle_id}-${circuitName}-${timing.lane || 'sin-carril'}-${timing.laps || 'sin-vueltas'}`;
      if (!groups[key]) {
        groups[key] = {
          key,
          vehicle_id: timing.vehicle_id,
          vehicle_manufacturer: timing.vehicle_manufacturer,
          vehicle_model: timing.vehicle_model,
          circuit: circuitName,
          circuit_id: timing.circuit_id || timing.circuits?.id,
          lane: timing.lane || 'Sin carril',
          sessions: [],
          best_time: null,
          last_session: null,
          total_sessions: 0,
          improvement: null
        };
      }
      groups[key].sessions.push(timing);
      groups[key].total_sessions++;
      const currentLapTime = getSeconds(timing.best_lap_time);
      if (!groups[key].best_time || currentLapTime < groups[key].best_time.seconds) {
        groups[key].best_time = { ...timing, seconds: currentLapTime };
      }
      const currentDate = new Date(timing.timing_date);
      if (!groups[key].last_session || currentDate > new Date(groups[key].last_session.timing_date)) {
        groups[key].last_session = timing;
      }
    });
    Object.values(groups).forEach(group => {
      if (group.sessions.length > 1) {
        const sortedByLapTime = group.sessions
          .map(s => ({ ...s, lapSeconds: getSeconds(s.best_lap_time) }))
          .sort((a, b) => a.lapSeconds - b.lapSeconds);
        const sortedByTotalTime = group.sessions
          .map(s => ({ ...s, totalSeconds: getTotalSeconds(s.total_time) }))
          .sort((a, b) => a.totalSeconds - b.totalSeconds);
        const bestLap = sortedByLapTime[0];
        const previousLap = sortedByLapTime[1];
        const bestTotal = sortedByTotalTime[0];
        const previousTotal = sortedByTotalTime[1];
        group.improvement = {
          lap_time_diff: previousLap ? (previousLap.lapSeconds - bestLap.lapSeconds).toFixed(3) : null,
          lap_percentage: previousLap ? ((previousLap.lapSeconds - bestLap.lapSeconds) / previousLap.lapSeconds * 100).toFixed(1) : null,
          total_time_diff: previousTotal ? (previousTotal.totalSeconds - bestTotal.totalSeconds).toFixed(3) : null,
          total_percentage: previousTotal ? ((previousTotal.totalSeconds - bestTotal.totalSeconds) / previousTotal.totalSeconds * 100).toFixed(1) : null,
          best_lap_session: bestLap,
          best_total_session: bestTotal
        };
      }
    });
    return groups;
  };

  const calculateCircuitRanking = (groupedTimings) => {
    const circuitRankings = {};
    Object.values(groupedTimings).forEach(group => {
      const circuit = group.circuit;
      if (!circuitRankings[circuit]) circuitRankings[circuit] = [];
      circuitRankings[circuit].push({
        ...group,
        best_lap_seconds: getSeconds(group.best_time.best_lap_time),
        best_total_seconds: getTotalSeconds(group.best_time.total_time)
      });
    });
    Object.keys(circuitRankings).forEach(circuit => {
      circuitRankings[circuit].sort((a, b) => a.best_lap_seconds - b.best_lap_seconds);
      circuitRankings[circuit].forEach((entry, index) => {
        entry.circuit_position = index + 1;
        if (index === 0) {
          entry.circuit_gap_to_leader = 0;
          entry.circuit_gap_to_previous = 0;
        } else {
          entry.circuit_gap_to_leader = (entry.best_lap_seconds - circuitRankings[circuit][0].best_lap_seconds).toFixed(3);
          entry.circuit_gap_to_previous = (entry.best_lap_seconds - circuitRankings[circuit][index - 1].best_lap_seconds).toFixed(3);
        }
        const bestTotalInCircuit = Math.min(...circuitRankings[circuit].map(e => e.best_total_seconds));
        entry.circuit_gap_to_best_total = (entry.best_total_seconds - bestTotalInCircuit).toFixed(3);
      });
    });
    return circuitRankings;
  };

  const getLaneBadgeVariant = (lane) => {
    const map = { '1': 'default', '2': 'secondary', '3': 'outline', '4': 'outline', '5': 'destructive', '6': 'secondary', '7': 'secondary', '8': 'secondary' };
    return map[lane] || 'secondary';
  };

  const toggleGroup = (key) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) newSet.delete(key);
      else newSet.add(key);
      return newSet;
    });
  };

  const groupedTimings = useMemo(() => groupTimings(timings), [timings]);

  const circuitRankings = useMemo(() => calculateCircuitRanking(groupedTimings), [groupedTimings]);

  useMemo(() => {
    Object.values(groupedTimings).forEach(group => {
      const localRankingEntry = circuitRankings[group.circuit]?.find(entry => entry.key === group.key);
      if (localRankingEntry) {
        group.circuit_ranking = {
          position: localRankingEntry.circuit_position,
          gap_to_leader: localRankingEntry.circuit_gap_to_leader,
          gap_to_previous: localRankingEntry.circuit_gap_to_previous,
          gap_to_best_total: localRankingEntry.circuit_gap_to_best_total,
          position_change: null
        };
        const timingWithRanking = group.sessions.find(s => s.circuit_ranking || s.current_position != null || s.position_change != null);
        if (timingWithRanking?.circuit_ranking) {
          group.circuit_ranking.previous_position = timingWithRanking.circuit_ranking.previous_position;
          group.circuit_ranking.position_change = timingWithRanking.circuit_ranking.position_change;
        } else if (timingWithRanking?.current_position != null) {
          group.circuit_ranking.previous_position = timingWithRanking.previous_position;
          group.circuit_ranking.position_change = timingWithRanking.position_change;
        }
      }
    });
  }, [groupedTimings, circuitRankings]);

  const filteredGroups = useMemo(() => {
    const selectedCircuit = circuits.find(c => c.id === filter.circuit_id);
    return Object.values(groupedTimings).filter(group => {
      const matchesVehicle = !filter.vehicle || group.vehicle_id === filter.vehicle;
      const matchesDateFrom = !filter.dateFrom || new Date(group.best_time.timing_date) >= new Date(filter.dateFrom);
      const matchesDateTo = !filter.dateTo || new Date(group.best_time.timing_date) <= new Date(filter.dateTo);
      const matchesCircuit = !filter.circuit_id || group.circuit_id === filter.circuit_id || (selectedCircuit && group.circuit === selectedCircuit.name);
      const matchesLane = !filter.lane || group.lane.toLowerCase().includes(filter.lane.toLowerCase());
      return matchesVehicle && matchesDateFrom && matchesDateTo && matchesCircuit && matchesLane;
    }).sort((a, b) => {
      if (a.circuit === b.circuit) {
        const aPos = a.circuit_ranking?.position || 999;
        const bPos = b.circuit_ranking?.position || 999;
        if (aPos !== bPos) return aPos - bPos;
      }
      return a.best_time.seconds - b.best_time.seconds;
    });
  }, [groupedTimings, circuits, filter]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          <p className="font-semibold">Error</p>
          <p>{error}</p>
          <Button variant="outline" size="sm" onClick={loadData} className="mt-2">
            Reintentar
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6 py-6">
      <h1 className="text-2xl font-bold">Tabla de Tiempos</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="space-y-2">
          <Label>Filtrar por Vehículo</Label>
          <Select value={filter.vehicle || '__all__'} onValueChange={(v) => setFilter(prev => ({ ...prev, vehicle: v === '__all__' ? '' : v }))}>
            <SelectTrigger>
              <SelectValue placeholder="Todos los vehículos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos los vehículos</SelectItem>
              {Object.values(vehicles).map(vehicle => (
                <SelectItem key={vehicle.id} value={String(vehicle.id)}>
                  {vehicle.manufacturer} {vehicle.model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Fecha Desde</Label>
          <Input type="date" name="dateFrom" value={filter.dateFrom} onChange={(e) => setFilter(prev => ({ ...prev, dateFrom: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label>Fecha Hasta</Label>
          <Input type="date" name="dateTo" value={filter.dateTo} onChange={(e) => setFilter(prev => ({ ...prev, dateTo: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label>Filtrar por Circuito</Label>
          <Select value={filter.circuit_id || '__all__'} onValueChange={(v) => setFilter(prev => ({ ...prev, circuit_id: v === '__all__' ? '' : v }))}>
            <SelectTrigger>
              <SelectValue placeholder="Todos los circuitos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos los circuitos</SelectItem>
              {circuits.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Filtrar por Carril</Label>
          <Input type="text" name="lane" value={filter.lane} onChange={(e) => setFilter(prev => ({ ...prev, lane: e.target.value }))} placeholder="Número de carril" />
        </div>
      </div>

      {timings.length > 0 && (
        <div className="rounded-lg border p-4 bg-muted/50">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><strong>Total de registros:</strong> {timings.length}</div>
            <div><strong>Combinaciones únicas:</strong> {Object.keys(groupedTimings).length}</div>
            <div><strong>Circuitos únicos:</strong> {Object.keys(circuitRankings).length}</div>
            <div className="text-right">
              <strong>Con configuración técnica:</strong> {timings.filter(t => t.setup_snapshot).length}
              <span className="text-muted-foreground ml-2">
                ({((timings.filter(t => t.setup_snapshot).length / timings.length) * 100).toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="md:hidden space-y-3">
        {filteredGroups.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground rounded-md border">No hay registros de tiempo</p>
        ) : (
          filteredGroups.map((group) => (
            <TimingMobileGroupCard
              key={group.key}
              group={group}
              expandedGroups={expandedGroups}
              toggleGroup={toggleGroup}
              getLaneBadgeVariant={getLaneBadgeVariant}
              setSelectedTiming={setSelectedTiming}
              setShowSpecsModal={setShowSpecsModal}
              setPerformanceTiming={setPerformanceTiming}
              setShowPerformanceModal={setShowPerformanceModal}
              setComparisonSessions={setComparisonSessions}
              setShowComparisonModal={setShowComparisonModal}
              getSeconds={getSeconds}
              getTotalSeconds={getTotalSeconds}
            />
          ))
        )}
      </div>

      <div className="hidden md:block rounded-md border timings-table-wrapper">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vehículo</TableHead>
              <TableHead>Circuito</TableHead>
              <TableHead>Carril</TableHead>
              <TableHead>Vueltas</TableHead>
              <TableHead>Dist.</TableHead>
              <TableHead>Vel.</TableHead>
              <TableHead>Pos.</TableHead>
              <TableHead>Mejor</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Ses.</TableHead>
              <TableHead>Mejora</TableHead>
              <TableHead>Última</TableHead>
              <TableHead className="text-center w-[80px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredGroups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                  No hay registros de tiempo
                </TableCell>
              </TableRow>
            ) : (
              filteredGroups.map(group => (
                <React.Fragment key={group.key}>
                  <TableRow className="bg-muted/50 font-medium">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {group.sessions.length > 1 && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleGroup(group.key)} title={expandedGroups.has(group.key) ? 'Ocultar historial' : 'Ver historial'}>
                            {expandedGroups.has(group.key) ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                          </Button>
                        )}
                        <Link to={`/vehicles/${group.vehicle_id}`} className="text-primary hover:underline">
                          {group.vehicle_manufacturer} {group.vehicle_model}
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell>{group.circuit}</TableCell>
                    <TableCell><Badge variant={getLaneBadgeVariant(group.lane)}>{group.lane}</Badge></TableCell>
                    <TableCell><Badge variant="secondary">{group.best_time.laps || 'N/A'}</Badge></TableCell>
                    <TableCell>
                      {formatDistance(group.best_time.total_distance_meters)}
                    </TableCell>
                    <TableCell>
                      {group.best_time.avg_speed_kmh != null && group.best_time.avg_speed_scale_kmh != null
                        ? `${Number(group.best_time.avg_speed_kmh).toFixed(1)} km/h (${Number(group.best_time.avg_speed_scale_kmh).toFixed(0)} eq.)`
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {group.circuit_ranking ? (
                        <Badge variant={group.circuit_ranking.position === 1 ? 'default' : 'secondary'}>P{group.circuit_ranking.position}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono font-medium">
                      {group.best_time.best_lap_time}
                      {group.circuit_ranking && group.circuit_ranking.position > 1 && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          <span className="text-destructive">+{group.circuit_ranking.gap_to_leader}s al líder</span>
                          <br />
                          <span className="text-amber-600">+{group.circuit_ranking.gap_to_previous}s al anterior</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono font-medium">{group.best_time.total_time}</TableCell>
                    <TableCell><Badge>{group.total_sessions}</Badge></TableCell>
                    <TableCell>
                      {group.improvement ? (
                        <div className="text-sm">
                          <div className="mb-1">
                            <strong className="text-primary">Mejor Vuelta:</strong>
                            <br />
                            <span className="text-green-600 font-medium">-{group.improvement.lap_time_diff}s</span>
                            <br />
                            <span className="text-muted-foreground">{group.improvement.lap_percentage}% mejor</span>
                          </div>
                          <div>
                            <strong className="text-primary">Mejor Total:</strong>
                            <br />
                            <span className="text-green-600 font-medium">-{group.improvement.total_time_diff}s</span>
                            <br />
                            <span className="text-muted-foreground">{group.improvement.total_percentage}% mejor</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Primera sesión</span>
                      )}
                    </TableCell>
                    <TableCell>{new Date(group.last_session.timing_date).toLocaleDateString()}</TableCell>
                    <TableCell className="text-center w-[80px]">
                      <div className="flex items-center justify-center gap-1">
                        {group.best_time.setup_snapshot && (
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => { setSelectedTiming(group.best_time); setShowSpecsModal(true); }} title="Ver especificaciones">
                            <Wrench className="size-4" />
                          </Button>
                        )}
                        {group.best_time?.has_laps && (
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => { setPerformanceTiming(group.best_time); setShowPerformanceModal(true); }}
                            title="Ver análisis de rendimiento"
                          >
                            <BarChart3 className="size-4" />
                          </Button>
                        )}
                        {group.sessions.length >= 2 ? (
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setComparisonSessions(group.sessions);
                              setShowComparisonModal(true);
                            }}
                            title="Comparar sesiones"
                          >
                            <GitCompare className="size-4" />
                          </Button>
                        ) : (
                          !group.best_time.setup_snapshot && <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  {expandedGroups.has(group.key) && group.sessions.length > 1 && (
                    group.sessions
                      .map(s => ({ ...s, lapSeconds: getSeconds(s.best_lap_time), totalSeconds: getTotalSeconds(s.total_time) }))
                      .sort((a, b) => a.lapSeconds !== b.lapSeconds ? a.lapSeconds - b.lapSeconds : a.totalSeconds - b.totalSeconds)
                      .map((session, index) => (
                        <TableRow key={`${session.id}-${index}`} className="text-sm">
                          <TableCell colSpan={2} className="pl-8 text-muted-foreground">
                            {new Date(session.timing_date).toLocaleDateString()}
                          </TableCell>
                          <TableCell><Badge variant={getLaneBadgeVariant(session.lane)}>{session.lane}</Badge></TableCell>
                          <TableCell><Badge variant="secondary">{session.laps || 'N/A'}</Badge></TableCell>
                          <TableCell>
                            {formatDistance(session.total_distance_meters)}
                          </TableCell>
                          <TableCell>
                            {session.avg_speed_kmh != null && session.avg_speed_scale_kmh != null
                              ? (
                                <div className="leading-tight">
                                  <div>{Number(session.avg_speed_kmh).toFixed(1)} km/h</div>
                                  <div className="text-muted-foreground">{Number(session.avg_speed_scale_kmh).toFixed(0)} km/h eq.</div>
                                </div>
                              )
                              : '-'}
                          </TableCell>
                          <TableCell></TableCell>
                          <TableCell className="font-mono">
                            {session.best_lap_time}
                            {index === 0 && <Badge variant="secondary" className="ml-2">Mejor Vuelta</Badge>}
                          </TableCell>
                          <TableCell className="font-mono">
                            {session.total_time}
                            {session.totalSeconds === group.improvement?.best_total_session?.totalSeconds && (
                              <Badge variant="secondary" className="ml-2">Mejor Total</Badge>
                            )}
                          </TableCell>
                          <TableCell></TableCell>
                          <TableCell></TableCell>
                          <TableCell></TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              {session.setup_snapshot && (
                                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => { setSelectedTiming(session); setShowSpecsModal(true); }} title="Ver especificaciones">
                                  <Wrench className="size-4" />
                                </Button>
                              )}
                              {session.has_laps && (
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => { setPerformanceTiming(session); setShowPerformanceModal(true); }}
                                  title="Ver análisis de rendimiento"
                                >
                                  <BarChart3 className="size-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                  )}
                </React.Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <TimingSpecsModal show={showSpecsModal} onHide={() => setShowSpecsModal(false)} setupSnapshot={selectedTiming?.setup_snapshot} timing={selectedTiming} />
      <SessionComparisonModal show={showComparisonModal} onHide={() => setShowComparisonModal(false)} sessions={comparisonSessions} />
      <SessionPerformanceModal show={showPerformanceModal} onHide={() => setShowPerformanceModal(false)} timing={performanceTiming} />
    </div>
  );
};

export default TimingsList;
