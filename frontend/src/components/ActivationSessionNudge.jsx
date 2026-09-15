import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Clock, X } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import {
  dismissActivationNudge,
  getActivationNudgeVariant,
  isActivationNudgeDismissed,
} from '../utils/activationNudge';

const ActivationSessionNudge = ({ totalVehicles, totalTimings, timingsLast30Days }) => {
  const { t } = useTranslation('dashboard');
  const variant = useMemo(
    () => getActivationNudgeVariant({ totalVehicles, totalTimings, timingsLast30Days }),
    [totalVehicles, totalTimings, timingsLast30Days],
  );
  const [dismissed, setDismissed] = useState(() => isActivationNudgeDismissed(variant));

  if (!variant || dismissed || isActivationNudgeDismissed(variant)) {
    return null;
  }

  const handleDismiss = () => {
    dismissActivationNudge(variant);
    setDismissed(true);
  };

  const isFirst = variant === 'first';

  return (
    <Card
      className={
        isFirst
          ? 'border-primary/30 bg-primary/5 shadow-sm'
          : 'border-border/80 bg-muted/30 shadow-sm'
      }
      data-testid="activation-session-nudge"
      data-variant={variant}
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
            <p className="text-sm font-semibold text-foreground">
              {isFirst ? t('activationNudge.firstTitle') : t('activationNudge.staleTitle')}
            </p>
            <p className="text-sm text-muted-foreground">
              {isFirst ? t('activationNudge.firstBody') : t('activationNudge.staleBody')}
            </p>
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
