import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { track } from '@vercel/analytics';
import NewSession from '../../pages/NewSession';
import api from '../../lib/axios';
import { setLastSessionCircuitId } from '../../utils/sessionLastCircuit';
import { getLastSessionVehicleId, setLastSessionVehicleId } from '../../utils/sessionLastVehicle';

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
const vehicle2 = { id: 'veh-2', manufacturer: 'Ninco', model: 'Porsche GT', type: 'GT' };

function mockLists({ circuits = [circuit], vehicles = [vehicle], timings = [] } = {}) {
  api.get.mockImplementation((url) => {
    if (url === '/circuits') return Promise.resolve({ data: circuits });
    if (url === '/vehicles') return Promise.resolve({ data: { vehicles } });
    if (typeof url === 'string' && /\/vehicles\/[^/]+\/timings$/.test(url)) {
      return Promise.resolve({ data: timings });
    }
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

async function goToCaptureFromWizard() {
  await screen.findByText(/Pista salón/i);
  fireEvent.click(screen.getByRole('option', { name: /Pista salón/i }));
  fireEvent.click(screen.getByTestId('session-continue-circuit'));
  await screen.findByText(/Ferrari F1/i);
  fireEvent.click(screen.getByRole('option', { name: /Ferrari F1/i }));
  fireEvent.click(screen.getByTestId('session-continue-vehicle'));
  await screen.findByLabelText(/Mejor vuelta|Best lap|Beste Runde/i);
}

function fillCaptureTimes({
  best = '11324',
  total = '0200000',
  laps = '10',
  lane = '1',
} = {}) {
  const bestEl = screen.getByLabelText(/Mejor vuelta|Best lap|Beste Runde/i);
  fireEvent.change(bestEl, { target: { value: best } });
  fireEvent.blur(bestEl);
  const totalEl = screen.getByLabelText(/Tiempo total|Total time|Gesamtzeit/i);
  fireEvent.change(totalEl, { target: { value: total } });
  fireEvent.blur(totalEl);
  fireEvent.change(screen.getByLabelText(/^Vueltas$|^Laps$|^Runden$/i), { target: { value: laps } });
  const laneSelect = screen.queryByLabelText(/^Carril$|^Lane$|^Spur$/i);
  if (laneSelect && lane != null && lane !== '') {
    fireEvent.change(laneSelect, { target: { value: lane } });
  }
}

function savedTimingResponse(overrides = {}) {
  return {
    id: 't-1',
    session_type: 'TRAINING',
    vehicle_id: 'veh-1',
    circuit_id: 'cir-1',
    circuit: 'Pista salón',
    lane: '1',
    best_lap_time: '00:11.324',
    best_lap_timestamp: 11.324,
    timing_date: '2026-09-16',
    sync_meta: { previous_best_lap_seconds: 11.5, is_personal_best: true, delta_vs_pb_seconds: -0.176 },
    ...overrides,
  };
}

async function saveTrainingSession() {
  api.post.mockResolvedValue({ data: savedTimingResponse() });
  await goToCaptureFromWizard();
  fillCaptureTimes();
  fireEvent.click(screen.getByTestId('session-save'));
  await screen.findByText(/Sesión guardada|Session saved|Session gespeichert/i);
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
    expect(body).not.toHaveProperty('lap_times');

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

  test('con último circuito y último coche aterriza en captura', async () => {
    mockLists({ circuits: [circuit], vehicles: [vehicle, vehicle2] });
    setLastSessionCircuitId('cir-1');
    setLastSessionVehicleId('veh-2');
    renderSession();

    await screen.findByTestId('session-step-capture');
    expect(screen.getByText(/Porsche GT/i)).toBeInTheDocument();
    expect(screen.getByText(/Pista salón/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(track).toHaveBeenCalledWith(
        'session_mode_opened',
        expect.objectContaining({ step: 'capture', has_prior_circuit: true }),
      );
    });
    expect(trackedNames()).not.toContain('session_circuit_selected');
    expect(trackedNames()).not.toContain('session_vehicle_selected');
  });

  test('si el último coche ya no está en el garaje, no lo preselecciona y limpia el id', async () => {
    mockLists({ circuits: [circuit], vehicles: [vehicle, vehicle2] });
    setLastSessionCircuitId('cir-1');
    setLastSessionVehicleId('veh-deleted');
    renderSession();

    await screen.findByTestId('session-step-circuit');
    expect(getLastSessionVehicleId()).toBeNull();
    expect(screen.queryByTestId('session-step-capture')).not.toBeInTheDocument();
  });

  test('con un solo coche, Continuar en vehículo ya está habilitado', async () => {
    mockLists();
    renderSession();

    await screen.findByTestId('session-continue-circuit');
    fireEvent.click(screen.getByTestId('session-continue-circuit'));
    const continueVehicle = await screen.findByTestId('session-continue-vehicle');
    expect(continueVehicle).not.toBeDisabled();
    expect(screen.getByRole('option', { name: /Ferrari F1/i })).toHaveAttribute('aria-selected', 'true');
  });

  test('otra manga mantiene circuito y coche y vacía los tiempos', async () => {
    mockLists();
    renderSession();
    await saveTrainingSession();

    expect(getLastSessionVehicleId()).toBe('veh-1');
    fireEvent.click(screen.getByTestId('session-another'));

    await screen.findByTestId('session-step-capture');
    expect(screen.getByText(/Ferrari F1/i)).toBeInTheDocument();
    expect(screen.getByText(/Pista salón/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Mejor vuelta|Best lap|Beste Runde/i)).toHaveValue('');
    expect(screen.getByLabelText(/Tiempo total|Total time|Gesamtzeit/i)).toHaveValue('');
    expect(screen.getByLabelText(/^Vueltas$|^Laps$|^Runden$/i)).toHaveValue(null);
    expect(screen.getByTestId('session-lap-times-toggle')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('session-lap-times')).not.toBeInTheDocument();
  });

  test('cambiar coche mantiene el circuito y vuelve al paso de vehículo', async () => {
    mockLists({ circuits: [circuit], vehicles: [vehicle, vehicle2] });
    renderSession();
    await saveTrainingSession();

    fireEvent.click(screen.getByTestId('session-change-car'));
    await screen.findByTestId('session-step-vehicle');
    expect(screen.getByRole('option', { name: /Ferrari F1/i })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('option', { name: /Porsche GT/i }));
    fireEvent.click(screen.getByTestId('session-continue-vehicle'));
    await screen.findByTestId('session-step-capture');
    expect(screen.getByText(/Porsche GT/i)).toBeInTheDocument();
    expect(screen.getByText(/Pista salón/i)).toBeInTheDocument();
  });

  test('validación fallida no borra campos válidos y enfoca el primer TimeInput inválido', async () => {
    mockLists();
    renderSession();
    await goToCaptureFromWizard();

    const total = screen.getByLabelText(/Tiempo total|Total time|Gesamtzeit/i);
    fireEvent.change(total, { target: { value: '0200000' } });
    fireEvent.blur(total);
    fireEvent.change(screen.getByLabelText(/^Vueltas$|^Laps$|^Runden$/i), { target: { value: '10' } });
    fireEvent.click(screen.getByTestId('session-save'));

    expect(api.post).not.toHaveBeenCalled();
    expect(await screen.findByText(/Indica la mejor vuelta|Enter the best lap|Bitte die beste Runde/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Tiempo total|Total time|Gesamtzeit/i)).toHaveValue('02:00.000');
    expect(screen.getByLabelText(/^Vueltas$|^Laps$|^Runden$/i)).toHaveValue(10);
    await waitFor(() => {
      expect(screen.getByLabelText(/Mejor vuelta|Best lap|Beste Runde/i)).toHaveFocus();
    });
  });

  test('si el POST falla, los tiempos rellenados se conservan', async () => {
    mockLists();
    api.post.mockRejectedValue({ response: { data: { error: 'No se pudo guardar la sesión' } } });
    renderSession();
    await goToCaptureFromWizard();
    fillCaptureTimes();
    fireEvent.click(screen.getByTestId('session-save'));

    expect(await screen.findByText(/No se pudo guardar la sesión/i)).toBeInTheDocument();
    expect(screen.getByTestId('session-step-capture')).toBeInTheDocument();
    expect(screen.getByLabelText(/Mejor vuelta|Best lap|Beste Runde/i)).toHaveValue('00:11.324');
    expect(screen.getByLabelText(/Tiempo total|Total time|Gesamtzeit/i)).toHaveValue('02:00.000');
    expect(screen.getByLabelText(/^Vueltas$|^Laps$|^Runden$/i)).toHaveValue(10);
  });

  test('tiempo total demasiado bajo avisa pero no impide guardar', async () => {
    mockLists();
    api.post.mockResolvedValue({
      data: { id: 't-low', session_type: 'TRAINING', best_lap_time: '00:09.000', sync_meta: {} },
    });
    renderSession();
    await goToCaptureFromWizard();
    fillCaptureTimes({ best: '09000', total: '020000', laps: '3', lane: '1' });

    expect(screen.getByText(/menor que el mínimo|below the minimum|liegt unter dem Minimum/i)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('session-save'));
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledTimes(1);
    });
    await screen.findByText(/Sesión guardada|Session saved|Session gespeichert/i);
  });

  test('el resumen muestra PB de circuito, contexto de 30 días y sesión anterior', async () => {
    mockLists({
      timings: [
        savedTimingResponse(),
        {
          id: 't-prev',
          circuit_id: 'cir-1',
          lane: '1',
          best_lap_time: '00:11.500',
          best_lap_timestamp: 11.5,
          timing_date: '2026-09-10',
          created_at: '2026-09-10T10:00:00.000Z',
          session_type: 'TRAINING',
        },
      ],
    });
    renderSession();
    await saveTrainingSession();

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/vehicles/veh-1/timings');
    });
    expect(screen.getByTestId('session-summary-best')).toHaveTextContent('00:11.324');
    expect(screen.getByTestId('session-summary-circuit-pb')).toHaveTextContent(/00:11\.500/);
    expect(screen.getByTestId('session-summary-circuit-pb')).toHaveTextContent(/más rápido|faster|schneller/);
    expect(screen.getByTestId('session-summary-month-pb')).toHaveTextContent(/00:11\.500/);
    expect(screen.getByTestId('session-summary-last')).toHaveTextContent(/00:11\.500/);
    expect(screen.getByTestId('session-another').compareDocumentPosition(
      screen.getByTestId('session-change-car'),
    ) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test('los atajos del resumen usan los ids de circuito y vehículo guardados', async () => {
    mockLists();
    renderSession();
    await saveTrainingSession();

    const shortcuts = screen.getByTestId('session-summary-shortcuts');
    expect(shortcuts.compareDocumentPosition(screen.getByTestId('session-summary-comparisons'))
      & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    expect(screen.getByTestId('session-another')).toBeInTheDocument();
    expect(screen.getByTestId('session-change-car')).toBeInTheDocument();

    const circuitLink = screen.getByTestId('session-shortcut-circuit');
    expect(circuitLink).toHaveAttribute('href', '/timings?circuit_id=cir-1');
    expect(circuitLink).toHaveTextContent(/Historial de este circuito|History for this circuit|Historie dieser Strecke/);

    const vehicleLink = screen.getByTestId('session-shortcut-vehicle');
    expect(vehicleLink).toHaveAttribute('href', '/vehicles/veh-1?tab=timings');
    expect(vehicleLink).toHaveTextContent(/Ficha del coche|Car sheet|Fahrzeugakte/);

    const vehicleCircuitLink = screen.getByTestId('session-shortcut-vehicle-circuit');
    expect(vehicleCircuitLink).toHaveAttribute('href', '/timings?circuit_id=cir-1&vehicle=veh-1');
    expect(vehicleCircuitLink).toHaveTextContent(
      /Tiempos de este coche en este circuito|This car.s times on this circuit|Zeiten dieses Autos auf dieser Strecke/,
    );
  });

  test('si el GET de historial falla, el resumen sigue con el PB de sync_meta', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/circuits') return Promise.resolve({ data: [circuit] });
      if (url === '/vehicles') return Promise.resolve({ data: { vehicles: [vehicle] } });
      if (typeof url === 'string' && /\/vehicles\/[^/]+\/timings$/.test(url)) {
        return Promise.reject(new Error('network'));
      }
      return Promise.reject(new Error(`unexpected GET ${url}`));
    });
    renderSession();
    await saveTrainingSession();

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/vehicles/veh-1/timings');
    });
    expect(screen.getByTestId('session-step-summary')).toBeInTheDocument();
    expect(screen.getByTestId('session-summary-circuit-pb')).toHaveTextContent(/00:11\.500/);
    expect(screen.getByTestId('session-summary-circuit-pb')).toHaveTextContent(/más rápido|faster|schneller/);
    expect(screen.queryByTestId('session-summary-month-pb')).not.toBeInTheDocument();
  });

  test('sin historial en el circuito muestra empty state', async () => {
    mockLists({ timings: [savedTimingResponse()] });
    renderSession();
    await saveTrainingSession();

    await waitFor(() => {
      expect(screen.getByTestId('session-summary-circuit-pb')).toHaveTextContent(
        /Primera sesión en este circuito|First session on this circuit|Erste Session auf dieser Strecke/,
      );
    });
    expect(screen.queryByTestId('session-summary-month-pb')).not.toBeInTheDocument();
  });

  test('muestra consistencia y peor vuelta si el POST las devuelve', async () => {
    mockLists();
    api.post.mockResolvedValue({
      data: savedTimingResponse({ consistency_score: 4.2, worst_lap_timestamp: 12.1 }),
    });
    renderSession();
    await goToCaptureFromWizard();
    fillCaptureTimes();
    fireEvent.click(screen.getByTestId('session-save'));

    expect(await screen.findByTestId('session-summary-consistency')).toHaveTextContent('4.20%');
    expect(screen.getByTestId('session-summary-worst')).toHaveTextContent(/00:12\.100/);
  });

  test('la sección de vueltas individuales está plegada y no alarga el camino feliz', async () => {
    mockLists();
    renderSession();
    await goToCaptureFromWizard();

    expect(screen.getByTestId('session-lap-times-toggle')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('session-lap-times')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Vuelta 1$|^Lap 1$|^Runde 1$/i)).not.toBeInTheDocument();
  });

  test('vueltas individuales opcionales se envían en el POST cuando hay ≥3 válidas', async () => {
    mockLists();
    api.post.mockResolvedValue({
      data: savedTimingResponse({
        id: 't-laps',
        best_lap_time: '00:09.000',
        best_lap_timestamp: 9,
        consistency_score: 4.2,
        worst_lap_timestamp: 11,
        sync_meta: {},
      }),
    });
    renderSession();
    await goToCaptureFromWizard();
    fillCaptureTimes({ best: '09000', total: '030000', laps: '3', lane: '1' });

    fireEvent.click(screen.getByTestId('session-lap-times-toggle'));
    await screen.findByTestId('session-lap-times');
    expect(screen.getByLabelText(/^Vuelta 1$|^Lap 1$|^Runde 1$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Vuelta 3$|^Lap 3$|^Runde 3$/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Vuelta 4$|^Lap 4$|^Runde 4$/i)).not.toBeInTheDocument();

    const fillLap = (label, digits) => {
      const el = screen.getByLabelText(label);
      fireEvent.change(el, { target: { value: digits } });
      fireEvent.blur(el);
    };
    fillLap(/^Vuelta 1$|^Lap 1$|^Runde 1$/i, '09000');
    fillLap(/^Vuelta 2$|^Lap 2$|^Runde 2$/i, '10000');
    fillLap(/^Vuelta 3$|^Lap 3$|^Runde 3$/i, '11000');

    fireEvent.click(screen.getByTestId('session-save'));
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledTimes(1);
    });
    const body = api.post.mock.calls[0][1];
    expect(body.session_type).toBe('TRAINING');
    expect(body.lap_times).toHaveLength(3);
    expect(body.lap_times[0]).toMatchObject({ lap_number: 1, time_seconds: 9, time_text: '00:09.000' });
    expect(body.lap_times[1].time_seconds).toBe(10);
    expect(body.lap_times[2].lap_number).toBe(3);
    await screen.findByText(/Sesión guardada|Session saved|Session gespeichert/i);
    expect(screen.getByTestId('session-summary-consistency')).toHaveTextContent('4.20%');
    expect(screen.getByTestId('session-summary-worst')).toHaveTextContent(/00:11\.000/);
  });

  test('rellenar vueltas individuales primero deriva mejor, total y número de vueltas', async () => {
    mockLists();
    renderSession();
    await goToCaptureFromWizard();

    fireEvent.click(screen.getByTestId('session-lap-times-toggle'));
    await screen.findByTestId('session-lap-times');
    const fillLap = (label, digits) => {
      const el = screen.getByLabelText(label);
      fireEvent.change(el, { target: { value: digits } });
      fireEvent.blur(el);
    };
    fillLap(/^Vuelta 1$|^Lap 1$|^Runde 1$/i, '09000');
    fillLap(/^Vuelta 2$|^Lap 2$|^Runde 2$/i, '10000');
    fillLap(/^Vuelta 3$|^Lap 3$|^Runde 3$/i, '11000');

    expect(screen.getByLabelText(/Mejor vuelta|Best lap|Beste Runde/i)).toHaveValue('00:09.000');
    expect(screen.getByLabelText(/Tiempo total|Total time|Gesamtzeit/i)).toHaveValue('00:30.000');
    expect(screen.getByLabelText(/^Vueltas$|^Laps$|^Runden$/i)).toHaveValue(3);
    expect(screen.getByLabelText(/Promedio|Average|Schnitt/i)).toHaveValue('00:10.000');
  });
});
