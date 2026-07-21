import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, Circle, X } from 'lucide-react';
import { useOnboardingStatus } from '../hooks/useOnboardingStatus';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

const OnboardingChecklistBanner = () => {
  const { t } = useTranslation('onboarding');
  const {
    steps,
    completedCount,
    visible,
    dismiss,
    loading,
    firstIncompleteStep,
  } = useOnboardingStatus();
  const [dismissing, setDismissing] = useState(false);

  if (loading || !visible) {
    return null;
  }

  const handleDismiss = async () => {
    setDismissing(true);
    try {
      await dismiss();
    } catch {
      /* ignore — el banner permanece visible */
    } finally {
      setDismissing(false);
    }
  };

  return (
    <div
      className="mb-6 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3"
      role="region"
      aria-label={t('title')}
      data-testid="onboarding-checklist-banner"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-sm font-semibold text-foreground">{t('title')}</p>
            <span className="text-xs text-muted-foreground">
              {t('progress', { done: completedCount, total: steps.length })}
            </span>
          </div>

          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {steps.map((step) => (
              <li key={step.id} className="flex items-center gap-1.5">
                {step.done ? (
                  <Check className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden />
                )}
                <Link
                  to={step.path}
                  className={cn(
                    'hover:underline',
                    step.done ? 'text-muted-foreground line-through' : 'text-foreground',
                    step.id === firstIncompleteStep?.id && 'font-medium',
                  )}
                >
                  {t(`steps.${step.id}`)}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex shrink-0 items-center gap-2 self-end sm:self-start">
          {firstIncompleteStep && (
            <Button asChild size="sm" data-testid="onboarding-cta">
              <Link to={firstIncompleteStep.path}>{t('cta')}</Link>
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleDismiss}
            disabled={dismissing}
            aria-label={t('dismiss')}
            data-testid="onboarding-dismiss"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingChecklistBanner;
