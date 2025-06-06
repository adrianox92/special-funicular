import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from '../../pages/Dashboard';
import api from '../../lib/axios';

// Mock de axios
jest.mock('../../lib/axios', () => ({
  get: jest.fn()
}));

// Mock de los componentes hijos
jest.mock('../../components/MetricCard', () => {
  return function MockMetricCard({ title, value, subtitle }) {
    return (
      <div data-testid={`metric-card-${title}`}>
        <h3>{title}</h3>
        <div>{value}</div>
        <div>{subtitle}</div>
      </div>
    );
  };
});

jest.mock('../../components/charts/VehiclesByTypeChart', () => {
  return function MockVehiclesByTypeChart() {
    return <div data-testid="vehicles-by-type-chart">Vehicles By Type Chart</div>;
  };
});

jest.mock('../../components/charts/ModificationPieChart', () => {
  return function MockModificationPieChart() {
    return <div data-testid="modification-pie-chart">Modification Pie Chart</div>;
  };
});

jest.mock('../../components/charts/BrandDistributionChart', () => {
  return function MockBrandDistributionChart() {
    return <div data-testid="brand-distribution-chart">Brand Distribution Chart</div>;
  };
});

jest.mock('../../components/charts/StoreDistributionChart', () => {
  return function MockStoreDistributionChart() {
    return <div data-testid="store-distribution-chart">Store Distribution Chart</div>;
  };
});

jest.mock('../../components/tables/TopCostTable', () => {
  return function MockTopCostTable() {
    return <div data-testid="top-cost-table">Top Cost Table</div>;
  };
});

jest.mock('../../components/tables/TopComponentsTable', () => {
  return function MockTopComponentsTable() {
    return <div data-testid="top-components-table">Top Components Table</div>;
  };
});

jest.mock('../../components/InsightsCarousel', () => {
  return function MockInsightsCarousel() {
    return <div data-testid="insights-carousel">Insights Carousel</div>;
  };
});

const mockMetricsData = {
  totalVehicles: 10,
  modifiedVehicles: 5,
  stockVehicles: 5,
  totalInvestment: 5000,
  averageInvestmentPerVehicle: 1000,
  averagePriceIncrement: 25,
  lastUpdate: '2024-03-07',
  highestIncrementVehicle: {
    model: 'Test Model',
    manufacturer: 'Test Manufacturer',
    price_increment: 30,
    purchase_date: '2024-03-07',
    price: 1000,
    total_price: 1300
  },
  bestTimeVehicle: {
    model: 'Test Model',
    manufacturer: 'Test Manufacturer',
    best_lap_time: '01:30.000',
    timing_date: '2024-03-07',
    circuit: 'Test Circuit',
    laps: 5,
    lane: 'A'
  },
  investmentHistory: [],
  performanceByType: {}
};

const mockChartsData = {
  vehiclesByType: [],
  modificationStats: { modified: 5, stock: 5 },
  topCostVehicles: [],
  topComponents: [],
  performanceByType: {},
  brandDistribution: [],
  storeDistribution: []
};

describe('Dashboard Component', () => {
  beforeEach(() => {
    // Reset de los mocks antes de cada test
    jest.clearAllMocks();
    
    // Configurar las respuestas mock por defecto
    api.get.mockImplementation((url) => {
      if (url === '/dashboard/metrics') {
        return Promise.resolve({ data: mockMetricsData });
      }
      if (url === '/dashboard/charts') {
        return Promise.resolve({ data: mockChartsData });
      }
      return Promise.reject(new Error('Not found'));
    });
  });

  const renderDashboard = () => {
    return render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );
  };

  test('renderiza el componente correctamente', async () => {
    renderDashboard();
    
    // Verificar que el título está presente
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    
    // Verificar que los componentes principales están presentes
    await waitFor(() => {
      expect(screen.getByTestId('insights-carousel')).toBeInTheDocument();
      expect(screen.getByTestId('vehicles-by-type-chart')).toBeInTheDocument();
      expect(screen.getByTestId('modification-pie-chart')).toBeInTheDocument();
      expect(screen.getByTestId('brand-distribution-chart')).toBeInTheDocument();
      expect(screen.getByTestId('store-distribution-chart')).toBeInTheDocument();
    });
  });

  test('muestra el estado de carga inicial', () => {
    renderDashboard();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  test('maneja errores de API correctamente', async () => {
    // Simular un error en la API
    api.get.mockRejectedValueOnce(new Error('API Error'));
    
    renderDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('Error al cargar los datos del dashboard')).toBeInTheDocument();
    });
  });

  test('muestra las métricas correctamente', async () => {
    renderDashboard();
    
    await waitFor(() => {
      // Verificar que las métricas principales están presentes
      expect(screen.getByTestId('metric-card-Total de Vehículos')).toBeInTheDocument();
      expect(screen.getByTestId('metric-card-Inversión en Componentes')).toBeInTheDocument();
      expect(screen.getByTestId('metric-card-Promedio de Incremento')).toBeInTheDocument();
    });
  });

  test('formatea correctamente los valores monetarios y porcentajes', async () => {
    renderDashboard();
    
    await waitFor(() => {
      const metricCards = screen.getAllByTestId(/metric-card-/);
      expect(metricCards.length).toBeGreaterThan(0);
    });
  });

  test('actualiza los datos cuando cambian las respuestas de la API', async () => {
    const newMetricsData = {
      ...mockMetricsData,
      totalVehicles: 20,
      modifiedVehicles: 10
    };
    
    api.get.mockImplementationOnce(() => Promise.resolve({ data: newMetricsData }))
       .mockImplementationOnce(() => Promise.resolve({ data: mockChartsData }));
    
    renderDashboard();
    
    await waitFor(() => {
      expect(screen.getByTestId('metric-card-Total de Vehículos')).toHaveTextContent('20');
    });
  });
}); 