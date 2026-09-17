import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Activity, Clock } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { emptyProgress, sessionsMonthDelta, shouldShowProgressCta } from '../utils/myProgress';

function lastSessionCopy(daysSinceLastSession, t) {
  if (daysSinceLastSession == null) return t('myProgress.lastSessionNever');
  if (Number(daysSinceLastSession) === 0) return t('myProgress.lastSessionToday');
  return t('myProgress.lastSessionDays', { count: Number(daysSinceLastSession) });
}

function deltaCopy(delta, t) {
  if (delta > 0) return t('myProgress.deltaUp', { count: delta });
  if (delta < 0) return t('myProgress.deltaDown', { count: Math.abs(delta) });
  return t('myProgress.deltaSame');
}

const StatCell = ({ label, children }) => (
  <div className="min-w-0 px-3 py-2.5 sm:px-4">
    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
    <div className="mt-1">{children}</div>
  </div>
);

const MyProgressCard = ({
  progress,
  totalTimings = 0,
  sessionNudgeVisible = false,
}) => {
  const { t } = useTranslation('dashboard');
  const data = { ...emptyProgress(), ...(progress || {}) };
  const sessionsThisMonth = Number(data.sessionsThisMonth) || 0;
  const sessionsLastMonth = Number(data.sessionsLastMonth) || 0;
  const delta = sessionsMonthDelta(sessionsThisMonth, sessionsLastMonth);
  const neverTimed = (Number(totalTimings) || 0) < 1 && sessionsThisMonth < 1;
  const weekStreak = Number(data.consecutiveWeeksWithSession) || 0;
  const showCta = shouldShowProgressCta({
    sessionsThisMonth,
    daysSinceLastSession: data.daysSinceLastSession,
    totalTimings,
    sessionNudgeVisible,
  });

  return (
    <Card
      className="border-border/70 shadow-none"
      data-testid="my-progress-card"
      aria-labelledby="dash-my-progress"
    >
      <CardHeader className="flex flex-col gap-1 p-4 pb-2 sm:flex-row sm:items-start sm:justify-between sm:p-4 sm:pb-2">
        <div className="min-w-0 space-y-1">
          <CardTitle id="dash-my-progress" className="flex items-center gap-2 text-base">
            <Activity className="size-4" aria-hidden />
            {t('myProgress.title')}
          </CardTitle>
          <CardDescription className="text-xs">{t('myProgress.desc')}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        {neverTimed ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-2xl font-bold tabular-nums">0</p>
              <p className="text-sm text-muted-foreground">{t('myProgress.zeroBody')}</p>
            </div>
            {showCta ? (
              <Button asChild size="sm" data-testid="my-progress-cta">
                <Link to="/session">
                  <Clock className="mr-2 size-4" aria-hidden />
                  {t('myProgress.cta')}
                </Link>
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 divide-y divide-border/60 overflow-hidden rounded-lg border border-border/60 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <StatCell label={t('myProgress.sessionsThisMonth')}>
                <p className="text-2xl font-bold tabular-nums" data-testid="my-progress-sessions">
                  {sessionsThisMonth}
                </p>
                {sessionsThisMonth === 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">{t('myProgress.emptyHint')}</p>
                ) : null}
              </StatCell>
              <StatCell label={t('myProgress.vsLastMonth')}>
                <p className="text-xl font-semibold tabular-nums" data-testid="my-progress-delta">
                  {deltaCopy(delta, t)}
                </p>
              </StatCell>
              <StatCell label={t('myProgress.lastSessionLabel')}>
                <p className="text-sm font-medium leading-snug" data-testid="my-progress-last">
                  {lastSessionCopy(data.daysSinceLastSession, t)}
                </p>
                {weekStreak >= 2 ? (
                  <p className="mt-1 text-xs text-muted-foreground" data-testid="my-progress-streak">
                    {t('myProgress.weekStreak', { count: weekStreak })}
                  </p>
                ) : null}
              </StatCell>
            </div>
            {showCta ? (
              <div className="flex justify-end">
                <Button asChild size="sm" variant="outline" data-testid="my-progress-cta">
                  <Link to="/session">
                    <Clock className="mr-2 size-4" aria-hidden />
                    {t('myProgress.cta')}
                  </Link>
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MyProgressCard;
