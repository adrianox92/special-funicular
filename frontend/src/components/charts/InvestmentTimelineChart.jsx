import React from 'react';
import { Card } from 'react-bootstrap';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

const InvestmentTimelineChart = ({ data }) => {
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <Card className="h-100">
        <Card.Body>
          <div className="text-center text-muted">
            No hay datos suficientes para mostrar la evolución de la colección
          </div>
        </Card.Body>
      </Card>
    );
  }

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const quarter = Math.floor(date.getMonth() / 3) + 1;
    return `T${quarter} ${date.getFullYear()}`;
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="custom-tooltip p-2 bg-white border rounded shadow-sm">
          <p className="mb-1 fw-bold">{formatDate(data.date)} - {formatDate(data.endDate)}</p>
          <p className="mb-1">Valor total: {formatCurrency(data.value)}</p>
          <div className="mt-2">
            <p className="mb-1 fw-bold">Vehículos en este trimestre:</p>
            {data.vehicles.map((vehicle, index) => (
              <p key={index} className="mb-1 small">
                {vehicle.manufacturer} {vehicle.model}: {formatCurrency(vehicle.price)}
              </p>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="h-100">
      <Card.Body>
        <h5 className="card-title mb-4">Evolución de la Colección</h5>
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <LineChart
              data={data}
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                tickFormatter={formatCurrency}
                tick={{ fontSize: 12 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#0d6efd"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card.Body>
    </Card>
  );
};

export default InvestmentTimelineChart; 