import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader } from './ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
  Cell,
} from 'recharts';
import { Check } from 'lucide-react';
import { formatDistance } from '../utils/formatUtils';
import { getVehicleComponentTypeLabel } from '../data/componentTypes';

const formatTime = (seconds) => {
  if (seconds == null || seconds === 0) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(3);
  return `${String(mins).padStart(2, '0')}:${secs.padStart(6, '0')}`;
};

const timeToSeconds = (val) => {
  if (val == null || val === '') return null;
  if (typeof val === 'number' && !isNaN(val)) return val;
  const str = String(val).trim();
  const m = str.match(/^(\d{1,2}):(\d{2})\.(\d{1,3})$/);
  if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + parseInt(m[3].padStart(3, '0'), 10) / 1000;
  const n = parseFloat(str.replace(',', '.'));
  return isNaN(n) ? null : n;
};

export const getConfigFingerprint = (snapshot) => {
  if (!snapshot) return null;
  try {
    const specs = typeof snapshot === 'string' ? JSON.parse(snapshot) : snapshot;
    if (!Array.isArray(specs) || specs.length === 0) return null;
    const sorted = [...specs].sort((a, b) => {
      const typeA = a.component_type || '';
      const typeB = b.component_type || '';
      if (typeA !== typeB) return typeA.localeCompare(typeB);
      const keyA = [a.element, a.manufacturer, a.size, a.teeth, a.rpm].map((v) => String(v ?? '')).join('|');
      const keyB = [b.element, b.manufacturer, b.size, b.teeth, b.rpm].map((v) => String(v ?? '')).join('|');
      return keyA.localeCompare(keyB);
    });
    return JSON.stringify(sorted.map((c) => ({
      component_type: c.component_type,
      element: c.element,
      manufacturer: c.manufacturer,
      size: c.size,
      teeth: c.teeth,
      rpm: c.rpm,
      material: c.material,
    })));
  } catch {
    return null;
  }
};

const getKeyDiffs = (prevSpecs, currSpecs) => {
  if (!prevSpecs || !currSpecs) return [];
  const prev = typeof prevSpecs === 'string' ? JSON.parse(prevSpecs) : prevSpecs;
  const curr = typeof currSpecs === 'string' ? JSON.parse(currSpecs) : currSpecs;
  const diffs = [];
  const prevByType = {};
  const currByType = {};
  prev.forEach((c) => {
    if (!prevByType[c.component_type]) prevByType[c.component_type] = [];
    prevByType[c.component_type].push(c);
  });
  curr.forEach((c) => {
    if (!currByType[c.component_type]) currByType[c.component_type] = [];
    currByType[c.component_type].push(c);
  });
  const types = new Set([...Object.keys(prevByType), ...Object.keys(currByType)]);
  types.forEach((type) => {
    const p = prevByType[type] || [];
    const c = currByType[type] || [];
    const pStr = p.map((x) => `${x.element || ''}|${x.teeth ?? ''}|${x.rpm ?? ''}`).sort().join(';');
    const cStr = c.map((x) => `${x.element || ''}|${x.teeth ?? ''}|${x.rpm ?? ''}`).sort().join(';');
    if (pStr !== cStr) {
      const label = getVehicleComponentTypeLabel(type);
      const pDesc = p.length ? p.map((x) => (x.teeth != null ? `${x.element || '-'} ${x.teeth}T` : x.rpm != null ? `${x.element || '-'} ${x.rpm}RPM` : x.element || '-')).join(', ') : '—';
      const cDesc = c.length ? c.map((x) => (x.teeth != null ? `${x.element || '-'} ${x.teeth}T` : x.rpm != null ? `${x.element || '-'} ${x.rpm}RPM` : x.element || '-')).join(', ') : '—';
      diffs.push(`${label}: ${pDesc} → ${cDesc}`);
    }
  });
  return diffs;
};

