import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import VehicleList from '../../pages/VehicleList';
import api from '../../lib/axios';

jest.mock('../../utils/formatUtils', () => ({
  formatDistance: (n) => String(n ?? ''),
}));

jest.mock('../../data/componentTypes', () => ({
  getVehicleComponentTypeLabel: (t) => t,
}));

jest.mock('../../lib/axios', () => ({
  __esModule: true,
  default: { get: jest.fn() },
  invalidateApiAccessTokenCache: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
  }),
}));

jest.mock('sonner', () => ({ toast: { error: jest.fn() } }));

jest.mock('../../components/VehicleCard', () => ({
  __esModule: true,
  default: ({ vehicle }) => <div data-testid={`vehicle-card-${vehicle.id}`}>{vehicle.model}</div>,
}));

jest.mock('../../components/VehicleTable', () => ({
  __esModule: true,
  default: () => <div data-testid="vehicle-table" />,
}));

jest.mock('../../components/VehicleImportDialog', () => ({
  __esModule: true,
  default: () => null,
}));

function mockApiGets() {
  api.get.mockImplementation((url) => {
    if (String(url).startsWith('/vehicles/scale-factors')) {
      return Promise.resolve({ data: { scaleFactors: [] } });
    }
    if (String(url).startsWith('/vehicles/manufacturers')) {
      return Promise.resolve({ data: { manufacturers: ['Ninco', 'Slot.it'] } });
    }
    if (String(url).startsWith('/vehicles?')) {
      return Promise.resolve({
        data: {
          vehicles: [],
          pagination: { total: 0, page: 1, limit: 25, totalPages: 0 },
        },
      });
    }
    return Promise.reject(new Error(`unexpected url: ${url}`));
  });
}

function listUrls() {
  return api.get.mock.calls.map(([url]) => String(url)).filter((u) => u.startsWith('/vehicles?'));
}

describe('VehicleList — filtros en querystring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
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
    mockApiGets();
  });

  test('pide una página normal, nunca limit=10000, y envía filtros en la query', async () => {
    render(
      <MemoryRouter initialEntries={['/vehicles']}>
        <VehicleList />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(listUrls().length).toBeGreaterThan(0);
    });

    const initial = listUrls()[0];
    expect(initial).toMatch(/limit=25/);
    expect(initial).not.toMatch(/limit=10000/);
    expect(initial).toMatch(/page=1/);

    const modelInput = screen.getByLabelText('model');
    await userEvent.type(modelInput, 'GT');

    await waitFor(() => {
      const withModel = listUrls().filter((u) => u.includes('model=GT'));
      expect(withModel.length).toBeGreaterThan(0);
      expect(withModel.every((u) => /limit=25/.test(u) && !/limit=10000/.test(u))).toBe(true);
    });
  });

  test('escribir fabricante envía manufacturer en la query con paginación normal', async () => {
    render(
      <MemoryRouter initialEntries={['/vehicles']}>
        <VehicleList />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(listUrls().length).toBeGreaterThan(0);
    });

    const manufacturerInput = screen.getByLabelText('manufacturer');
    await userEvent.type(manufacturerInput, 'Ninco');

    await waitFor(() => {
      const withMfg = listUrls().filter((u) => u.includes('manufacturer=Ninco'));
      expect(withMfg.length).toBeGreaterThan(0);
      expect(withMfg.every((u) => /limit=25/.test(u) && !/limit=10000/.test(u))).toBe(true);
    });
  });

  test('elegir un fabricante de la lista envía el valor exacto (p. ej. Slot.it)', async () => {
    render(
      <MemoryRouter initialEntries={['/vehicles']}>
        <VehicleList />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(api.get.mock.calls.some(([url]) => String(url).startsWith('/vehicles/manufacturers'))).toBe(
        true,
      );
    });

    const manufacturerInput = screen.getByLabelText('manufacturer');
    await userEvent.click(manufacturerInput);
    const slotIt = await screen.findByRole('button', { name: 'Slot.it' });
    await userEvent.click(slotIt);

    await waitFor(() => {
      const withSlot = listUrls().filter((u) => decodeURIComponent(u).includes('manufacturer=Slot.it'));
      expect(withSlot.length).toBeGreaterThan(0);
    });
  });
});
