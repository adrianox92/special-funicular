import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Clock } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';

const TimingsEmptyState = ({ hasVehicles = false }) => {
  const { t } = useTranslation('timings');

  return (
    <Card className="border-dashed bg-muted/30" data-testid="timings-empty-state">
      <CardContent className="flex flex-col items-center justify-center gap-4 px-6 py-14 text-center">
        <div
          className="flex size-16 items-center justify-center rounded-full bg-primary/10"
          aria-hidden
        >
          <Clock className="size-8 text-primary" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">{t('emptyTitle')}</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            {hasVehicles ? t('emptyHintWithVehicles') : t('emptyHint')}
          </p>
        </div>
        <Button asChild size="lg" data-testid="timings-empty-session-cta">
          <Link to="/session">
            <Clock className="mr-2 size-4" aria-hidden />
            {t('emptyCta')}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
};

export default TimingsEmptyState;
