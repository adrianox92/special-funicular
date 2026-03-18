import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardContent, CardHeader } from '../ui/card';

const formatTime = (seconds) => {
  if (!seconds || seconds === 0) return '00:00.000';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = (seconds % 60).toFixed(3);
  return `${String(minutes).padStart(2, '0')}:${remainingSeconds.padStart(6, '0')}`;
};

const LapBreakdownChart = ({ laps, bestLapTimestamp }) => {
  if (!laps || laps.length === 0) return null;

  const bestTime = bestLapTimestamp ?? Math.min(...laps.map((l) => parseFloat(l.lap_time_seconds) || Infinity));

  const chartData = laps.map((lap) => ({
    lap: lap.lap_number,
    name: `Vuelta ${lap.lap_number}`,
    time: parseFloat(lap.lap_time_seconds) || 0,
    isBest: bestTime !== Infinity && Math.abs(parseFloat(lap.lap_time_seconds) - bestTime) < 0.001,
  }));

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-md border bg-popover p-3 shadow-md">
          <p className="font-semibold mb-1">{data.name}</p>
          <p className="text-sm">Tiempo: {formatTime(data.time)}</p>
          {data.isBest && <p className="text-sm text-primary font-medium">Mejor vuelta</p>}
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="mb-4">
      <CardHeader>
        <h5 className="font-semibold">Desglose de vueltas</h5>
      </CardHeader>
      <CardContent>
        <div style={{ width: '100%', height: 250 }}>
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 20, right: 20, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="lap" name="Vuelta" />
              <YAxis tickFormatter={(v) => formatTime(v)} domain={['dataMin - 0.5', 'dataMax + 0.5']} width={80} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="time" name="Tiempo" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.isBest ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.5)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default LapBreakdownChart;
