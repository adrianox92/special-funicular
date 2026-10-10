import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import VehicleCard from '../../components/VehicleCard';

jest.mock('../../lib/axios', () => ({
  __esModule: true,
  default: { get: jest.fn(), delete: jest.fn() },
}));

jest.mock('../../utils/formatUtils', () => ({
  formatDistance: (n) => String(n ?? ''),
  getIntlLocale: () => 'es',
  safeVehicleFileBasename: (name) => name || 'vehiculo',
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => {
      const map = {
        'techSpecs.title': 'Información técnica',
        'techSpecs.fields.scale': 'Escala',
        'techSpecs.fields.body': 'Carrocería',
        'card.priceUnavailable': 'Precio no disponible',
      };
      return map[key] || key;
    },
  }),
}));

jest.mock('sonner', () => ({ toast: { error: jest.fn() } }));

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
});

const vehicle = {
  id: 'v1',
  model: 'Audi Quattro',
  manufacturer: 'Scalextric',
  reference: 'C123',
  type: 'rally',
  spec_scale: '1:32',
  spec_body: 'Plastic',
};

describe('VehicleCard', () => {
  test('no muestra las especificaciones técnicas en el listado', () => {
    render(
      <MemoryRouter>
        <VehicleCard vehicle={vehicle} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Audi Quattro')).toBeInTheDocument();
    expect(screen.getByText(/Scalextric/)).toBeInTheDocument();
    expect(screen.queryByText('Información técnica')).not.toBeInTheDocument();
    expect(screen.queryByText('Escala')).not.toBeInTheDocument();
    expect(screen.queryByText('1:32')).not.toBeInTheDocument();
    expect(screen.queryByText('Carrocería')).not.toBeInTheDocument();
  });
});
