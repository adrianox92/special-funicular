import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, Wrench, GitCompare, BarChart3, Trash2 } from 'lucide-react';
import api from '../lib/axios';
import TimingSpecsModal from './TimingSpecsModal';
import ImportTimingsModal from './ImportTimingsModal';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { toast } from 'sonner';
import './TimingsList.css';
import { formatDistance } from '../utils/formatUtils';
import { cn } from '../lib/utils';
import { isLapTimerSession, getRecordedFromLabel } from '../utils/recordedFromLabel';
import LapTimerTrainingLink from './LapTimerTrainingLink';
import SessionTimeline from './SessionTimeline';

/** Igual que VehicleList: GET /vehicles está paginado (25 por defecto). */
const TIMINGS_VEHICLES_PAGE_LIMIT = 10000;

/** setup_snapshot puede ser string JSON (legado) o objeto/array (jsonb desde PostgREST). */
function hasMeaningfulSetupSnapshot(raw) {
  if (raw == null || raw === '') return false;
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t || t === 'null' || t === '[]' || t === '{}') return false;
    return true;
  }
  if (Array.isArray(raw)) return raw.length > 0;
  if (typeof raw === 'object') return Object.keys(raw).length > 0;
  return false;
}

/** Botón “detalle de sesión”: resumen, tabla de vueltas y/o setup — no solo si hay snapshot. */
function showSessionDetailButton(timing) {
  if (!timing) return false;
  if (hasMeaningfulSetupSnapshot(timing.setup_snapshot)) return true;
  if (timing.has_laps) return true;
  const n = Number(timing.laps);
  return Number.isFinite(n) && n > 0;
}

/** Análisis de rendimiento: solo si hay filas en timing_laps (flag has_laps del listado /api/timings). */
function showPerformanceAnalysisButton(timing) {
  return Boolean(timing?.has_laps);
}

function formatVoltageVolts(v) {
  if (v == null || v === '') return '—';
  const n = Number(v);
  return Number.isFinite(n) ? `${n.toFixed(2)} V` : '—';
}

function RecordedFromBadge({ recordedFrom }) {
  const label = getRecordedFromLabel(recordedFrom);
  if (!label || recordedFrom === 'web') return null;
  return (
    <Badge variant={isLapTimerSession(recordedFrom) ? 'default' : 'outline'} className="text-[10px]">
      {label}
    </Badge>
  );
}

function GuidedSessionBadge({ guidedSession }) {
  const { t } = useTranslation('timings');
  if (!guidedSession || typeof guidedSession !== 'object') return null;
  const on = guidedSession.laps_on_target;
  const total = guidedSession.total_laps;
  const title =
    on != null && total != null
      ? t('guided.badgeTitle', { on, total })
      : t('guided.badge');
  return (
    <Badge variant="secondary" className="text-[10px]" title={title}>
      {t('guided.badge')}
    </Badge>
  );
}

function getSeconds(timeStr) {
  const [minutes, seconds] = timeStr.split(':');
  const [secs, ms] = seconds?.split('.') || ['0', '0'];
  return parseInt(minutes) * 60 + parseInt(secs) + parseInt(ms) / 1000;
}

function getTotalSeconds(timeStr) {
  if (!timeStr) return 0;
  const [minutes, seconds] = timeStr.split(':');
  const [secs, ms] = seconds?.split('.') || ['0', '0'];
  return parseInt(minutes) * 60 + parseInt(secs) + parseInt(ms) / 1000;
}

