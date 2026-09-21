import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from '../../pages/Dashboard';
import api from '../../lib/axios';
import i18n from '../../i18n';
import { useAuth } from '../../context/AuthContext';

jest.mock('../../lib/axios', () => ({
  __esModule: true,
  default: { get: jest.fn() },
  invalidateApiAccessTokenCache: jest.fn(),
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(),
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
  purchaseInvestment: 4000,
  modificationInvestment: 1000,
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
  totalTimings: 8,
  timingsLast30Days: 3,
  timingsLast14Days: 3,
  progress: {
    sessionsThisMonth: 2,
    sessionsLastMonth: 1,
    lastSessionDate: '2026-09-10',
    daysSinceLastSession: 7,
    consecutiveWeeksWithSession: 2,
  },
};

const mockChartsData = {
  vehiclesByType: [],
  modificationStats: { modified: 5, stock: 5 },
  topCostVehicles: [],
  topComponents: [],
  brandDistribution: [],
  storeDistribution: [],
};

function mockDashboardGets(metricsOverride) {
  api.get.mockImplementation((url) => {
    if (url === '/dashboard/metrics') {
      return Promise.resolve({
        data: metricsOverride ? { ...mockMetricsData, ...metricsOverride } : mockMetricsData,
      });
    }
    if (url === '/dashboard/charts') return Promise.resolve({ data: mockChartsData });
    if (url === '/dashboard/action-items') return Promise.resolve({ data: mockActionItems });
    if (url === '/dashboard/maintenance-summary') return Promise.resolve({ data: mockMaintenance });
    if (url === '/dashboard/training-goals-summary') return Promise.resolve({ data: { goals: [] } });
    return Promise.reject(new Error(`Not found: ${url}`));
  });
}

describe('Dashboard Component', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    localStorage.clear();
    await i18n.changeLanguage('es');
    useAuth.mockReturnValue({
      user: { email: 'test@example.com', user_metadata: { full_name: 'Tester' } },
    });
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
      expect(screen.getByTestId('kpi-stat-vehicles')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-stat-purchases')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-stat-modifications')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-stat-investment')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-extra-avg-increment')).toBeInTheDocument();
    });
    expect(screen.getByTestId('kpi-stat-purchases')).toHaveTextContent(/compras de coches/i);
    expect(screen.getByTestId('kpi-stat-modifications')).toHaveTextContent(/modificaciones/i);
    expect(screen.getByTestId('kpi-stat-investment')).toHaveTextContent(/compras \+ modificaciones/i);
  });

  test('formatea correctamente los valores monetarios y porcentajes', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId('kpi-stat-purchases')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-stat-modifications')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-stat-investment')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-extra-avg-increment')).toBeInTheDocument();
    });
    expect(screen.getByTestId('kpi-stat-purchases')).toHaveTextContent('4.000,00');
    expect(screen.getByTestId('kpi-stat-modifications')).toHaveTextContent('1.000,00');
    expect(screen.getByTestId('kpi-stat-investment')).toHaveTextContent('5.000,00');
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
      if (url === '/dashboard/training-goals-summary') return Promise.resolve({ data: { goals: [] } });
      return Promise.reject(new Error(`Not found: ${url}`));
    });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId('kpi-stat-vehicles')).toHaveTextContent('20');
    });
  });

  test('no duplica el primer tiempo si el checklist de onboarding sigue visible', async () => {
    mockDashboardGets({
      totalTimings: 0,
      timingsLast30Days: 0,
      timingsLast14Days: 0,
      bestTimeVehicle: null,
      progress: {
        sessionsThisMonth: 0,
        sessionsLastMonth: 0,
        lastSessionDate: null,
        daysSinceLastSession: null,
        consecutiveWeeksWithSession: 0,
      },
    });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText(/Bienvenido/)).toBeInTheDocument();
    });
    expect(screen.queryByTestId('activation-session-nudge')).not.toBeInTheDocument();
    expect(screen.getByTestId('my-progress-card')).toBeInTheDocument();
    expect(screen.getByTestId('my-progress-cta')).toHaveAttribute('href', '/session');
  });

  test('muestra el nudge de primer tiempo si el checklist se descartó', async () => {
    useAuth.mockReturnValue({
      user: {
        email: 'test@example.com',
        user_metadata: { full_name: 'Tester', onboarding_dismissed_at: '2026-01-01T00:00:00.000Z' },
      },
    });
    mockDashboardGets({
      totalTimings: 0,
      timingsLast30Days: 0,
      timingsLast14Days: 0,
      bestTimeVehicle: null,
      progress: {
        sessionsThisMonth: 0,
        sessionsLastMonth: 0,
        lastSessionDate: null,
        daysSinceLastSession: null,
        consecutiveWeeksWithSession: 0,
      },
    });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId('activation-session-nudge')).toBeInTheDocument();
    });
    const now = screen.getByTestId('dashboard-now-section');
    const nudge = screen.getByTestId('activation-session-nudge');
    const progress = screen.getByTestId('my-progress-card');
    expect(now).toContainElement(nudge);
    expect(now).toContainElement(progress);
    expect(nudge.compareDocumentPosition(progress) & Node.DOCUMENT_POSITION_FOLLOWING).toBeGreaterThan(0);
    expect(screen.getByTestId('activation-session-nudge-cta')).toHaveAttribute('href', '/session');
  });

  test('no muestra el nudge si hay tiempos en los últimos 14 días', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText(/Bienvenido/)).toBeInTheDocument();
    });
    expect(screen.queryByTestId('activation-session-nudge')).not.toBeInTheDocument();
  });

  test('muestra el nudge suave si hay tiempos en 30 días pero no en 14', async () => {
    mockDashboardGets({ timingsLast30Days: 2, timingsLast14Days: 0 });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId('activation-session-nudge')).toHaveAttribute('data-variant', 'quiet');
    });
    expect(screen.getByTestId('activation-session-nudge-cta')).toHaveAttribute('href', '/session');
  });

  test('muestra Mi progreso con sesiones y delta, sin CTA extra', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId('my-progress-card')).toBeInTheDocument();
    });
    expect(screen.getByTestId('my-progress-sessions')).toHaveTextContent('2');
    expect(screen.getByTestId('my-progress-delta')).toHaveTextContent('+1');
    expect(screen.queryByTestId('my-progress-cta')).not.toBeInTheDocument();
  });

  test('CTA primario Nueva sesión y zona Ahora en el orden correcto', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-primary-cta')).toBeInTheDocument();
    });

    expect(screen.getByTestId('dashboard-header')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-primary-cta')).toHaveAttribute('href', '/session');
    expect(screen.getByTestId('dashboard-primary-cta')).toHaveTextContent('Nueva sesión');
    expect(screen.getByTestId('dashboard-refresh')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-more-actions')).toBeInTheDocument();

    const now = screen.getByTestId('dashboard-now-section');
    expect(now).toHaveTextContent('Ahora');
    const progress = screen.getByTestId('my-progress-card');
    const actions = screen.getByTestId('dashboard-action-blocks');
    expect(now).toContainElement(progress);
    expect(now).toContainElement(actions);
    expect(progress.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeGreaterThan(0);
    expect(screen.queryByTestId('activation-session-nudge')).not.toBeInTheDocument();

    const header = screen.getByTestId('dashboard-header');
    expect(header.compareDocumentPosition(now) & Node.DOCUMENT_POSITION_FOLLOWING).toBeGreaterThan(0);
    expect(now.compareDocumentPosition(screen.getByTestId('dashboard-maintenance')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeGreaterThan(0);
    expect(
      screen.getByTestId('dashboard-maintenance').compareDocumentPosition(screen.getByTestId('dashboard-kpi-strip'))
        & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeGreaterThan(0);
  });

  test('garaje vacío prioriza añadir vehículo y mantiene la zona Ahora', async () => {
    mockDashboardGets({
      totalVehicles: 0,
      modifiedVehicles: 0,
      stockVehicles: 0,
      digitalVehicles: 0,
      museoVehicles: 0,
      tallerVehicles: 0,
      totalInvestment: 0,
      purchaseInvestment: 0,
      modificationInvestment: 0,
      averageInvestmentPerVehicle: 0,
      totalTimings: 0,
      timingsLast30Days: 0,
      timingsLast14Days: 0,
      bestTimeVehicle: null,
      progress: {
        sessionsThisMonth: 0,
        sessionsLastMonth: 0,
        lastSessionDate: null,
        daysSinceLastSession: null,
        consecutiveWeeksWithSession: 0,
      },
    });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-primary-cta')).toBeInTheDocument();
    });

    expect(screen.getByTestId('dashboard-primary-cta')).toHaveAttribute('href', '/vehicles/new');
    expect(screen.getByTestId('dashboard-secondary-session-cta')).toHaveAttribute('href', '/session');
    expect(screen.getByTestId('dashboard-now-section')).toContainElement(screen.getByTestId('my-progress-card'));
    expect(screen.getByTestId('dashboard-now-section')).toContainElement(screen.getByTestId('dashboard-action-blocks'));
    expect(screen.queryByText('Tu garaje te está esperando')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-kpi-strip')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-maintenance')).not.toBeInTheDocument();
  });

  test('garaje compacto: conteos y enlace, sin muro de paneles', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-maintenance')).toBeInTheDocument();
    });

    const garage = screen.getByTestId('dashboard-maintenance');
    expect(garage).toHaveTextContent('0 pendientes');
    expect(garage).toHaveTextContent('0 programados');
    expect(garage.querySelector('a[href="/vehicles"]')).toBeTruthy();
    expect(screen.getByTestId('dashboard-kpi-strip')).toContainElement(screen.getByTestId('kpi-stat-vehicles'));
    expect(screen.getByTestId('dashboard-kpi-strip')).toContainElement(screen.getByTestId('kpi-extra-avg-increment'));
  });

  test('Mi progreso en cero no duplica el CTA si el nudge de primer tiempo está visible', async () => {
    useAuth.mockReturnValue({
      user: {
        email: 'test@example.com',
        user_metadata: { full_name: 'Tester', onboarding_dismissed_at: '2026-01-01T00:00:00.000Z' },
      },
    });
    mockDashboardGets({
      totalTimings: 0,
      timingsLast30Days: 0,
      timingsLast14Days: 0,
      bestTimeVehicle: null,
      progress: {
        sessionsThisMonth: 0,
        sessionsLastMonth: 0,
        lastSessionDate: null,
        daysSinceLastSession: null,
        consecutiveWeeksWithSession: 0,
      },
    });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId('activation-session-nudge')).toBeInTheDocument();
      expect(screen.getByTestId('my-progress-card')).toBeInTheDocument();
    });
    expect(screen.getByTestId('activation-session-nudge-cta')).toHaveAttribute('href', '/session');
    expect(screen.queryByTestId('my-progress-cta')).not.toBeInTheDocument();
  });
});
