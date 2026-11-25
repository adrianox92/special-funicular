import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import AdminSlotCatalog from '../../pages/AdminSlotCatalog';
import api from '../../lib/axios';

jest.mock('../../lib/axios', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
  invalidateApiAccessTokenCache: jest.fn(),
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'admin-1', email: 'admin@example.com' } }),
}));

jest.mock('../../lib/licenseAdmin', () => ({
  isLicenseAdminUser: () => true,
}));

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      refreshSession: jest.fn(),
    },
  },
}));

jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, opts) => opts?.defaultValue || key,
  }),
}));

jest.mock('../../components/CatalogBrandSelect', () => ({
  __esModule: true,
  default: ({ value, onChange, label = 'Marca', id }) => (
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

jest.mock('recharts', () => ({
  Bar: () => null,
  BarChart: () => null,
  CartesianGrid: () => null,
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

const ITEM = {
  id: '11111111-1111-4111-8111-111111111111',
  reference: 'AV1',
  manufacturer_id: '22222222-2222-4222-8222-222222222222',
  manufacturer: 'Avant Slot',
  model_name: 'GT3 watermark',
  vehicle_type: 'GT',
  traction: '4x4',
  motor_position: 'inline',
  commercial_release_year: 2020,
  discontinued: true,
  upcoming_release: true,
  dorsal: '7',
  limited_edition: false,
  limited_edition_total: null,
  real_race_results_url: null,
  real_race_photos_url: null,
  image_url: null,
};

function mockAdminGets() {
  api.get.mockImplementation((url) => {
    if (url === '/catalog/stats') {
      return Promise.resolve({
        data: {
          totalItems: 1,
          weightedCompletenessPercent: 80,
          fullyCompletePercent: 0,
          fullyCompleteCount: 0,
          weights: { image_url: 0.3, model_name: 0.14 },
          missing: {},
        },
      });
    }
    if (url === '/catalog/items') {
      return Promise.resolve({
        data: { items: [ITEM], totalPages: 1, page: 1 },
      });
    }
    if (url === '/catalog/change-requests' || url === '/catalog/insert-requests') {
      return Promise.resolve({ data: { requests: [] } });
    }
    if (url === '/catalog/brands') {
      return Promise.resolve({ data: { brands: [] } });
    }
    return Promise.reject(new Error(`unexpected url: ${url}`));
  });
}

async function openItems() {
  render(
    <MemoryRouter>
      <AdminSlotCatalog />
    </MemoryRouter>,
  );
  const itemsTabs = await screen.findAllByRole('tab', { name: /Ítems/i });
  await userEvent.click(itemsTabs[0]);
  expect(await screen.findByText('AV1')).toBeInTheDocument();
}

describe('AdminSlotCatalog — edición inline del listado', () => {
  beforeAll(() => {
    if (!Element.prototype.hasPointerCapture) {
      Element.prototype.hasPointerCapture = () => false;
    }
    if (!Element.prototype.setPointerCapture) {
      Element.prototype.setPointerCapture = () => {};
    }
    if (!Element.prototype.releasePointerCapture) {
      Element.prototype.releasePointerCapture = () => {};
    }
    if (!Element.prototype.scrollIntoView) {
      Element.prototype.scrollIntoView = () => {};
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    window.matchMedia = jest.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));
    mockAdminGets();
    api.put.mockResolvedValue({ data: { ...ITEM, vehicle_type: 'Rally' } });
  });

  it('muestra dorsal editable y no las columnas descatalogado ni próximamente', async () => {
    await openItems();

    expect(screen.getByRole('columnheader', { name: 'Dorsal' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Desc.' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Próx.' })).not.toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Año AV1' })).toHaveValue(2020);
    expect(screen.getByRole('textbox', { name: 'Dorsal AV1' })).toHaveValue('7');
    expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument();
  });

  it('al cambiar el tipo guarda solo ese campo, sin botón', async () => {
    await openItems();

    await userEvent.click(screen.getByRole('combobox', { name: 'Tipo AV1' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Rally' }));

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith(`/catalog/items/${ITEM.id}`, { vehicle_type: 'Rally' });
    });
    expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument();
  });

  it('un año a medias no se envía y se recupera el año guardado', async () => {
    await openItems();

    const year = screen.getByRole('spinbutton', { name: 'Año AV1' });
    await userEvent.clear(year);
    await userEvent.type(year, '20');
    fireEvent.blur(year);

    expect(api.put).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('El año tiene que ser un valor entre 1900 y 2100.');
    expect(year).toHaveValue(2020);
  });
});