function groupTimings(timings, labels = {}) {
  const noCircuit = labels.noCircuit ?? 'Sin circuito';
  const noLane = labels.noLane ?? 'Sin carril';
  const groups = {};
  timings.forEach((timing) => {
    const circuitName = timing.circuit || timing.circuits?.name || noCircuit;
    const key = `${timing.vehicle_id}-${circuitName}-${timing.lane || 'sin-carril'}-${timing.laps || 'sin-vueltas'}`;
    if (!groups[key]) {
      groups[key] = {
        key,
        vehicle_id: timing.vehicle_id,
        vehicle_manufacturer: timing.vehicle_manufacturer,
        vehicle_model: timing.vehicle_model,
        circuit: circuitName,
        circuit_id: timing.circuit_id || timing.circuits?.id,
        lane: timing.lane || noLane,
        sessions: [],
        best_time: null,
        last_session: null,
        total_sessions: 0,
        improvement: null,
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
  Object.values(groups).forEach((group) => {
    if (group.sessions.length > 1) {
      const sortedByLapTime = group.sessions
        .map((s) => ({ ...s, lapSeconds: getSeconds(s.best_lap_time) }))
        .sort((a, b) => a.lapSeconds - b.lapSeconds);
      const sortedByTotalTime = group.sessions
        .map((s) => ({ ...s, totalSeconds: getTotalSeconds(s.total_time) }))
        .sort((a, b) => a.totalSeconds - b.totalSeconds);
      const bestLap = sortedByLapTime[0];
      const previousLap = sortedByLapTime[1];
      const bestTotal = sortedByTotalTime[0];
      const previousTotal = sortedByTotalTime[1];
      group.improvement = {
        lap_time_diff: previousLap ? (previousLap.lapSeconds - bestLap.lapSeconds).toFixed(3) : null,
        lap_percentage: previousLap
          ? (((previousLap.lapSeconds - bestLap.lapSeconds) / previousLap.lapSeconds) * 100).toFixed(1)
          : null,
        total_time_diff: previousTotal ? (previousTotal.totalSeconds - bestTotal.totalSeconds).toFixed(3) : null,
        total_percentage: previousTotal
          ? (((previousTotal.totalSeconds - bestTotal.totalSeconds) / previousTotal.totalSeconds) * 100).toFixed(1)
          : null,
        best_lap_session: bestLap,
        best_total_session: bestTotal,
      };
    }
  });
  return groups;
}

function calculateCircuitRanking(groupedTimings) {
  const circuitRankings = {};
  Object.values(groupedTimings).forEach((group) => {
    const circuit = group.circuit;
    if (!circuitRankings[circuit]) circuitRankings[circuit] = [];
    circuitRankings[circuit].push({
      ...group,
      best_lap_seconds: getSeconds(group.best_time.best_lap_time),
      best_total_seconds: getTotalSeconds(group.best_time.total_time),
    });
  });
  Object.keys(circuitRankings).forEach((circuit) => {
    circuitRankings[circuit].sort((a, b) => a.best_lap_seconds - b.best_lap_seconds);
    circuitRankings[circuit].forEach((entry, index) => {
      entry.circuit_position = index + 1;
      if (index === 0) {
        entry.circuit_gap_to_leader = 0;
        entry.circuit_gap_to_previous = 0;
      } else {
        entry.circuit_gap_to_leader = (
          entry.best_lap_seconds - circuitRankings[circuit][0].best_lap_seconds
        ).toFixed(3);
        entry.circuit_gap_to_previous = (
          entry.best_lap_seconds - circuitRankings[circuit][index - 1].best_lap_seconds
        ).toFixed(3);
      }
      const bestTotalInCircuit = Math.min(...circuitRankings[circuit].map((e) => e.best_total_seconds));
      entry.circuit_gap_to_best_total = (entry.best_total_seconds - bestTotalInCircuit).toFixed(3);
    });
  });
  return circuitRankings;
}

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
  onRequestDeleteSession,
  getSeconds,
  getTotalSeconds,
}) {
  const { t } = useTranslation('timings');
  const expanded = expandedGroups.has(group.key);
  const formatSpeed = (real, scale) =>
    t('speedFormat', { real: Number(real).toFixed(1), scale: Number(scale).toFixed(0) });
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
              title={expanded ? t('hideHistory') : t('showHistory')}
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
              <Badge variant={getLaneBadgeVariant(group.lane)}>{t('lane', { lane: group.lane })}</Badge>
              <Badge variant="secondary">{group.best_time.laps ? t('laps', { count: group.best_time.laps }) : t('lapsNa')}</Badge>
              {group.circuit_ranking ? (
                <Badge variant={group.circuit_ranking.position === 1 ? 'default' : 'secondary'}>
                  {t('positionShort', { pos: group.circuit_ranking.position })}
                </Badge>
              ) : null}
              <Badge>{t('sessionsShort', { count: group.total_sessions })}</Badge>
              {group.circuit_id && (
                <LapTimerTrainingLink
                  vehicleId={group.vehicle_id}
                  circuitId={group.circuit_id}
                  lane={group.lane}
                />
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground block text-xs">{t('distance')}</span>
            {formatDistance(group.best_time.total_distance_meters)}
          </div>
          <div>
            <span className="text-muted-foreground block text-xs">{t('speed')}</span>
            {group.best_time.avg_speed_kmh != null && group.best_time.avg_speed_scale_kmh != null
              ? formatSpeed(group.best_time.avg_speed_kmh, group.best_time.avg_speed_scale_kmh)
              : '—'}
          </div>
          <div>
            <span className="text-muted-foreground block text-xs">{t('bestLap')}</span>
            <span className="font-mono font-medium">{group.best_time.best_lap_time}</span>
            {group.circuit_ranking && group.circuit_ranking.position > 1 && (
              <div className="mt-1 text-xs text-muted-foreground">
                <span className="text-destructive">{t('gapLeader', { gap: group.circuit_ranking.gap_to_leader })}</span>
                <br />
                <span className="text-amber-600">{t('gapPrevious', { gap: group.circuit_ranking.gap_to_previous })}</span>
              </div>
            )}
          </div>
          <div>
            <span className="text-muted-foreground block text-xs">{t('total')}</span>
            <span className="font-mono font-medium">{group.best_time.total_time}</span>
          </div>
          <div className="col-span-2">
            <span className="text-muted-foreground block text-xs">{t('voltage')}</span>
            <span>{formatVoltageVolts(group.best_time.supply_voltage_volts)}</span>
          </div>
          <div className="col-span-2">
            <span className="text-muted-foreground block text-xs">{t('lastSession')}</span>
            {new Date(group.last_session.timing_date).toLocaleDateString()}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {showSessionDetailButton(group.best_time) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedTiming(group.best_time);
                setShowSpecsModal(true);
              }}
            >
              <Wrench className="size-4 mr-1" />
              {t('config')}
            </Button>
          )}
          {showPerformanceAnalysisButton(group.best_time) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPerformanceTiming(group.best_time);
                setShowPerformanceModal(true);
              }}
            >
              <BarChart3 className="size-4 mr-1" />
              {t('performance')}
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
              {t('compare')}
            </Button>
          )}
          {group.sessions.length === 1 && group.sessions[0]?.id != null && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onRequestDeleteSession(group.vehicle_id, group.sessions[0].id)}
              title={t('deleteSession')}
            >
              <Trash2 className="size-4 mr-1" />
              {t('delete')}
            </Button>
          )}
        </div>

        {expanded && group.sessions.length > 1 && (
          <div className="space-y-2 border-t pt-3">
            <p className="text-xs font-medium text-muted-foreground">{t('sessionHistory')}</p>
            {group.sessions
              .map((s) => ({ ...s, lapSeconds: getSeconds(s.best_lap_time), totalSeconds: getTotalSeconds(s.total_time) }))
              .sort((a, b) => (a.lapSeconds !== b.lapSeconds ? a.lapSeconds - b.lapSeconds : a.totalSeconds - b.totalSeconds))
              .map((session, index) => (
                <div key={`${session.id}-${index}`} className="rounded-md border p-3 text-sm space-y-2 bg-muted/20">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="text-muted-foreground">{new Date(session.timing_date).toLocaleDateString()}</span>
                    <Badge variant={getLaneBadgeVariant(session.lane)}>{t('lane', { lane: session.lane })}</Badge>
                    <RecordedFromBadge recordedFrom={session.recorded_from} />
                    <GuidedSessionBadge guidedSession={session.guided_session} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                    <div>
                      {t('bestShort')} {session.best_lap_time}
                      {index === 0 && <Badge variant="secondary" className="ml-1 text-[10px]">{t('badges.bestLap')}</Badge>}
                    </div>
                    <div>
                      {t('totalShort')} {session.total_time}
                      {session.totalSeconds === group.improvement?.best_total_session?.totalSeconds && (
                        <Badge variant="secondary" className="ml-1 text-[10px]">{t('badges.bestTotal')}</Badge>
                      )}
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">{t('voltageShort')} </span>
                      {formatVoltageVolts(session.supply_voltage_volts)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {showSessionDetailButton(session) && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setSelectedTiming(session);
                          setShowSpecsModal(true);
                        }}
                        title={t('specs')}
                      >
                        <Wrench className="size-4" />
                      </Button>
                    )}
                    {showPerformanceAnalysisButton(session) && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setPerformanceTiming(session);
                          setShowPerformanceModal(true);
                        }}
                        title={t('performance')}
                      >
                        <BarChart3 className="size-4" />
                      </Button>
                    )}
                    {session.id != null && (
                      <Button
                        variant="destructive"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onRequestDeleteSession(group.vehicle_id, session.id)}
                        title={t('deleteSession')}
                      >
                        <Trash2 className="size-4" />
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
  const { t } = useTranslation('timings');
  const { t: tCommon } = useTranslation('common');
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
  const [showImportModal, setShowImportModal] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [deleteSessionConfirm, setDeleteSessionConfirm] = useState({
    open: false,
    vehicleId: null,
    timingId: null,
  });
  const [filter, setFilter] = useState({
    vehicle: '',
    dateFrom: '',
    dateTo: '',
    circuit_id: '',
    lane: ''
  });
  const [vehiclePickerOpen, setVehiclePickerOpen] = useState(false);
  const [vehicleSearch, setVehicleSearch] = useState('');
  const vehiclePickerRef = useRef(null);
  const vehicleSearchInputRef = useRef(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [vehiclesResponse, timingsResponse, circuitsResponse] = await Promise.allSettled([
        api.get('/vehicles', { params: { page: 1, limit: TIMINGS_VEHICLES_PAGE_LIMIT } }),
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
      setError(err.response?.data?.error || t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const sortedVehicleOptions = useMemo(() => {
    return Object.values(vehicles).sort((a, b) => {
      const ma = `${a.manufacturer ?? ''} ${a.model ?? ''}`.trim().toLocaleLowerCase();
      const mb = `${b.manufacturer ?? ''} ${b.model ?? ''}`.trim().toLocaleLowerCase();
      return ma.localeCompare(mb, 'es');
    });
  }, [vehicles]);

  const vehicleFilterLabel = useMemo(() => {
    if (!filter.vehicle) return t('allVehicles');
    const v = vehicles[filter.vehicle];
    if (!v) return t('vehicle');
    const label = `${v.manufacturer ?? ''} ${v.model ?? ''}`.trim();
    return label || v.id;
  }, [filter.vehicle, vehicles, t]);

  const filteredVehicleOptions = useMemo(() => {
    const q = vehicleSearch.trim().toLocaleLowerCase();
    if (!q) return sortedVehicleOptions;
    return sortedVehicleOptions.filter((v) => {
      const label = `${v.manufacturer ?? ''} ${v.model ?? ''}`.trim().toLocaleLowerCase();
      return label.includes(q) || String(v.id).toLocaleLowerCase().includes(q);
    });
  }, [sortedVehicleOptions, vehicleSearch]);

  useEffect(() => {
    if (!vehiclePickerOpen) setVehicleSearch('');
  }, [vehiclePickerOpen]);

  useEffect(() => {
    if (!vehiclePickerOpen) return;
    const id = requestAnimationFrame(() => vehicleSearchInputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [vehiclePickerOpen]);

  useEffect(() => {
    if (!vehiclePickerOpen) return;
    const esc = (e) => {
      if (e.key === 'Escape') setVehiclePickerOpen(false);
    };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [vehiclePickerOpen]);

  useEffect(() => {
    if (!vehiclePickerOpen) return;
    const onDocMouseDown = (e) => {
      if (!vehiclePickerRef.current || vehiclePickerRef.current.contains(e.target)) return;
      setVehiclePickerOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [vehiclePickerOpen]);

  const reloadTimings = async () => {
    try {
      const { data } = await api.get('/timings');
      setTimings(data);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || t('refreshError'));
    }
  };

  const requestDeleteSession = (vehicleId, timingId) => {
    if (vehicleId == null || timingId == null) return;
    setDeleteSessionConfirm({ open: true, vehicleId, timingId });
  };

  const confirmDeleteSession = async () => {
    const { vehicleId, timingId } = deleteSessionConfirm;
    if (vehicleId == null || timingId == null) return;
    setDeleteSessionConfirm({ open: false, vehicleId: null, timingId: null });
    try {
      const response = await api.delete(`/vehicles/${vehicleId}/timings/${timingId}`);
      if (response.data?.position_updated) {
        toast.success(t('deleteSuccess', { circuit: response.data.circuit }));
      }
      await reloadTimings();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || t('deleteError'));
    }
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

  const groupedTimings = useMemo(
    () => groupTimings(timings, { noCircuit: t('noCircuit'), noLane: t('noLane') }),
    [timings, t],
  );

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
          <p className="font-semibold">{tCommon('actions.error')}</p>
          <p>{error}</p>
          <Button variant="outline" size="sm" onClick={loadData} className="mt-2">
            {tCommon('actions.retry')}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <Button type="button" variant="outline" onClick={() => setShowImportModal(true)}>
          {t('import')}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div ref={vehiclePickerRef} className="relative space-y-2">
          <Label>{t('filterVehicle')}</Label>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={vehiclePickerOpen}
            aria-haspopup="listbox"
            className="h-9 w-full justify-between font-normal"
            type="button"
            onClick={() => setVehiclePickerOpen((o) => !o)}
          >
            <span className="truncate text-left">{vehicleFilterLabel}</span>
            <ChevronDown className="ml-2 size-4 shrink-0 opacity-50" aria-hidden />
          </Button>
          {vehiclePickerOpen ? (
            <div
              className="pointer-events-auto absolute left-0 right-0 top-full z-[200] mt-1 flex flex-col rounded-md border border-border bg-popover text-popover-foreground shadow-lg"
              role="listbox"
              aria-label={t('vehicleListAria')}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="border-b px-3 py-2">
                <Input
                  ref={vehicleSearchInputRef}
                  placeholder={t('searchVehiclePlaceholder')}
                  value={vehicleSearch}
                  onChange={(e) => setVehicleSearch(e.target.value)}
                  className="h-9"
                  autoComplete="off"
                />
              </div>
              <div className="pointer-events-auto max-h-[280px] overflow-y-auto overscroll-contain p-1">
                <button
                  type="button"
                  role="option"
                  aria-selected={!filter.vehicle}
                  className={cn(
                    'flex w-full cursor-pointer rounded-sm px-2 py-2.5 text-left text-sm outline-none transition-colors',
                    'hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground',
                    !filter.vehicle ? 'bg-accent/80 text-accent-foreground' : null,
                  )}
                  onMouseDown={(e) => {
                    e.preventDefault();
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setFilter((prev) => ({ ...prev, vehicle: '' }));
                    setVehiclePickerOpen(false);
                  }}
                >
                  {t('allVehicles')}
                </button>
                {filteredVehicleOptions.length === 0 ? (
                  <p className="px-2 py-4 text-center text-sm text-muted-foreground">{t('noMatches')}</p>
                ) : (
                  filteredVehicleOptions.map((vehicle) => {
                    const label = `${vehicle.manufacturer ?? ''} ${vehicle.model ?? ''}`.trim() || String(vehicle.id);
                    const idStr = String(vehicle.id);
                    const selected = filter.vehicle === idStr;
                    return (
                      <button
                        key={vehicle.id}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        className={cn(
                          'flex w-full cursor-pointer rounded-sm px-2 py-2.5 text-left text-sm outline-none transition-colors',
                          'hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground',
                          selected ? 'bg-accent/80 text-accent-foreground' : null,
                        )}
                        onMouseDown={(e) => {
                          e.preventDefault();
                        }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setFilter((prev) => ({ ...prev, vehicle: idStr }));
                          setVehiclePickerOpen(false);
                        }}
                      >
                        {label}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label>{t('filterDateFrom')}</Label>
          <Input type="date" name="dateFrom" value={filter.dateFrom} onChange={(e) => setFilter(prev => ({ ...prev, dateFrom: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label>{t('filterDateTo')}</Label>
          <Input type="date" name="dateTo" value={filter.dateTo} onChange={(e) => setFilter(prev => ({ ...prev, dateTo: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label>{t('filterCircuit')}</Label>
          <Select value={filter.circuit_id || '__all__'} onValueChange={(v) => setFilter(prev => ({ ...prev, circuit_id: v === '__all__' ? '' : v }))}>
            <SelectTrigger>
              <SelectValue placeholder={t('allCircuits')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t('allCircuits')}</SelectItem>
              {circuits.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t('filterLane')}</Label>
          <Input type="text" name="lane" value={filter.lane} onChange={(e) => setFilter(prev => ({ ...prev, lane: e.target.value }))} placeholder={t('lanePlaceholder')} />
        </div>
      </div>

      {timings.length > 0 && (
        <div className="rounded-lg border p-4 bg-muted/50">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><strong>{t('statsTotal')}</strong> {timings.length}</div>
            <div><strong>{t('statsCombinations')}</strong> {Object.keys(groupedTimings).length}</div>
            <div><strong>{t('statsCircuits')}</strong> {Object.keys(circuitRankings).length}</div>
          </div>
        </div>
      )}

      <div className="md:hidden space-y-3">
        {filteredGroups.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground rounded-md border">{t('empty')}</p>
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
              onRequestDeleteSession={requestDeleteSession}
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
              <TableHead>{t('table.vehicle')}</TableHead>
              <TableHead>{t('table.circuit')}</TableHead>
              <TableHead>{t('table.lane')}</TableHead>
              <TableHead>{t('table.laps')}</TableHead>
              <TableHead>{t('table.distance')}</TableHead>
              <TableHead>{t('table.speed')}</TableHead>
              <TableHead>{t('table.position')}</TableHead>
              <TableHead>{t('table.best')}</TableHead>
              <TableHead>{t('table.total')}</TableHead>
              <TableHead>{t('table.voltage')}</TableHead>
              <TableHead>{t('table.sessions')}</TableHead>
              <TableHead>{t('table.last')}</TableHead>
              <TableHead className="text-center min-w-[112px]">{t('table.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredGroups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                  {t('empty')}
                </TableCell>
              </TableRow>
            ) : (
              filteredGroups.map(group => (
                <React.Fragment key={group.key}>
                  <TableRow className="bg-muted/50 font-medium">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {group.sessions.length > 1 && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleGroup(group.key)} title={expandedGroups.has(group.key) ? t('hideHistory') : t('showHistory')}>
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
                    <TableCell><Badge variant="secondary">{group.best_time.laps || t('lapsNa')}</Badge></TableCell>
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
                        <Badge variant={group.circuit_ranking.position === 1 ? 'default' : 'secondary'}>{t('positionShort', { pos: group.circuit_ranking.position })}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono font-medium">
                      {group.best_time.best_lap_time}
                      {group.circuit_ranking && group.circuit_ranking.position > 1 && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          <span className="text-destructive">{t('gapLeaderTable', { gap: group.circuit_ranking.gap_to_leader })}</span>
                          <br />
                          <span className="text-amber-600">{t('gapPreviousTable', { gap: group.circuit_ranking.gap_to_previous })}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono font-medium">{group.best_time.total_time}</TableCell>
                    <TableCell className="font-mono text-sm">{formatVoltageVolts(group.best_time.supply_voltage_volts)}</TableCell>
                    <TableCell><Badge>{group.total_sessions}</Badge></TableCell>
                    <TableCell>{new Date(group.last_session.timing_date).toLocaleDateString()}</TableCell>
                    <TableCell className="text-center min-w-[112px]">
                      <div className="flex items-center justify-center gap-1 flex-wrap">
                        {showSessionDetailButton(group.best_time) && (
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => { setSelectedTiming(group.best_time); setShowSpecsModal(true); }} title={t('viewSpecs')}>
                            <Wrench className="size-4" />
                          </Button>
                        )}
                        {showPerformanceAnalysisButton(group.best_time) && (
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => { setPerformanceTiming(group.best_time); setShowPerformanceModal(true); }}
                            title={t('viewPerformance')}
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
                            title={t('compareSessions')}
                          >
                            <GitCompare className="size-4" />
                          </Button>
                        ) : null}
                        {group.sessions.length === 1 && group.sessions[0]?.id != null && (
                          <Button
                            variant="destructive"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => requestDeleteSession(group.vehicle_id, group.sessions[0].id)}
                            title={t('deleteSession')}
                          >
                            <Trash2 className="size-4" />
                          </Button>
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
                          <TableCell><Badge variant="secondary">{session.laps || t('lapsNa')}</Badge></TableCell>
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
                            {index === 0 && <Badge variant="secondary" className="ml-2">{t('bestLapBadge')}</Badge>}
                            <RecordedFromBadge recordedFrom={session.recorded_from} />
                    <GuidedSessionBadge guidedSession={session.guided_session} />
                          </TableCell>
                          <TableCell className="font-mono">
                            {session.total_time}
                            {session.totalSeconds === group.improvement?.best_total_session?.totalSeconds && (
                              <Badge variant="secondary" className="ml-2">{t('bestTotalBadge')}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{formatVoltageVolts(session.supply_voltage_volts)}</TableCell>
                          <TableCell></TableCell>
                          <TableCell></TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              {showSessionDetailButton(session) && (
                                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => { setSelectedTiming(session); setShowSpecsModal(true); }} title={t('viewSpecs')}>
                                  <Wrench className="size-4" />
                                </Button>
                              )}
                              {showPerformanceAnalysisButton(session) && (
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => { setPerformanceTiming(session); setShowPerformanceModal(true); }}
                                  title={t('viewPerformance')}
                                >
                                  <BarChart3 className="size-4" />
                                </Button>
                              )}
                              {session.id != null && (
                                <Button
                                  variant="destructive"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => requestDeleteSession(group.vehicle_id, session.id)}
                                  title={t('deleteSession')}
                                >
                                  <Trash2 className="size-4" />
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

      {timings.length > 0 && <SessionTimeline sessions={timings} />}

      <TimingSpecsModal show={showSpecsModal} onHide={() => setShowSpecsModal(false)} setupSnapshot={selectedTiming?.setup_snapshot} timing={selectedTiming} />
      <SessionComparisonModal show={showComparisonModal} onHide={() => setShowComparisonModal(false)} sessions={comparisonSessions} />
      <SessionPerformanceModal show={showPerformanceModal} onHide={() => setShowPerformanceModal(false)} timing={performanceTiming} />
      <ImportTimingsModal
        open={showImportModal}
        onOpenChange={setShowImportModal}
        vehicles={Object.values(vehicles)}
        circuits={circuits}
        defaultVehicleId={filter.vehicle || undefined}
        defaultCircuitId={filter.circuit_id || undefined}
        onImported={loadData}
      />

      <AlertDialog
        open={deleteSessionConfirm.open}
        onOpenChange={(open) => !open && setDeleteSessionConfirm({ open: false, vehicleId: null, timingId: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteConfirmBody')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">{tCommon('actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              onClick={confirmDeleteSession}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TimingsList;
