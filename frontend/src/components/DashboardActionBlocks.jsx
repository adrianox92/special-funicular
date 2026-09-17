import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import { Trophy, Clock, Car, Package, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { formatInventoryCategory } from '../utils/formatUtils';
import { competitionDetailPath } from '../utils/competitionRoutes';
import { cn } from '../lib/utils';

const BlockCard = ({ icon: Icon, title, children, footer, compact = false }) => (
  <Card className={cn('flex h-full flex-col border-border/70', compact ? 'shadow-none' : 'shadow-sm')}>
    <CardHeader className={cn(compact ? 'px-4 py-3 pb-1.5' : 'pb-2')}>
      <CardTitle className={cn('flex items-center gap-2 font-semibold', compact ? 'text-sm' : 'text-base')}>
        {Icon ? <Icon className="size-4 shrink-0 text-primary" aria-hidden /> : null}
        {title}
      </CardTitle>
    </CardHeader>
    <CardContent className={cn('flex flex-1 flex-col pt-0', compact ? 'gap-2 px-4 pb-3' : 'gap-3')}>
      <div className={cn('flex-1 text-sm text-muted-foreground', compact ? 'min-h-0' : 'min-h-[4rem]')}>
        {children}
      </div>
      {footer ? <div className="border-t border-border/60 pt-1">{footer}</div> : null}
    </CardContent>
  </Card>
);

const DashboardActionBlocks = ({ data, loadError, embedded = false }) => {
  const { t } = useTranslation('dashboard');
  const HeadingTag = embedded ? 'h3' : 'h2';

  if (loadError) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        {t('actionBlocks.loadError')}
      </p>
    );
  }

  if (!data) {
    return null;
  }

  const {
    nextCompetition,
    openCompetitionTimings,
    usualCircuit,
    staleVehiclesAtUsualCircuit,
    staleDaysThreshold = 60,
    lowStockCritical,
  } = data;

  return (
    <section className="space-y-2.5" aria-labelledby="dash-action-blocks-heading" data-testid="dashboard-action-blocks">
      <HeadingTag
        id="dash-action-blocks-heading"
        className={cn(
          'font-semibold tracking-tight',
          embedded ? 'text-sm' : 'text-lg',
        )}
      >
        {t('actionBlocks.title')}
      </HeadingTag>
      <p className={cn('text-muted-foreground -mt-0.5', embedded ? 'text-xs' : 'text-sm')}>
        <Trans
          i18nKey="actionBlocks.desc"
          ns="dashboard"
          values={{ days: staleDaysThreshold }}
          components={{
            1: <span className="font-medium text-foreground" />,
            2: (
              <Link
                to="/settings"
                className="text-foreground underline underline-offset-2 hover:no-underline"
              />
            ),
          }}
        />
      </p>
      <div className={cn('grid grid-cols-1 md:grid-cols-2', embedded ? 'gap-3' : 'gap-4')}>
        <BlockCard
          compact={embedded}
          icon={Trophy}
          title={t('actionBlocks.nextCompetition')}
          footer={
            <Button variant="ghost" size="sm" className="w-full justify-between px-2" asChild>
              <Link to="/competitions">
                {t('actionBlocks.goToCompetitions')}
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            </Button>
          }
        >
          {nextCompetition ? (
            <div className="space-y-2 text-foreground">
              <p className="font-medium leading-snug">{nextCompetition.name}</p>
              {nextCompetition.circuit_name ? (
                <p className="text-muted-foreground">{nextCompetition.circuit_name}</p>
              ) : null}
              <p>
                {nextCompetition.times_remaining > 0
                  ? t('actionBlocks.timesRemaining', {
                      count: nextCompetition.times_remaining,
                      pct: nextCompetition.progress_percentage,
                    })
                  : t('actionBlocks.inProgress')}
              </p>
              <Button size="sm" className="mt-1" asChild>
                <Link to={competitionDetailPath(nextCompetition.id, { section: 'timings' })}>
                  {t('actionBlocks.registerTimings')}
                </Link>
              </Button>
            </div>
          ) : (
            <p>{t('actionBlocks.noPendingCompetitions')}</p>
          )}
        </BlockCard>

        <BlockCard
          compact={embedded}
          icon={Clock}
          title={t('actionBlocks.openTimings')}
          footer={
            <Button variant="ghost" size="sm" className="w-full justify-between px-2" asChild>
              <Link to="/competitions">
                {t('actionBlocks.viewAll')}
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            </Button>
          }
        >
          {openCompetitionTimings?.length ? (
            <ul className="space-y-2 list-none p-0 m-0">
              {openCompetitionTimings.map((c) => (
                <li key={c.id} className="border-b border-border/50 last:border-0 pb-2 last:pb-0">
                  <Link
                    to={competitionDetailPath(c.id, { section: 'timings' })}
                    className="font-medium text-foreground hover:underline"
                  >
                    {c.name}
                  </Link>
                  <p className="text-xs mt-0.5">
                    {t('actionBlocks.missingTimes', {
                      remaining: c.times_remaining,
                      total: c.total_required_times,
                      pct: c.progress_percentage,
                    })}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p>{t('actionBlocks.allTimingsComplete')}</p>
          )}
        </BlockCard>

        <BlockCard
          compact={embedded}
          icon={Car}
          title={t('actionBlocks.usualCircuit')}
          footer={
            <Button variant="ghost" size="sm" className="w-full justify-between px-2" asChild>
              <Link to="/timings">
                {t('actionBlocks.viewTimings')}
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            </Button>
          }
        >
          {!usualCircuit ? (
            <p>{t('actionBlocks.addTimingsHint')}</p>
          ) : staleVehiclesAtUsualCircuit?.length ? (
            <div className="space-y-2">
              <p className="text-foreground">
                <Trans
                  i18nKey="actionBlocks.staleAtCircuit"
                  ns="dashboard"
                  values={{ name: usualCircuit.name, days: staleDaysThreshold }}
                  components={{ 1: <span className="font-medium" /> }}
                />
              </p>
              <ul className="space-y-1.5 list-none p-0 m-0">
                {staleVehiclesAtUsualCircuit.map((v) => (
                  <li key={v.id}>
                    <Link
                      to={`/vehicles/${v.id}`}
                      className="text-foreground hover:underline font-medium"
                    >
                      {[v.manufacturer, v.model].filter(Boolean).join(' ') ||
                        t('actionBlocks.vehicleFallback')}
                    </Link>
                    <span className="text-muted-foreground text-xs ml-1">
                      {t('actionBlocks.daysAgo', { days: v.days_since })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p>
              <Trans
                i18nKey="actionBlocks.allRecentAtCircuit"
                ns="dashboard"
                values={{ name: usualCircuit.name, days: staleDaysThreshold }}
                components={{ 1: <span className="font-medium text-foreground" /> }}
              />
            </p>
          )}
        </BlockCard>

        <BlockCard
          compact={embedded}
          icon={Package}
          title={t('actionBlocks.lowStock')}
          footer={
            <Button variant="ghost" size="sm" className="w-full justify-between px-2" asChild>
              <Link to="/inventory">
                {t('actionBlocks.openInventory')}
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            </Button>
          }
        >
          {lowStockCritical?.length ? (
            <ul className="space-y-2 list-none p-0 m-0">
              {lowStockCritical.map((item) => (
                <li key={item.id} className="border-b border-border/50 last:border-0 pb-2 last:pb-0">
                  <p className="font-medium text-foreground">{item.name}</p>
                  <p className="text-xs">
                    {formatInventoryCategory(item.category)} · {item.quantity}/{item.min_stock}{' '}
                    {item.reference ? `· ${item.reference}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p>{t('actionBlocks.noLowStock')}</p>
          )}
        </BlockCard>
      </div>
    </section>
  );
};

export default DashboardActionBlocks;
