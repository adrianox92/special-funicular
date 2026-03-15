import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader } from '../ui/card';

const PerformanceByTypeChart = ({ data = {} }) => {
  const hasValidData = Object.entries(data).some(([type, stats]) =>
    stats.count > 0 && stats.vehicles?.length > 0 &&
    stats.vehicles.some(v => v.best_time !== undefined && v.best_time !== null)
  );

  if (!hasValidData) {
    return (
      <Card className="h-full">
        <CardHeader><h5 className="font-semibold">Rendimiento por Tipo</h5></CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            No hay vehículos con tiempos registrados para mostrar el rendimiento por tipo
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = Object.entries(data)
    .filter(([_, stats]) => stats.count > 0 && stats.vehicles?.length > 0)
    .map(([type, stats]) => {
      // Calcular el tiempo promedio solo con los vehículos que tienen tiempo
      const validVehicles = stats.vehicles.filter(v => v.best_time !== undefined && v.best_time !== null);
      const averageTime = validVehicles.length > 0
        ? validVehicles.reduce((sum, v) => sum + v.best_time, 0) / validVehicles.length
        : 0;

      return {
        type,
        averageTime: Number(averageTime.toFixed(2)),
        count: validVehicles.length,
        vehicles: validVehicles
      };
    })
    .sort((a, b) => a.averageTime - b.averageTime);

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = (seconds % 60).toFixed(2);
    return `${minutes}:${remainingSeconds.padStart(5, '0')}`;
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const typeData = data[label];
      return (
        <div className="rounded-md border bg-popover p-3 shadow-md">
          <p className="font-semibold mb-1">{label}</p>
          <p className="mb-1 text-sm">Tiempo promedio: {formatTime(payload[0].value)}</p>
          <p className="mb-1 text-sm">Vehículos analizados: {typeData.count}</p>
          <div className="mt-2">
            <p className="font-semibold mb-1 text-sm">Mejores tiempos:</p>
            {typeData.vehicles.slice(0, 3).map((vehicle, index) => (
              <p key={index} className="mb-1 text-xs">
                {vehicle.manufacturer} {vehicle.model}: {formatTime(vehicle.best_time)}
              </p>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="h-full">
      <CardHeader><h5 className="font-semibold">Rendimiento por Tipo</h5></CardHeader>
      <CardContent>
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis 
                dataKey="type" 
                angle={-45}
                textAnchor="end"
                height={60}
                interval={0}
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                tickFormatter={formatTime}
                tick={{ fontSize: 12 }}
                label={{ 
                  value: 'Tiempo promedio', 
                  angle: -90, 
                  position: 'insideLeft',
                  style: { textAnchor: 'middle', fontSize: 12 }
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="averageTime" 
                fill="#8884d8"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default PerformanceByTypeChart; 