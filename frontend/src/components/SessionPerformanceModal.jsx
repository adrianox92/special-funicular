import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Card, CardContent, CardHeader } from './ui/card';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
  BarChart,
  Bar,
  LabelList,
} from 'recharts';
import { CircleHelp } from 'lucide-react';
import api from '../lib/axios';
import LapDeltaChart from './charts/LapDeltaChart';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

const formatTime = (seconds) => {
  if (seconds == null || seconds === 0) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(3);
  return `${String(mins).padStart(2, '0')}:${secs.padStart(6, '0')}`;
};

const formatTimeCompact = (seconds) => {
  if (seconds == null || seconds === 0) return '';
  if (seconds < 60) return `${seconds.toFixed(2)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(2);
  return `${mins}:${secs}`;
};

const SessionPerformanceModal = ({ show, onHide, timing, vehicle }) => {
  const [laps, setLaps] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (show && timing?.id) {
      setLoading(true);
      api
        .get(`/timings/${timing.id}/laps`)
        .then((r) => setLaps(r.data?.laps || []))
        .catch(() => setLaps([]))
        .finally(() => setLoading(false));
    } else {
      setLaps([]);
    }
  }, [show, timing?.id]);

  if (!timing) return null;

  const times = laps.map((l) => parseFloat(l.lap_time_seconds) || 0).filter((t) => t > 0);
  const bestTime = timing.best_lap_timestamp ?? (times.length ? Math.min(...times) : null);
  const worstTime = timing.worst_lap_timestamp ?? (times.length ? Math.max(...times) : null);
  const meanTime = times.length ? times.reduce((a, b) => a + b, 0) / times.length : null;
  const sortedTimes = [...times].sort((a, b) => a - b);
  const medianTime = sortedTimes.length
    ? sortedTimes.length % 2 === 0
      ? (sortedTimes[sortedTimes.length / 2 - 1] + sortedTimes[sortedTimes.length / 2]) / 2
      : sortedTimes[Math.floor(sortedTimes.length / 2)]
    : null;
  const bestWorstDiff = bestTime != null && worstTime != null ? worstTime - bestTime : null;
  const consistencyScore = timing.consistency_score ?? (meanTime > 0 && times.length >= 3
    ? (Math.sqrt(times.reduce((s, t) => s + (t - meanTime) ** 2, 0) / times.length) / meanTime) * 100
    : null);

  const movingAvg = (arr, window = 3) => {
    const result = [];
    for (let i = 0; i < arr.length; i++) {
      if (i < window - 1) {
        result.push(null);
      } else {
        const slice = arr.slice(i - window + 1, i + 1);
        result.push(slice.reduce((a, b) => a + b, 0) / window);
      }
    }
    return result;
  };

  // Compute moving average once (not per-lap) for performance.
  const movingAvgs = movingAvg(times, 3);

  const evolutionData = laps.map((lap, i) => {
    const time = parseFloat(lap.lap_time_seconds) || 0;
    return {
      lap: lap.lap_number,
      time: time || null,
      movingAvg: movingAvgs[i] ?? null,
    };
  });

  const mid = Math.floor(laps.length / 2);
  const firstHalf = laps.slice(0, mid);
  const secondHalf = laps.slice(mid);
  const firstHalfTimes = firstHalf.map((l) => parseFloat(l.lap_time_seconds) || 0).filter((t) => t > 0);
  const secondHalfTimes = secondHalf.map((l) => parseFloat(l.lap_time_seconds) || 0).filter((t) => t > 0);
  const firstHalfMean = firstHalfTimes.length ? firstHalfTimes.reduce((a, b) => a + b, 0) / firstHalfTimes.length : null;
  const secondHalfMean = secondHalfTimes.length ? secondHalfTimes.reduce((a, b) => a + b, 0) / secondHalfTimes.length : null;
  const firstHalfBest = firstHalfTimes.length ? Math.min(...firstHalfTimes) : null;
  const secondHalfBest = secondHalfTimes.length ? Math.min(...secondHalfTimes) : null;

  const bucketSize = 0.5;
  const histogram = {};
  times.forEach((t) => {
    const bucket = Math.floor(t / bucketSize) * bucketSize;
    histogram[bucket] = (histogram[bucket] || 0) + 1;
  });
  const histogramData = Object.entries(histogram)
    .map(([k, v]) => ({ range: `${Number(k).toFixed(1)}s`, count: v }))
    .sort((a, b) => parseFloat(a.range) - parseFloat(b.range));

  const subtitle = [
    vehicle ? `${vehicle.manufacturer} ${vehicle.model}` : timing.vehicle_manufacturer && timing.vehicle_model ? `${timing.vehicle_manufacturer} ${timing.vehicle_model}` : null,
    new Date(timing.timing_date).toLocaleDateString(),
    timing.circuit ? `${timing.circuit}${timing.lane ? ` (Carril ${timing.lane})` : ''}` : null,
  ]
    .filter(Boolean)
    .join(' — ');

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      const delta = d.time != null && bestTime != null ? d.time - bestTime : null;
      return (
        <div className="rounded-md border bg-popover p-3 shadow-md">
          <p className="font-semibold mb-1">Vuelta {d.lap}</p>
          <p className="text-sm">Tiempo: {d.time != null ? formatTime(d.time) : '—'}</p>
          {delta != null && Math.abs(delta) > 0.001 && (
            <p className="text-sm text-muted-foreground">Delta: +{delta.toFixed(3)}s</p>
          )}
        </div>
      );
    }
    return null;
  };

  const lapsWithStats = laps.map((lap) => {
    const time = parseFloat(lap.lap_time_seconds) || 0;
    const deltaBest = bestTime != null && time > 0 ? time - bestTime : null;
    const deltaMean = meanTime != null && time > 0 ? time - meanTime : null;
    const isBest = bestTime != null && Math.abs(time - bestTime) < 0.001;
    const isWorst = worstTime != null && Math.abs(time - worstTime) < 0.001;
    return {
      ...lap,
      time,
      deltaBest,
      deltaMean,
      isBest,
      isWorst,
    };
  });

  const hasLaps = laps.length > 0;

  return (
    <Dialog open={show} onOpenChange={(open) => !open && onHide()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            <div>
              <div>Análisis de rendimiento</div>
              <small className="text-muted-foreground font-normal block mt-1">{subtitle || 'Sesión'}</small>
            </div>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-muted-foreground py-8 text-center">Cargando vueltas...</p>
        ) : !hasLaps ? (
          <p className="text-muted-foreground py-8 text-center">
            No hay datos de vueltas individuales para esta sesión.
          </p>
        ) : (
          <Tabs defaultValue="evolution" className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="evolution">Evolución</TabsTrigger>
              <TabsTrigger value="statistics">Estadísticas</TabsTrigger>
            </TabsList>

            <TabsContent value="evolution" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <Card>
                  <CardHeader className="py-2 px-3">
                    <p className="text-xs text-muted-foreground">Mejor vuelta</p>
                  </CardHeader>
                  <CardContent className="py-1 px-3 pb-3">
                    <p className="font-mono font-semibold">{formatTime(bestTime)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="py-2 px-3">
                    <p className="text-xs text-muted-foreground">Peor vuelta</p>
                  </CardHeader>
                  <CardContent className="py-1 px-3 pb-3">
                    <p className="font-mono font-semibold">{formatTime(worstTime)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="py-2 px-3">
                    <p className="text-xs text-muted-foreground">Media</p>
                  </CardHeader>
                  <CardContent className="py-1 px-3 pb-3">
                    <p className="font-mono font-semibold">{formatTime(meanTime)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="py-2 px-3">
                    <p className="text-xs text-muted-foreground">Mediana</p>
                  </CardHeader>
                  <CardContent className="py-1 px-3 pb-3">
                    <p className="font-mono font-semibold">{formatTime(medianTime)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="py-2 px-3">
                    <div className="flex items-center gap-1">
                      <p className="text-xs text-muted-foreground">Consistencia</p>
                      <TooltipProvider delayDuration={150}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="inline-flex items-center text-muted-foreground hover:text-foreground"
                              aria-label="Cómo se calcula la consistencia"
                            >
                              <CircleHelp className="size-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs leading-relaxed">
                            <p>
                              La consistencia mide la variabilidad de tus vueltas: cuanto menor sea el porcentaje, más
                              regular es la sesión.
                            </p>
                            <p className="mt-1">
                              Formula: <span className="font-mono">((desv. estandar / media) * 100)</span>.
                            </p>
                            <p className="mt-1 text-xs">Se calcula cuando hay al menos 3 vueltas válidas.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </CardHeader>
                  <CardContent className="py-1 px-3 pb-3">
                    <p
                      className={
                        consistencyScore != null
                          ? consistencyScore < 5
                            ? 'text-green-600 font-semibold'
                            : consistencyScore > 15
                              ? 'text-destructive font-semibold'
                              : 'font-semibold'
                          : ''
                      }
                    >
                      {consistencyScore != null ? `${Number(consistencyScore).toFixed(2)}%` : '—'}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="py-2 px-3">
                    <p className="text-xs text-muted-foreground">Diff. mejor-peor</p>
                  </CardHeader>
                  <CardContent className="py-1 px-3 pb-3">
                    <p className="font-mono font-semibold">
                      {bestWorstDiff != null ? `+${bestWorstDiff.toFixed(3)}s` : '—'}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <h5 className="font-semibold">Evolución de tiempos por vuelta</h5>
                </CardHeader>
                <CardContent>
                  <div style={{ width: '100%', height: 280 }}>
                    <ResponsiveContainer>
                      <LineChart data={evolutionData} margin={{ top: 20, right: 20, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                        <XAxis dataKey="lap" />
                        <YAxis
                          tickFormatter={(v) => formatTime(v)}
                          width={80}
                          domain={
                            bestTime != null && worstTime != null
                              ? [Math.max(0, bestTime - 2), worstTime + 2]
                              : undefined
                          }
                        />
                        <RechartsTooltip content={<CustomTooltip />} />
                        {bestTime != null && (
                          <ReferenceLine y={bestTime} stroke="hsl(142, 76%, 36%)" strokeDasharray="3 3" label={{ value: 'Mejor', position: 'right' }} />
                        )}
                        {meanTime != null && (
                          <ReferenceLine y={meanTime} stroke="hsl(38, 92%, 50%)" strokeDasharray="3 3" label={{ value: 'Media', position: 'right' }} />
                        )}
                        <Line
                          type="monotone"
                          dataKey="time"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          name="Tiempo"
                          dot={{ r: 3, fill: '#000', stroke: '#000' }}
                          activeDot={{ r: 4, fill: '#ef4444', stroke: '#ef4444' }}
                        >
                          <LabelList
                            dataKey="time"
                            position="top"
                            formatter={(v) => (v != null ? formatTimeCompact(v) : '')}
                            interval={evolutionData.length > 25 ? 1 : 0}
                            style={{ fontSize: 10 }}
                          />
                        </Line>
                        <Line
                          type="monotone"
                          dataKey="movingAvg"
                          stroke="hsl(var(--muted-foreground))"
                          strokeWidth={1.5}
                          strokeDasharray="5 5"
                          name="Media móvil (3)"
                          dot={false}
                          connectNulls
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-3 h-3 rounded-full shrink-0 border border-border" style={{ backgroundColor: '#000' }} />
                      Tiempo
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-6 h-1 shrink-0 border-t-2 border-dashed" style={{ borderColor: 'var(--muted-foreground)' }} />
                      Media móvil (3)
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-6 h-1 shrink-0 border-t-2 border-dashed" style={{ borderColor: 'hsl(142, 76%, 36%)' }} />
                      Mejor (referencia)
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-6 h-1 shrink-0 border-t-2 border-dashed" style={{ borderColor: 'hsl(38, 92%, 50%)' }} />
                      Media (referencia)
                    </span>
                  </div>
                </CardContent>
              </Card>

              <LapDeltaChart laps={laps} bestLapTimestamp={bestTime} />
            </TabsContent>

            <TabsContent value="statistics" className="space-y-4 mt-4">
              {firstHalf.length > 0 && secondHalf.length > 0 && (
                <Card>
                  <CardHeader>
                    <h5 className="font-semibold">Análisis por mitades</h5>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Métrica</TableHead>
                            <TableHead>Primera mitad (vueltas 1-{mid})</TableHead>
                            <TableHead>Segunda mitad (vueltas {mid + 1}-{laps.length})</TableHead>
                            <TableHead>Diferencia</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell className="font-medium">Media</TableCell>
                            <TableCell className="font-mono">{formatTime(firstHalfMean)}</TableCell>
                            <TableCell className="font-mono">{formatTime(secondHalfMean)}</TableCell>
                            <TableCell>
                              {firstHalfMean != null && secondHalfMean != null ? (
                                <span
                                  className={
                                    secondHalfMean < firstHalfMean ? 'text-green-600' : secondHalfMean > firstHalfMean ? 'text-destructive' : ''
                                  }
                                >
                                  {secondHalfMean >= firstHalfMean ? '+' : ''}
                                  {(secondHalfMean - firstHalfMean).toFixed(3)}s
                                </span>
                              ) : (
                                '—'
                              )}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">Mejor vuelta</TableCell>
                            <TableCell className="font-mono">{formatTime(firstHalfBest)}</TableCell>
                            <TableCell className="font-mono">{formatTime(secondHalfBest)}</TableCell>
                            <TableCell>
                              {firstHalfBest != null && secondHalfBest != null ? (
                                <span
                                  className={
                                    secondHalfBest < firstHalfBest ? 'text-green-600' : secondHalfBest > firstHalfBest ? 'text-destructive' : ''
                                  }
                                >
                                  {secondHalfBest >= firstHalfBest ? '+' : ''}
                                  {(secondHalfBest - firstHalfBest).toFixed(3)}s
                                </span>
                              ) : (
                                '—'
                              )}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {histogramData.length > 0 && (
                <Card>
                  <CardHeader>
                    <h5 className="font-semibold">Distribución de tiempos</h5>
                  </CardHeader>
                  <CardContent>
                    <div style={{ width: '100%', height: 200 }}>
                      <ResponsiveContainer>
                        <BarChart data={histogramData} margin={{ top: 20, right: 20, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                          <XAxis dataKey="range" />
                          <YAxis />
                          <RechartsTooltip />
                          <Legend />
                          <Bar dataKey="count" name="Vueltas" radius={[4, 4, 0, 0]} fill="hsl(var(--primary) / 0.7)" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <h5 className="font-semibold">Tabla detallada de vueltas</h5>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border overflow-x-auto max-h-[300px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Vuelta</TableHead>
                          <TableHead>Tiempo</TableHead>
                          <TableHead>Delta vs mejor</TableHead>
                          <TableHead>Delta vs media</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lapsWithStats.map((lap) => (
                          <TableRow
                            key={lap.id || lap.lap_number}
                            className={lap.isBest ? 'bg-green-50 dark:bg-green-950/20' : lap.isWorst ? 'bg-red-50 dark:bg-red-950/20' : ''}
                          >
                            <TableCell className="font-medium">{lap.lap_number}</TableCell>
                            <TableCell className="font-mono">{formatTime(lap.time)}</TableCell>
                            <TableCell className="font-mono">
                              {lap.deltaBest != null ? (lap.isBest ? '—' : `+${lap.deltaBest.toFixed(3)}s`) : '—'}
                            </TableCell>
                            <TableCell className="font-mono">
                              {lap.deltaMean != null ? (lap.deltaMean >= 0 ? '+' : '') + lap.deltaMean.toFixed(3) + 's' : '—'}
                            </TableCell>
                            <TableCell>
                              {lap.isBest && (
                                <span className="text-xs font-medium text-green-600">Mejor</span>
                              )}
                              {lap.isWorst && !lap.isBest && (
                                <span className="text-xs font-medium text-destructive">Peor</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SessionPerformanceModal;
