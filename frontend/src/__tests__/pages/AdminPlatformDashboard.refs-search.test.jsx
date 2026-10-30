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

jest.mock('../../components/ui/switch', () => ({
  Switch: ({ id, checked, onCheckedChange, ...rest }) => (
    <input
      id={id}
      type="checkbox"
      role="switch"
      aria-checked={!!checked}
      checked={!!checked}
      onChange={(e) => onCheckedChange(e.target.checked)}
      {...rest}
    />
  ),
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
    if (url === '/admin/catalog-link-suggestions') {
      return Promise.resolve({
        data: { suggestions: refs.suggestions ?? [] },
      });
    }
    if (url === '/admin/mcp-catalog-usage') {
      return Promise.resolve({ data: { ready: true, lookups_24h: 0, users: [], recent: [] } });
    }
    if (url === '/admin/vehicle-refs-not-in-catalog') {
      const q = config?.params?.q;
      const manufacturer = config?.params?.manufacturer;
      const onlyInCatalog = config?.params?.only_in_catalog === 'true';
      if (q || manufacturer || onlyInCatalog) {
        const rows = refs.rows ?? (q ? [IN_CATALOG_ROW] : [{ ...IN_CATALOG_ROW, in_catalog: false }]);
        return Promise.resolve({
          data: {
            total: refs.total ?? rows.length,
            q: q || null,
            manufacturer: manufacturer || null,
            rows,
          },
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
    expect(last[1].params.manufacturer).toBeUndefined();
    expect(last[1].params.only_in_catalog).toBeUndefined();
  });

  it('el filtro solo enlazables pide grupos que ya están en el catálogo', async () => {
    mockGets({ refs: { total: 1, rows: [IN_CATALOG_ROW] } });

    render(
      <MemoryRouter>
        <AdminPlatformDashboard />
      </MemoryRouter>,
    );

    const toggle = await screen.findByRole('switch', {
      name: /solo enlazables/i,
    });
    await userEvent.click(toggle);

    await waitFor(() => {
      const calls = refsGetCalls().filter(([, cfg]) => cfg?.params?.only_in_catalog === 'true');
      expect(calls.length).toBeGreaterThan(0);
    });
    expect(await screen.findByText('En catálogo')).toBeInTheDocument();
    expect(
      screen.getByText(/ordenados por nº de ejemplares enlazables; solo enlazables/i),
    ).toBeInTheDocument();
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
        catalog_item_id: IN_CATALOG_ROW.catalog_item_id,
        catalog_reference: 'AV52802',
        catalog_manufacturer_id: CATALOG_ID,
        garage_manufacturer: 'Avant Slot',
      });
    });
    expect(await screen.findByText(/Enlazados 2 vehículo/)).toBeInTheDocument();
  });

  it('filtra por fabricante y lo combina con la referencia', async () => {
    mockGets({
      refs: {
        total: 1,
        rows: [{ ...IN_CATALOG_ROW, sample_manufacturer: 'Ninco' }],
      },
    });

    render(
      <MemoryRouter>
        <AdminPlatformDashboard />
      </MemoryRouter>,
    );

    const mfg = await screen.findByLabelText('Fabricante');
    await userEvent.type(mfg, 'Ninco');
    await userEvent.type(screen.getByLabelText('Buscar referencia'), 'AV52802');
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    await waitFor(() => {
      expect(window.location.search).toContain('ref=AV52802');
      expect(window.location.search).toContain('manufacturer=Ninco');
    });
    await waitFor(() => {
      const withBoth = refsGetCalls().filter(
        ([, cfg]) => cfg?.params?.q === 'AV52802' && cfg?.params?.manufacturer === 'Ninco',
      );
      expect(withBoth.length).toBeGreaterThan(0);
    });
    expect(await screen.findByText(/agrupados por marca/i)).toBeInTheDocument();
  });

  it('deep-link ?manufacturer= pide el API con manufacturer', async () => {
    window.history.replaceState(null, '', '/admin/dashboard?manufacturer=Ninco');
    mockGets({
      refs: {
        total: 1,
        rows: [{ ...IN_CATALOG_ROW, in_catalog: false, sample_manufacturer: 'Ninco' }],
      },
    });

    render(
      <MemoryRouter>
        <AdminPlatformDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByDisplayValue('Ninco')).toBeInTheDocument();
    await waitFor(() => {
      const withMfg = refsGetCalls().filter(([, cfg]) => cfg?.params?.manufacturer === 'Ninco');
      expect(withMfg.length).toBeGreaterThan(0);
    });
    expect(screen.getByText(/agrupados por marca/i)).toBeInTheDocument();
  });

  it('elige la ficha que termina en la referencia del garaje y enlaza por id', async () => {
    const suggestion = {
      id: '900e8585-d110-45a9-915c-c5669ddaca7e',
      reference: '20027131',
      manufacturer_id: CATALOG_ID,
      manufacturer: 'Carrera',
      model_name: 'Mercedes C DTM 2006 red',
      match: 'suffix',
      manufacturer_rank: 0,
    };
    mockGets({
      refs: {
        total: 1,
        suggestions: [suggestion],
        rows: [
          {
            reference: '27131',
            vehicle_count: 1,
            distinct_user_count: 1,
            linkable_vehicle_count: 1,
            linkable_distinct_user_count: 1,
            sample_manufacturer: 'Carrera',
            sample_model: 'Mercedes',
            in_catalog: false,
            catalog_item_count: 0,
          },
        ],
      },
    });

    render(
      <MemoryRouter>
        <AdminPlatformDashboard />
      </MemoryRouter>,
    );

    const input = await screen.findByLabelText('Buscar referencia');
    await userEvent.type(input, '27131');
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Enlazar' }));

    const match = await screen.findByRole('button', { name: /20027131/ });
    expect(match).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/Termina en la ref/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Confirmar enlace' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/admin/link-garage-refs-to-catalog', {
        garage_reference: '27131',
        catalog_item_id: suggestion.id,
        catalog_reference: '20027131',
        catalog_manufacturer_id: CATALOG_ID,
        garage_manufacturer: 'Carrera',
      });
    });
  });
});
