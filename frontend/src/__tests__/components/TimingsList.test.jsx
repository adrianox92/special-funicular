import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TimingsList from '../../components/TimingsList';
import api from '../../lib/axios';

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useSearchParams: () => [new URLSearchParams('circuit_id=cir-1&vehicle=veh-1'), jest.fn()],
}));

jest.mock('../../lib/axios', () => ({
  __esModule: true,
  default: { get: jest.fn(), delete: jest.fn() },
  invalidateApiAccessTokenCache: jest.fn(),
}));

jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

jest.mock('../../components/LapTimerTrainingLink', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../components/SessionTimeline', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../components/ImportTimingsModal', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../components/SessionComparisonModal', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../components/SessionPerformanceModal', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../components/TimingSpecsModal', () => ({
  __esModule: true,
  default: () => null,
}));

const circuit = { id: 'cir-1', name: 'Pista salón' };
const circuit2 = { id: 'cir-2', name: 'Club' };
const vehicle = { id: 'veh-1', manufacturer: 'Scalextric', model: 'Ferrari F1' };
const vehicle2 = { id: 'veh-2', manufacturer: 'Ninco', model: 'Porsche GT' };

const timingOnCircuit = {
  id: 't-1',
  vehicle_id: 'veh-1',
  vehicle_manufacturer: 'Scalextric',
  vehicle_model: 'Ferrari F1',
  circuit_id: 'cir-1',
  circuit: 'Pista salón',
  lane: '1',
  laps: 10,
  best_lap_time: '00:11.324',
  timing_date: '2026-09-16',
};

const timingOtherCircuit = {
  id: 't-2',
  vehicle_id: 'veh-2',
  vehicle_manufacturer: 'Ninco',
  vehicle_model: 'Porsche GT',
  circuit_id: 'cir-2',
  circuit: 'Club',
  lane: '1',
  laps: 8,
  best_lap_time: '00:12.000',
  timing_date: '2026-09-15',
};

function mockListData(timings = [timingOnCircuit, timingOtherCircuit]) {
  api.get.mockImplementation((url) => {
    if (url === '/vehicles') {
      return Promise.resolve({ data: { vehicles: [vehicle, vehicle2] } });
    }
    if (url === '/timings') return Promise.resolve({ data: timings });
    if (url === '/circuits') return Promise.resolve({ data: [circuit, circuit2] });
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
}

function renderTimings(search = '/timings') {
  return render(
    <MemoryRouter initialEntries={[search]}>
      <TimingsList />
    </MemoryRouter>,
  );
}

describe('TimingsList — deep-link de filtros', () => {
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
  });

  test('circuit_id y vehicle del query aplican los filtros del listado', async () => {
    mockListData();
    renderTimings('/timings?circuit_id=cir-1&vehicle=veh-1');

    await waitFor(() => {
      expect(screen.getByTestId('timings-filter-vehicle')).toHaveTextContent(/Ferrari F1/);
    });
    expect(screen.getByTestId('timings-filter-circuit')).toHaveTextContent('Pista salón');
    expect(screen.getAllByText('Pista salón').length).toBeGreaterThan(0);
    expect(screen.queryByText('Porsche GT')).not.toBeInTheDocument();
    expect(screen.queryByText('Club')).not.toBeInTheDocument();
  });
});
