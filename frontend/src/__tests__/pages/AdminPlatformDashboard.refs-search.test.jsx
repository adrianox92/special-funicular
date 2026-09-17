import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
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
  default: ({ value, onChange, label, id }) => (
    <label htmlFor={id}>
      {label}
      <input
        id={id}
        aria-label={label}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  ),
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

const RETENTION = {
  window_days: 30,
  registered_users: 1,
  users_with_vehicle: 1,
  users_with_vehicle_pct: 100,
  users_with_timing_ever: 0,
  users_with_timing_ever_pct: 0,
  users_with_timing_30d: 0,
  timing_30d_pct: 0,
  goal: { target_min_pct: 8, target_max_pct: 10 },
};

const METRICS = {
  users_created: 0,
  users_active: 0,
  vehicles_in_period: 0,
  competitions_created: 0,
  vehicles_total: 0,
  vehicles_with_catalog_item_id: 0,
  vehicles_by_user: [],
};

const CATALOG_ID = '22222222-2222-4222-8222-222222222222';

const IN_CATALOG_ROW = {
  reference: 'AV52802',
  vehicle_count: 4,
  distinct_user_count: 2,
  linkable_vehicle_count: 2,
  linkable_distinct_user_count: 1,
  sample_manufacturer: 'Avant Slot',
  sample_model: 'GT3',
  in_catalog: true,
  catalog_item_count: 1,
  catalog_item_id: '11111111-1111-4111-8111-111111111111',
  catalog_manufacturer_id: CATALOG_ID,
  catalog_reference: 'AV52802',
  catalog_manufacturer: 'Avant Slot',
};

function mockGets({ refs = { total: 0, rows: [] } } = {}) {
  api.get.mockImplementation((url, config) => {
    if (url === '/admin/timing-retention') {
      return Promise.resolve({ data: RETENTION });
    }
    if (url === '/admin/platform-metrics') {
      return Promise.resolve({ data: METRICS });
    }
    if (url === '/admin/vehicle-refs-not-in-catalog') {
      const q = config?.params?.q;
      if (q) {
        return Promise.resolve({
          data: { total: refs.total ?? 1, q, rows: refs.rows ?? [IN_CATALOG_ROW] },
        });
      }
      return Promise.resolve({ data: { total: 0, rows: [] } });
    }
    return Promise.reject(new Error(`unexpected url: ${url}`));
  });
}

function refsGetCalls() {
  return api.get.mock.calls.filter(([url]) => url === '/admin/vehicle-refs-not-in-catalog');
}

describe('AdminPlatformDashboard — búsqueda y enlace de refs de garaje', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.history.replaceState(null, '', '/admin/dashboard');
    mockGets();
    api.post.mockResolvedValue({ data: { updated_count: 2 } });
  });

  afterEach(() => {
    window.history.replaceState(null, '', '/admin/dashboard');
  });

  it('sin búsqueda no envía q (ranking de huecos)', async () => {
    render(
      <MemoryRouter>
        <AdminPlatformDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByLabelText('Buscar referencia')).toBeInTheDocument();
    await waitFor(() => {
      expect(refsGetCalls().length).toBeGreaterThan(0);
    });
    const last = refsGetCalls().at(-1);
    expect(last[1].params.q).toBeUndefined();
  });

  it('deep-link ?ref= pide el API con q e incluye refs ya en catálogo', async () => {
    window.history.replaceState(null, '', '/admin/dashboard?ref=AV52802');
    mockGets({ refs: { total: 1, rows: [IN_CATALOG_ROW] } });

    render(
      <MemoryRouter>
        <AdminPlatformDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByDisplayValue('AV52802')).toBeInTheDocument();
    await waitFor(() => {
      const withQ = refsGetCalls().filter(([, cfg]) => cfg?.params?.q === 'AV52802');
      expect(withQ.length).toBeGreaterThan(0);
    });
    expect(await screen.findByText('AV52802')).toBeInTheDocument();
    expect(screen.getByText('En catálogo')).toBeInTheDocument();
  });

  it('buscar y enlazar prellena el ítem único del catálogo y llama al POST', async () => {
    mockGets({ refs: { total: 1, rows: [IN_CATALOG_ROW] } });

    render(
      <MemoryRouter>
        <AdminPlatformDashboard />
      </MemoryRouter>,
    );

    const input = await screen.findByLabelText('Buscar referencia');
    await userEvent.clear(input);
    await userEvent.type(input, 'AV52802');
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    await waitFor(() => {
      expect(window.location.search).toContain('ref=AV52802');
    });
    expect(await screen.findByText('En catálogo')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Enlazar' }));

    expect(await screen.findByText(/se han prellenado marca y referencia/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Marca en el catálogo')).toHaveValue(CATALOG_ID);
    expect(screen.getByLabelText('Referencia en el catálogo')).toHaveValue('AV52802');

    await userEvent.click(screen.getByRole('button', { name: 'Confirmar enlace' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/admin/link-garage-refs-to-catalog', {
        garage_reference: 'AV52802',
        catalog_reference: 'AV52802',
        catalog_manufacturer_id: CATALOG_ID,
        garage_manufacturer: 'Avant Slot',
      });
    });
    expect(await screen.findByText(/Enlazados 2 vehículo/)).toBeInTheDocument();
  });
});
