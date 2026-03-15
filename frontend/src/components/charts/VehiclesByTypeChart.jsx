import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Label
} from 'recharts';
import { Card, CardContent, CardHeader } from '../ui/card';

const COLORS = {
  modified: '#4e79a7',
  stock: '#59a14f',
  total: '#f28e2c'
};

const VehiclesByTypeChart = ({ data }) => {
  // Ordenar los datos por total de vehículos
  const sortedData = [...data].sort((a, b) => b.total - a.total);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const total = payload.reduce((sum, entry) => sum + entry.value, 0);
      return (
        <div className="rounded-md border bg-popover p-3 shadow-md">
          <p className="font-semibold mb-2">{label}</p>
          {payload.map((entry, index) => {
            const percentage = ((entry.value / total) * 100).toFixed(1);
            return (
              <p key={index} className="flex justify-between gap-4 text-sm my-1">
                <span>{entry.name === 'modified' ? 'Modificados' : entry.name === 'stock' ? 'Serie' : 'Total'}:</span>
                <span>{entry.value} ({percentage}%)</span>
              </p>
            );
          })}
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="h-full">
      <CardHeader><h5 className="font-semibold">Vehículos por Tipo</h5></CardHeader>
      <CardContent>
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <BarChart
              data={sortedData}
              margin={{
                top: 20,
                right: 30,
                left: 20,
                bottom: 60,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis 
                dataKey="type" 
                angle={-45}
                textAnchor="end"
                height={80}
                interval={0}
                tick={{ fontSize: 12 }}
              >
                <Label 
                  value="Tipo de Vehículo" 
                  position="bottom" 
                  offset={50}
                  style={{ textAnchor: 'middle' }}
                />
              </XAxis>
              <YAxis 
                tick={{ fontSize: 12 }}
                allowDecimals={false}
              >
                <Label 
                  value="Número de Vehículos" 
                  angle={-90} 
                  position="insideLeft"
                  style={{ textAnchor: 'middle' }}
                />
              </YAxis>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                formatter={(value) => {
                  if (value === 'modified') return 'Modificados';
                  if (value === 'stock') return 'Serie';
                  return 'Total';
                }}
                verticalAlign="top"
                height={36}
              />
              <Bar 
                dataKey="modified" 
                stackId="a" 
                fill={COLORS.modified}
                name="modified"
                radius={[4, 4, 0, 0]}
              />
              <Bar 
                dataKey="stock" 
                stackId="a" 
                fill={COLORS.stock}
                name="stock"
                radius={[4, 4, 0, 0]}
              />
              <Bar 
                dataKey="total" 
                fill={COLORS.total}
                name="total"
                opacity={0.3}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default VehiclesByTypeChart; 