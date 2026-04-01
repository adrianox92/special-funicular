import React from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
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

/** @param {{ label: string, value: unknown }} */
function formatDetailValue({ label, value }) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number') {
    if (label.toLowerCase().includes('vuelta')) {
      return Number.isInteger(value) ? String(value) : value.toLocaleString('es-ES', { maximumFractionDigits: 2 });
    }
    return value.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  return String(value);
}

const MetricCard = ({
  title,
  value,
  subtitle,
  icon,
  details,
  /** 'inline' | 'tooltip-only' — tooltip-only evita apilar mucho texto en la tarjeta */
  detailsMode = 'inline',
  valueColor,
  threshold,
  formatValue,
  formatSubtitle,
  trend,
  trendValue,
  /** Ruta interna (react-router); la tarjeta completa es clicable */
  to,
}) => {
  const linkClassName =
    'block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';
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
    const cls = 'inline size-3.5 align-middle';
    switch (trend) {
      case 'up':
        return <TrendingUp className={cls} aria-hidden />;
      case 'down':
        return <TrendingDown className={cls} aria-hidden />;
      case 'stable':
        return <Minus className={cls} aria-hidden />;
      default:
        return null;
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

  const hasDetails = details && Object.values(details).some((v) => v !== undefined && v !== null);
  const showInlineDetails = hasDetails && detailsMode === 'inline';

  const cardContent = (
    <CardContent className="flex min-h-[132px] flex-col p-5">
      <div className="flex flex-1 flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div
            className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-inner ring-1 ring-primary/10 dark:bg-primary/15 dark:ring-primary/20 [&>svg]:size-5"
            aria-hidden
          >
            {icon}
          </div>
          {trend && trendValue ? (
            <span
              className={cn(
                'inline-flex max-w-[58%] shrink-0 items-center gap-1 rounded-full border border-border/80 bg-muted/50 px-2.5 py-1 text-[11px] font-medium leading-tight text-foreground/90 dark:bg-muted/30',
                trendColorClasses[getTrendColor()],
              )}
            >
              {getTrendIcon()}
              <span className="line-clamp-2 text-end">{trendValue}</span>
            </span>
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h5>
          <div
            className={cn(
              'mt-1.5 text-2xl font-bold tabular-nums tracking-tight sm:text-[1.65rem]',
              valueColorClasses[getValueColor()] || 'text-foreground',
            )}
          >
            {renderValue()}
          </div>
          {renderSubtitle() && (
            <p className="mt-2 line-clamp-2 text-sm leading-snug text-muted-foreground">{renderSubtitle()}</p>
          )}
          {hasDetails && detailsMode === 'tooltip-only' && (
            <p className="mt-2 text-xs text-muted-foreground">Pasa el cursor para ver circuito, fecha y carril.</p>
          )}
          {showInlineDetails && (
            <div className="mt-3 space-y-1.5 rounded-lg border border-border/50 bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground dark:bg-muted/20">
              {Object.entries(details).map(([key, val]) => {
                if (val === undefined || val === null) return null;
                const text = formatDetailValue({ label: key, value: val });
                return (
                  <div key={key} className="flex justify-between gap-3">
                    <span className="shrink-0 text-muted-foreground/90">{key}</span>
                    <span className="min-w-0 text-end font-medium text-foreground/90">{text}</span>
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
    <Card className="group h-full overflow-hidden border-border/70 bg-card/90 shadow-sm ring-0 transition-[box-shadow,transform] duration-200 hover:border-border hover:shadow-md dark:bg-card/95">
      {cardContent}
    </Card>
  );

  if (hasDetails && detailsMode === 'tooltip-only') {
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            {to ? (
              <Link to={to} className={cn(linkClassName, 'h-full cursor-help')}>
                {card}
              </Link>
            ) : (
              <div className="h-full cursor-help">{card}</div>
            )}
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-sm border-border/80">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
            <div className="space-y-2 text-sm">
              {Object.entries(details).map(([key, val]) => {
                if (val === undefined || val === null) return null;
                return (
                  <div key={key} className="flex justify-between gap-6">
                    <span className="text-muted-foreground">{key}</span>
                    <span className="max-w-[12rem] text-end font-medium">{formatDetailValue({ label: key, value: val })}</span>
                  </div>
                );
              })}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (to) {
    return (
      <Link to={to} className={linkClassName}>
        {card}
      </Link>
    );
  }

  return card;
};

export default MetricCard;
