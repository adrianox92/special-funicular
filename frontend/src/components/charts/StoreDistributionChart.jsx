import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { Card } from 'react-bootstrap';

const COLORS = {
  bar: '#f28e2c'
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="custom-tooltip" style={{
        backgroundColor: 'white',
        padding: '10px',
        border: '1px solid #ccc',
        borderRadius: '4px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <p className="mb-1" style={{ color: payload[0].color }}>
          <strong>{data.name}</strong>
        </p>
        <p className="mb-0">
          {data.value} vehículos ({data.percentage}%)
        </p>
      </div>
    );
  }
  return null;
};

const StoreDistributionChart = ({ data }) => {
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <Card className="h-100 shadow-sm">
        <Card.Body>
          <Card.Title className="mb-4">Distribución por Tienda</Card.Title>
          <div className="text-center text-muted">
            No hay datos disponibles para mostrar la distribución de tiendas
          </div>
        </Card.Body>
      </Card>
    );
  }

  // Calcular porcentajes y ordenar por cantidad
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const chartData = data
    .map(item => ({
      ...item,
      percentage: total > 0 ? ((item.value / total) * 100).toFixed(1) : '0.0'
    }))
    .sort((a, b) => b.value - a.value);

  const formatLabel = (value, entry) => {
    if (!entry || !entry.payload) return '';
    return `${value} (${entry.payload.percentage}%)`;
  };

  return (
    <Card className="h-100 shadow-sm">
      <Card.Body>
        <Card.Title className="mb-4">Distribución por Tienda</Card.Title>
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{
                top: 5,
                right: 30,
                left: 100,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
              <XAxis type="number" />
              <YAxis 
                type="category" 
                dataKey="name" 
                width={100}
                tick={{ fontSize: 12 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="value" 
                fill={COLORS.bar}
                radius={[0, 4, 4, 0]}
                label={{ 
                  position: 'right',
                  formatter: formatLabel
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card.Body>
    </Card>
  );
};

export default StoreDistributionChart; 