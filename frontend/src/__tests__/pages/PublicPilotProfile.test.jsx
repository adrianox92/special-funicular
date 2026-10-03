import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import PublicPilotProfile, {
  brandCountsFromVehicles,
  filterPublicVehicles,
} from '../../pages/PublicPilotProfile';
import api from '../../lib/axios';
import i18n from '../../i18n';

jest.mock('../../lib/axios', () => ({
  __esModule: true,
  default: { get: jest.fn() },
  invalidateApiAccessTokenCache: jest.fn(),
}));

jest.mock('../../components/Footer', () => () => <footer data-testid="footer" />);

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ slug: 'adrian-palomera' }),
  useLocation: () => ({ pathname: '/piloto/adrian-palomera', search: '', hash: '', state: null, key: 'default' }),
  useNavigate: () => jest.fn(),
}));

const PROFILE = {
  slug: 'adrian-palomera',
  display_name: 'Adrian Palomera',
  vehicles: [
    {
      id: 'v1',
      manufacturer: 'Slot.it',
      model: 'Porsche 911 RSR',
      type: 'GT',
      image: 'https://cdn.example/vehicle-images/porshe.webp',
    },
    {
      id: 'v2',
      manufacturer: 'Ninco',
      model: 'Audi R8',
      type: 'GT',
      image: null,
    },
    {
      id: 'v3',
      manufacturer: 'Scalextric',
      model: 'Ferrari F1',
      type: 'F1',
      image: 'https://cdn.example/vehicle-images/ferrari.webp',
    },
  ],
  best_times_by_circuit: [
    {
      circuit_id: 'c1',
      circuit_name: 'Club Slot',
      best_lap_time: '00:08.123',
      best_lap_seconds: 8.123,
      vehicle_id: 'v1',
      vehicle_manufacturer: 'Slot.it',
      vehicle_model: 'Porsche 911 RSR',
      timing_date: '2025-11-01',
      session_type: 'PRACTICE',
      supply_voltage_volts: 12,
    },
  ],
  competitions_organized: [{ id: 'org1', name: 'Copa Club', public_slug: 'copa-club' }],
  competitions_participated: [
    { competition_id: 'p1', competition_name: 'Test Copa', driver_name: 'Adrian', public_slug: 'test-copa' },
  ],
  palmares: [
    {
      competition_id: 'pal1',
      competition_name: 'Copa Skoda',
      public_slug: 'copa-skoda',
      circuit_name: 'Pista 1',
      position: 1,
      total_participants: 8,
      points: 25,
    },
  ],
};

async function renderProfile(payload = PROFILE, language = 'es') {
  api.get.mockImplementation((url) => {
    if (String(url).startsWith('/public/pilot/adrian-palomera/compare/')) {
      return Promise.resolve({
        data: {
          pilot_a: { display_name: 'Adrian Palomera' },
          pilot_b: { display_name: 'Rival' },
          circuits_compared: 1,
          wins_a: 1,
          circuits: [
            {
              circuit_key: 'c1',
              circuit_name: 'Club Slot',
              leader: 'a',
              pilot_a: { best_lap_time: '00:08.123' },
              pilot_b: { best_lap_time: '00:08.500' },
            },
          ],
        },
      });
    }
    if (String(url).startsWith('/public/pilot/adrian-palomera')) {
      return Promise.resolve({ data: payload });
    }
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });

  await i18n.loadNamespaces(['public', 'common']);
  await i18n.changeLanguage(language);

  const view = render(<PublicPilotProfile />);
  await screen.findByRole('heading', { level: 1 });
  return view;
}

describe('filterPublicVehicles / brandCountsFromVehicles', () => {
  test('filtra por texto y tipo', () => {
    expect(filterPublicVehicles(PROFILE.vehicles, 'ferrari', '__all__').map((v) => v.id)).toEqual(['v3']);
    expect(filterPublicVehicles(PROFILE.vehicles, '', 'F1').map((v) => v.id)).toEqual(['v3']);
    expect(filterPublicVehicles(PROFILE.vehicles, 'gt', 'GT')).toHaveLength(2);
  });

  test('agrupa marcas por recuento', () => {
    expect(brandCountsFromVehicles(PROFILE.vehicles)).toEqual([
      { name: 'Ninco', count: 1 },
      { name: 'Scalextric', count: 1 },
      { name: 'Slot.it', count: 1 },
    ]);
  });
});

describe('PublicPilotProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('muestra la colección en cards con imagen y conserva el resto de datos', async () => {
    await renderProfile();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Adrian Palomera');
    });

    const collection = screen.getByRole('heading', { name: /colección|collection|sammlung/i }).closest('section');
    expect(collection).toBeTruthy();
    expect(within(collection).getByText('Porsche 911 RSR')).toBeInTheDocument();
    expect(within(collection).getByText('Audi R8')).toBeInTheDocument();
    expect(within(collection).getByText('Ferrari F1')).toBeInTheDocument();

    const porscheImg = screen.getByRole('img', { name: 'Slot.it Porsche 911 RSR' });
    expect(porscheImg).toHaveAttribute('src', expect.stringContaining('porshe.webp'));
    expect(screen.queryByRole('img', { name: 'Ninco Audi R8' })).not.toBeInTheDocument();
    expect(within(collection).getByText(/sin imagen|no image|kein bild/i)).toBeInTheDocument();

    expect(screen.getByText('Copa Skoda')).toBeInTheDocument();
    expect(screen.getByText('Club Slot')).toBeInTheDocument();
    expect(screen.getByText('Copa Club')).toBeInTheDocument();
    expect(screen.getByText('Test Copa')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /comparar|compare|vergleichen/i })).toBeInTheDocument();
    expect(screen.getByTestId('footer')).toBeInTheDocument();
  });

  test('filtra la parrilla de la colección', async () => {
    await renderProfile();
    await screen.findByText('Porsche 911 RSR');

    fireEvent.change(screen.getByLabelText(/buscar por marca|search by brand|nach marke/i), {
      target: { value: 'Audi' },
    });

    expect(screen.getByText('Audi R8')).toBeInTheDocument();
    expect(screen.queryByText('Porsche 911 RSR')).not.toBeInTheDocument();
    expect(screen.queryByText('Ferrari F1')).not.toBeInTheDocument();
  });

  test('usa copy en inglés', async () => {
    await renderProfile(PROFILE, 'en');
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Collection' })).toBeInTheDocument();
    });
    expect(screen.getByText(/3 vehicles/i)).toBeInTheDocument();
    expect(screen.getAllByText('Verified palmares').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Best times by circuit').length).toBeGreaterThan(0);
  });

  test('usa copy en alemán', async () => {
    await renderProfile(PROFILE, 'de');
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Sammlung' })).toBeInTheDocument();
    });
    expect(screen.getByText(/3 Fahrzeuge/i)).toBeInTheDocument();
    expect(screen.getAllByText('Verifiziertes Palmarès').length).toBeGreaterThan(0);
  });
});
