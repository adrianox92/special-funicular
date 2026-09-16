import React from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from './ui/badge';
import { cn } from '../lib/utils';
import { formatLapTimeDisplay } from '../utils/formatUtils';
import { formatSecondsToLapTime } from '../utils/averageLapTime';

function formatDeltaAbs(seconds) {
  const abs = Math.abs(Number(seconds));
  if (!Number.isFinite(abs)) return '';
  return formatSecondsToLapTime(abs);
}

function DeltaLine({ delta }) {
  const { t } = useTranslation('session');
  if (delta == null || !Number.isFinite(Number(delta))) return null;
  const n = Number(delta);
  if (n === 0) {
    return <p className="text-xs text-muted-foreground">{t('summary.deltaEqual')}</p>;
  }
  const faster = n < 0;
  return (
    <p
      className={cn(
        'text-xs',
        faster ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground',
      )}
    >
      {faster
        ? t('summary.deltaFaster', { time: formatDeltaAbs(n) })
        : t('summary.deltaSlower', { time: formatDeltaAbs(n) })}
    </p>
  );
}

function ComparisonRow({ label, seconds, delta, emptyText, testId }) {
  return (
    <div className="space-y-0.5" data-testid={testId}>
      <div className="flex justify-between gap-3">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-medium text-right">
          {seconds != null ? formatLapTimeDisplay(seconds) : emptyText}
        </span>
      </div>
      {seconds != null ? <DeltaLine delta={delta} /> : null}
    </div>
  );
}

/**
 * Bloque de comparativas del resumen de Nueva sesión.
 * El CTA primario («Otra manga») permanece fuera de este componente.
 */
const SessionSummaryComparisons = ({ comparisons }) => {
  const { t } = useTranslation('session');
  if (!comparisons) return null;

  const {
    circuitPb,
    lanePb,
    monthPb,
    previousSession,
    consistencyScore,
    worstLapSeconds,
    isPersonalBest,
  } = comparisons;

  const showMonthEmpty = monthPb?.empty === true;
  const showMonthPb = monthPb != null && monthPb.empty !== true && monthPb.seconds != null;
  const showBadges = isPersonalBest || (showMonthPb && monthPb.isNewBest);

  return (
    <div className="space-y-3" data-testid="session-summary-comparisons">
      {showBadges ? (
        <div className="flex flex-wrap gap-1.5">
          {isPersonalBest ? <Badge>{t('summary.personalBest')}</Badge> : null}
          {showMonthPb && monthPb.isNewBest ? (
            <Badge variant="secondary">{t('summary.monthBestBadge')}</Badge>
          ) : null}
        </div>
      ) : null}

      <ComparisonRow
        testId="session-summary-circuit-pb"
        label={t('summary.previousBest')}
        seconds={circuitPb?.seconds}
        emptyText={t('summary.noPrevious')}
        delta={circuitPb?.delta}
      />
      {lanePb?.seconds != null ? (
        <ComparisonRow
          testId="session-summary-lane-pb"
          label={t('summary.previousBestLane')}
          seconds={lanePb.seconds}
          delta={lanePb.delta}
        />
      ) : null}
      {showMonthEmpty ? (
        <div className="flex justify-between gap-3" data-testid="session-summary-month-pb">
          <span className="text-muted-foreground">{t('summary.monthBest')}</span>
          <span className="text-right text-sm text-muted-foreground">{t('summary.noMonthBest')}</span>
        </div>
      ) : null}
      {showMonthPb ? (
        <ComparisonRow
          testId="session-summary-month-pb"
          label={t('summary.monthBest')}
          seconds={monthPb.seconds}
          delta={monthPb.delta}
        />
      ) : null}
      {previousSession?.seconds != null ? (
        <ComparisonRow
          testId="session-summary-last"
          label={t('summary.lastSession')}
          seconds={previousSession.seconds}
          delta={previousSession.delta}
        />
      ) : null}
      {consistencyScore != null ? (
        <div className="flex justify-between gap-3 text-muted-foreground" data-testid="session-summary-consistency">
          <span>{t('summary.consistency')}</span>
          <span className="font-mono">{Number(consistencyScore).toFixed(2)}%</span>
        </div>
      ) : null}
      {worstLapSeconds != null ? (
        <div className="flex justify-between gap-3 text-muted-foreground" data-testid="session-summary-worst">
          <span>{t('summary.worstLap')}</span>
          <span className="font-mono">{formatLapTimeDisplay(worstLapSeconds)}</span>
        </div>
      ) : null}
    </div>
  );
};

export default SessionSummaryComparisons;
