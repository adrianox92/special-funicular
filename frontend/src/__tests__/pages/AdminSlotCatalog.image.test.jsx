import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
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
    t: (key) => key,
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

jest.mock('../../components/CatalogTractionSelect', () => ({
  __esModule: true,
  default: ({ value, onChange, label = 'Tracción', id }) => (
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
  traction: '4x2',
  motor_position: null,
  commercial_release_year: 2020,
  discontinued: false,
  upcoming_release: false,
  dorsal: null,
  limited_edition: false,
  limited_edition_total: null,
  real_race_results_url: null,
  real_race_photos_url: null,
  image_url: 'https://cdn.example/catalog/watermark.jpg',
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

async function openItemsAndEdit() {
  render(
    <MemoryRouter>
      <AdminSlotCatalog />
    </MemoryRouter>,
  );

  const itemsTabs = await screen.findAllByRole('tab', { name: /Ítems/i });
  await userEvent.click(itemsTabs[0]);
  expect(await screen.findByText('AV1')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
  expect(await screen.findByText('Imagen actual')).toBeInTheDocument();
}

describe('AdminSlotCatalog — eliminar imagen de ítem', () => {
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
    api.put.mockResolvedValue({ data: { ...ITEM, image_url: null } });
    api.delete.mockResolvedValue({ data: { ...ITEM, image_url: null } });
  });

  it('al guardar con «Quitar imagen actual» envía clear_image', async () => {
    await openItemsAndEdit();

    await userEvent.click(screen.getByLabelText('Quitar imagen actual'));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => {
      expect(api.put).toHaveBeenCalled();
    });
    const [, fd] = api.put.mock.calls[0];
    expect(fd.get('clear_image')).toBe('true');
    expect(fd.get('image')).toBeNull();
  });

  it('«Eliminar ahora» llama DELETE de la imagen del ítem', async () => {
    await openItemsAndEdit();

    await userEvent.click(screen.getByRole('button', { name: 'Eliminar ahora' }));

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith(`/catalog/items/${ITEM.id}/image`);
    });
    await waitFor(() => {
      expect(screen.queryByText('Imagen actual')).not.toBeInTheDocument();
    });
    expect(screen.queryByLabelText('Quitar imagen actual')).not.toBeInTheDocument();
  });

  it('al borrar el año de comercialización lo envía vacío para poder dejarlo sin valor', async () => {
    await openItemsAndEdit();

    const yearInput = screen.getByPlaceholderText('ej. 2020');
    expect(yearInput).toHaveValue(2020);
    await userEvent.clear(yearInput);
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => {
      expect(api.put).toHaveBeenCalled();
    });
    const [, fd] = api.put.mock.calls[0];
    expect(fd.get('commercial_release_year')).toBe('');
  });
});
