import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

jest.mock('../../components/ui/switch', () => ({
  Switch: ({ id, checked, onCheckedChange }) => (
    <input
      id={id}
      type="checkbox"
      role="switch"
      aria-checked={!!checked}
      checked={!!checked}
      onChange={(e) => onCheckedChange(e.target.checked)}
    />
  ),
}));

const METRICS = {
  users_created: 0,
  users_active: 0,
  vehicles_in_period: 15,
  competitions_created: 0,
  vehicles_total: 200,
  vehicles_with_catalog_item_id: 128,
  vehicles_by_user: [],
  catalog_brands_period: [{ brand_name: 'Scalextric', vehicle_count: 15, user_count: 8 }],
  catalog_brands_all: [{ brand_name: 'Scalextric', vehicle_count: 128, user_count: 42 }],
  catalog_refs_period: [
    {
      reference: 'C4032',
      model_name: 'Porsche 911 GT3',
      brand_name: 'Scalextric',
      user_count: 4,
    },
  ],
  catalog_refs_all: [
    {
      reference: 'C4032',
      model_name: 'Porsche 911 GT3',
      brand_name: 'Scalextric',
      user_count: 37,
    },
  ],
};

describe('AdminPlatformDashboard — tops de catálogo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.get.mockImplementation((url) => {
      if (url === '/admin/timing-retention') {
        return Promise.resolve({
          data: {
            window_days: 30,
            registered_users: 1,
            users_with_vehicle: 1,
            users_with_vehicle_pct: 100,
            users_with_timing_ever: 0,
            users_with_timing_ever_pct: 0,
            users_with_timing_30d: 0,
            timing_30d_pct: 0,
            goal: { target_min_pct: 8, target_max_pct: 10 },
          },
        });
      }
      if (url === '/admin/platform-metrics') {
        return Promise.resolve({ data: METRICS });
      }
      if (url === '/admin/vehicle-refs-not-in-catalog') {
        return Promise.resolve({ data: { total: 0, rows: [] } });
      }
      if (url === '/admin/mcp-catalog-usage') {
        return Promise.resolve({ data: { ready: true, lookups_24h: 0, users: [], recent: [] } });
      }
      return Promise.reject(new Error(`unexpected url: ${url}`));
    });
  });

  it('muestra la variación del periodo y cambia al total histórico', async () => {
    render(
      <MemoryRouter>
        <AdminPlatformDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByText('+15 (8)')).toBeInTheDocument();
    expect(screen.getByText('+4')).toBeInTheDocument();
    expect(screen.getByText('C4032')).toBeInTheDocument();
    expect(screen.getByText(/Porsche 911 GT3/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('switch', { name: 'Total histórico' }));

    expect(screen.getByText('128 (42)')).toBeInTheDocument();
    expect(screen.getByText('37')).toBeInTheDocument();
    expect(screen.queryByText('+15 (8)')).not.toBeInTheDocument();
    expect(screen.queryByText('+4')).not.toBeInTheDocument();
  });
});
