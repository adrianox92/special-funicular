import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminPlatformDashboard from '../../pages/AdminPlatformDashboard';
import api from '../../lib/axios';

jest.mock('../../lib/axios', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
  invalidateApiAccessTokenCache: jest.fn(),
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'admin-1', email: 'admin@example.com' } }),
}));

jest.mock('../../lib/licenseAdmin', () => ({
  isLicenseAdminUser: () => true,
}));

jest.mock('../../components/charts/VehicleCatalogCoverageChart', () => ({
  __esModule: true,
  default: () => <div data-testid="catalog-coverage" />,
}));

jest.mock('../../components/CatalogBrandSelect', () => ({
  __esModule: true,
  default: () => null,
}));

const RETENTION = {
  window_days: 30,
  registered_users: 91,
  users_with_vehicle: 40,
  users_with_vehicle_pct: 44.0,
  users_with_timing_ever: 10,
  users_with_timing_ever_pct: 11.0,
  users_with_timing_30d: 3,
  timing_30d_pct: 3.3,
  goal: {
    baseline_2026_09_11_pct: 2.7,
    baseline_2026_09_15_pct: 3.3,
    target_min_pct: 8,
    target_max_pct: 10,
  },
};

describe('AdminPlatformDashboard — retención timings 30d', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.get.mockImplementation((url) => {
      if (url === '/admin/timing-retention') {
        return Promise.resolve({ data: RETENTION });
      }
      if (url === '/admin/platform-metrics') {
        return Promise.resolve({
          data: {
            users_created: 0,
            users_active: 0,
            vehicles_in_period: 0,
            competitions_created: 0,
            vehicles_total: 0,
            vehicles_with_catalog_item_id: 0,
            vehicles_by_user: [],
          },
        });
      }
      if (url === '/admin/vehicle-refs-not-in-catalog') {
        return Promise.resolve({ data: { total: 0, rows: [] } });
      }
      return Promise.reject(new Error(`unexpected url: ${url}`));
    });
  });

  it('muestra el KPI timing-30d con conteos y porcentaje', async () => {
    render(
      <MemoryRouter>
        <AdminPlatformDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Retención timings (30d)')).toBeInTheDocument();
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/admin/timing-retention');
    });
    expect(screen.getAllByText('3,3 %').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Registrados')).toBeInTheDocument();
    expect(screen.getByText('Con ≥1 vehículo')).toBeInTheDocument();
    expect(screen.getByText('Con timing alguna vez')).toBeInTheDocument();
    expect(screen.getByText('Con timing 30d')).toBeInTheDocument();
    expect(screen.getByText('91')).toBeInTheDocument();
    expect(screen.getByText('Por debajo del objetivo')).toBeInTheDocument();
    expect(screen.getByText(/Objetivo ≥ 8–10/)).toBeInTheDocument();
  });
});
