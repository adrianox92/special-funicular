import React, { Suspense, lazy, useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Truck,
  Wrench,
  Euro,
  TrendingUp,
  Trophy,
  Clock,
  Car,
  Settings,
  Plus,
  LayoutDashboard,
  BarChart3,
  Gauge,
  Sparkles,
  Smartphone,
  Landmark,
  Warehouse,
  RefreshCw,
  MoreHorizontal,
  ChevronDown,
} from 'lucide-react';
import MetricCard from '../components/MetricCard';
import DashboardActionBlocks from '../components/DashboardActionBlocks';
import ActivationSessionNudge from '../components/ActivationSessionNudge';
import MyProgressCard from '../components/MyProgressCard';
import { useDashboardData } from '../hooks/useDashboardData';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Spinner } from '../components/ui/spinner';
import { Tabs, TabsContent } from '../components/ui/tabs';
import { ResponsiveTabsNav } from '../components/ui/responsive-tabs-nav';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { cn } from '../lib/utils';
import api from '../lib/axios';
import {
  formatCurrencyEur,
  formatPercentEs,
  formatLapTimeDisplay,
  formatDashboardMetricDate,
  formatMaintenanceKind,
  getIntlLocale,
} from '../utils/formatUtils';
import { getActivationNudgeVariant, isActivationNudgeDismissed } from '../utils/activationNudge';

const BrandDistributionChart = lazy(() => import('../components/charts/BrandDistributionChart'));
const StoreDistributionChart = lazy(() => import('../components/charts/StoreDistributionChart'));
const VehiclesByTypeChart = lazy(() => import('../components/charts/VehiclesByTypeChart'));
const ModificationPieChart = lazy(() => import('../components/charts/ModificationPieChart'));
const PerformanceByTypeChart = lazy(() => import('../components/charts/PerformanceByTypeChart'));
const InvestmentTimelineChart = lazy(() => import('../components/charts/InvestmentTimelineChart'));
const TopCostTable = lazy(() => import('../components/tables/TopCostTable'));
const TopComponentsTable = lazy(() => import('../components/tables/TopComponentsTable'));
const LaneComparisonChart = lazy(() => import('../components/LaneComparisonChart'));

const ChartFallback = () => (
  <Card className="min-h-[260px] border-border/60">
    <CardContent className="flex h-[260px] items-center justify-center p-6">
      <Spinner className="size-8 text-muted-foreground" />
    </CardContent>
  </Card>
);

