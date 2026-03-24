import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
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
} from 'lucide-react';
import MetricCard from '../components/MetricCard';
import VehiclesByTypeChart from '../components/charts/VehiclesByTypeChart';
import ModificationPieChart from '../components/charts/ModificationPieChart';
import BrandDistributionChart from '../components/charts/BrandDistributionChart';
import StoreDistributionChart from '../components/charts/StoreDistributionChart';
import TopCostTable from '../components/tables/TopCostTable';
import TopComponentsTable from '../components/tables/TopComponentsTable';
import PerformanceByTypeChart from '../components/charts/PerformanceByTypeChart';
import InvestmentTimelineChart from '../components/charts/InvestmentTimelineChart';
import InsightsCarousel from '../components/InsightsCarousel';
import DashboardActionBlocks from '../components/DashboardActionBlocks';
import LaneComparisonChart from '../components/LaneComparisonChart';
import api from '../lib/axios';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Separator } from '../components/ui/separator';
import { Spinner } from '../components/ui/spinner';

const SectionHeader = ({ icon: Icon, title, description, headingId }) => (
  <div className="space-y-2">
    <div className="flex flex-wrap items-center gap-2">
      {Icon ? <Icon className="size-5 text-primary" aria-hidden /> : null}
      <h2 id={headingId} className="text-lg font-semibold tracking-tight">
        {title}
      </h2>
    </div>
    {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    <Separator className="mt-3" />
  </div>
);

const Dashboard = () => {
  const { user } = useAuth();

  const [metrics, setMetrics] = useState({
    totalVehicles: 0,
    modifiedVehicles: 0,
    stockVehicles: 0,
    totalInvestment: 0,
    averageInvestmentPerVehicle: 0,
    averagePriceIncrement: 0,
    lastUpdate: null,
    highestIncrementVehicle: null,
    bestTimeVehicle: null,
    investmentHistory: [],
    performanceByType: {},
    trends: {},
    activeCompetitions: 0,
  });

  const [chartsData, setChartsData] = useState({
    vehiclesByType: [],
    modificationStats: { modified: 0, stock: 0 },
    topCostVehicles: [],
    topComponents: [],
    brandDistribution: [],
    storeDistribution: [],
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionItems, setActionItems] = useState(null);
  const [actionItemsError, setActionItemsError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [metricsResponse, chartsResponse] = await Promise.all([
          api.get('/dashboard/metrics'),
          api.get('/dashboard/charts'),
        ]);
        setMetrics(metricsResponse.data);
        setChartsData(chartsResponse.data);

        try {
          const actionResponse = await api.get('/dashboard/action-items');
          setActionItems(actionResponse.data);
          setActionItemsError(false);
        } catch (actionErr) {
          console.error('Error al cargar acciones del dashboard:', actionErr);
          setActionItems(null);
          setActionItemsError(true);
        }
      } catch (err) {
        console.error('Error al cargar datos del dashboard:', err);
        setError('Error al cargar los datos del dashboard');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const displayName = useMemo(() => {
    const meta = user?.user_metadata;
    if (meta?.full_name && String(meta.full_name).trim()) return String(meta.full_name).trim();
    if (meta?.name && String(meta.name).trim()) return String(meta.name).trim();
    if (user?.email) return user.email.split('@')[0];
    return null;
  }, [user]);

  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date()),
    [],
  );

  const formatCurrency = (value) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
  const formatPercentage = (value) =>
    new Intl.NumberFormat('es-ES', {
      style: 'percent',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(value / 100);
  const formatIncrementSubtitle = (vehicle) =>
    !vehicle?.model || !vehicle?.manufacturer ? 'N/A' : `${vehicle.manufacturer} ${vehicle.model}`;
  const formatTime = (timeStr) => {
    if (!timeStr) return 'N/A';
    if (typeof timeStr === 'string' && timeStr.match(/^\d{2}:\d{2}\.\d{3}$/)) return timeStr;
    const seconds = Number(timeStr);
    if (!Number.isNaN(seconds)) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = (seconds % 60).toFixed(3);
      return `${String(minutes).padStart(2, '0')}:${remainingSeconds.padStart(6, '0')}`;
    }
    return 'N/A';
  };
  const formatBestTimeSubtitle = (vehicle) =>
    !vehicle?.model || !vehicle?.manufacturer ? 'N/A' : `${vehicle.manufacturer} ${vehicle.model}`;

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
              {displayName ? `Bienvenido, ${displayName}` : 'Bienvenido de nuevo'}
            </h1>
            <p className="mt-1 capitalize text-muted-foreground">{todayLabel}</p>
            <p className="mt-3 max-w-xl text-sm text-muted-foreground">
              Aún no tienes vehículos registrados. Añade tu primer coche para ver métricas, gráficos e
              insights de tu colección.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="lg" asChild>
              <Link to="/vehicles/new">
                <Plus className="size-4 mr-2" aria-hidden />
                Añadir tu primer vehículo
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link to="/competitions">
                <Trophy className="size-4 mr-2" aria-hidden />
                Competiciones
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
              <h2 className="text-xl font-semibold">Tu garaje te está esperando</h2>
              <p className="max-w-md text-sm text-muted-foreground">
                Registra modelos, fotos, reglajes y tiempos. El dashboard se llenará de gráficos y
                análisis automáticamente.
              </p>
            </div>
            <Button asChild size="lg">
              <Link to="/vehicles/new">Empezar ahora</Link>
            </Button>
          </CardContent>
        </Card>

        <InsightsCarousel />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {displayName ? `Bienvenido de nuevo, ${displayName}` : 'Bienvenido de nuevo'}
          </h1>
          <p className="mt-1 capitalize text-muted-foreground">{todayLabel}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {metrics.totalVehicles} vehículo{metrics.totalVehicles !== 1 ? 's' : ''} en colección
            {metrics.activeCompetitions != null
              ? ` · ${metrics.activeCompetitions} competición${metrics.activeCompetitions !== 1 ? 'es' : ''} activa${metrics.activeCompetitions !== 1 ? 's' : ''}`
              : ''}
          </p>
        </div>
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Acciones rápidas del dashboard"
        >
          <Button size="default" asChild>
            <Link to="/competitions">
              <Plus className="size-4 mr-2" aria-hidden />
              Nueva competición
            </Link>
          </Button>
          <Button variant="outline" size="default" asChild>
            <Link to="/vehicles">
              <Car className="size-4 mr-2" aria-hidden />
              Vehículos
            </Link>
          </Button>
          <Button variant="outline" size="default" asChild>
            <Link to="/timings">
              <Clock className="size-4 mr-2" aria-hidden />
              Tiempos
            </Link>
          </Button>
        </div>
      </div>

      <DashboardActionBlocks data={actionItems} loadError={actionItemsError} />

      <InsightsCarousel />

      <section className="space-y-4" aria-labelledby="dash-metrics-primary">
        <span id="dash-metrics-primary" className="sr-only">
          Métricas principales de la colección
        </span>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Total Vehículos"
            value={metrics.totalVehicles}
            icon={<Truck />}
            valueColor="primary"
            trend={metrics.trends?.totalVehicles?.trend || 'stable'}
            trendValue={metrics.trends?.totalVehicles?.value || 'Sin datos'}
          />
          <MetricCard
            title="Vehículos Modificados"
            value={metrics.modifiedVehicles}
            subtitle={`${metrics.totalVehicles ? ((metrics.modifiedVehicles / metrics.totalVehicles) * 100).toFixed(1) : 0}% del total`}
            icon={<Wrench />}
            valueColor="success"
            trend={metrics.trends?.modifiedVehicles?.trend || 'stable'}
            trendValue={metrics.trends?.modifiedVehicles?.value || 'Sin datos'}
          />
          <MetricCard
            title="Vehículos sin modificar"
            value={metrics.stockVehicles}
            subtitle={`${metrics.totalVehicles ? ((metrics.stockVehicles / metrics.totalVehicles) * 100).toFixed(1) : 0}% del total`}
            icon={<Car />}
            valueColor="info"
            trend={metrics.trends?.stockVehicles?.trend || 'stable'}
            trendValue={metrics.trends?.stockVehicles?.value || 'Sin datos'}
          />
          <MetricCard
            title="Inversión Total"
            value={formatCurrency(metrics.totalInvestment)}
            subtitle={`Promedio: ${formatCurrency(metrics.averageInvestmentPerVehicle)}`}
            icon={<Euro />}
            valueColor="warning"
            trend={metrics.trends?.totalInvestment?.trend || 'stable'}
            trendValue={metrics.trends?.totalInvestment?.value || 'Sin datos'}
          />
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="dash-metrics-secondary">
        <span id="dash-metrics-secondary" className="sr-only">
          Métricas secundarias
        </span>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Incremento Promedio"
            value={formatPercentage(metrics.averagePriceIncrement)}
            subtitle={formatIncrementSubtitle(metrics.highestIncrementVehicle)}
            icon={<TrendingUp />}
            valueColor="success"
            trend={metrics.trends?.averagePriceIncrement?.trend || 'stable'}
            trendValue={metrics.trends?.averagePriceIncrement?.value || 'Sin datos'}
          />
          <MetricCard
            title="Última Actualización"
            value={
              metrics.lastUpdate ? new Date(metrics.lastUpdate).toLocaleDateString('es-ES') : 'N/A'
            }
            subtitle="Base de datos"
            icon={<Settings />}
            valueColor="secondary"
            trend={metrics.trends?.lastUpdate?.trend || 'stable'}
            trendValue={metrics.trends?.lastUpdate?.value || 'Sistema activo'}
          />
          <MetricCard
            title="Competiciones Activas"
            value={metrics.activeCompetitions || 0}
            subtitle="En curso"
            icon={<Trophy />}
            valueColor="primary"
            trend={metrics.trends?.activeCompetitions?.trend || 'stable'}
            trendValue={metrics.trends?.activeCompetitions?.value || 'Sin datos'}
          />
          <MetricCard
            title="Mejor Tiempo"
            value={metrics.bestTimeVehicle?.best_lap_time}
            subtitle={formatBestTimeSubtitle(metrics.bestTimeVehicle)}
            icon={<Clock />}
            details={{
              'Última actualización': metrics.bestTimeVehicle?.timing_date,
              Circuito: metrics.bestTimeVehicle?.circuit,
              Vueltas: metrics.bestTimeVehicle?.laps,
              Carril: metrics.bestTimeVehicle?.lane,
            }}
            formatValue={formatTime}
            valueColor="success"
            threshold={{ good: 10, warning: 12 }}
          />
        </div>
      </section>

      <section className="space-y-6" aria-labelledby="section-coleccion">
        <SectionHeader
          icon={LayoutDashboard}
          headingId="section-coleccion"
          title="Colección"
          description="Distribución de tu flota por marca, tienda, tipo y estado de modificación."
        />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <BrandDistributionChart data={chartsData.brandDistribution || []} />
          <StoreDistributionChart data={chartsData.storeDistribution || []} />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <VehiclesByTypeChart data={chartsData.vehiclesByType || []} />
          <ModificationPieChart data={chartsData.modificationStats || { modified: 0, stock: 0 }} />
        </div>
      </section>

      <section className="space-y-6" aria-labelledby="section-rendimiento">
        <SectionHeader
          icon={Gauge}
          headingId="section-rendimiento"
          title="Rendimiento"
          description="Evolución por tipo de vehículo, mayor revalorización y comparativa de tiempos por carril."
        />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <MetricCard
            title="Mayor Incremento"
            value={metrics.highestIncrementVehicle?.price_increment || 0}
            subtitle={formatIncrementSubtitle(metrics.highestIncrementVehicle)}
            icon={<Trophy />}
            details={{
              'Última actualización': metrics.highestIncrementVehicle?.purchase_date,
              'Precio Base': metrics.highestIncrementVehicle?.price,
              'Precio Total': metrics.highestIncrementVehicle?.total_price,
            }}
            formatValue={formatPercentage}
            valueColor="warning"
          />
          <PerformanceByTypeChart data={metrics.performanceByType || {}} />
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="size-4 text-muted-foreground" aria-hidden />
            <h3 className="text-sm font-medium text-muted-foreground">Análisis de tiempos por carril</h3>
          </div>
          <LaneComparisonChart />
        </div>
      </section>

      <section className="space-y-6" aria-labelledby="section-inversion">
        <SectionHeader
          icon={Sparkles}
          headingId="section-inversion"
          title="Inversión y análisis detallado"
          description="Evolución del valor invertido y rankings de coste y componentes."
        />
        <InvestmentTimelineChart data={metrics.investmentHistory || []} />
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <TopCostTable data={chartsData.topCostVehicles || []} />
        </div>
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <TopComponentsTable data={chartsData.topComponents || []} />
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
