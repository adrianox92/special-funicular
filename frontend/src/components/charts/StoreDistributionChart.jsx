import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { Card, CardContent, CardHeader } from '../ui/card';

const COLORS = {
  bar: '#f28e2c'
};

const StoreDistributionChart = ({ data }) => {
  const { t } = useTranslation('dashboard');

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="rounded-md border bg-popover p-3 shadow-md">
          <p className="font-semibold mb-1">{item.name}</p>
          <p className="text-sm mb-0">
            {t('charts.common.vehiclesTooltip', { value: item.value, percentage: item.percentage })}
          </p>
        </div>
      );
    }
    return null;
  };

  if (!Array.isArray(data) || data.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader><h5 className="font-semibold">{t('charts.store.title')}</h5></CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            {t('charts.store.empty')}
          </div>
        </CardContent>
      </Card>
    );
  }

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
    <Card className="h-full">
      <CardHeader><h5 className="font-semibold">{t('charts.store.title')}</h5></CardHeader>
      <CardContent>
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
                isAnimationActive={false}
                radius={[0, 4, 4, 0]}
                label={{ 
                  position: 'right',
                  formatter: formatLabel
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default StoreDistributionChart;
