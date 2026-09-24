import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { useVehicleSpecs } from '../../../components/edit-vehicle/useVehicleSpecs';
import api from '../../../lib/axios';

jest.mock('../../../lib/axios', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
  invalidateApiAccessTokenCache: jest.fn(),
}));

jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn(), warning: jest.fn() } }));

function SaveProbe() {
  const specs = useVehicleSpecs('veh-1', {
    t: (key) => key,
    setError: jest.fn(),
    setDeleteConfirm: jest.fn(),
    deleteConfirm: null,
  });

  return (
    <div>
      <button
        type="button"
        onClick={() =>
          specs.handleSpecChange({
            target: { name: 'component_type', value: 'motor', type: 'text' },
          })
        }
      >
        set-type
      </button>
      <button
        type="button"
        onClick={() =>
          specs.handleSpecChange({
            target: { name: 'element', value: 'Motor nuevo', type: 'text' },
          })
        }
      >
        set-name
      </button>
      <button
        type="button"
        onClick={() =>
          specs.handleSpecChange({
            target: { name: 'manufacturer', value: 'Slot', type: 'text' },
          })
        }
      >
        set-brand
      </button>
      <button
        type="button"
        onClick={() =>
          specs.handleSpecChange({
            target: { name: 'rpm', value: '20000', type: 'text' },
          })
        }
      >
        set-rpm
      </button>
      <div data-testid="presence">{specs.inventoryPresence}</div>
      <form onSubmit={(e) => specs.handleAddSpec(e, true)}>
        <button type="submit">save-mod</button>
      </form>
    </div>
  );
}

describe('useVehicleSpecs — referencia ausente en inventario', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.get.mockImplementation((url) => {
      if (String(url).includes('/technical-specs')) {
        return Promise.resolve({ data: [] });
      }
      if (String(url) === '/inventory/parts/match') {
        return Promise.resolve({ data: null });
      }
      return Promise.reject(new Error(`unexpected url: ${url}`));
    });
    api.post.mockResolvedValue({
      data: {
        inventory_created_at_zero: true,
        inventory_notice:
          'La pieza se ha creado en el inventario con stock 0. Puedes añadir más stock más adelante desde la sección Inventario.',
      },
    });
  });

  test('avisa que se creará con stock 0 y confirma al guardar', async () => {
    render(<SaveProbe />);

    await userEvent.click(screen.getByRole('button', { name: 'set-type' }));
    await userEvent.click(screen.getByRole('button', { name: 'set-name' }));
    await userEvent.click(screen.getByRole('button', { name: 'set-brand' }));
    await userEvent.click(screen.getByRole('button', { name: 'set-rpm' }));

    await waitFor(() => {
      expect(screen.getByTestId('presence')).toHaveTextContent('missing');
    });

    await userEvent.click(screen.getByRole('button', { name: 'save-mod' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/vehicles/veh-1/technical-specs',
        expect.objectContaining({
          is_modification: true,
          deduct_from_inventory: true,
        }),
      );
    });
    expect(toast.success).toHaveBeenCalledWith('edit.toasts.specCreatedInventoryZero');
  });
});
