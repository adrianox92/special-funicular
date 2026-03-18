import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardContent, CardHeader } from '../ui/card';

const LapDeltaChart = ({ laps, bestLapTimestamp }) => {
  if (!laps || laps.length === 0) return null;

  const bestTime = bestLapTimestamp ?? Math.min(...laps.map((l) => parseFloat(l.lap_time_seconds) || Infinity));
  if (bestTime === Infinity) return null;

  const chartData = laps.map((lap) => {
    const time = parseFloat(lap.lap_time_seconds) || 0;
    const delta = time - bestTime;
    return {
      lap: lap.lap_number,
      name: `Vuelta ${lap.lap_number}`,
      delta,
      time,
      isBest: Math.abs(delta) < 0.001,
    };
  });

  const maxDelta = Math.max(...chartData.map((d) => d.delta), 0.1);

  const getBarColor = (delta) => {
    if (Math.abs(delta) < 0.001) return 'var(--primary)';
    const ratio = delta / maxDelta;
    if (ratio <= 0.33) return 'hsl(142, 76%, 36%)';
    if (ratio <= 0.66) return 'hsl(38, 92%, 50%)';
    return 'var(--destructive)';
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-md border bg-popover p-3 shadow-md">
          <p className="font-semibold mb-1">{data.name}</p>
          <p className="text-sm">Delta: +{data.delta.toFixed(3)}s</p>
          {data.isBest && <p className="text-sm text-primary font-medium">Mejor vuelta</p>}
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="mb-4">
      <CardHeader>
        <h5 className="font-semibold">Delta vs mejor vuelta</h5>
      </CardHeader>
      <CardContent>
        <div style={{ width: '100%', height: 250 }}>
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 20, right: 20, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="lap" name="Vuelta" />
              <YAxis tickFormatter={(v) => `+${v.toFixed(2)}s`} width={60} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="delta" name="Delta vs mejor vuelta" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getBarColor(entry.delta)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm shrink-0 border border-border" style={{ backgroundColor: 'var(--primary)' }} />
            Mejor vuelta
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm shrink-0 border border-border" style={{ backgroundColor: 'hsl(142, 76%, 36%)' }} />
            Cercano a la mejor (&lt;33% del rango)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm shrink-0 border border-border" style={{ backgroundColor: 'hsl(38, 92%, 50%)' }} />
            Desviación media (33-66%)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm shrink-0 border border-border" style={{ backgroundColor: 'var(--destructive)' }} />
            Mayor desviación (&gt;66%)
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

export default LapDeltaChart;
