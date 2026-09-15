import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const mockCtx = {
  inventoryPickerOpen: true,
  setInventoryPickerOpen: jest.fn(),
  inventoryPickerLoading: false,
  inventoryPickerLoadingMore: false,
  inventoryPickerItems: [],
  inventoryPickerHasMore: false,
  inventoryPickerQ: '',
  newSpec: { component_type: '' },
  handlePickInventoryItem: jest.fn(),
  searchInventoryPicker: jest.fn(),
  loadMoreInventoryPicker: jest.fn(),
};

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, opts) => {
      if (opts && Object.prototype.hasOwnProperty.call(opts, 'categorySuffix')) {
        return `${key}${opts.categorySuffix || ''}`;
      }
      return key;
    },
  }),
}));

jest.mock('../../../utils/formatUtils', () => ({
  formatInventoryCategory: (c) => c || '—',
}));

jest.mock('../../../components/edit-vehicle/EditVehicleContext', () => ({
  useEditVehicle: () => mockCtx,
}));

import InventoryPickerDialog from '../../../components/edit-vehicle/InventoryPickerDialog';

function renderDialog() {
  return render(
    <MemoryRouter>
      <InventoryPickerDialog />
    </MemoryRouter>,
  );
}

describe('InventoryPickerDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCtx.inventoryPickerOpen = true;
    mockCtx.inventoryPickerLoading = false;
    mockCtx.inventoryPickerLoadingMore = false;
    mockCtx.inventoryPickerItems = [];
    mockCtx.inventoryPickerHasMore = false;
    mockCtx.inventoryPickerQ = '';
    mockCtx.newSpec = { component_type: '' };
  });

  test('muestra spinner mientras carga la primera página', () => {
    mockCtx.inventoryPickerLoading = true;
    renderDialog();
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });

  test('muestra vacío y busca en el servidor con debounce', async () => {
    renderDialog();

    expect(screen.getByText('modals.noInventoryItems')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('modals.inventoryPickerSearch'), 'GT');

    await waitFor(
      () => {
        expect(mockCtx.searchInventoryPicker).toHaveBeenCalledWith('GT');
      },
      { timeout: 2000 },
    );
  });

  test('lista ítems, permite elegir uno y pide la siguiente página', async () => {
    mockCtx.inventoryPickerItems = [
      { id: 'i1', name: 'Piñón 9', category: 'pinion', quantity: 4, purchase_price: 1.5 },
    ];
    mockCtx.inventoryPickerHasMore = true;
    renderDialog();

    expect(screen.getByText('Piñón 9')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'modals.useThis' }));
    expect(mockCtx.handlePickInventoryItem).toHaveBeenCalledWith(mockCtx.inventoryPickerItems[0]);

    await userEvent.click(screen.getByRole('button', { name: 'modals.inventoryPickerLoadMore' }));
    expect(mockCtx.loadMoreInventoryPicker).toHaveBeenCalled();
  });
});
