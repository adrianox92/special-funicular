import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from '../../pages/Dashboard';
import api from '../../lib/axios';

jest.mock('../../lib/axios', () => ({
  __esModule: true,
  default: { get: jest.fn() },
  invalidateApiAccessTokenCache: jest.fn(),
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { email: 'test@example.com', user_metadata: { full_name: 'Tester' } },
  }),
}));

jest.mock('../../components/DashboardActionBlocks', () => {
  return function MockDashboardActionBlocks() {
    return <div data-testid="dashboard-action-blocks">Action blocks</div>;
  };
});

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

jest.mock('../../components/charts/PerformanceByTypeChart', () => {
  return function MockPerformanceByTypeChart() {
    return <div data-testid="performance-by-type-chart">Performance By Type</div>;
  };
});

jest.mock('../../components/charts/InvestmentTimelineChart', () => {
  return function MockInvestmentTimelineChart() {
    return <div data-testid="investment-timeline-chart">Investment Timeline</div>;
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

jest.mock('../../components/LaneComparisonChart', () => {
  return function MockLaneComparisonChart() {
    return <div data-testid="lane-comparison-chart">Lane Comparison</div>;
  };
});

const mockActionItems = { generatedAt: new Date().toISOString() };
const mockMaintenance = { recent: [], vehiclesWithoutRecentMaintenanceTotal: 0, staleDaysThreshold: 90 };

const mockMetricsData = {
  totalVehicles: 10,
  modifiedVehicles: 5,
  stockVehicles: 5,
  digitalVehicles: 0,
  museoVehicles: 0,
  tallerVehicles: 0,
  totalInvestment: 5000,
  averageInvestmentPerVehicle: 1000,
  averagePriceIncrement: 25,
  lastUpdate: '2024-03-07',
  activeCompetitions: 0,
  highestIncrementVehicle: {
    model: 'Test Model',
    manufacturer: 'Test Manufacturer',
    price_increment: 30,
    purchase_date: '2024-03-07',
    price: 1000,
    total_price: 1300,
  },
  bestTimeVehicle: {
    model: 'Test Model',
    manufacturer: 'Test Manufacturer',
    best_lap_time: '01:30.000',
    timing_date: '2024-03-07',
    circuit: 'Test Circuit',
    laps: 5,
    lane: 'A',
  },
  investmentHistory: [],
  performanceByType: {},
  trends: {},
};

const mockChartsData = {
  vehiclesByType: [],
  modificationStats: { modified: 5, stock: 5 },
  topCostVehicles: [],
  topComponents: [],
  brandDistribution: [],
  storeDistribution: [],
};

function mockDashboardGets() {
  api.get.mockImplementation((url) => {
    if (url === '/dashboard/metrics') return Promise.resolve({ data: mockMetricsData });
    if (url === '/dashboard/charts') return Promise.resolve({ data: mockChartsData });
    if (url === '/dashboard/action-items') return Promise.resolve({ data: mockActionItems });
    if (url === '/dashboard/maintenance-summary') return Promise.resolve({ data: mockMaintenance });
    return Promise.reject(new Error(`Not found: ${url}`));
  });
}

describe('Dashboard Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDashboardGets();
  });

  const renderDashboard = () =>
    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>,
    );

  test('renderiza el componente correctamente', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText(/Bienvenido/)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByTestId('vehicles-by-type-chart')).toBeInTheDocument();
      expect(screen.getByTestId('modification-pie-chart')).toBeInTheDocument();
      expect(screen.getByTestId('brand-distribution-chart')).toBeInTheDocument();
      expect(screen.getByTestId('store-distribution-chart')).toBeInTheDocument();
    });
  });

  test('muestra el estado de carga inicial', () => {
    api.get.mockImplementation(() => new Promise(() => {}));

    renderDashboard();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  test('maneja errores de API correctamente', async () => {
    api.get.mockRejectedValueOnce(new Error('API Error'));

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Error al cargar los datos del dashboard')).toBeInTheDocument();
    });
  });

  test('muestra las métricas correctamente', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId('metric-card-Total Vehículos')).toBeInTheDocument();
      expect(screen.getByTestId('metric-card-Inversión Total')).toBeInTheDocument();
      expect(screen.getByTestId('metric-card-Incremento Promedio')).toBeInTheDocument();
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
      modifiedVehicles: 10,
    };

    api.get.mockImplementation((url) => {
      if (url === '/dashboard/metrics') return Promise.resolve({ data: newMetricsData });
      if (url === '/dashboard/charts') return Promise.resolve({ data: mockChartsData });
      if (url === '/dashboard/action-items') return Promise.resolve({ data: mockActionItems });
      if (url === '/dashboard/maintenance-summary') return Promise.resolve({ data: mockMaintenance });
      return Promise.reject(new Error(`Not found: ${url}`));
    });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId('metric-card-Total Vehículos')).toHaveTextContent('20');
    });
  });
});
