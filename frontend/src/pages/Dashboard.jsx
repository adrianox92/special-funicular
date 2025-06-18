import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Alert, Card, Button } from 'react-bootstrap';
import { 
  FiTruck, 
  FiTool, 
  FiDollarSign, 
  FiTrendingUp,
  FiAward,
  FiClock
} from 'react-icons/fi';
import { FaTrophy } from 'react-icons/fa';
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
    performanceByType: {}
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
      <h2 className="mb-4">Dashboard</h2>
      
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
              <Card>
                <Card.Header>
                  <h6 className="mb-0">
                    <FaTrophy className="me-2" />
                    Acciones Rápidas
                  </h6>
                </Card.Header>
                <Card.Body>
                  <div className="d-grid gap-2">
                    <Button 
                      variant="primary" 
                      onClick={() => window.location.href = '/competitions'}
                    >
                      <FaTrophy className="me-2" />
                      Crear Nueva Competición
                    </Button>
                    <Button 
                      variant="outline-primary" 
                      onClick={() => window.location.href = '/vehicles'}
                    >
                      <FiTruck className="me-2" />
                      Gestionar Vehículos
                    </Button>
                    <Button 
                      variant="outline-primary" 
                      onClick={() => window.location.href = '/timings'}
                    >
                      <FiClock className="me-2" />
                      Ver Tiempos
                    </Button>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          <h4 className="mb-3">Métricas de Colección</h4>
          <Row className="g-3 mb-4">
            <Col xs={12} md={4}>
              <MetricCard
                title="Total de Vehículos"
                value={metrics.totalVehicles || 0}
                subtitle={`${metrics.modifiedVehicles || 0} modificados`}
                icon="bi-car-front"
                details={{
                  'Ultima actualización': metrics.lastUpdate,
                  'Vehículos de serie': metrics.stockVehicles || 0
                }}
              />
            </Col>
            <Col xs={12} md={4}>
              <MetricCard
                title="Inversión en Componentes"
                value={metrics.totalInvestment || 0}
                subtitle={`${metrics.averageInvestmentPerVehicle || 0} € por vehículo modificado`}
                icon="bi-currency-euro"
                details={{
                  'Ultima actualización': metrics.lastUpdate,
                  'Total de Vehículos modificados': metrics.modifiedVehicles || 0
                }}
              />
            </Col>
            <Col xs={12} md={4}>
              <MetricCard
                title="Promedio de Incremento"
                value={metrics.averagePriceIncrement || 0}
                subtitle="Porcentaje medio de incremento"
                icon="bi-graph-up"
                details={{
                  'Ultima actualización': metrics.lastUpdate,
                  'Total de Vehículos modificados': metrics.modifiedVehicles || 0
                }}
                formatValue={formatPercentage}
                valueColor="info"
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
                icon="bi-trophy"
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
                icon="bi-stopwatch"
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
        </>
      )}
    </Container>
  );
};

export default Dashboard; 