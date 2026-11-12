import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AddVehicle from '../../components/AddVehicle';
import api from '../../lib/axios';
import { useAuth } from '../../context/AuthContext';

const ITEM_ID = 'f837090b-c5a9-4749-a828-3d67a04f6b60';
const catalogItem = {
  id: ITEM_ID,
  model_name: 'Cadillac CTS-V Coupe',
  manufacturer: 'Scaleauto',
  reference: 'SC6378',
  vehicle_type: 'Turismo',
  image_url: null,
};

jest.mock('../../lib/axios', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key }),
}));

jest.mock('../../components/VehicleCatalogSuggestions', () => ({
  __esModule: true,
  default: function VehicleCatalogAssistMock({ onSelect, catalogItemId }) {
    if (catalogItemId) return <p>Enlazado al catálogo</p>;
    return (
      <button
        type="button"
        onClick={() =>
          onSelect({
            id: 'f837090b-c5a9-4749-a828-3d67a04f6b60',
            model_name: 'Cadillac CTS-V Coupe',
            manufacturer: 'Scaleauto',
            reference: 'SC6378',
            vehicle_type: 'Turismo',
          })
        }
      >
        Es este
      </button>
    );
  },
}));

jest.mock('../../components/CatalogTechSpecsFields', () => ({
  __esModule: true,
  default: function CatalogTechSpecsFieldsMock() {
    return null;
  },
}));

jest.mock('../../components/CatalogListingImage', () => ({
  __esModule: true,
  default: function CatalogListingImageMock() {
    return null;
  },
}));

jest.mock('../../components/ui/select', () => ({
  Select: ({ children }) => <div>{children}</div>,
  SelectTrigger: ({ children }) => <div>{children}</div>,
  SelectValue: () => null,
  SelectContent: ({ children }) => <div>{children}</div>,
  SelectItem: ({ children }) => <div>{children}</div>,
}));

jest.mock('../../components/ui/tabs', () => {
  const React = require('react');
  const Ctx = React.createContext({ onValueChange: () => {} });
  function Tabs({ value, onValueChange, children }) {
    return React.createElement(Ctx.Provider, { value: { value, onValueChange } }, children);
  }
  function TabsList({ children }) {
    return React.createElement('div', { role: 'tablist' }, children);
  }
  function TabsTrigger({ value, children }) {
    const ctx = React.useContext(Ctx);
    return React.createElement(
      'button',
      { type: 'button', role: 'tab', onClick: () => ctx.onValueChange(value) },
      children,
    );
  }
  function TabsContent({ children }) {
    return React.createElement('div', null, children);
  }
  return { __esModule: true, Tabs, TabsList, TabsTrigger, TabsContent };
});

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return {
    __esModule: true,
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

function postedFormData() {
  const arg = api.post.mock.calls[0][1];
  expect(arg).toBeInstanceOf(FormData);
  return arg;
}

function field(name) {
  return document.querySelector(`[name="${name}"]`);
}

function fill(name, value) {
  fireEvent.change(field(name), { target: { value, name } });
}

function renderAdd(initialEntries = ['/vehicles/new']) {
  useAuth.mockReturnValue({ user: { id: 'user-1' } });
  api.post.mockResolvedValue({ data: { id: 'v1' } });
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AddVehicle />
    </MemoryRouter>,
  );
}

describe('AddVehicle submit — FormData de los tres flujos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.get.mockResolvedValue({ data: { items: [] } });
  });

  test('a) «Es este» envía un solo catalog_item_id', async () => {
    renderAdd();
    fill('model', 'Cadillac');
    fill('manufacturer', 'Scaleauto');
    fill('type', 'Turismo');
    fireEvent.click(screen.getByRole('button', { name: 'Es este' }));
    fireEvent.click(screen.getByRole('button', { name: 'addPage.createButton' }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/vehicles', expect.any(FormData)));
    const fd = postedFormData();
    expect(fd.getAll('catalog_item_id')).toEqual([ITEM_ID]);
    expect(fd.get('vehicle_save_source')).toBe('suggest');
  });

  test('b) pestaña Catálogo: un solo catalog_item_id y source catalog_tab', async () => {
    api.get.mockImplementation((url) => {
      if (String(url).includes('/catalog/search')) {
        return Promise.resolve({ data: { items: [catalogItem] } });
      }
      return Promise.resolve({ data: { items: [] } });
    });
    renderAdd();
    fireEvent.click(screen.getByRole('tab', { name: 'addPage.tabCatalog' }));
    fireEvent.change(screen.getByPlaceholderText('addPage.catalogSearchPlaceholder'), {
      target: { value: 'SC6378' },
    });
    const pick = await screen.findByRole('button', { name: /SC6378/ });
    fireEvent.click(pick);
    fireEvent.click(screen.getByRole('button', { name: 'addPage.createButton' }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/vehicles', expect.any(FormData)));
    const fd = postedFormData();
    expect(fd.getAll('catalog_item_id')).toEqual([ITEM_ID]);
    expect(fd.get('vehicle_save_source')).toBe('catalog_tab');
    expect(fd.get('reference')).toBe('SC6378');
  });

  test('c) sin catálogo: no envía catalog_item_id', async () => {
    renderAdd();
    fill('model', 'Libre');
    fill('manufacturer', 'Ninco');
    fill('type', 'GT');
    fireEvent.click(screen.getByRole('button', { name: 'addPage.createButton' }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/vehicles', expect.any(FormData)));
    const fd = postedFormData();
    expect(fd.getAll('catalog_item_id')).toEqual([]);
    expect(fd.get('vehicle_save_source')).toBe('manual');
  });
});
