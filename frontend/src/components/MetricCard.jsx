import React from 'react';
import { Card, CardContent } from './ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import { cn } from '../lib/utils';

const valueColorClasses = {
  primary: 'text-primary',
  success: 'text-green-600 dark:text-green-400',
  warning: 'text-amber-600 dark:text-amber-400',
  danger: 'text-destructive',
  info: 'text-blue-600 dark:text-blue-400',
  secondary: 'text-muted-foreground',
};

const trendColorClasses = {
  success: 'text-green-600 dark:text-green-400',
  danger: 'text-destructive',
  info: 'text-blue-600 dark:text-blue-400',
  secondary: 'text-muted-foreground',
};

const MetricCard = ({
  title,
  value,
  subtitle,
  icon,
  details,
  valueColor,
  threshold,
  formatValue,
  formatSubtitle,
  trend,
  trendValue
}) => {
  const getValueColor = () => {
    if (valueColor) return valueColor;
    if (threshold && typeof value === 'number') {
      if (value <= threshold.good) return 'success';
      if (value <= threshold.warning) return 'warning';
      return 'danger';
    }
    if (typeof value === 'string' && value.includes('%')) {
      const percentage = parseFloat(value);
      if (percentage <= 0) return 'secondary';
      if (percentage > 50) return 'danger';
      return 'success';
    }
    return 'primary';
  };

  const getTrendIcon = () => {
    if (!trend) return null;
    switch (trend) {
      case 'up': return '↗️';
      case 'down': return '↘️';
      case 'stable': return '→';
      default: return null;
    }
  };

  const getTrendColor = () => {
    if (!trend) return 'secondary';
    switch (trend) {
      case 'up': return 'success';
      case 'down': return 'danger';
      case 'stable': return 'info';
      default: return 'secondary';
    }
  };

  const renderValue = () => {
    if (value === undefined || value === null) return 'N/A';
    return formatValue ? formatValue(value) : value;
  };

  const renderSubtitle = () => {
    if (!subtitle) return null;
    return formatSubtitle ? formatSubtitle(subtitle) : subtitle;
  };

  const hasDetails = details && Object.values(details).some(v => v !== undefined && v !== null);

  const cardContent = (
    <CardContent className="p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground [&>svg]:size-5">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h5 className="text-sm font-medium text-muted-foreground">{title}</h5>
            {trend && (
              <span className={cn('text-xs', trendColorClasses[getTrendColor()])}>
                {getTrendIcon()} {trendValue}
              </span>
            )}
          </div>
          <div className={cn('mt-1 text-2xl font-bold', valueColorClasses[getValueColor()] || 'text-foreground')}>
            {renderValue()}
          </div>
          {renderSubtitle() && (
            <p className="mt-1 text-sm text-muted-foreground">{renderSubtitle()}</p>
          )}
          {hasDetails && (
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              {Object.entries(details).map(([key, val]) => {
                if (val === undefined || val === null) return null;
                return (
                  <div key={key} className="flex justify-between gap-2">
                    <span>{key}:</span>
                    <span>{typeof val === 'number' ? val.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(val)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </CardContent>
  );

  const card = (
    <Card className="h-full overflow-hidden">
      {cardContent}
    </Card>
  );

  if (hasDetails) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="h-full cursor-help">{card}</div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="space-y-2">
              {Object.entries(details).map(([key, val]) => {
                if (val === undefined || val === null) return null;
                return (
                  <div key={key} className="flex justify-between gap-4">
                    <span className="font-medium">{key}:</span>
                    <span>{typeof val === 'number' ? val.toLocaleString('es-ES') : String(val)}</span>
                  </div>
                );
              })}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return card;
};

export default MetricCard;
