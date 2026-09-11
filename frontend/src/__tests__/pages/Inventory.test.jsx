import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Inventory from '../../pages/Inventory';
import api from '../../lib/axios';

jest.mock('../../lib/axios', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
  invalidateApiAccessTokenCache: jest.fn(),
}));

jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

const HUGE_LIMIT = 10000;

function mockApiGets() {
  api.get.mockImplementation((url) => {
    const path = String(url);
    if (path === '/vehicles' || path.startsWith('/vehicles')) {
      return Promise.resolve({
        data: { vehicles: [], pagination: { total: 0, page: 1, limit: 250, totalPages: 0 } },
      });
    }
    if (path === '/inventory/parts') {
      return Promise.resolve({
        data: { parts: [], pagination: { total: 0, page: 1, limit: 25, totalPages: 0 } },
      });
    }
    if (path === '/inventory') {
      return Promise.resolve({
        data: { items: [], pagination: { total: 0, page: 1, limit: 25, totalPages: 0 } },
      });
    }
    return Promise.reject(new Error(`unexpected url: ${url}`));
  });
}

function inventoryCalls() {
  return api.get.mock.calls.filter(([url]) => {
    const path = String(url);
    return path === '/inventory' || path === '/inventory/parts';
  });
}

function partsCalls() {
  return api.get.mock.calls.filter(([url]) => String(url) === '/inventory/parts');
}

function itemsCalls() {
  return api.get.mock.calls.filter(([url]) => String(url) === '/inventory');
}

describe('Inventory — filtros en query y paginación de servidor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    mockApiGets();
  });

  test('pide una página normal, nunca limit=10000, y envía filtros en la query', async () => {
    render(
      <MemoryRouter initialEntries={['/inventory']}>
        <Inventory />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(partsCalls().length).toBeGreaterThan(0);
    });

    const [, initialCfg] = partsCalls()[0];
    expect(initialCfg.params.limit).toBe(25);
    expect(initialCfg.params.page).toBe(1);
    expect(initialCfg.params.limit).not.toBe(HUGE_LIMIT);
    expect(initialCfg.params.q).toBeUndefined();

    const search = screen.getByLabelText(/Buscar/);
    await userEvent.type(search, 'GT');

    await waitFor(
      () => {
        const withQ = partsCalls().filter(([, cfg]) => cfg?.params?.q === 'GT');
        expect(withQ.length).toBeGreaterThan(0);
        expect(
          withQ.every(
            ([, cfg]) => cfg.params.limit === 25 && cfg.params.limit !== HUGE_LIMIT && cfg.params.page === 1,
          ),
        ).toBe(true);
      },
      { timeout: 2000 },
    );

    expect(inventoryCalls().every(([, cfg]) => cfg?.params?.limit !== HUGE_LIMIT)).toBe(true);
  });

  test('al cambiar a líneas de stock pide GET /inventory con page y limit de página', async () => {
    render(
      <MemoryRouter initialEntries={['/inventory']}>
        <Inventory />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(partsCalls().length).toBeGreaterThan(0);
    });

    await userEvent.click(screen.getByRole('tab', { name: 'Líneas de stock' }));

    await waitFor(() => {
      expect(itemsCalls().length).toBeGreaterThan(0);
      expect(screen.getByText('No hay ítems')).toBeInTheDocument();
    });

    const [, cfg] = itemsCalls()[0];
    expect(cfg.params.page).toBe(1);
    expect(cfg.params.limit).toBe(25);
    expect(cfg.params.limit).not.toBe(HUGE_LIMIT);
  });
});
