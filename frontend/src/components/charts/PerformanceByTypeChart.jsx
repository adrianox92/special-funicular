import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, OverlayTrigger, Tooltip as BSTooltip } from 'react-bootstrap';

const PerformanceByTypeChart = ({ data = {} }) => {
  console.log('PerformanceByTypeChart - Raw data:', data);
  
  // Validar que data sea un objeto y tenga datos válidos
  const hasValidData = Object.entries(data).some(([type, stats]) => {
    console.log(`Checking type ${type}:`, stats);
    const isValid = stats.count > 0 && stats.vehicles?.length > 0 && 
      stats.vehicles.some(v => v.best_time !== undefined && v.best_time !== null);
    console.log(`Type ${type} is valid:`, isValid);
    return isValid;
  });

  console.log('Has valid data:', hasValidData);

  if (!hasValidData) {
    return (
      <Card className="h-100 shadow-sm">
        <Card.Body>
          <Card.Title className="mb-4">Rendimiento por Tipo</Card.Title>
          <div className="text-center text-muted">
            No hay vehículos con tiempos registrados<br />
            para mostrar el rendimiento por tipo
          </div>
        </Card.Body>
      </Card>
    );
  }

  // Convertir el objeto de datos en un array para el gráfico
  const chartData = Object.entries(data)
    .filter(([_, stats]) => {
      console.log('Filtering stats:', stats);
      return stats.count > 0 && stats.vehicles?.length > 0;
    })
    .map(([type, stats]) => {
      console.log(`Processing type ${type}:`, stats);
      // Calcular el tiempo promedio solo con los vehículos que tienen tiempo
      const validVehicles = stats.vehicles.filter(v => v.best_time !== undefined && v.best_time !== null);
      console.log(`Valid vehicles for ${type}:`, validVehicles);
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

  console.log('Final chart data:', chartData);

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = (seconds % 60).toFixed(2);
    return `${minutes}:${remainingSeconds.padStart(5, '0')}`;
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const typeData = data[label];
      return (
        <div className="custom-tooltip p-2 bg-white border rounded shadow-sm">
          <p className="mb-1 fw-bold">{label}</p>
          <p className="mb-1">Tiempo promedio: {formatTime(payload[0].value)}</p>
          <p className="mb-1">Vehículos analizados: {typeData.count}</p>
          <div className="mt-2">
            <p className="mb-1 fw-bold">Mejores tiempos:</p>
            {typeData.vehicles.slice(0, 3).map((vehicle, index) => (
              <p key={index} className="mb-1 small">
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
    <Card className="h-100 shadow-sm">
      <Card.Body>
        <Card.Title className="mb-4">Rendimiento por Tipo</Card.Title>
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
      </Card.Body>
    </Card>
  );
};

export default PerformanceByTypeChart; 