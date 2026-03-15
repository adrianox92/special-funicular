import React, { useState, useEffect } from 'react';
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
import LaneComparisonChart from '../components/LaneComparisonChart';
import api from '../lib/axios';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Spinner } from '../components/ui/spinner';

const Dashboard = () => {
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
    activeCompetitions: 0
  });

  const [chartsData, setChartsData] = useState({
    vehiclesByType: [],
    modificationStats: { modified: 0, stock: 0 },
    topCostVehicles: [],
    topComponents: [],
    brandDistribution: [],
    storeDistribution: []
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [metricsResponse, chartsResponse] = await Promise.all([
          api.get('/dashboard/metrics'),
          api.get('/dashboard/charts')
        ]);
        setMetrics(metricsResponse.data);
        setChartsData(chartsResponse.data);
      } catch (err) {
        console.error('Error al cargar datos del dashboard:', err);
        setError('Error al cargar los datos del dashboard');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const formatCurrency = (value) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
  const formatPercentage = (value) => new Intl.NumberFormat('es-ES', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value / 100);
  const formatIncrementSubtitle = (vehicle) => (!vehicle?.model || !vehicle?.manufacturer) ? 'N/A' : `${vehicle.manufacturer} ${vehicle.model}`;
  const formatTime = (timeStr) => {
    if (!timeStr) return 'N/A';
    if (typeof timeStr === 'string' && timeStr.match(/^\d{2}:\d{2}\.\d{3}$/)) return timeStr;
    const seconds = Number(timeStr);
    if (!isNaN(seconds)) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = (seconds % 60).toFixed(3);
      return `${String(minutes).padStart(2, '0')}:${remainingSeconds.padStart(6, '0')}`;
    }
    return 'N/A';
  };
  const formatBestTimeSubtitle = (vehicle) => (!vehicle?.model || !vehicle?.manufacturer) ? 'N/A' : `${vehicle.manufacturer} ${vehicle.model}`;

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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <InsightsCarousel />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <h5 className="font-semibold flex items-center gap-2">
              <Trophy className="size-4" />
              Acciones Rápidas
            </h5>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full" size="lg" onClick={() => window.location.href = '/competitions'}>
              <Plus className="size-4 mr-2" />
              Crear Nueva Competición
            </Button>
            <Button variant="outline" className="w-full" size="lg" onClick={() => window.location.href = '/vehicles'}>
              <Car className="size-4 mr-2" />
              Gestionar Vehículos
            </Button>
            <Button variant="outline" className="w-full" size="lg" onClick={() => window.location.href = '/timings'}>
              <Clock className="size-4 mr-2" />
              Ver Tiempos
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Total Vehículos" value={metrics.totalVehicles} icon={<Truck />} valueColor="primary" trend={metrics.trends?.totalVehicles?.trend || 'stable'} trendValue={metrics.trends?.totalVehicles?.value || 'Sin datos'} />
        <MetricCard title="Vehículos Modificados" value={metrics.modifiedVehicles} subtitle={`${metrics.totalVehicles ? ((metrics.modifiedVehicles / metrics.totalVehicles) * 100).toFixed(1) : 0}% del total`} icon={<Wrench />} valueColor="success" trend={metrics.trends?.modifiedVehicles?.trend || 'stable'} trendValue={metrics.trends?.modifiedVehicles?.value || 'Sin datos'} />
        <MetricCard title="Vehículos sin modificar" value={metrics.stockVehicles} subtitle={`${metrics.totalVehicles ? ((metrics.stockVehicles / metrics.totalVehicles) * 100).toFixed(1) : 0}% del total`} icon={<Car />} valueColor="info" trend={metrics.trends?.stockVehicles?.trend || 'stable'} trendValue={metrics.trends?.stockVehicles?.value || 'Sin datos'} />
        <MetricCard title="Inversión Total" value={formatCurrency(metrics.totalInvestment)} subtitle={`Promedio: ${formatCurrency(metrics.averageInvestmentPerVehicle)}`} icon={<Euro />} valueColor="warning" trend={metrics.trends?.totalInvestment?.trend || 'stable'} trendValue={metrics.trends?.totalInvestment?.value || 'Sin datos'} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Incremento Promedio" value={formatPercentage(metrics.averagePriceIncrement)} subtitle={formatIncrementSubtitle(metrics.highestIncrementVehicle)} icon={<TrendingUp />} valueColor="success" trend={metrics.trends?.averagePriceIncrement?.trend || 'stable'} trendValue={metrics.trends?.averagePriceIncrement?.value || 'Sin datos'} />
        <MetricCard title="Última Actualización" value={metrics.lastUpdate ? new Date(metrics.lastUpdate).toLocaleDateString('es-ES') : 'N/A'} subtitle="Base de datos" icon={<Settings />} valueColor="secondary" trend={metrics.trends?.lastUpdate?.trend || 'stable'} trendValue={metrics.trends?.lastUpdate?.value || 'Sistema activo'} />
        <MetricCard title="Competiciones Activas" value={metrics.activeCompetitions || 0} subtitle="En curso" icon={<Trophy />} valueColor="primary" trend={metrics.trends?.activeCompetitions?.trend || 'stable'} trendValue={metrics.trends?.activeCompetitions?.value || 'Sin datos'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BrandDistributionChart data={chartsData.brandDistribution || []} />
        <StoreDistributionChart data={chartsData.storeDistribution || []} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <VehiclesByTypeChart data={chartsData.vehiclesByType || []} />
        <ModificationPieChart data={chartsData.modificationStats || { modified: 0, stock: 0 }} />
      </div>

      <h4 className="font-semibold">Métricas de Rendimiento</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <MetricCard title="Mayor Incremento" value={metrics.highestIncrementVehicle?.price_increment || 0} subtitle={formatIncrementSubtitle(metrics.highestIncrementVehicle)} icon={<Trophy />} details={{ 'Ultima actualización': metrics.highestIncrementVehicle?.purchase_date, 'Precio Base': metrics.highestIncrementVehicle?.price, 'Precio Total': metrics.highestIncrementVehicle?.total_price }} formatValue={formatPercentage} valueColor="warning" />
        <MetricCard title="Mejor Tiempo" value={metrics.bestTimeVehicle?.best_lap_time} subtitle={formatBestTimeSubtitle(metrics.bestTimeVehicle)} icon={<Clock />} details={{ 'Ultima actualización': metrics.bestTimeVehicle?.timing_date, 'Circuito': metrics.bestTimeVehicle?.circuit, 'Vueltas': metrics.bestTimeVehicle?.laps, 'Carril': metrics.bestTimeVehicle?.lane }} formatValue={formatTime} valueColor="success" threshold={{ good: 10, warning: 12 }} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PerformanceByTypeChart data={metrics.performanceByType || {}} />
        <InvestmentTimelineChart data={metrics.investmentHistory || []} />
      </div>

      <TopCostTable data={chartsData.topCostVehicles || []} />
      <TopComponentsTable data={chartsData.topComponents || []} />

      <h4 className="font-semibold mt-8">Análisis de Tiempos por Carril</h4>
      <LaneComparisonChart />
    </div>
  );
};

export default Dashboard;