export const hasMultipleConfigs = (timings = []) => {
  const withSnapshot = timings.filter((t) => t.setup_snapshot);
  const fingerprints = new Set();
  withSnapshot.forEach((t) => {
    const fp = getConfigFingerprint(t.setup_snapshot);
    if (fp) fingerprints.add(fp);
  });
  return fingerprints.size >= 2;
};

const getBetterConfig = (key, configs) => {
  const lowerIsBetter = ['best_lap_timestamp', 'average_time_timestamp', 'worst_lap_timestamp'];
  const higherIsBetter = ['laps', 'total_distance_meters', 'avg_speed_kmh', 'avg_speed_scale_kmh', 'best_lap_speed_kmh', 'consistency_score'];
  let bestIdx = 0;
  let bestVal = configs[0]?.stats?.[key];
  for (let i = 1; i < configs.length; i++) {
    const val = configs[i]?.stats?.[key];
    if (val == null) continue;
    if (bestVal == null) {
      bestIdx = i;
      bestVal = val;
      continue;
    }
    const numVal = typeof val === 'number' ? val : timeToSeconds(val);
    const numBest = typeof bestVal === 'number' ? bestVal : timeToSeconds(bestVal);
    if (numVal == null || isNaN(numVal)) continue;
    if (numBest == null || isNaN(numBest)) {
      bestIdx = i;
      bestVal = val;
      continue;
    }
    if (lowerIsBetter.includes(key) && numVal < numBest) {
      bestIdx = i;
      bestVal = val;
    } else if (higherIsBetter.includes(key) && numVal > numBest) {
      bestIdx = i;
      bestVal = val;
    }
  }
  return bestIdx;
};

/** Agrega métricas de un conjunto de sesiones (misma lógica que por grupo de config). */
const aggregateStats = (sessions) => {
  const bestLaps = sessions
    .map((s) => s.best_lap_timestamp ?? timeToSeconds(s.best_lap_time))
    .filter((v) => v != null && !isNaN(v));
  const avgTimes = sessions
    .map((s) => s.average_time_timestamp ?? timeToSeconds(s.average_time))
    .filter((v) => v != null && !isNaN(v));
  const speeds = sessions.map((s) => s.avg_speed_kmh).filter((v) => v != null && !isNaN(v));
  return {
    best_lap_timestamp: bestLaps.length ? Math.min(...bestLaps) : null,
    average_time_timestamp: avgTimes.length ? avgTimes.reduce((a, b) => a + b, 0) / avgTimes.length : null,
    avg_speed_kmh: speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : null,
  };
};

const laneKeyForTiming = (t) => `${t.circuit_id || t.circuit || ''}::${t.lane}`;

const hasLane = (t) => t.lane != null && String(t.lane).trim() !== '';

/** Entre dos valores de una métrica: quién gana ('prev' | 'curr') o empate/null. */
const getBetterBetween = (key, prevVal, currVal) => {
  const lowerIsBetter = ['best_lap_timestamp', 'average_time_timestamp'];
  const higherIsBetter = ['avg_speed_kmh'];
  if (prevVal == null && currVal == null) return null;
  if (prevVal == null) return 'curr';
  if (currVal == null) return 'prev';
  const numP = typeof prevVal === 'number' ? prevVal : timeToSeconds(prevVal);
  const numC = typeof currVal === 'number' ? currVal : timeToSeconds(currVal);
  if (numP == null || isNaN(numP)) return 'curr';
  if (numC == null || isNaN(numC)) return 'prev';
  if (lowerIsBetter.includes(key)) {
    if (numP < numC) return 'prev';
    if (numC < numP) return 'curr';
    return null;
  }
  if (higherIsBetter.includes(key)) {
    if (numP > numC) return 'prev';
    if (numC > numP) return 'curr';
    return null;
  }
  return null;
};

