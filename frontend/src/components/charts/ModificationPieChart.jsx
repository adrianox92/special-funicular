import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend
} from 'recharts';
import { Card, CardContent, CardHeader } from '../ui/card';

const COLORS = ['#4e79a7', '#59a14f'];

const RADIAN = Math.PI / 180;

const ModificationPieChart = ({ data }) => {
  const { t } = useTranslation('dashboard');

  const seriesLabel = (name) =>
    name === 'modified' ? t('charts.common.modified') : t('charts.common.stock');

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name, value }) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    const textAnchor = x > cx ? 'start' : 'end';
    const label = seriesLabel(name);
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
      const item = payload[0].payload;
      return (
        <div className="custom-tooltip" style={{
          backgroundColor: 'white',
          padding: '10px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <p className="mb-1" style={{ color: payload[0].color }}>
            <strong>{seriesLabel(item.name)}</strong>
          </p>
          <p className="mb-0">
            {t('charts.common.vehiclesTooltip', { value: item.value, percentage: item.percentage })}
          </p>
        </div>
      );
    }
    return null;
  };

  const chartData = [
    { name: 'modified', value: data.modified || 0 },
    { name: 'stock', value: data.stock || 0 }
  ];

  const total = chartData.reduce((sum, item) => sum + item.value, 0);
  const chartDataWithPercentage = chartData.map(item => ({
    ...item,
    percentage: total > 0 ? ((item.value / total) * 100).toFixed(1) : '0.0'
  }));

  return (
    <Card className="h-full">
      <CardHeader><h5 className="font-semibold">{t('charts.modificationPie.title')}</h5></CardHeader>
      <CardContent>
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
                innerRadius={40}
                fill="#8884d8"
                dataKey="value"
                nameKey="name"
                paddingAngle={2}
                isAnimationActive={false}
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
                formatter={(value) => seriesLabel(value)}
                verticalAlign="bottom"
                height={36}
                iconType="circle"
                iconSize={10}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default ModificationPieChart;
