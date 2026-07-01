import React, { Suspense, lazy, useMemo } from 'react';
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
} from 'lucide-react';
import MetricCard from '../components/MetricCard';
import DashboardActionBlocks from '../components/DashboardActionBlocks';
import { useDashboardData } from '../hooks/useDashboardData';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Spinner } from '../components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { cn } from '../lib/utils';
import {
  formatCurrencyEur,
  formatPercentEs,
  formatLapTimeDisplay,
  formatDashboardMetricDate,
  formatMaintenanceKind,
  getIntlLocale,
} from '../utils/formatUtils';

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

/** Agrupa tarjetas de métricas con una etiqueta compacta */
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

  if (isEmpty) {
    return (
      <div className="space-y-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {displayName ? t('welcomeNamed', { name: displayName }) : t('welcome')}
            </h1>
            <p className="mt-1 capitalize text-muted-foreground">{todayLabel}</p>
            <p className="mt-3 max-w-xl text-sm text-muted-foreground">{t('emptyHint')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="lg" asChild>
              <Link to="/vehicles/new">
                <Plus className="size-4 mr-2" aria-hidden />
                {t('addFirstVehicle')}
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link to="/competitions">
                <Trophy className="size-4 mr-2" aria-hidden />
                {t('competitions')}
              </Link>
            </Button>
          </div>
        </div>

        <DashboardActionBlocks data={actionItems} loadError={actionItemsError} />

        <Card className="border-dashed bg-muted/30">
          <CardContent className="flex flex-col items-center justify-center gap-4 py-16 px-6 text-center">
            <div
              className="flex size-20 items-center justify-center rounded-full bg-muted"
              aria-hidden
            >
              <Car className="size-10 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">{t('garageWaiting')}</h2>
              <p className="max-w-md text-sm text-muted-foreground">
                {t('garageHint')}
              </p>
            </div>
            <Button asChild size="lg">
              <Link to="/vehicles/new">{t('startNow')}</Link>
            </Button>
          </CardContent>
        </Card>

      </div>
    );
  }

  const total = metrics.totalVehicles || 0;
  const digitalCount = metrics.digitalVehicles ?? 0;
  const museoCount = metrics.museoVehicles ?? 0;
  const tallerCount = metrics.tallerVehicles ?? 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {displayName ? t('welcomeNamed', { name: displayName }) : t('welcome')}
          </h1>
          <p className="mt-1 capitalize text-muted-foreground">{todayLabel}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('vehicleCount', { count: metrics.totalVehicles })}
            {metrics.activeCompetitions != null
              ? ` · ${t('activeCompetitions', { count: metrics.activeCompetitions })}`
              : ''}
          </p>
        </div>
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label={t('quickActionsAria')}
        >
          <Button
            type="button"
            variant="outline"
            size="default"
            disabled={isRefreshing}
            onClick={() => refetch()}
          >
            <RefreshCw className={`size-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden />
            {t('refresh')}
          </Button>
          <Button size="default" asChild>
            <Link to="/competitions">
              <Plus className="size-4 mr-2" aria-hidden />
              {t('newCompetition')}
            </Link>
          </Button>
          <Button variant="outline" size="default" asChild>
            <Link to="/vehicles">
              <Car className="size-4 mr-2" aria-hidden />
              {t('vehicles')}
            </Link>
          </Button>
          <Button variant="outline" size="default" asChild>
            <Link to="/timings">
              <Clock className="size-4 mr-2" aria-hidden />
              {t('timings')}
            </Link>
          </Button>
        </div>
      </div>

      {maintenanceError ? (
        <Alert variant="destructive">
          <AlertDescription>{t('maintenanceLoadError')}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-6">
        <DashboardActionBlocks data={actionItems} loadError={actionItemsError} />

        {maintenanceSummary ? (
          <section aria-labelledby="dash-maintenance" className="space-y-4">
            <Card className="border-border/80 shadow-sm">
              <CardHeader className="flex flex-col gap-3 border-b border-border/60 bg-muted/15 pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <CardTitle id="dash-maintenance" className="text-base">
                    {t('maintenance')}
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    {t('maintenanceDesc', { days: maintenanceSummary.staleDaysThreshold ?? '—' })}
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" className="shrink-0 self-start sm:self-auto" asChild>
                  <Link to="/vehicles">{t('garage')}</Link>
                </Button>
              </CardHeader>
              <CardContent className="p-4 sm:p-5">
                <div className="grid gap-5 lg:grid-cols-12 lg:gap-6 lg:items-start">
                  <div className="rounded-lg border border-border/60 bg-muted/10 p-4 lg:col-span-4 xl:col-span-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t('pendingReview')}
                    </p>
                    <p className="mt-1 text-3xl font-bold tabular-nums">
                      {maintenanceSummary.vehiclesWithoutRecentMaintenanceTotal ?? 0}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t('pendingReviewHint')}
                    </p>
                  </div>
                  <div className="min-w-0 lg:col-span-8 xl:col-span-9">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t('recentRecords')}
                    </p>
                    {maintenanceSummary.recent?.length ? (
                      <ul className="mt-3 max-h-[min(16rem,40vh)] space-y-0 overflow-y-auto text-sm lg:max-h-[min(20rem,45vh)]">
                        {maintenanceSummary.recent.slice(0, 12).map((row) => (
                          <li
                            key={row.id}
                            className="flex flex-col gap-0.5 border-b border-border/40 py-2.5 last:border-0 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <Link
                              to={`/vehicles/${row.vehicle_id}`}
                              className="font-medium text-primary underline-offset-4 hover:underline"
                            >
                              {[row.manufacturer, row.model].filter(Boolean).join(' ') ||
                                t('vehicleFallback', { id: row.vehicle_id })}
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
                      <p className="mt-3 text-sm text-muted-foreground">
                        {t('noMaintenanceRecords')}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {maintenanceSummary.upcomingScheduled?.length ? (
              <Card className="border-amber-500/40 shadow-sm" aria-labelledby="dash-maintenance-upcoming">
                <CardHeader className="border-b border-border/60 bg-amber-500/5 pb-4">
                  <CardTitle id="dash-maintenance-upcoming" className="text-base">
                    {t('upcomingMaintenance')}
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    {t('upcomingMaintenanceDesc')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-5">
                  <ul className="space-y-0 divide-y divide-border/40 text-sm">
                    {maintenanceSummary.upcomingScheduled.map((row) => (
                      <li key={`${row.vehicle_id}-${row.next_due_at}`} className="flex flex-col gap-1 py-3 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
                        <Link
                          to={`/vehicles/${row.vehicle_id}?tab=maintenance`}
                          className="font-medium text-primary underline-offset-4 hover:underline"
                        >
                          {[row.manufacturer, row.model].filter(Boolean).join(' ') ||
                            t('vehicleFallback', { id: row.vehicle_id })}
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
                </CardContent>
              </Card>
            ) : null}
          </section>
        ) : null}
      </div>

      <section aria-labelledby="dash-metrics-heading">
        <Card className="overflow-hidden border-border/80 shadow-sm">
          <CardHeader className="border-b border-border/60 bg-muted/15 py-4 sm:py-5">
            <CardTitle id="dash-metrics-heading" className="text-base sm:text-lg">
              {t('kpiTitle')}
            </CardTitle>
            <CardDescription>
              {t('kpiDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8 p-4 sm:p-6">
            <MetricSubGroup label={t('subgroupFleet')}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
                <MetricCard
                  title={t('metrics.totalVehicles')}
                  value={metrics.totalVehicles}
                  icon={<Truck />}
                  valueColor="primary"
                  trend={metrics.trends?.totalVehicles?.trend || 'stable'}
                  trendValue={metrics.trends?.totalVehicles?.value || t('metrics.noData')}
                  to="/vehicles"
                />
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
                <MetricCard
                  title={t('metrics.totalInvestment')}
                  value={formatCurrencyEur(metrics.totalInvestment)}
                  subtitle={t('metrics.averageLabel', { value: formatCurrencyEur(metrics.averageInvestmentPerVehicle) })}
                  icon={<Euro />}
                  valueColor="warning"
                  trend={metrics.trends?.totalInvestment?.trend || 'stable'}
                  trendValue={metrics.trends?.totalInvestment?.value || t('metrics.noData')}
                />
              </div>
            </MetricSubGroup>

            <MetricSubGroup label={t('subgroupClassification')}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
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
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
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
                <MetricCard
                  title={t('metrics.activeCompetitions')}
                  value={metrics.activeCompetitions || 0}
                  subtitle={t('metrics.inProgress')}
                  icon={<Trophy />}
                  valueColor="primary"
                  trend={metrics.trends?.activeCompetitions?.trend || 'stable'}
                  trendValue={metrics.trends?.activeCompetitions?.value || t('metrics.noData')}
                />
                <MetricCard
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
            </MetricSubGroup>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4" aria-labelledby="dash-analytics-heading">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="dash-analytics-heading" className="text-lg font-semibold tracking-tight">
              {t('analyticsTitle')}
            </h2>
          </div>
        </div>

        <Tabs defaultValue="coleccion" className="w-full">
          <TabsList
            className="grid h-auto w-full grid-cols-1 gap-1 p-1 sm:inline-flex sm:h-9 sm:w-auto sm:grid-cols-none"
            aria-label={t('tabsAria')}
          >
            <TabsTrigger value="coleccion" className="gap-1.5">
              <LayoutDashboard className="size-3.5 opacity-70" aria-hidden />
              {t('collection')}
            </TabsTrigger>
            <TabsTrigger value="rendimiento" className="gap-1.5">
              <Gauge className="size-3.5 opacity-70" aria-hidden />
              {t('performance')}
            </TabsTrigger>
            <TabsTrigger value="inversion" className="gap-1.5">
              <Sparkles className="size-3.5 opacity-70" aria-hidden />
              {t('investment')}
            </TabsTrigger>
          </TabsList>

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
