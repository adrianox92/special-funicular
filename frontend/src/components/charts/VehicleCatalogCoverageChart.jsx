import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

const COLORS = { linked: '#059669', unlinked: '#94a3b8' };

const RADIAN = Math.PI / 180;
const renderSliceLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name, value }) => {
  if (!value) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.52;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  const textAnchor = x > cx ? 'start' : 'end';
  const label = name === 'linked' ? 'Con catálogo' : 'Sin catálogo';
  const pct = (percent * 100).toFixed(1);

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
          filter: 'drop-shadow(0px 1px 1px rgba(0,0,0,0.5))',
        }}
      >
        {`${value}`}
      </text>
      <text
        x={x}
        y={y + 10}
        fill="white"
        textAnchor={textAnchor}
        dominantBaseline="central"
        style={{
          fontSize: '12px',
          filter: 'drop-shadow(0px 1px 1px rgba(0,0,0,0.5))',
        }}
      >
        {`${label} (${pct}%)`}
      </text>
    </g>
  );
};

const CoverageTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const p = payload[0].payload;
    const title =
      p.name === 'linked' ? 'Con ítem de catálogo' : 'Sin ítem de catálogo';
    return (
      <div
        className="rounded-md border bg-background px-3 py-2 text-sm shadow-md"
        style={{ borderColor: 'hsl(var(--border))' }}
      >
        <p className="mb-1 font-medium" style={{ color: payload[0].color }}>
          {title}
        </p>
        <p className="mb-0 text-muted-foreground">
          {p.value} vehículo{p.value !== 1 ? 's' : ''} ({p.percentage}%)
        </p>
      </div>
    );
  }
  return null;
};

/** Cobertura global: vehículos con catalog_item_id frente al total. */
const VehicleCatalogCoverageChart = ({
  vehiclesTotal = 0,
  withCatalogItemId = 0,
  className = '',
}) => {
  const without = Math.max(0, vehiclesTotal - withCatalogItemId);
  const chartRowsRaw = [
    { name: 'linked', value: withCatalogItemId },
    { name: 'unlinked', value: without },
  ].filter((r) => r.value > 0);

  const hasAny = vehiclesTotal > 0;
  const pctLinked =
    hasAny ? ((withCatalogItemId / vehiclesTotal) * 100).toFixed(1) : null;

  const chartDataWithPercentage = chartRowsRaw.map((item) => ({
    ...item,
    percentage:
      vehiclesTotal > 0 ? ((item.value / vehiclesTotal) * 100).toFixed(1) : '0.0',
  }));

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Cobertura del catálogo en vehículos</CardTitle>
        <p className="text-sm text-muted-foreground">
          Porcentaje de vehículos con <span className="font-mono">catalog_item_id</span> enlazado
          (estado actual de la base de datos; no usa el periodo seleccionado arriba).
        </p>
        {hasAny && pctLinked != null && (
          <p className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400 mt-2">
            {pctLinked}%
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({withCatalogItemId} de {vehiclesTotal})
            </span>
          </p>
        )}
      </CardHeader>
      <CardContent>
        {!hasAny ? (
          <p className="text-sm text-muted-foreground">No hay vehículos registrados.</p>
        ) : (
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={chartDataWithPercentage}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={renderSliceLabel}
                  outerRadius={95}
                  innerRadius={52}
                  dataKey="value"
                  nameKey="name"
                  paddingAngle={chartDataWithPercentage.length > 1 ? 2 : 0}
                >
                  {chartDataWithPercentage.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={COLORS[entry.name]}
                      stroke="hsl(var(--background))"
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CoverageTooltip />} />
                <Legend
                  formatter={(value) =>
                    value === 'linked' ? 'Con ítem de catálogo' : 'Sin ítem de catálogo'}
                  verticalAlign="bottom"
                  height={36}
                  iconType="circle"
                  iconSize={10}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default VehicleCatalogCoverageChart;
