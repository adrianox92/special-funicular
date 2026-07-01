import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Label } from '../ui/label';

const timeToSeconds = (val) => {
  if (val == null || val === '') return null;
  if (typeof val === 'number' && !Number.isNaN(val)) return val;
  const str = String(val).trim();
  const m = str.match(/^(\d{1,2}):(\d{2})\.(\d{1,3})$/);
  if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + parseInt(m[3].padStart(3, '0'), 10) / 1000;
  const n = parseFloat(str.replace(',', '.'));
  return Number.isNaN(n) ? null : n;
};

const formatTime = (seconds) => {
  if (seconds == null || Number.isNaN(seconds)) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(3);
  return `${String(mins).padStart(2, '0')}:${secs.padStart(6, '0')}`;
};

function groupKey(t) {
  return `${t.circuit_id || t.circuit || '—'}::${t.lane ?? '—'}`;
}

export default function VoltagePerformanceChart({ timings = [] }) {
  const { t } = useTranslation('timings');
  const withVoltage = useMemo(
    () =>
      (timings || []).filter(
        (t) => t.supply_voltage_volts != null && Number.isFinite(Number(t.supply_voltage_volts)),
      ),
    [timings],
  );

  const groups = useMemo(() => {
    const map = {};
    withVoltage.forEach((t) => {
      const k = groupKey(t);
      if (!map[k]) {
        map[k] = {
          key: k,
          circuit: t.circuit || t.circuits?.name || '—',
          lane: t.lane ?? '—',
          points: [],
        };
      }
      const sec = t.best_lap_timestamp ?? timeToSeconds(t.best_lap_time);
      if (sec == null) return;
      map[k].points.push({
        id: t.id,
        voltage: Number(t.supply_voltage_volts),
        bestLap: sec,
        date: t.timing_date,
      });
    });
    return Object.values(map).filter((g) => g.points.length >= 2);
  }, [withVoltage]);

  const [selectedKey, setSelectedKey] = useState('');

  const activeKey = selectedKey || groups[0]?.key || '';
  const activeGroup = groups.find((g) => g.key === activeKey);

  const analysis = useMemo(() => {
    if (!activeGroup || activeGroup.points.length < 2) return null;
    const points = activeGroup.points;
    const byVolt = {};
    points.forEach((p) => {
      const vKey = p.voltage.toFixed(1);
      if (!byVolt[vKey]) byVolt[vKey] = [];
      byVolt[vKey].push(p.bestLap);
    });
    const bands = Object.entries(byVolt)
      .filter(([, laps]) => laps.length >= 1)
      .map(([v, laps]) => ({
        voltage: parseFloat(v),
        avgPb: laps.reduce((a, b) => a + b, 0) / laps.length,
        count: laps.length,
      }));
    const suggested = bands.filter((b) => b.count >= 3).sort((a, b) => a.avgPb - b.avgPb)[0];
    const overallPb = Math.min(...points.map((p) => p.bestLap));
    const latest = [...points].sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
    const relativeThreshold = suggested ? suggested.voltage * 0.95 : null;
    const voltageAlert =
      suggested &&
      latest &&
      latest.bestLap > overallPb + 0.15 &&
      latest.voltage < relativeThreshold;

    return { suggested, overallPb, latest, voltageAlert, scatter: points };
  }, [activeGroup]);

  if (withVoltage.length < 2) {
    return (
      <Alert>
        <AlertDescription>{t('voltageChart.insufficient')}</AlertDescription>
      </Alert>
    );
  }

  if (groups.length === 0) {
    return (
      <Alert>
        <AlertDescription>{t('voltageChart.noValidPoints')}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <h5 className="font-semibold text-sm">{t('voltageChart.title')}</h5>
        <p className="text-xs text-muted-foreground font-normal">{t('voltageChart.hint')}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {groups.length > 1 && (
          <div className="space-y-2 max-w-xs">
            <Label>{t('voltageChart.groupLabel')}</Label>
            <Select value={activeKey} onValueChange={setSelectedKey}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g.key} value={g.key}>
                    {g.circuit} — {t('lane', { lane: g.lane })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {analysis?.voltageAlert && (
          <Alert variant="destructive">
            <AlertDescription>{t('voltageChart.slowLowVoltage')}</AlertDescription>
          </Alert>
        )}

        {analysis?.suggested && (
          <p className="text-sm text-muted-foreground">
            {t('voltageChart.suggestedBand', {
              min: (analysis.suggested.voltage - 0.2).toFixed(1),
              max: (analysis.suggested.voltage + 0.2).toFixed(1),
              avg: formatTime(analysis.suggested.avgPb),
              count: analysis.suggested.count,
            })}
          </p>
        )}

        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <ScatterChart margin={{ top: 16, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="voltage"
                name={t('voltageChart.axisVoltage')}
                domain={['auto', 'auto']}
                tickFormatter={(v) => `${v}V`}
              />
              <YAxis
                type="number"
                dataKey="bestLap"
                name={t('bestLap')}
                tickFormatter={(v) => formatTime(v)}
                width={72}
              />
              <Tooltip
                formatter={(val, name) =>
                  name === t('bestLap') ? formatTime(val) : `${Number(val).toFixed(2)} V`
                }
              />
              {analysis?.suggested && (
                <ReferenceArea
                  x1={analysis.suggested.voltage - 0.2}
                  x2={analysis.suggested.voltage + 0.2}
                  strokeOpacity={0.2}
                  fill="hsl(var(--primary))"
                  fillOpacity={0.08}
                />
              )}
              {analysis?.overallPb != null && (
                <ReferenceLine y={analysis.overallPb} stroke="hsl(142, 76%, 36%)" strokeDasharray="4 4" />
              )}
              <Scatter data={analysis?.scatter || []} fill="hsl(var(--primary))" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
