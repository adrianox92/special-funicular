import React, { Suspense, lazy, useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Truck,
  Wrench,
  Euro,
  ShoppingCart,
  Trophy,
  Clock,
  Car,
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
    <Card className="border-border/70 shadow-none">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Gauge className="size-4" />
          {t('trainingGoals.title')}
        </CardTitle>
        <CardDescription className="text-xs">{t('trainingGoals.desc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-2">
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
    'inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background px-2.5 py-1 text-xs transition-colors hover:border-border hover:bg-muted/50';
  const inner = (
    <>
      {Icon ? <Icon className="size-3 text-muted-foreground" aria-hidden /> : null}
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

const kpiCellClassName =
  'min-w-0 flex-1 border-b border-border/60 last:border-b-0 sm:max-lg:[&:nth-child(odd)]:border-r sm:max-lg:[&:nth-last-child(-n+2)]:border-b-0 lg:border-r lg:[&:nth-child(3n)]:border-r-0 lg:[&:nth-last-child(-n+3)]:border-b-0';

const KpiStat = ({ to, icon: Icon, label, value, subtitle, testId }) => {
  const inner = (
    <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-3 py-3 sm:px-4" data-testid={testId}>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden /> : null}
        <span className="truncate">{label}</span>
      </p>
      <p className="truncate text-xl font-bold tabular-nums tracking-tight text-foreground sm:text-2xl">{value}</p>
      {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
    </div>
  );
  if (to) {
    return (
      <Link
        to={to}
        className={cn(
          kpiCellClassName,
          'rounded-none transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        )}
      >
        {inner}
      </Link>
    );
  }
  return <div className={kpiCellClassName}>{inner}</div>;
};

const ExtraMetricRow = ({ label, value, hint, to, testId }) => {
  const row = (
    <div className="flex items-baseline justify-between gap-3 py-2" data-testid={testId}>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
  if (to) {
    return (
      <Link to={to} className="block rounded-md px-1 -mx-1 hover:bg-muted/40">
        {row}
      </Link>
    );
  }
  return <div className="px-1 -mx-1">{row}</div>;
};

function DashboardPageHeader({
  displayName,
  todayLabel,
  contextLine,
  hint,
  primaryCta,
  secondaryCtas = [],
  menuItems = [],
  onRefresh,
  isRefreshing = false,
  t,
}) {
  const PrimaryIcon = primaryCta.icon;
  return (
    <header
      className="flex flex-col gap-4 border-b border-border/70 pb-5 lg:flex-row lg:items-end lg:justify-between"
      data-testid="dashboard-header"
    >
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {displayName ? t('welcomeNamed', { name: displayName }) : t('welcome')}
        </h1>
        <p className="text-sm capitalize text-muted-foreground">{todayLabel}</p>
        {contextLine ? <p className="text-sm text-muted-foreground">{contextLine}</p> : null}
        {hint ? <p className="max-w-xl text-sm text-muted-foreground">{hint}</p> : null}
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
        {onRefresh ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label={t('refresh')}
            data-testid="dashboard-refresh"
          >
            <RefreshCw className={cn('size-4', isRefreshing && 'animate-spin')} aria-hidden />
          </Button>
        ) : null}
        {menuItems.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                data-testid="dashboard-more-actions"
                aria-label={t('moreActionsAria')}
              >
                <MoreHorizontal className="size-4" aria-hidden />
                <span className="sr-only">{t('moreActions')}</span>
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
    </header>
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
    <section className="space-y-3" aria-labelledby="dash-now-heading" data-testid="dashboard-now-section">
      <div className="space-y-1">
        <h2 id="dash-now-heading" className="text-lg font-semibold tracking-tight">
          {t('nowTitle')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('nowDesc')}</p>
      </div>
      <div className="space-y-3 rounded-2xl bg-muted/20 p-3 sm:p-4">
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
  const upcomingAll = summary.upcomingScheduled || [];
  const upcomingTotal = upcomingAll.length;
  const recentTotal = summary.recent?.length ?? 0;
  const staleRows = summary.vehiclesWithoutRecentMaintenance || [];
  const recentRows = summary.recent || [];

  const topItems = [];
  for (const row of upcomingAll) {
    if (topItems.length >= 3) break;
    topItems.push({
      key: `up-${row.vehicle_id}-${row.next_due_at}`,
      to: `/vehicles/${row.vehicle_id}?tab=maintenance`,
      name: vehicleDisplayName(row, t),
      meta: [
        formatMaintenanceKind(row.kind),
        row.next_due_at
          ? new Date(String(row.next_due_at).slice(0, 10)).toLocaleDateString(getIntlLocale())
          : null,
      ]
        .filter(Boolean)
        .join(' · '),
      tone: 'upcoming',
    });
  }
  for (const row of staleRows) {
    if (topItems.length >= 3) break;
    topItems.push({
      key: `stale-${row.id}`,
      to: `/vehicles/${row.id}`,
      name: vehicleDisplayName(row, t),
      meta: t('staleShort'),
      tone: 'stale',
    });
  }
  if (topItems.length === 0) {
    for (const row of recentRows.slice(0, 3)) {
      topItems.push({
        key: `recent-${row.id}`,
        to: `/vehicles/${row.vehicle_id}`,
        name: vehicleDisplayName(row, t),
        meta: [
          formatMaintenanceKind(row.kind),
          row.performed_at ? new Date(row.performed_at).toLocaleDateString(getIntlLocale()) : null,
        ]
          .filter(Boolean)
          .join(' · '),
        tone: 'recent',
      });
    }
  }

  const notableCount = upcomingTotal + pendingTotal;
  const shownNotable = topItems.filter((item) => item.tone !== 'recent').length;
  const remaining =
    notableCount > 0
      ? Math.max(0, notableCount - shownNotable)
      : Math.max(0, recentTotal - topItems.length);

  return (
    <section aria-labelledby="dash-maintenance" data-testid="dashboard-maintenance">
      <Card className="border-border/70 shadow-sm">
        <CardContent className="space-y-3 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <h2 id="dash-maintenance" className="text-base font-semibold tracking-tight">
                {t('garageCompactTitle')}
              </h2>
              <p className="text-xs text-muted-foreground sm:text-sm">
                {t('garageCounts', {
                  pending: pendingTotal,
                  upcoming: upcomingTotal,
                  recent: recentTotal,
                })}
              </p>
            </div>
            <Button variant="ghost" size="sm" className="shrink-0 self-start" asChild>
              <Link to="/vehicles">{t('garage')}</Link>
            </Button>
          </div>

          {topItems.length ? (
            <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
              {topItems.map((item) => (
                <li key={item.key} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <Link
                    to={item.to}
                    className="min-w-0 truncate font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {item.name}
                  </Link>
                  <span
                    className={cn(
                      'shrink-0 text-xs',
                      item.tone === 'upcoming'
                        ? 'text-amber-700 dark:text-amber-300'
                        : 'text-muted-foreground',
                    )}
                  >
                    {item.meta}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t('garageAllClear')}</p>
          )}

          {remaining > 0 ? (
            <p className="text-xs text-muted-foreground">{t('andMore', { count: remaining })}</p>
          ) : null}
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
          onRefresh={() => refetch()}
          isRefreshing={isRefreshing}
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
          { to: '/competitions', label: t('newCompetition'), icon: Plus },
          { to: '/vehicles', label: t('vehicles'), icon: Car },
          { to: '/timings', label: t('timings'), icon: Clock },
        ]}
        onRefresh={() => refetch()}
        isRefreshing={isRefreshing}
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
        <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <KpiStat
              to="/vehicles"
              icon={Truck}
              label={t('metrics.totalVehicles')}
              value={metrics.totalVehicles}
              testId="kpi-stat-vehicles"
            />
            <KpiStat
              icon={ShoppingCart}
              label={t('metrics.purchaseInvestment')}
              value={formatCurrencyEur(metrics.purchaseInvestment)}
              testId="kpi-stat-purchases"
            />
            <KpiStat
              icon={Wrench}
              label={t('metrics.modificationInvestment')}
              value={formatCurrencyEur(metrics.modificationInvestment)}
              subtitle={t('metrics.averageLabel', { value: formatCurrencyEur(metrics.averageInvestmentPerVehicle) })}
              testId="kpi-stat-modifications"
            />
            <KpiStat
              icon={Euro}
              label={t('metrics.totalInvestment')}
              value={formatCurrencyEur(metrics.totalInvestment)}
              subtitle={t('metrics.investmentSumHint')}
              testId="kpi-stat-investment"
            />
            <KpiStat
              icon={Trophy}
              label={t('metrics.activeCompetitions')}
              value={metrics.activeCompetitions || 0}
              subtitle={t('metrics.inProgress')}
              testId="kpi-stat-competitions"
            />
            <KpiStat
              icon={Clock}
              label={t('metrics.bestTime')}
              value={formatLapTimeDisplay(metrics.bestTimeVehicle?.best_lap_time)}
              subtitle={formatBestTimeSubtitle(metrics.bestTimeVehicle)}
              testId="kpi-stat-best-time"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5" data-testid="dashboard-kpi-chips">
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

        <details className="group rounded-xl border border-border/70 bg-card">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
            <span>{t('moreMetrics')}</span>
            <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="grid grid-cols-1 gap-x-8 border-t border-border/60 px-4 py-3 sm:grid-cols-2 sm:px-5">
            <ExtraMetricRow
              label={t('metrics.modifiedVehicles')}
              value={metrics.modifiedVehicles}
              hint={`${pctLabel(metrics.modifiedVehicles, total)} · ${metrics.trends?.modifiedVehicles?.value || t('metrics.noData')}`}
              to="/vehicles?modified=Sí"
            />
            <ExtraMetricRow
              label={t('metrics.stockVehicles')}
              value={metrics.stockVehicles}
              hint={`${pctLabel(metrics.stockVehicles, total)} · ${metrics.trends?.stockVehicles?.value || t('metrics.noData')}`}
              to="/vehicles?modified=No"
            />
            <ExtraMetricRow
              label={t('metrics.digital')}
              value={digitalCount}
              hint={`${pctLabel(digitalCount, total)} · ${metrics.trends?.digitalVehicles?.value || t('metrics.noData')}`}
              to="/vehicles?digital=Digital"
            />
            <ExtraMetricRow
              label={t('metrics.museo')}
              value={museoCount}
              hint={`${pctLabel(museoCount, total)} · ${metrics.trends?.museoVehicles?.value || t('metrics.noData')}`}
              to="/vehicles?filterMuseo=true"
            />
            <ExtraMetricRow
              label={t('metrics.taller')}
              value={tallerCount}
              hint={`${pctLabel(tallerCount, total)} · ${metrics.trends?.tallerVehicles?.value || t('metrics.noData')}`}
              to="/vehicles?filterTaller=true"
            />
            <ExtraMetricRow
              label={t('metrics.avgIncrement')}
              value={formatPercentEs(metrics.averagePriceIncrement)}
              hint={`${formatIncrementSubtitle(metrics.highestIncrementVehicle)} · ${metrics.trends?.averagePriceIncrement?.value || t('metrics.noData')}`}
              testId="kpi-extra-avg-increment"
            />
            <ExtraMetricRow
              label={t('metrics.lastUpdate')}
              value={formatDashboardMetricDate(metrics.lastUpdate)}
              hint={metrics.trends?.lastUpdate?.value || t('metrics.systemActive')}
              testId="kpi-extra-last-update"
            />
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
