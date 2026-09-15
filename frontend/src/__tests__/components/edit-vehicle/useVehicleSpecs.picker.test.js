import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useVehicleSpecs } from '../../../components/edit-vehicle/useVehicleSpecs';
import api from '../../../lib/axios';
import { INVENTORY_PICKER_PAGE_SIZE } from '../../../components/edit-vehicle/specSnapshot';

jest.mock('../../../lib/axios', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
  invalidateApiAccessTokenCache: jest.fn(),
}));

jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn(), warning: jest.fn() } }));

function inventoryCalls() {
  return api.get.mock.calls.filter(([url]) => String(url) === '/inventory');
}

function PickerProbe() {
  const specs = useVehicleSpecs('veh-1', {
    t: (key) => key,
    setError: jest.fn(),
    setDeleteConfirm: jest.fn(),
    deleteConfirm: null,
  });

  return (
    <div>
      <button type="button" onClick={specs.openInventoryPicker}>
        open-picker
      </button>
      <button type="button" onClick={() => specs.searchInventoryPicker('Slot')}>
        search-picker
      </button>
      <button type="button" onClick={() => specs.loadMoreInventoryPicker()}>
        more-picker
      </button>
      <button
        type="button"
        onClick={() =>
          specs.handleSpecChange({
            target: { name: 'component_type', value: 'motor', type: 'text' },
          })
        }
      >
        set-motor
      </button>
      <button
        type="button"
        onClick={() => {
          const item = specs.inventoryPickerItems[0];
          if (item) specs.handlePickInventoryItem(item);
        }}
      >
        pick-first
      </button>
      <div data-testid="picker-ids">{specs.inventoryPickerItems.map((i) => i.id).join(',')}</div>
      <div data-testid="picker-has-more">{String(specs.inventoryPickerHasMore)}</div>
      <div data-testid="selected-id">{specs.selectedInventoryItemId || ''}</div>
      <div data-testid="selected-max">{specs.selectedInventoryMaxQty ?? ''}</div>
      <div data-testid="selected-qty">{specs.selectedInventoryMountQty}</div>
      <div data-testid="picker-open">{String(specs.inventoryPickerOpen)}</div>
    </div>
  );
}

describe('useVehicleSpecs — picker de inventario paginado', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.get.mockImplementation((url, cfg) => {
      if (String(url).includes('/technical-specs')) {
        return Promise.resolve({ data: [] });
      }
      if (String(url) === '/inventory') {
        const page = cfg?.params?.page ?? 1;
        const items =
          page === 1
            ? [{ id: 'i1', name: 'Piñón 9', category: 'pinion', quantity: 3, purchase_price: 4 }]
            : [{ id: 'i2', name: 'Piñón 10', category: 'pinion', quantity: 1 }];
        return Promise.resolve({
          data: {
            items,
            pagination: { total: 26, page, limit: INVENTORY_PICKER_PAGE_SIZE, totalPages: 2 },
          },
        });
      }
      return Promise.reject(new Error(`unexpected url: ${url}`));
    });
  });

  test('al abrir pide página 1 con limit e in_stock, nunca el dump sin paginar', async () => {
    render(<PickerProbe />);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });

    await userEvent.click(screen.getByRole('button', { name: 'open-picker' }));

    await waitFor(() => {
      expect(inventoryCalls().length).toBeGreaterThan(0);
    });

    const [, cfg] = inventoryCalls()[0];
    expect(cfg.params.page).toBe(1);
    expect(cfg.params.limit).toBe(INVENTORY_PICKER_PAGE_SIZE);
    expect(cfg.params.in_stock).toBe('true');
    expect(cfg.params.limit).not.toBeUndefined();
    expect(screen.getByTestId('picker-ids')).toHaveTextContent('i1');
    expect(screen.getByTestId('picker-has-more')).toHaveTextContent('true');
  });

  test('buscar y cargar más envían q y page; elegir línea conserva id y stock', async () => {
    render(<PickerProbe />);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });

    await userEvent.click(screen.getByRole('button', { name: 'set-motor' }));
    await userEvent.click(screen.getByRole('button', { name: 'search-picker' }));

    await waitFor(() => {
      const searchCall = inventoryCalls().find(([, cfg]) => cfg?.params?.q === 'Slot');
      expect(searchCall).toBeTruthy();
      expect(searchCall[1].params).toEqual({
        page: 1,
        limit: INVENTORY_PICKER_PAGE_SIZE,
        category: 'motor',
        q: 'Slot',
        in_stock: 'true',
      });
    });

    await userEvent.click(screen.getByRole('button', { name: 'more-picker' }));

    await waitFor(() => {
      const page2 = inventoryCalls().find(([, cfg]) => cfg?.params?.page === 2);
      expect(page2).toBeTruthy();
      expect(page2[1].params.limit).toBe(INVENTORY_PICKER_PAGE_SIZE);
      expect(page2[1].params.q).toBe('Slot');
      expect(screen.getByTestId('picker-ids')).toHaveTextContent('i1,i2');
    });

    await userEvent.click(screen.getByRole('button', { name: 'pick-first' }));
    expect(screen.getByTestId('selected-id')).toHaveTextContent('i1');
    expect(screen.getByTestId('selected-max')).toHaveTextContent('3');
    expect(screen.getByTestId('selected-qty')).toHaveTextContent('1');
    expect(screen.getByTestId('picker-open')).toHaveTextContent('false');
  });
});
