import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Alert, Card, Button } from 'react-bootstrap';
import { 
  FaTruck, 
  FaTools, 
  FaEuroSign, 
  FaChartLine,
  FaTrophy,
  FaClock,
  FaCar,
  FaCog,
  FaPlus,
  FaList
} from 'react-icons/fa';
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
        setLoading(false);
      } catch (err) {
        console.error('Error al cargar datos del dashboard:', err);
        setError('Error al cargar los datos del dashboard');
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <Container className="py-4">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
        </div>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="py-4">
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      </Container>
    );
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(value);
  };

  const formatPercentage = (value) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'percent',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }).format(value / 100);
  };

  const formatIncrementSubtitle = (vehicle) => {
    if (!vehicle?.model || !vehicle?.manufacturer) return 'N/A';
    return `${vehicle.manufacturer} ${vehicle.model}`;
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return 'N/A';
    
    // Si ya está en formato mm:ss.ms, devolverlo tal cual
    if (typeof timeStr === 'string' && timeStr.match(/^\d{2}:\d{2}\.\d{3}$/)) {
      return timeStr;
    }
    
    // Si es un número (segundos), convertirlo a formato mm:ss.ms
    const seconds = Number(timeStr);
    if (!isNaN(seconds)) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = (seconds % 60).toFixed(3);
      return `${String(minutes).padStart(2, '0')}:${remainingSeconds.padStart(6, '0')}`;
    }
    
    return 'N/A';
  };

  const formatBestTimeSubtitle = (vehicle) => {
    if (!vehicle?.model || !vehicle?.manufacturer) return 'N/A';
    return `${vehicle.manufacturer} ${vehicle.model}`;
  };

  return (
    <Container fluid className="py-4">
      <h1 className="mb-2">Dashboard</h1>
      
      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}

      {loading ? (
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
        </div>
      ) : (
        <>
          {/* Carrusel de Insights de IA */}
          <Row className="mb-4">
            <Col xs={12}>
              <InsightsCarousel />
            </Col>
          </Row>

          {/* Bloque de Acciones Rápidas */}
          <Row className="mb-4">
            <Col xs={12} lg={6}>
              <Card className="action-card">
                <Card.Header className="action-card-header">
                  <h6 className="mb-0">
                    <FaTrophy className="me-2" />
                    Acciones Rápidas
                  </h6>
                </Card.Header>
                <Card.Body>
                  <div className="d-grid gap-3">
                    <Button 
                      variant="primary" 
                      size="lg"
                      className="action-button"
                      onClick={() => window.location.href = '/competitions'}
                    >
                      <FaPlus className="me-2" />
                      Crear Nueva Competición
                    </Button>
                    <Button 
                      variant="outline-primary" 
                      size="lg"
                      className="action-button"
                      onClick={() => window.location.href = '/vehicles'}
                    >
                      <FaCar className="me-2" />
                      Gestionar Vehículos
                    </Button>
                    <Button 
                      variant="outline-primary" 
                      size="lg"
                      className="action-button"
                      onClick={() => window.location.href = '/timings'}
                    >
                      <FaClock className="me-2" />
                      Ver Tiempos
                    </Button>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Métricas Principales */}
          <Row className="mb-4">
            <Col xs={12} sm={6} lg={3} className="mb-3">
              <MetricCard
                title="Total Vehículos"
                value={metrics.totalVehicles}
                icon={<FaTruck />}
                valueColor="primary"
                trend={metrics.trends?.totalVehicles?.trend || 'stable'}
                trendValue={metrics.trends?.totalVehicles?.value || 'Sin datos'}
              />
            </Col>
            <Col xs={12} sm={6} lg={3} className="mb-3">
              <MetricCard
                title="Vehículos Modificados"
                value={metrics.modifiedVehicles}
                subtitle={`${((metrics.modifiedVehicles / metrics.totalVehicles) * 100).toFixed(1)}% del total`}
                icon={<FaTools />}
                valueColor="success"
                trend={metrics.trends?.modifiedVehicles?.trend || 'stable'}
                trendValue={metrics.trends?.modifiedVehicles?.value || 'Sin datos'}
              />
            </Col>
            <Col xs={12} sm={6} lg={3} className="mb-3">
              <MetricCard
                title="Vehículos sin modificar"
                value={metrics.stockVehicles}
                subtitle={`${((metrics.stockVehicles / metrics.totalVehicles) * 100).toFixed(1)}% del total`}
                icon={<FaCar />}
                valueColor="info"
                trend={metrics.trends?.stockVehicles?.trend || 'stable'}
                trendValue={metrics.trends?.stockVehicles?.value || 'Sin datos'}
              />
            </Col>
            <Col xs={12} sm={6} lg={3} className="mb-3">
              <MetricCard
                title="Inversión Total"
                value={formatCurrency(metrics.totalInvestment)}
                subtitle={`Promedio: ${formatCurrency(metrics.averageInvestmentPerVehicle)}`}
                icon={<FaEuroSign />}
                valueColor="warning"
                trend={metrics.trends?.totalInvestment?.trend || 'stable'}
                trendValue={metrics.trends?.totalInvestment?.value || 'Sin datos'}
              />
            </Col>
          </Row>

          {/* Métricas Secundarias */}
          <Row className="mb-4">
            
            <Col xs={12} sm={6} lg={3} className="mb-3">
              <MetricCard
                title="Incremento Promedio"
                value={formatPercentage(metrics.averagePriceIncrement)}
                subtitle={formatIncrementSubtitle(metrics.highestIncrementVehicle)}
                icon={<FaChartLine />}
                valueColor="success"
                trend={metrics.trends?.averagePriceIncrement?.trend || 'stable'}
                trendValue={metrics.trends?.averagePriceIncrement?.value || 'Sin datos'}
              />
            </Col>
            <Col xs={12} sm={6} lg={3} className="mb-3">
              <MetricCard
                title="Última Actualización"
                value={metrics.lastUpdate ? new Date(metrics.lastUpdate).toLocaleDateString('es-ES') : 'N/A'}
                subtitle="Base de datos"
                icon={<FaCog />}
                valueColor="secondary"
                trend={metrics.trends?.lastUpdate?.trend || 'stable'}
                trendValue={metrics.trends?.lastUpdate?.value || 'Sistema activo'}
              />
            </Col>
            <Col xs={12} sm={6} lg={3} className="mb-3">
              <MetricCard
                title="Competiciones Activas"
                value={metrics.activeCompetitions || 0}
                subtitle="En curso"
                icon={<FaTrophy />}
                valueColor="primary"
                trend={metrics.trends?.activeCompetitions?.trend || 'stable'}
                trendValue={metrics.trends?.activeCompetitions?.value || 'Sin datos'}
              />
            </Col>
          </Row>

          <Row className="g-3 mb-4">
            <Col xs={12} lg={6}>
              <BrandDistributionChart data={chartsData.brandDistribution || []} />
            </Col>
            <Col xs={12} lg={6}>
              <StoreDistributionChart data={chartsData.storeDistribution || []} />
            </Col>
          </Row>

          <Row className="g-3 mb-4">
            <Col xs={12} lg={6}>
              <VehiclesByTypeChart data={chartsData.vehiclesByType || []} />
            </Col>
            <Col xs={12} lg={6}>
              <ModificationPieChart data={chartsData.modificationStats || { modified: 0, stock: 0 }} />
            </Col>
          </Row>

          <h4 className="mb-3">Métricas de Rendimiento</h4>
          <Row className="g-3 mb-4">
            <Col xs={12} md={6}>
              <MetricCard
                title="Mayor Incremento"
                value={metrics.highestIncrementVehicle?.price_increment || 0}
                subtitle={formatIncrementSubtitle(metrics.highestIncrementVehicle)}
                icon={<FaTrophy />}
                details={{
                  'Ultima actualización': metrics.highestIncrementVehicle?.purchase_date,
                  'Precio Base': metrics.highestIncrementVehicle?.price,
                  'Precio Total': metrics.highestIncrementVehicle?.total_price
                }}
                formatValue={formatPercentage}
                valueColor="warning"
              />
            </Col>
            <Col xs={12} md={6}>
              <MetricCard
                title="Mejor Tiempo"
                value={metrics.bestTimeVehicle?.best_lap_time}
                subtitle={formatBestTimeSubtitle(metrics.bestTimeVehicle)}
                icon={<FaClock />}
                details={{
                  'Ultima actualización': metrics.bestTimeVehicle?.timing_date,
                  'Circuito': metrics.bestTimeVehicle?.circuit,
                  'Vueltas': metrics.bestTimeVehicle?.laps,
                  'Carril': metrics.bestTimeVehicle?.lane
                }}
                formatValue={formatTime}
                valueColor="success"
                threshold={{ good: 10, warning: 12 }}
              />
            </Col>
          </Row>

          <Row className="g-3 mb-4">
            <Col xs={12} lg={6}>
              <PerformanceByTypeChart data={metrics.performanceByType || {}} />
            </Col>
            <Col xs={12} lg={6}>
              <InvestmentTimelineChart data={metrics.investmentHistory || []} />
            </Col>
          </Row>

          

          <Row className="g-3 mb-4">
            <Col xs={12}>
              <TopCostTable data={chartsData.topCostVehicles || []} />
            </Col>
          </Row>

          <Row className="g-3">
            <Col xs={12}>
              <TopComponentsTable data={chartsData.topComponents || []} />
            </Col>
          </Row>
          {/* Nueva Sección: Comparativa de Carriles */}
          <h4 className="mb-3 mt-4">Análisis de Tiempos por Carril</h4>
          <Row className="g-3 mb-4">
            <Col xs={12}>
              <LaneComparisonChart />
            </Col>
          </Row>
        </>
      )}
    </Container>
  );
};

export default Dashboard; 