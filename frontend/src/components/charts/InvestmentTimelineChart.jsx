import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader } from '../ui/card';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { formatCurrencyEur } from '../../utils/formatUtils';

const InvestmentTimelineChart = ({ data }) => {
  const { t } = useTranslation('dashboard');

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const quarter = Math.floor(date.getMonth() / 3) + 1;
    return `T${quarter} ${date.getFullYear()}`;
  };

  const formatCurrency = (value) =>
    formatCurrencyEur(value, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="rounded-md border bg-popover p-3 shadow-md">
          <p className="font-semibold mb-1">{formatDate(item.date)} - {formatDate(item.endDate)}</p>
          <p className="mb-1 text-sm">
            {t('charts.investmentTimeline.totalValue', { value: formatCurrency(item.value) })}
          </p>
          <div className="mt-2">
            <p className="font-semibold mb-1 text-sm">{t('charts.investmentTimeline.vehiclesInQuarter')}</p>
            {item.vehicles.map((vehicle, index) => (
              <p key={index} className="mb-1 text-xs">
                {vehicle.manufacturer} {vehicle.model}: {formatCurrency(vehicle.price)}
              </p>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  if (!Array.isArray(data) || data.length === 0) {
    return (
      <Card className="h-full">
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            {t('charts.investmentTimeline.empty')}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader><h5 className="font-semibold">{t('charts.investmentTimeline.title')}</h5></CardHeader>
      <CardContent>
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
                isAnimationActive={false}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default InvestmentTimelineChart;
