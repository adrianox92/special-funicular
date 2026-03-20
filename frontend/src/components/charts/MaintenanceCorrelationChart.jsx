import React, { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { formatMaintenanceKind } from '../../utils/formatUtils';

function calendarDayKey(iso) {
  return String(iso).slice(0, 10);
}

function dayKeyToAxisLabel(dayKey) {
  const [y, m, d] = dayKey.split('-').map(Number);
  if (!y || !m || !d) return dayKey;
  return new Date(y, m - 1, d).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

const convertTimeToSeconds = (timeStr) => {
  if (!timeStr) return 0;
  const match = String(timeStr).match(/^(\d{2}):(\d{2})\.(\d{3})$/);
  if (!match) return 0;
  const [, minutes, seconds, milliseconds] = match.map(Number);
  return minutes * 60 + seconds + milliseconds / 1000;
};

function groupTimingsByCircuitLane(timings) {
  const grouped = {};
  timings.forEach((timing) => {
    if (timing.circuit && timing.lane) {
      const key = `${timing.circuit}-${timing.lane}-${timing.laps || 'sin-vueltas'}`;
      if (!grouped[key]) {
        grouped[key] = {
          key,
          circuit: timing.circuit,
          lane: timing.lane,
          laps: timing.laps || 'N/A',
          timings: [],
        };
      }
      grouped[key].timings.push(timing);
    }
  });
  return Object.values(grouped).filter((g) => g.timings.length >= 2);
}

const formatTime = (seconds) => {
  if (!seconds || seconds === 0) return '00:00.000';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = (seconds % 60).toFixed(3);
  return `${String(minutes).padStart(2, '0')}:${remainingSeconds.padStart(6, '0')}`;
};

/**
 * Mejor vuelta en el tiempo + líneas verticales en días de mantenimiento que coinciden con una sesión.
 */
const MaintenanceCorrelationChart = ({ timings, maintenanceLogs }) => {
  const groups = useMemo(() => groupTimingsByCircuitLane(timings || []), [timings]);
  const [selectedKey, setSelectedKey] = useState(null);

  const activeKey = selectedKey && groups.some((g) => g.key === selectedKey) ? selectedKey : groups[0]?.key;
  const group = groups.find((g) => g.key === activeKey);

  const { chartData, refLines } = useMemo(() => {
    if (!group) return { chartData: [], refLines: [] };

    const filteredTimings = group.timings.filter((t) => t.circuit === group.circuit && t.lane === group.lane);
    const sessionDays = new Set(filteredTimings.map((t) => calendarDayKey(t.timing_date)));

    const chartDataInner = filteredTimings
      .sort((a, b) => new Date(a.timing_date) - new Date(b.timing_date))
      .map((timing) => {
        const dayKey = calendarDayKey(timing.timing_date);
        return {
          date: dayKeyToAxisLabel(dayKey),
          dayKey,
          bestLap: convertTimeToSeconds(timing.best_lap_time),
          laps: timing.laps,
        };
      });

    const byAxisDate = new Map();
    (maintenanceLogs || []).forEach((log) => {
      const logDay = calendarDayKey(log.performed_at);
      if (!sessionDays.has(logDay)) return;
      const x = dayKeyToAxisLabel(logDay);
      if (!byAxisDate.has(x)) byAxisDate.set(x, []);
      byAxisDate.get(x).push(log);
    });

    const refLinesInner = Array.from(byAxisDate.entries()).map(([x, logs]) => ({
      x,
      label: logs.map((l) => formatMaintenanceKind(l.kind)).join(', '),
    }));

    return { chartData: chartDataInner, refLines: refLinesInner };
  }, [group, maintenanceLogs]);

  if (groups.length === 0) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <h5 className="font-semibold">Mantenimiento y telemetría</h5>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Necesitas al menos dos sesiones con el mismo circuito y carril para ver la correlación con el historial de
            mantenimiento.
          </p>
        </CardContent>
      </Card>
    );
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const row = payload[0]?.payload;
      return (
        <div className="rounded-md border bg-popover p-3 shadow-md">
          <p className="font-semibold mb-2">Fecha: {label}</p>
          <p className="mb-1 text-sm">Mejor vuelta: {formatTime(payload[0].value)}</p>
          {row?.laps != null && <p className="mb-0 text-xs text-muted-foreground">Vueltas: {row.laps}</p>}
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="mb-6">
      <CardHeader className="space-y-3">
        <h5 className="font-semibold">Mantenimiento y evolución de mejor vuelta</h5>
        <div className="flex flex-col gap-2 max-w-md">
          <Label htmlFor="maint-corr-group">Circuito / carril / vueltas</Label>
          <Select value={activeKey || ''} onValueChange={setSelectedKey}>
            <SelectTrigger id="maint-corr-group">
              <SelectValue placeholder="Seleccionar grupo" />
            </SelectTrigger>
            <SelectContent>
              {groups.map((g) => (
                <SelectItem key={g.key} value={g.key}>
                  {g.circuit} — Carril {g.lane} — {g.laps} vuelta(s)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length < 2 ? (
          <p className="text-sm text-muted-foreground">No hay suficientes puntos en este grupo.</p>
        ) : (
          <>
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <LineChart data={chartData} margin={{ top: 24, right: 24, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="date" angle={-45} textAnchor="end" height={72} tick={{ fontSize: 10 }} />
                  <YAxis
                    tickFormatter={formatTime}
                    domain={['dataMin - 0.5', 'dataMax + 0.5']}
                    width={80}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="bestLap"
                    stroke="#8884d8"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Mejor vuelta"
                  />
                  {refLines.map((rl) => (
                    <ReferenceLine
                      key={rl.x}
                      x={rl.x}
                      stroke="#f97316"
                      strokeDasharray="4 4"
                      label={{
                        value: rl.label.length > 28 ? `${rl.label.slice(0, 28)}…` : rl.label,
                        position: 'top',
                        fill: '#ea580c',
                        fontSize: 10,
                      }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Las líneas naranjas marcan mantenimientos en días en los que hay una sesión registrada en este circuito,
              carril y número de vueltas. Es una correlación visual aproximada, no causal.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default MaintenanceCorrelationChart;
