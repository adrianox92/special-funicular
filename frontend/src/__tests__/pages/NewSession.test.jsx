import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { track } from '@vercel/analytics';
import NewSession from '../../pages/NewSession';
import api from '../../lib/axios';

jest.mock('@vercel/analytics', () => ({
  track: jest.fn(),
}));

jest.mock('../../lib/axios', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
  invalidateApiAccessTokenCache: jest.fn(),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const circuit = { id: 'cir-1', name: 'Pista salón', num_lanes: 2, lane_lengths: [0, 0] };
const vehicle = { id: 'veh-1', manufacturer: 'Scalextric', model: 'Ferrari F1', type: 'F1' };

function mockLists({ circuits = [circuit], vehicles = [vehicle] } = {}) {
  api.get.mockImplementation((url) => {
    if (url === '/circuits') return Promise.resolve({ data: circuits });
    if (url === '/vehicles') return Promise.resolve({ data: { vehicles } });
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
}

function renderSession(initial = '/session') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <NewSession />
    </MemoryRouter>,
  );
}

function trackedNames() {
  return track.mock.calls.map((call) => call[0]);
}

describe('NewSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockNavigate.mockReset();
  });

  test('sin circuitos muestra el alta mínima', async () => {
    mockLists({ circuits: [], vehicles: [vehicle] });
    renderSession();

    await screen.findByText(/Aún no tienes circuitos|You have no circuits yet|Du hast noch keine Strecken/i);
    expect(screen.getByLabelText(/Nombre|Name/i)).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(track).toHaveBeenCalledWith(
        'session_mode_opened',
        expect.objectContaining({ step: 'circuit', has_prior_circuit: false }),
      );
    });
  });

  test('sin vehículos no bloquea la app y ofrece alta/catálogo', async () => {
    mockLists({ circuits: [circuit], vehicles: [] });
    renderSession();

    await screen.findByTestId('session-continue-circuit');
    fireEvent.click(screen.getByTestId('session-continue-circuit'));

    await screen.findByText(/Tu garaje está vacío|Your garage is empty|Deine Garage ist leer/i);
    expect(screen.getByRole('link', { name: /Añadir vehículo|Add vehicle|Fahrzeug hinzufügen/i })).toHaveAttribute('href', '/vehicles/new');
    expect(screen.getByRole('link', { name: /Ver catálogo|View catalogue|Katalog ansehen/i })).toHaveAttribute('href', '/catalogo');
    expect(api.post).not.toHaveBeenCalled();
  });

  test('cancelar a mitad de flujo no guarda borrador y dispara session_abandoned', async () => {
    mockLists();
    renderSession();

    await screen.findByRole('button', { name: /Cancelar|Cancel|Abbrechen/i });
    await waitFor(() => {
      expect(trackedNames()).toContain('session_mode_opened');
    });
    fireEvent.click(screen.getByRole('button', { name: /Cancelar|Cancel|Abbrechen/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    expect(api.post).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith(
      'session_abandoned',
      expect.objectContaining({
        step: 'circuit',
        has_prior_circuit: true,
        circuit_created: false,
      }),
    );
    expect(trackedNames()).not.toContain('session_timing_saved');
  });

  test('crear circuito en el flujo dispara session_circuit_created', async () => {
    mockLists({ circuits: [], vehicles: [vehicle] });
    api.post.mockResolvedValue({
      data: { id: 'cir-new', name: 'Casa', num_lanes: 2, lane_lengths: [0, 0] },
    });
    renderSession();

    const nameInput = await screen.findByLabelText(/Nombre|Name/i);
    fireEvent.change(nameInput, { target: { value: 'Casa' } });
    fireEvent.click(screen.getByRole('button', { name: /Crear y usar|Create and use|Anlegen und verwenden/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/circuits',
        expect.objectContaining({ name: 'Casa', num_lanes: 2 }),
      );
    });
    expect(track).toHaveBeenCalledWith(
      'session_circuit_created',
      expect.objectContaining({
        step: 'circuit',
        circuit_created: true,
        has_prior_circuit: false,
      }),
    );
    await screen.findByTestId('session-step-vehicle');
  });

  test('guarda una sesión TRAINING por POST /timings', async () => {
    mockLists();
    api.post.mockResolvedValue({
      data: {
        id: 't-1',
        session_type: 'TRAINING',
        best_lap_time: '00:11.324',
        sync_meta: { previous_best_lap_seconds: 11.5, is_personal_best: true, delta_vs_pb_seconds: -0.176 },
      },
    });

    renderSession();

    await screen.findByText(/Pista salón/i);
    fireEvent.click(screen.getByRole('option', { name: /Pista salón/i }));
    fireEvent.click(screen.getByTestId('session-continue-circuit'));

    await screen.findByText(/Ferrari F1/i);
    fireEvent.click(screen.getByRole('option', { name: /Ferrari F1/i }));
    fireEvent.click(screen.getByTestId('session-continue-vehicle'));

    await screen.findByLabelText(/Mejor vuelta|Best lap|Beste Runde/i);

    const best = screen.getByLabelText(/Mejor vuelta|Best lap|Beste Runde/i);
    fireEvent.change(best, { target: { value: '11324' } });
    fireEvent.blur(best);

    const total = screen.getByLabelText(/Tiempo total|Total time|Gesamtzeit/i);
    fireEvent.change(total, { target: { value: '0200000' } });
    fireEvent.blur(total);

    fireEvent.change(screen.getByLabelText(/^Vueltas$|^Laps$|^Runden$/i), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText(/^Carril$|^Lane$|^Spur$/i), { target: { value: '1' } });

    fireEvent.click(screen.getByTestId('session-save'));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledTimes(1);
    });

    const [url, body] = api.post.mock.calls[0];
    expect(url).toBe('/timings');
    expect(body.session_type).toBe('TRAINING');
    expect(body.vehicle_id).toBe('veh-1');
    expect(body.circuit_id).toBe('cir-1');
    expect(body.best_lap_time).toBe('00:11.324');
    expect(body.total_time).toBe('02:00.000');
    expect(body.laps).toBe(10);
    expect(body.average_time).toBe('00:12.000');
    expect(body.lane).toBe('1');

    await screen.findByText(/Sesión guardada|Session saved|Session gespeichert/i);

    expect(trackedNames()).toEqual([
      'session_mode_opened',
      'session_circuit_selected',
      'session_vehicle_selected',
      'session_timing_saved',
    ]);
    expect(track).toHaveBeenCalledWith(
      'session_timing_saved',
      expect.objectContaining({
        step: 'capture',
        has_prior_circuit: true,
        circuit_created: false,
        lane_set: true,
        voltage_set: false,
      }),
    );
    const savedProps = track.mock.calls.find((call) => call[0] === 'session_timing_saved')[1];
    expect(savedProps).not.toHaveProperty('vehicle_name');
    expect(savedProps).not.toHaveProperty('email');
    expect(JSON.stringify(savedProps)).not.toMatch(/11\.324|Ferrari|veh-1/i);

    track.mockClear();
    window.dispatchEvent(new Event('beforeunload'));
    expect(trackedNames()).not.toContain('session_abandoned');
  });

  test('el promedio de captura redondea al ms (misma regla que EditVehicle)', async () => {
    mockLists();
    renderSession();

    await screen.findByText(/Pista salón/i);
    fireEvent.click(screen.getByRole('option', { name: /Pista salón/i }));
    fireEvent.click(screen.getByTestId('session-continue-circuit'));

    await screen.findByText(/Ferrari F1/i);
    fireEvent.click(screen.getByRole('option', { name: /Ferrari F1/i }));
    fireEvent.click(screen.getByTestId('session-continue-vehicle'));

    await screen.findByLabelText(/Mejor vuelta|Best lap|Beste Runde/i);

    const best = screen.getByLabelText(/Mejor vuelta|Best lap|Beste Runde/i);
    fireEvent.change(best, { target: { value: '03000' } });
    fireEvent.blur(best);

    const total = screen.getByLabelText(/Tiempo total|Total time|Gesamtzeit/i);
    fireEvent.change(total, { target: { value: '10007' } });
    fireEvent.blur(total);

    fireEvent.change(screen.getByLabelText(/^Vueltas$|^Laps$|^Runden$/i), { target: { value: '3' } });

    // 10.007 / 3 = 3.335666… → 00:03.336 (floor habría sido 00:03.335)
    expect(screen.getByDisplayValue('00:03.336')).toBeInTheDocument();
  });

  test('beforeunload a mitad de flujo dispara session_abandoned una vez', async () => {
    mockLists();
    renderSession();
    await waitFor(() => {
      expect(trackedNames()).toContain('session_mode_opened');
    });
    track.mockClear();
    window.dispatchEvent(new Event('beforeunload'));
    window.dispatchEvent(new Event('pagehide'));
    expect(trackedNames()).toEqual(['session_abandoned']);
    expect(track).toHaveBeenCalledWith(
      'session_abandoned',
      expect.objectContaining({ step: 'circuit', has_prior_circuit: true }),
    );
  });
});
