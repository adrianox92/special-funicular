import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import { Trophy, Clock, Car, Package, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { formatInventoryCategory } from '../utils/formatUtils';

const BlockCard = ({ icon: Icon, title, children, footer }) => (
  <Card className="flex flex-col h-full border-border/80 shadow-sm">
    <CardHeader className="pb-2">
      <CardTitle className="text-base font-semibold flex items-center gap-2">
        {Icon ? <Icon className="size-4 text-primary shrink-0" aria-hidden /> : null}
        {title}
      </CardTitle>
    </CardHeader>
    <CardContent className="flex flex-1 flex-col gap-3 pt-0">
      <div className="flex-1 text-sm text-muted-foreground min-h-[4rem]">{children}</div>
      {footer ? <div className="pt-1 border-t border-border/60">{footer}</div> : null}
    </CardContent>
  </Card>
);

const DashboardActionBlocks = ({ data, loadError }) => {
  const { t } = useTranslation('dashboard');

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
    <section className="space-y-3" aria-labelledby="dash-action-blocks-heading">
      <h2 id="dash-action-blocks-heading" className="text-lg font-semibold tracking-tight">
        {t('actionBlocks.title')}
      </h2>
      <p className="text-sm text-muted-foreground -mt-1">
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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <BlockCard
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
                <Link to={`/competitions/${nextCompetition.id}/timings`}>
                  {t('actionBlocks.registerTimings')}
                </Link>
              </Button>
            </div>
          ) : (
            <p>{t('actionBlocks.noPendingCompetitions')}</p>
          )}
        </BlockCard>

        <BlockCard
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
                    to={`/competitions/${c.id}/timings`}
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