function TrainingGoalsDashboardWidget() {
  const { t } = useTranslation('dashboard');
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/dashboard/training-goals-summary');
        if (!cancelled) setGoals(data?.goals || []);
      } catch {
        if (!cancelled) setGoals([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading || goals.length === 0) return null;

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Gauge className="size-4" />
          {t('trainingGoals.title')}
        </CardTitle>
        <CardDescription>{t('trainingGoals.desc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {goals.map((g) => (
          <div key={g.id} className="space-y-1.5">
            <div className="flex justify-between gap-2 text-sm">
              <span className="font-medium truncate">
                {g.vehicle?.manufacturer} {g.vehicle?.model} — {g.circuit_name}
                {g.lane ? ` (${t('trainingGoals.lane', { lane: g.lane })})` : ''}
              </span>
              <span className="text-muted-foreground shrink-0 tabular-nums">{g.progress_pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${Math.min(100, g.progress_pct)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground font-mono">
              {g.goal_type === 'lap_time'
                ? t('trainingGoals.lapProgress', { current: g.current_display, target: g.target_display })
                : t('trainingGoals.consistencyProgress', {
                    current: g.current_value != null ? Number(g.current_value).toFixed(1) : '—',
                    target: g.target_display,
                  })}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

const MetricSubGroup = ({ label, children, className }) => (
  <div className={cn('space-y-3', className)}>
    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
    {children}
  </div>
);

const TabSectionIntro = ({ title, description, id }) => (
  <div className="mb-4 space-y-1">
    <h3 id={id} className="text-sm font-semibold text-foreground">
      {title}
    </h3>
    {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
  </div>
);

function vehicleDisplayName(row, t) {
  return (
    [row?.manufacturer, row?.model].filter(Boolean).join(' ') ||
    t('vehicleFallback', { id: row?.vehicle_id || row?.id })
  );
}

const KpiChip = ({ to, icon: Icon, label, value }) => {
  const className =
    'inline-flex items-center gap-2 rounded-lg border border-border/70 bg-card px-3 py-2 text-sm shadow-sm transition-colors hover:border-border hover:bg-muted/40';
  const inner = (
    <>
      {Icon ? <Icon className="size-3.5 text-muted-foreground" aria-hidden /> : null}
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums text-foreground">{value}</span>
    </>
  );
  if (to) {
    return (
      <Link to={to} className={className}>
        {inner}
      </Link>
    );
  }
  return <div className={className}>{inner}</div>;
};

function DashboardPageHeader({
  displayName,
  todayLabel,
  contextLine,
  hint,
  primaryCta,
  secondaryCtas = [],
  menuItems = [],
  t,
}) {
  const PrimaryIcon = primaryCta.icon;
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight">
          {displayName ? t('welcomeNamed', { name: displayName }) : t('welcome')}
        </h1>
        <p className="mt-1 capitalize text-muted-foreground">{todayLabel}</p>
        {contextLine ? <p className="mt-2 text-sm text-muted-foreground">{contextLine}</p> : null}
        {hint ? <p className="mt-3 max-w-xl text-sm text-muted-foreground">{hint}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('quickActionsAria')}>
        <Button size="default" asChild>
          <Link to={primaryCta.to} data-testid="dashboard-primary-cta">
            {PrimaryIcon ? <PrimaryIcon className="size-4 mr-2" aria-hidden /> : null}
            {primaryCta.label}
          </Link>
        </Button>
        {secondaryCtas.map((cta) => {
          const SecondaryIcon = cta.icon;
          return (
            <Button key={cta.to} variant="outline" size="default" asChild>
              <Link to={cta.to} data-testid={cta.testId}>
                {SecondaryIcon ? <SecondaryIcon className="size-4 mr-2" aria-hidden /> : null}
                {cta.label}
              </Link>
            </Button>
          );
        })}
        {menuItems.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="default"
                data-testid="dashboard-more-actions"
                aria-label={t('moreActionsAria')}
              >
                <MoreHorizontal className="size-4" aria-hidden />
                <span className="hidden sm:inline">{t('moreActions')}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {menuItems.map((item, index) => {
                if (item.type === 'separator') {
                  return <DropdownMenuSeparator key={`sep-${index}`} />;
                }
                const ItemIcon = item.icon;
                if (item.type === 'button') {
                  return (
                    <DropdownMenuItem
                      key={item.label}
                      disabled={item.disabled}
                      onSelect={item.onSelect}
                      className="cursor-pointer"
                    >
                      {ItemIcon ? <ItemIcon className="size-4" aria-hidden /> : null}
                      {item.label}
                    </DropdownMenuItem>
                  );
                }
                return (
                  <DropdownMenuItem key={item.to} asChild>
                    <Link to={item.to} className="flex items-center gap-2 cursor-pointer">
                      {ItemIcon ? <ItemIcon className="size-4" aria-hidden /> : null}
                      {item.label}
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </div>
  );
}

function DashboardNowZone({
  t,
  metrics,
  user,
  sessionNudgeVisible,
  setSessionNudgeDismissed,
  actionItems,
  actionItemsError,
}) {
  return (
    <section className="space-y-4" aria-labelledby="dash-now-heading" data-testid="dashboard-now-section">
      <div className="space-y-1">
        <h2 id="dash-now-heading" className="text-lg font-semibold tracking-tight">
          {t('nowTitle')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('nowDesc')}</p>
      </div>
      <div className="space-y-4">
        <ActivationSessionNudge
          totalVehicles={metrics.totalVehicles}
          totalTimings={metrics.totalTimings}
          timingsLast30Days={metrics.timingsLast30Days}
          timingsLast14Days={metrics.timingsLast14Days}
          suppressFirst={!user?.user_metadata?.onboarding_dismissed_at}
          onDismiss={() => setSessionNudgeDismissed(true)}
        />
        <MyProgressCard
          progress={metrics.progress}
          totalTimings={metrics.totalTimings}
          sessionNudgeVisible={sessionNudgeVisible}
        />
        <DashboardActionBlocks data={actionItems} loadError={actionItemsError} embedded />
        <TrainingGoalsDashboardWidget />
      </div>
    </section>
  );
}

function CompactMaintenanceSummary({ summary, t }) {
  const pendingTotal = summary.vehiclesWithoutRecentMaintenanceTotal ?? 0;
  const stalePreview = (summary.vehiclesWithoutRecentMaintenance || []).slice(0, 3);
  const recentPreview = (summary.recent || []).slice(0, 3);
  const upcomingAll = summary.upcomingScheduled || [];
  const upcomingPreview = upcomingAll.slice(0, 3);
  const upcomingTotal = upcomingAll.length;
  const recentTotal = summary.recent?.length ?? 0;
  const remainingRecent = Math.max(0, recentTotal - recentPreview.length);
  const remainingStale = Math.max(0, pendingTotal - stalePreview.length);
  const remainingUpcoming = Math.max(0, upcomingTotal - upcomingPreview.length);

  return (
    <section aria-labelledby="dash-maintenance" className="space-y-3" data-testid="dashboard-maintenance">
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="flex flex-col gap-3 border-b border-border/60 bg-muted/15 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <CardTitle id="dash-maintenance" className="text-base">
              {t('garageCompactTitle')}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {t('maintenanceDesc', { days: summary.staleDaysThreshold ?? '—' })}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" className="shrink-0 self-start sm:self-auto" asChild>
            <Link to="/vehicles">{t('garage')}</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t('pendingReview')}
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{pendingTotal}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t('upcomingShort')}
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{upcomingTotal}</p>
            </div>
            <div className="col-span-2 rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5 sm:col-span-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t('recentRecords')}
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{recentTotal}</p>
            </div>
          </div>

          {upcomingPreview.length ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                {t('upcomingMaintenance')}
              </p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {upcomingPreview.map((row) => (
                  <li key={`${row.vehicle_id}-${row.next_due_at}`} className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
                    <Link
                      to={`/vehicles/${row.vehicle_id}?tab=maintenance`}
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {vehicleDisplayName(row, t)}
                    </Link>
                    <span className="text-xs text-muted-foreground sm:text-end sm:shrink-0">
                      {formatMaintenanceKind(row.kind)}
                      {row.next_due_at
                        ? ` · ${new Date(String(row.next_due_at).slice(0, 10)).toLocaleDateString(getIntlLocale())}`
                        : ''}
                    </span>
                  </li>
                ))}
              </ul>
              {remainingUpcoming > 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">{t('andMore', { count: remainingUpcoming })}</p>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t('staleShort')}
              </p>
              {stalePreview.length ? (
                <ul className="mt-2 space-y-1.5 text-sm">
                  {stalePreview.map((row) => (
                    <li key={row.id}>
                      <Link
                        to={`/vehicles/${row.id}`}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {vehicleDisplayName(row, t)}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">{t('noStaleVehicles')}</p>
              )}
              {remainingStale > 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">{t('andMore', { count: remainingStale })}</p>
              ) : null}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t('recentRecords')}
              </p>
              {recentPreview.length ? (
                <ul className="mt-2 space-y-1.5 text-sm">
                  {recentPreview.map((row) => (
                    <li key={row.id} className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-2">
                      <Link
                        to={`/vehicles/${row.vehicle_id}`}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {vehicleDisplayName(row, t)}
                      </Link>
                      <span className="text-xs text-muted-foreground sm:shrink-0 sm:text-end">
                        {formatMaintenanceKind(row.kind)}
                        {row.performed_at
                          ? ` · ${new Date(row.performed_at).toLocaleDateString(getIntlLocale())}`
                          : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">{t('noMaintenanceRecords')}</p>
              )}
              {remainingRecent > 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">{t('andMore', { count: remainingRecent })}</p>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

const Dashboard = () => {
  const { t } = useTranslation('dashboard');
  const locale = getIntlLocale();
  const { user } = useAuth();
  const {
    metrics,
    chartsData,
    actionItems,
    actionItemsError,
    maintenanceSummary,
    maintenanceError,
    loading,
    isRefreshing,
    error,
    refetch,
  } = useDashboardData();

  const displayName = useMemo(() => {
    const meta = user?.user_metadata;
    if (meta?.full_name && String(meta.full_name).trim()) return String(meta.full_name).trim();
    if (meta?.name && String(meta.name).trim()) return String(meta.name).trim();
    if (user?.email) return user.email.split('@')[0];
    return null;
  }, [user]);

  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date()),
    [locale],
  );

  const pctLabel = (part, total) => {
    const pct = total ? ((Number(part) / total) * 100).toFixed(1) : '0';
    return t('pctOfTotal', { pct });
  };

  const formatIncrementSubtitle = (vehicle) =>
    !vehicle?.model || !vehicle?.manufacturer ? t('na') : `${vehicle.manufacturer} ${vehicle.model}`;
  const formatBestTimeSubtitle = formatIncrementSubtitle;

  const [analyticsTab, setAnalyticsTab] = useState('coleccion');
  const [sessionNudgeDismissed, setSessionNudgeDismissed] = useState(false);

  const sessionNudgeVisible = useMemo(() => {
    if (sessionNudgeDismissed) return false;
    const variant = getActivationNudgeVariant({
      totalVehicles: metrics.totalVehicles,
      totalTimings: metrics.totalTimings,
      timingsLast30Days: metrics.timingsLast30Days,
      timingsLast14Days: metrics.timingsLast14Days,
      suppressFirst: !user?.user_metadata?.onboarding_dismissed_at,
    });
    if (!variant) return false;
    return !isActivationNudgeDismissed(variant);
  }, [
    sessionNudgeDismissed,
    metrics.totalVehicles,
    metrics.totalTimings,
    metrics.timingsLast30Days,
    metrics.timingsLast14Days,
    user?.user_metadata?.onboarding_dismissed_at,
  ]);
  const analyticsTabOptions = useMemo(
    () => [
      {
        value: 'coleccion',
        label: t('collection'),
        trigger: (
          <>
            <LayoutDashboard className="size-3.5 opacity-70" aria-hidden />
            {t('collection')}
          </>
        ),
      },
      {
        value: 'rendimiento',
        label: t('performance'),
        trigger: (
          <>
            <Gauge className="size-3.5 opacity-70" aria-hidden />
            {t('performance')}
          </>
        ),
      },
      {
        value: 'inversion',
        label: t('investment'),
        trigger: (
          <>
            <Sparkles className="size-3.5 opacity-70" aria-hidden />
            {t('investment')}
          </>
        ),
      },
    ],
    [t],
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const isEmpty = !metrics.totalVehicles;
  const nowZone = (
    <DashboardNowZone
      t={t}
      metrics={metrics}
      user={user}
      sessionNudgeVisible={sessionNudgeVisible}
      setSessionNudgeDismissed={setSessionNudgeDismissed}
      actionItems={actionItems}
      actionItemsError={actionItemsError}
    />
  );

  if (isEmpty) {
    return (
      <div className="space-y-8">
        <DashboardPageHeader
          displayName={displayName}
          todayLabel={todayLabel}
          hint={t('emptyHint')}
          primaryCta={{ to: '/vehicles/new', label: t('addFirstVehicle'), icon: Plus }}
          secondaryCtas={[
            {
              to: '/session',
              label: t('newSession'),
              icon: Clock,
              testId: 'dashboard-secondary-session-cta',
            },
          ]}
          menuItems={[
            { to: '/competitions', label: t('competitions'), icon: Trophy },
          ]}
          t={t}
        />
        {nowZone}
      </div>
    );
  }

  const total = metrics.totalVehicles || 0;
  const digitalCount = metrics.digitalVehicles ?? 0;
  const museoCount = metrics.museoVehicles ?? 0;
  const tallerCount = metrics.tallerVehicles ?? 0;
  const fleetLine = `${t('vehicleCount', { count: metrics.totalVehicles })}${
    metrics.activeCompetitions != null
      ? ` · ${t('activeCompetitions', { count: metrics.activeCompetitions })}`
      : ''
  }`;

  return (
    <div className="space-y-8">
      <DashboardPageHeader
        displayName={displayName}
        todayLabel={todayLabel}
        contextLine={fleetLine}
        primaryCta={{ to: '/session', label: t('newSession'), icon: Clock }}
        menuItems={[
          {
            type: 'button',
            label: t('refresh'),
            icon: RefreshCw,
            disabled: isRefreshing,
            onSelect: () => refetch(),
          },
          { type: 'separator' },
          { to: '/competitions', label: t('newCompetition'), icon: Plus },
          { to: '/vehicles', label: t('vehicles'), icon: Car },
          { to: '/timings', label: t('timings'), icon: Clock },
        ]}
        t={t}
      />

      {nowZone}

      {maintenanceError ? (
        <Alert variant="destructive">
          <AlertDescription>{t('maintenanceLoadError')}</AlertDescription>
        </Alert>
      ) : null}

      {maintenanceSummary ? <CompactMaintenanceSummary summary={maintenanceSummary} t={t} /> : null}

      <section aria-labelledby="dash-metrics-heading" className="space-y-3" data-testid="dashboard-kpi-strip">
        <div className="space-y-1">
          <h2 id="dash-metrics-heading" className="text-lg font-semibold tracking-tight">
            {t('kpiTitle')}
          </h2>
          <p className="text-sm text-muted-foreground">{t('kpiDescCompact')}</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            compact
            title={t('metrics.totalVehicles')}
            value={metrics.totalVehicles}
            icon={<Truck />}
            valueColor="primary"
            to="/vehicles"
          />
          <MetricCard
            compact
            title={t('metrics.totalInvestment')}
            value={formatCurrencyEur(metrics.totalInvestment)}
            subtitle={t('metrics.averageLabel', { value: formatCurrencyEur(metrics.averageInvestmentPerVehicle) })}
            icon={<Euro />}
            valueColor="warning"
          />
          <MetricCard
            compact
            title={t('metrics.activeCompetitions')}
            value={metrics.activeCompetitions || 0}
            subtitle={t('metrics.inProgress')}
            icon={<Trophy />}
            valueColor="primary"
          />
          <MetricCard
            compact
            title={t('metrics.bestTime')}
            value={metrics.bestTimeVehicle?.best_lap_time}
            subtitle={formatBestTimeSubtitle(metrics.bestTimeVehicle)}
            icon={<Clock />}
            detailsMode="tooltip-only"
            details={{
              [t('details.lastUpdate')]: metrics.bestTimeVehicle?.timing_date,
              [t('details.circuit')]: metrics.bestTimeVehicle?.circuit,
              [t('details.laps')]: metrics.bestTimeVehicle?.laps,
              [t('details.lane')]: metrics.bestTimeVehicle?.lane,
            }}
            formatValue={formatLapTimeDisplay}
            valueColor="success"
            threshold={{ good: 10, warning: 12 }}
          />
        </div>
        <div className="flex flex-wrap gap-2" data-testid="dashboard-kpi-chips">
          <KpiChip
            to="/vehicles?digital=Digital"
            icon={Smartphone}
            label={t('metrics.digital')}
            value={digitalCount}
          />
          <KpiChip
            to="/vehicles?filterMuseo=true"
            icon={Landmark}
            label={t('metrics.museo')}
            value={museoCount}
          />
          <KpiChip
            to="/vehicles?filterTaller=true"
            icon={Warehouse}
            label={t('metrics.taller')}
            value={tallerCount}
          />
          <KpiChip
            to="/vehicles?modified=Sí"
            icon={Wrench}
            label={t('metrics.modifiedVehicles')}
            value={metrics.modifiedVehicles}
          />
          <KpiChip
            to="/vehicles?modified=No"
            icon={Car}
            label={t('metrics.stockVehicles')}
            value={metrics.stockVehicles}
          />
        </div>

        <details className="group rounded-xl border border-border/70 bg-card shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
            <span>{t('moreMetrics')}</span>
            <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="space-y-6 border-t border-border/60 px-4 py-4 sm:px-5">
            <MetricSubGroup label={t('subgroupFleet')}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <MetricCard
                  title={t('metrics.modifiedVehicles')}
                  value={metrics.modifiedVehicles}
                  subtitle={pctLabel(metrics.modifiedVehicles, total)}
                  icon={<Wrench />}
                  valueColor="success"
                  trend={metrics.trends?.modifiedVehicles?.trend || 'stable'}
                  trendValue={metrics.trends?.modifiedVehicles?.value || t('metrics.noData')}
                  to="/vehicles?modified=Sí"
                />
                <MetricCard
                  title={t('metrics.stockVehicles')}
                  value={metrics.stockVehicles}
                  subtitle={pctLabel(metrics.stockVehicles, total)}
                  icon={<Car />}
                  valueColor="info"
                  trend={metrics.trends?.stockVehicles?.trend || 'stable'}
                  trendValue={metrics.trends?.stockVehicles?.value || t('metrics.noData')}
                  to="/vehicles?modified=No"
                />
              </div>
            </MetricSubGroup>
            <MetricSubGroup label={t('subgroupClassification')}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <MetricCard
                  title={t('metrics.digital')}
                  value={digitalCount}
                  subtitle={pctLabel(digitalCount, total)}
                  icon={<Smartphone />}
                  valueColor="primary"
                  trend={metrics.trends?.digitalVehicles?.trend || 'stable'}
                  trendValue={metrics.trends?.digitalVehicles?.value || t('metrics.noData')}
                  to="/vehicles?digital=Digital"
                />
                <MetricCard
                  title={t('metrics.museo')}
                  value={museoCount}
                  subtitle={pctLabel(museoCount, total)}
                  icon={<Landmark />}
                  valueColor="info"
                  trend={metrics.trends?.museoVehicles?.trend || 'stable'}
                  trendValue={metrics.trends?.museoVehicles?.value || t('metrics.noData')}
                  to="/vehicles?filterMuseo=true"
                />
                <MetricCard
                  title={t('metrics.taller')}
                  value={tallerCount}
                  subtitle={pctLabel(tallerCount, total)}
                  icon={<Warehouse />}
                  valueColor="secondary"
                  trend={metrics.trends?.tallerVehicles?.trend || 'stable'}
                  trendValue={metrics.trends?.tallerVehicles?.value || t('metrics.noData')}
                  to="/vehicles?filterTaller=true"
                />
              </div>
            </MetricSubGroup>
            <MetricSubGroup label={t('subgroupActivity')}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <MetricCard
                  title={t('metrics.avgIncrement')}
                  value={formatPercentEs(metrics.averagePriceIncrement)}
                  subtitle={formatIncrementSubtitle(metrics.highestIncrementVehicle)}
                  icon={<TrendingUp />}
                  valueColor="success"
                  trend={metrics.trends?.averagePriceIncrement?.trend || 'stable'}
                  trendValue={metrics.trends?.averagePriceIncrement?.value || t('metrics.noData')}
                />
                <MetricCard
                  title={t('metrics.lastUpdate')}
                  value={formatDashboardMetricDate(metrics.lastUpdate)}
                  subtitle={t('metrics.syncSubtitle')}
                  icon={<Settings />}
                  valueColor="secondary"
                  trend={metrics.trends?.lastUpdate?.trend || 'stable'}
                  trendValue={metrics.trends?.lastUpdate?.value || t('metrics.systemActive')}
                />
              </div>
            </MetricSubGroup>
          </div>
        </details>
      </section>

      <section className="space-y-4" aria-labelledby="dash-analytics-heading">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="dash-analytics-heading" className="text-lg font-semibold tracking-tight">
              {t('analyticsTitle')}
            </h2>
          </div>
        </div>

        <Tabs value={analyticsTab} onValueChange={setAnalyticsTab} className="w-full">
          <ResponsiveTabsNav
            value={analyticsTab}
            onValueChange={setAnalyticsTab}
            options={analyticsTabOptions}
            listClassName="sm:grid-cols-3"
            triggerClassName="gap-1.5"
            listAriaLabel={t('tabsAria')}
            mobileLabel={t('tabsSectionLabel')}
          />

          <TabsContent value="coleccion" className="mt-4 space-y-6 focus-visible:outline-none">
            <TabSectionIntro
              id="tab-coleccion-desc"
              title={t('sectionFleetDist')}
              description={t('sectionFleetDistDesc')}
            />
            <Suspense fallback={<ChartFallback />}>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <BrandDistributionChart data={chartsData.brandDistribution || []} />
                <StoreDistributionChart data={chartsData.storeDistribution || []} />
              </div>
            </Suspense>
            <Suspense fallback={<ChartFallback />}>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <VehiclesByTypeChart data={chartsData.vehiclesByType || []} />
                <ModificationPieChart data={chartsData.modificationStats || { modified: 0, stock: 0 }} />
              </div>
            </Suspense>
          </TabsContent>

          <TabsContent value="rendimiento" className="mt-4 space-y-6 focus-visible:outline-none">
            <TabSectionIntro
              id="tab-rendimiento-desc"
              title={t('sectionReval')}
              description={t('sectionRevalDesc')}
            />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <MetricCard
                title={t('metrics.highestIncrement')}
                value={metrics.highestIncrementVehicle?.price_increment || 0}
                subtitle={formatIncrementSubtitle(metrics.highestIncrementVehicle)}
                icon={<Trophy />}
                details={{
                  [t('details.lastUpdate')]: metrics.highestIncrementVehicle?.purchase_date,
                  [t('details.basePrice')]: metrics.highestIncrementVehicle?.price,
                  [t('details.totalPrice')]: metrics.highestIncrementVehicle?.total_price,
                }}
                formatValue={formatPercentEs}
                valueColor="warning"
              />
              <Suspense fallback={<ChartFallback />}>
                <PerformanceByTypeChart data={metrics.performanceByType || {}} />
              </Suspense>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="size-4 text-muted-foreground" aria-hidden />
                <h3 className="text-sm font-medium text-muted-foreground">{t('timesByLane')}</h3>
              </div>
              <Suspense fallback={<ChartFallback />}>
                <LaneComparisonChart />
              </Suspense>
            </div>
          </TabsContent>

          <TabsContent value="inversion" className="mt-4 space-y-6 focus-visible:outline-none">
            <TabSectionIntro
              id="tab-inversion-desc"
              title={t('sectionInvestment')}
              description={t('sectionInvestmentDesc')}
            />
            <Suspense fallback={<ChartFallback />}>
              <InvestmentTimelineChart data={metrics.investmentHistory || []} />
            </Suspense>
            <Suspense fallback={<ChartFallback />}>
              <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                <TopCostTable data={chartsData.topCostVehicles || []} />
              </div>
            </Suspense>
            <Suspense fallback={<ChartFallback />}>
              <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                <TopComponentsTable data={chartsData.topComponents || []} />
              </div>
            </Suspense>
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
};

export default Dashboard;
