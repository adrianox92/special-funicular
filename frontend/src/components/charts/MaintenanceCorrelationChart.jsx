import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { formatMaintenanceKind, getIntlLocale } from '../../utils/formatUtils';

function calendarDayKey(iso) {
  return String(iso).slice(0, 10);
}

function dayKeyToAxisLabel(dayKey) {
  const [y, m, d] = dayKey.split('-').map(Number);
  if (!y || !m || !d) return dayKey;
  return new Date(y, m - 1, d).toLocaleDateString(getIntlLocale(), {
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
          laps: timing.laps ?? null,
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

const MaintenanceCorrelationChart = ({ timings, maintenanceLogs }) => {
  const { t } = useTranslation('vehicles');
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

  const formatGroupOption = (g) => {
    const lapsDisplay = g.laps ?? 'N/A';
    if (g.laps == null) {
      return t('maintenance.chart.groupOptionLapsNA', { circuit: g.circuit, lane: g.lane });
    }
    return t('maintenance.chart.groupOption', { circuit: g.circuit, lane: g.lane, laps: lapsDisplay });
  };

  if (groups.length === 0) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <h5 className="font-semibold">{t('maintenance.chart.emptyTitle')}</h5>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t('maintenance.chart.emptyDescription')}</p>
        </CardContent>
      </Card>
    );
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const row = payload[0]?.payload;
      return (
        <div className="rounded-md border bg-popover p-3 shadow-md">
          <p className="font-semibold mb-2">{t('maintenance.chart.tooltipDate', { date: label })}</p>
          <p className="mb-1 text-sm">{t('maintenance.chart.tooltipBestLap', { time: formatTime(payload[0].value) })}</p>
          {row?.laps != null && (
            <p className="mb-0 text-xs text-muted-foreground">{t('maintenance.chart.tooltipLaps', { laps: row.laps })}</p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="mb-6">
      <CardHeader className="space-y-3">
        <h5 className="font-semibold">{t('maintenance.chart.title')}</h5>
        <div className="flex flex-col gap-2 max-w-md">
          <Label htmlFor="maint-corr-group">{t('maintenance.chart.groupLabel')}</Label>
          <Select value={activeKey || ''} onValueChange={setSelectedKey}>
            <SelectTrigger id="maint-corr-group">
              <SelectValue placeholder={t('maintenance.chart.groupPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {groups.map((g) => (
                <SelectItem key={g.key} value={g.key}>
                  {formatGroupOption(g)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length < 2 ? (
          <p className="text-sm text-muted-foreground">{t('maintenance.chart.insufficientPoints')}</p>
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
                    name={t('maintenance.chart.lineName')}
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
            <p className="text-xs text-muted-foreground mt-3">{t('maintenance.chart.footnote')}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default MaintenanceCorrelationChart;
