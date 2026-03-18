import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardHeader } from '../ui/card';

const SpeedEvolutionChart = ({ timings, circuit, lane, laps }) => {
  const filteredTimings = timings.filter(
    (t) => t.circuit === circuit && t.lane === lane && (t.avg_speed_kmh != null || t.best_lap_speed_kmh != null)
  );

  if (filteredTimings.length < 2) return null;

  const chartData = filteredTimings
    .sort((a, b) => new Date(a.timing_date) - new Date(b.timing_date))
    .map((t) => ({
      date: new Date(t.timing_date).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
      }),
      avgSpeed: t.avg_speed_kmh != null ? parseFloat(t.avg_speed_kmh) : null,
      bestLapSpeed: t.best_lap_speed_kmh != null ? parseFloat(t.best_lap_speed_kmh) : null,
      laps: t.laps,
      originalData: t,
    }));

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload;
      if (!data) return null;
      return (
        <div className="rounded-md border bg-popover p-3 shadow-md">
          <p className="font-semibold mb-2">Fecha: {label}</p>
          {data.avgSpeed != null && <p className="mb-1 text-sm">Velocidad media: {data.avgSpeed.toFixed(2)} km/h</p>}
          {data.bestLapSpeed != null && <p className="mb-1 text-sm">Velocidad mejor vuelta: {data.bestLapSpeed.toFixed(2)} km/h</p>}
          <p className="mb-0 text-xs text-muted-foreground">Vueltas: {data.laps}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <h5 className="font-semibold">Evolución de Velocidad - {circuit} (Carril {lane}) - {laps} vueltas</h5>
      </CardHeader>
      <CardContent>
        <div style={{ width: '100%', height: 250 }}>
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 20, right: 20, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="date" angle={-45} textAnchor="end" height={60} tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={(v) => `${v} km/h`} width={70} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              {chartData.some((d) => d.avgSpeed != null) && (
                <Line
                  type="monotone"
                  dataKey="avgSpeed"
                  stroke="#82ca9d"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Velocidad media"
                />
              )}
              {chartData.some((d) => d.bestLapSpeed != null) && (
                <Line
                  type="monotone"
                  dataKey="bestLapSpeed"
                  stroke="#8884d8"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Velocidad mejor vuelta"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <small className="text-muted-foreground text-sm">
          Velocidad en pista (km/h). Requiere circuito con longitud de carril configurada.
        </small>
      </CardContent>
    </Card>
  );
};

export default SpeedEvolutionChart;
