import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Clock, X } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import {
  dismissActivationNudge,
  getActivationNudgeVariant,
  getQuietCopyKey,
  isActivationNudgeDismissed,
} from '../utils/activationNudge';

function nudgeCardClass(variant) {
  if (variant === 'first') return 'border-primary/30 bg-primary/5 shadow-sm';
  if (variant === 'quiet') return 'border-border/60 bg-card shadow-sm';
  return 'border-border/80 bg-muted/30 shadow-sm';
}

function nudgeCopy(variant, t, copyKey) {
  if (variant === 'first') {
    return {
      title: t('activationNudge.firstTitle'),
      body: t('activationNudge.firstBody'),
    };
  }
  if (variant === 'quiet') {
    return {
      title: t(`activationNudge.quiet.${copyKey}.title`),
      body: t(`activationNudge.quiet.${copyKey}.body`),
    };
  }
  return {
    title: t('activationNudge.staleTitle'),
    body: t('activationNudge.staleBody'),
  };
}

const ActivationSessionNudge = ({
  totalVehicles,
  totalTimings,
  timingsLast30Days,
  timingsLast14Days,
  suppressFirst = false,
  now,
  onDismiss,
}) => {
  const { t } = useTranslation('dashboard');
  const variant = useMemo(
    () =>
      getActivationNudgeVariant({
        totalVehicles,
        totalTimings,
        timingsLast30Days,
        timingsLast14Days,
        suppressFirst,
      }),
    [totalVehicles, totalTimings, timingsLast30Days, timingsLast14Days, suppressFirst],
  );
  const clock = now ?? new Date();
  const copyKey = getQuietCopyKey(clock);
  const [dismissed, setDismissed] = useState(() => isActivationNudgeDismissed(variant, clock));

  if (!variant || dismissed || isActivationNudgeDismissed(variant, clock)) {
    return null;
  }

  const handleDismiss = () => {
    dismissActivationNudge(variant, clock);
    setDismissed(true);
    if (typeof onDismiss === 'function') onDismiss(variant);
  };

  const { title, body } = nudgeCopy(variant, t, copyKey);

  return (
    <Card
      className={nudgeCardClass(variant)}
      data-testid="activation-session-nudge"
      data-variant={variant}
      data-copy={variant === 'quiet' ? copyKey : undefined}
    >
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 gap-3">
          <div
            className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10"
            aria-hidden
          >
            <Clock className="size-4 text-primary" />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="text-sm text-muted-foreground">{body}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 self-end sm:self-start">
          <Button asChild size="sm" data-testid="activation-session-nudge-cta">
            <Link to="/session">{t('activationNudge.cta')}</Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleDismiss}
            aria-label={t('activationNudge.dismiss')}
            data-testid="activation-session-nudge-dismiss"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ActivationSessionNudge;