const SetupPerformanceAnalysis = ({ timings = [] }) => {
  const { configGroups, barChartData, timelineData, laneComparisons } = useMemo(() => {
    const withSnapshot = timings.filter((t) => t.setup_snapshot);
    const byFingerprint = {};
    withSnapshot.forEach((t) => {
      const fp = getConfigFingerprint(t.setup_snapshot);
      if (!fp) return;
      if (!byFingerprint[fp]) {
        byFingerprint[fp] = { fingerprint: fp, timings: [], setupSnapshot: t.setup_snapshot };
      }
      byFingerprint[fp].timings.push(t);
    });

    const groups = Object.values(byFingerprint);
    if (groups.length < 2) {
      return { configGroups: [], barChartData: [], timelineData: [], laneComparisons: [] };
    }

    groups.forEach((g) => {
      g.timings.sort((a, b) => new Date(a.timing_date) - new Date(b.timing_date));
    });

    const sortedGroups = groups.sort(
      (a, b) => new Date(a.timings[0].timing_date) - new Date(b.timings[0].timing_date)
    );

    const configGroups = sortedGroups.map((g, idx) => {
      const sessions = g.timings;
      const bestLaps = sessions.map((s) => s.best_lap_timestamp ?? timeToSeconds(s.best_lap_time)).filter((v) => v != null && !isNaN(v));
      const avgTimes = sessions.map((s) => s.average_time_timestamp ?? timeToSeconds(s.average_time)).filter((v) => v != null && !isNaN(v));
      const speeds = sessions.map((s) => s.avg_speed_kmh).filter((v) => v != null && !isNaN(v));
      const bestLap = bestLaps.length ? Math.min(...bestLaps) : null;
      const avgTime = avgTimes.length ? avgTimes.reduce((a, b) => a + b, 0) / avgTimes.length : null;
      const avgSpeed = speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : null;
      const firstDate = sessions[0]?.timing_date;
      const lastDate = sessions[sessions.length - 1]?.timing_date;
      const prevGroup = idx > 0 ? sortedGroups[idx - 1] : null;
      const keyDiffs = prevGroup ? getKeyDiffs(prevGroup.setupSnapshot, g.setupSnapshot) : [];

      return {
        label: `Config ${idx + 1}`,
        sessions,
        keyDiffs,
        stats: {
          best_lap_timestamp: bestLap,
          average_time_timestamp: avgTime,
          avg_speed_kmh: avgSpeed,
          laps: sessions.reduce((sum, s) => sum + (s.laps || 0), 0),
          total_distance_meters: sessions.reduce((sum, s) => sum + (s.total_distance_meters || 0), 0),
          consistency_score: sessions.filter((s) => s.consistency_score != null).length
            ? sessions.reduce((sum, s) => sum + (s.consistency_score || 0), 0) / sessions.filter((s) => s.consistency_score != null).length
            : null,
        },
        firstDate,
        lastDate,
        sessionCount: sessions.length,
      };
    });

    const barChartData = configGroups.map((cg, i) => ({
      name: cg.label,
      bestLap: cg.stats.best_lap_timestamp,
      avgLap: cg.stats.average_time_timestamp,
      avgSpeed: cg.stats.avg_speed_kmh,
      sessions: cg.sessionCount,
    }));

    const allTimingsSorted = [...withSnapshot].sort((a, b) => new Date(a.timing_date) - new Date(b.timing_date));
    const fpByTiming = {};
    allTimingsSorted.forEach((t) => {
      fpByTiming[t.id] = getConfigFingerprint(t.setup_snapshot);
    });

    let lastFp = null;
    const timelineData = allTimingsSorted.map((t, i) => {
      const fp = fpByTiming[t.id];
      const configIdx = sortedGroups.findIndex((g) => g.fingerprint === fp);
      const configLabel = configIdx >= 0 ? configGroups[configIdx].label : '?';
      const isChange = lastFp != null && fp !== lastFp;
      lastFp = fp;
      return {
        date: new Date(t.timing_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' }),
        bestLap: t.best_lap_timestamp ?? timeToSeconds(t.best_lap_time),
        configLabel,
        configIdx,
        isChange,
      };
    });

    const currentGroup = sortedGroups[sortedGroups.length - 1];
    const laneComparisons = sortedGroups.slice(0, -1)
      .map((prevG, idx) => {
        const prevMap = {};
        const currMap = {};
        prevG.timings.filter(hasLane).forEach((t) => {
          const k = laneKeyForTiming(t);
          if (!prevMap[k]) prevMap[k] = [];
          prevMap[k].push(t);
        });
        currentGroup.timings.filter(hasLane).forEach((t) => {
          const k = laneKeyForTiming(t);
          if (!currMap[k]) currMap[k] = [];
          currMap[k].push(t);
        });
        const common = Object.keys(prevMap).filter((k) => currMap[k]);
        common.sort((a, b) => a.localeCompare(b, 'es'));
        const rows = common.map((k) => {
          const sample = prevMap[k][0];
          const circuitLabel = sample.circuit || k.split('::')[0] || '—';
          return {
            key: k,
            circuitLabel,
            lane: sample.lane,
            prev: aggregateStats(prevMap[k]),
            curr: aggregateStats(currMap[k]),
          };
        });
        return {
          prevLabel: `Config ${idx + 1}`,
          currLabel: `Config ${sortedGroups.length} (actual)`,
          rows,
        };
      })
      .filter((c) => c.rows.length > 0);

    return { configGroups, barChartData, timelineData, laneComparisons };
  }, [timings]);

  if (configGroups.length < 2) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <p>No hay suficientes configuraciones distintas para comparar.</p>
        <p className="text-sm mt-1">Se necesitan al menos 2 reglajes diferentes registrados en sesiones de tiempo.</p>
      </div>
    );
  }

  const comparisonRows = [
    { key: 'best_lap_timestamp', label: 'Mejor vuelta', fmt: (s) => formatTime(s?.best_lap_timestamp) },
    { key: 'average_time_timestamp', label: 'Promedio', fmt: (s) => formatTime(s?.average_time_timestamp) },
    { key: 'avg_speed_kmh', label: 'Velocidad media (km/h)', fmt: (s) => (s?.avg_speed_kmh != null ? Number(s.avg_speed_kmh).toFixed(1) : '—') },
    { key: 'laps', label: 'Vueltas totales', fmt: (s) => s?.laps ?? '—' },
    { key: 'total_distance_meters', label: 'Distancia', fmt: (s) => formatDistance(s?.total_distance_meters) },
    { key: 'consistency_score', label: 'Consistencia (%)', fmt: (s) => (s?.consistency_score != null ? `${Number(s.consistency_score).toFixed(2)}%` : '—') },
  ];

  const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">
        Comparativa de rendimiento entre las distintas configuraciones registradas. Cada configuración agrupa las sesiones con el mismo reglaje de componentes.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {configGroups.map((cg, idx) => (
          <Card key={cg.label}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <h5 className="font-semibold">{cg.label}</h5>
                <span className="text-xs text-muted-foreground">{cg.sessionCount} sesiones</span>
              </div>
              {cg.keyDiffs.length > 0 && (
                <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                  {cg.keyDiffs.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-sm">
                <span className="text-muted-foreground">Vigencia: </span>
                {new Date(cg.firstDate).toLocaleDateString()} — {new Date(cg.lastDate).toLocaleDateString()}
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Mejor vuelta: </span>
                  <span className="font-mono font-medium">{formatTime(cg.stats.best_lap_timestamp)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Promedio: </span>
                  <span className="font-mono font-medium">{formatTime(cg.stats.average_time_timestamp)}</span>
                </div>
                {cg.stats.avg_speed_kmh != null && (
                  <div>
                    <span className="text-muted-foreground">Vel. media: </span>
                    <span className="font-medium">{Number(cg.stats.avg_speed_kmh).toFixed(1)} km/h</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <h5 className="font-semibold">Tabla comparativa</h5>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Métrica</TableHead>
                  {configGroups.map((cg) => (
                    <TableHead key={cg.label}>{cg.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparisonRows.map((row) => {
                  const bestIdx = getBetterConfig(row.key, configGroups);
                  return (
                    <TableRow key={row.key}>
                      <TableCell className="font-medium">{row.label}</TableCell>
                      {configGroups.map((cg, idx) => (
                        <TableCell
                          key={cg.label}
                          className={bestIdx === idx ? 'bg-green-100 dark:bg-green-950/50 font-medium' : ''}
                        >
                          {row.fmt(cg.stats)}
                          {bestIdx === idx && (
                            <Check className="ml-1.5 inline size-4 align-middle text-green-600 dark:text-green-400" aria-label="Mejor" />
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <h5 className="font-semibold">Mejor vuelta y promedio por configuración</h5>
          </CardHeader>
          <CardContent>
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={barChartData} margin={{ top: 20, right: 20, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" angle={-15} textAnchor="end" height={60} />
                  <YAxis tickFormatter={(v) => formatTime(v)} width={70} />
                  <Tooltip
                    formatter={(value, name) => {
                      if (name === 'Mejor vuelta' || name === 'Promedio') return formatTime(value);
                      return value;
                    }}
                    labelFormatter={(label) => `Configuración: ${label}`}
                  />
                  <Legend />
                  <Bar dataKey="bestLap" name="Mejor vuelta" radius={[4, 4, 0, 0]}>
                    {barChartData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                  <Bar dataKey="avgLap" name="Promedio" radius={[4, 4, 0, 0]} opacity={0.85}>
                    {barChartData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} opacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h5 className="font-semibold">Evolución en el tiempo</h5>
            <p className="text-sm text-muted-foreground font-normal">Mejor vuelta por sesión. Líneas verticales indican cambio de configuración.</p>
          </CardHeader>
          <CardContent>
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <LineChart data={timelineData} margin={{ top: 20, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={(v) => formatTime(v)} width={70} />
                  <Tooltip
                    formatter={(value) => formatTime(value)}
                    content={({ active, payload, label }) => {
                      if (active && payload?.length && payload[0]?.payload) {
                        const p = payload[0].payload;
                        return (
                          <div className="rounded-md border bg-popover p-3 shadow-md">
                            <p className="font-medium">{label}</p>
                            <p className="text-sm">Mejor vuelta: {formatTime(p.bestLap)}</p>
                            <p className="text-sm text-muted-foreground">Config: {p.configLabel}</p>
                            {p.isChange && <p className="text-xs text-primary font-medium">Cambio de configuración</p>}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                  {timelineData.filter((d) => d.isChange).map((d, i) => (
                    <ReferenceLine key={i} x={d.date} stroke="hsl(var(--primary))" strokeDasharray="4 4" />
                  ))}
                  <Line
                    type="monotone"
                    dataKey="bestLap"
                    name="Mejor vuelta"
                    stroke={COLORS[0]}
                    strokeWidth={2}
                    dot={(props) => {
                      const { cx, cy, payload } = props;
                      const color = payload.configIdx >= 0 ? COLORS[payload.configIdx % COLORS.length] : COLORS[0];
                      return <circle cx={cx} cy={cy} r={4} fill={color} stroke="hsl(var(--background))" strokeWidth={1} />;
                    }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {laneComparisons.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold">Comparativa por carril entre reglajes</h4>
          <p className="text-sm text-muted-foreground">
            Solo se muestran circuito y carril donde hay sesiones en el reglaje anterior y en el actual. Métricas agregadas por carril dentro de cada configuración.
          </p>
          {laneComparisons.map((comparison) => (
            <Card key={`${comparison.prevLabel}-${comparison.currLabel}`}>
              <CardHeader>
                <h5 className="font-semibold">
                  {comparison.prevLabel} → {comparison.currLabel}
                </h5>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead rowSpan={2} className="align-bottom">
                          Circuito
                        </TableHead>
                        <TableHead rowSpan={2} className="align-bottom">
                          Carril
                        </TableHead>
                        <TableHead colSpan={2} className="text-center border-l">
                          Mejor vuelta
                        </TableHead>
                        <TableHead colSpan={2} className="text-center border-l">
                          Promedio
                        </TableHead>
                        <TableHead colSpan={2} className="text-center border-l">
                          Vel. media (km/h)
                        </TableHead>
                      </TableRow>
                      <TableRow>
                        <TableHead className="border-l text-xs font-normal">{comparison.prevLabel}</TableHead>
                        <TableHead className="text-xs font-normal">{comparison.currLabel}</TableHead>
                        <TableHead className="border-l text-xs font-normal">{comparison.prevLabel}</TableHead>
                        <TableHead className="text-xs font-normal">{comparison.currLabel}</TableHead>
                        <TableHead className="border-l text-xs font-normal">{comparison.prevLabel}</TableHead>
                        <TableHead className="text-xs font-normal">{comparison.currLabel}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {comparison.rows.map((row) => {
                        const bestBest = getBetterBetween('best_lap_timestamp', row.prev.best_lap_timestamp, row.curr.best_lap_timestamp);
                        const bestAvg = getBetterBetween('average_time_timestamp', row.prev.average_time_timestamp, row.curr.average_time_timestamp);
                        const bestSpd = getBetterBetween('avg_speed_kmh', row.prev.avg_speed_kmh, row.curr.avg_speed_kmh);
                        const winClass = 'bg-green-100 dark:bg-green-950/50 font-medium';
                        return (
                          <TableRow key={row.key}>
                            <TableCell>{row.circuitLabel}</TableCell>
                            <TableCell>{row.lane}</TableCell>
                            <TableCell className={`border-l ${bestBest === 'prev' ? winClass : ''}`}>
                              <span className="font-mono">{formatTime(row.prev.best_lap_timestamp)}</span>
                              {bestBest === 'prev' && (
                                <Check className="ml-1 inline size-4 align-middle text-green-600 dark:text-green-400" aria-label="Mejor" />
                              )}
                            </TableCell>
                            <TableCell className={bestBest === 'curr' ? winClass : ''}>
                              <span className="font-mono">{formatTime(row.curr.best_lap_timestamp)}</span>
                              {bestBest === 'curr' && (
                                <Check className="ml-1 inline size-4 align-middle text-green-600 dark:text-green-400" aria-label="Mejor" />
                              )}
                            </TableCell>
                            <TableCell className={`border-l ${bestAvg === 'prev' ? winClass : ''}`}>
                              <span className="font-mono">{formatTime(row.prev.average_time_timestamp)}</span>
                              {bestAvg === 'prev' && (
                                <Check className="ml-1 inline size-4 align-middle text-green-600 dark:text-green-400" aria-label="Mejor" />
                              )}
                            </TableCell>
                            <TableCell className={bestAvg === 'curr' ? winClass : ''}>
                              <span className="font-mono">{formatTime(row.curr.average_time_timestamp)}</span>
                              {bestAvg === 'curr' && (
                                <Check className="ml-1 inline size-4 align-middle text-green-600 dark:text-green-400" aria-label="Mejor" />
                              )}
                            </TableCell>
                            <TableCell className={`border-l ${bestSpd === 'prev' ? winClass : ''}`}>
                              {row.prev.avg_speed_kmh != null ? Number(row.prev.avg_speed_kmh).toFixed(1) : '—'}
                              {bestSpd === 'prev' && (
                                <Check className="ml-1 inline size-4 align-middle text-green-600 dark:text-green-400" aria-label="Mejor" />
                              )}
                            </TableCell>
                            <TableCell className={bestSpd === 'curr' ? winClass : ''}>
                              {row.curr.avg_speed_kmh != null ? Number(row.curr.avg_speed_kmh).toFixed(1) : '—'}
                              {bestSpd === 'curr' && (
                                <Check className="ml-1 inline size-4 align-middle text-green-600 dark:text-green-400" aria-label="Mejor" />
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default SetupPerformanceAnalysis;
