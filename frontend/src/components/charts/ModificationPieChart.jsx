import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend
} from 'recharts';
import { Card } from 'react-bootstrap';

const COLORS = ['#4e79a7', '#59a14f']; // Colores más suaves

const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name, value }) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  // Calcular la posición del texto para evitar superposiciones
  const textAnchor = x > cx ? 'start' : 'end';
  const label = name === 'modified' ? 'Modificados' : 'Serie';
  const percentage = (percent * 100).toFixed(0);

  return (
    <g>
      <text
        x={x}
        y={y - 10}
        fill="white"
        textAnchor={textAnchor}
        dominantBaseline="central"
        style={{ 
          fontSize: '12px', 
          fontWeight: 'bold',
          filter: 'drop-shadow(0px 1px 1px rgba(0,0,0,0.5))'
        }}
      >
        {`${value} ${label}`}
      </text>
      <text
        x={x}
        y={y + 10}
        fill="white"
        textAnchor={textAnchor}
        dominantBaseline="central"
        style={{ 
          fontSize: '12px',
          filter: 'drop-shadow(0px 1px 1px rgba(0,0,0,0.5))'
        }}
      >
        {`(${percentage}%)`}
      </text>
    </g>
  );
};

const CustomTooltip = ({ active, payload }) => {
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
          <strong>{data.name === 'modified' ? 'Modificados' : 'Serie'}</strong>
        </p>
        <p className="mb-0">
          {data.value} vehículos ({data.percentage}%)
        </p>
      </div>
    );
  }
  return null;
};

const ModificationPieChart = ({ data }) => {
  // Convertir el objeto de datos en un array
  const chartData = [
    { name: 'modified', value: data.modified || 0 },
    { name: 'stock', value: data.stock || 0 }
  ];

  // Calcular porcentajes para las etiquetas
  const total = chartData.reduce((sum, item) => sum + item.value, 0);
  const chartDataWithPercentage = chartData.map(item => ({
    ...item,
    percentage: total > 0 ? ((item.value / total) * 100).toFixed(1) : '0.0'
  }));

  return (
    <Card className="h-100 shadow-sm">
      <Card.Body>
        <Card.Title className="mb-4">Proporción Modificados vs Serie</Card.Title>
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={chartDataWithPercentage}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderCustomizedLabel}
                outerRadius={100}
                innerRadius={40} // Convertir en donut chart
                fill="#8884d8"
                dataKey="value"
                nameKey="name"
                paddingAngle={2} // Añadir espacio entre segmentos
              >
                {chartDataWithPercentage.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={COLORS[index % COLORS.length]}
                    stroke="#fff"
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                formatter={(value) => {
                  if (value === 'modified') return 'Modificados';
                  if (value === 'stock') return 'Serie';
                  return value;
                }}
                verticalAlign="bottom"
                height={36}
                iconType="circle"
                iconSize={10}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card.Body>
    </Card>
  );
};

export default ModificationPieChart; 