import { track } from '@vercel/analytics';
import {
  SESSION_EVENTS,
  buildSessionFunnelProps,
  trackEvent,
  trackSessionEvent,
} from '../../lib/analytics';

jest.mock('@vercel/analytics', () => ({
  track: jest.fn(),
}));

describe('analytics helper', () => {
  beforeEach(() => {
    track.mockReset();
  });

  test('SESSION_EVENTS keep the PRD snake_case names', () => {
    expect(SESSION_EVENTS).toEqual({
      MODE_OPENED: 'session_mode_opened',
      CIRCUIT_SELECTED: 'session_circuit_selected',
      CIRCUIT_CREATED: 'session_circuit_created',
      VEHICLE_SELECTED: 'session_vehicle_selected',
      TIMING_SAVED: 'session_timing_saved',
      ABANDONED: 'session_abandoned',
    });
  });

  test('trackEvent forwards name and flat properties to Vercel track', () => {
    trackEvent('session_timing_saved', { step: 'capture', lane_set: true });
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('session_timing_saved', {
      step: 'capture',
      lane_set: true,
    });
  });

  test('trackEvent omits the properties argument when none are valid', () => {
    trackEvent('session_mode_opened');
    expect(track).toHaveBeenCalledWith('session_mode_opened');
  });

  test('trackEvent no-ops on empty name and does not throw if track fails', () => {
    expect(() => trackEvent('')).not.toThrow();
    expect(track).not.toHaveBeenCalled();

    track.mockImplementation(() => {
      throw new Error('script missing');
    });
    expect(() => trackEvent('session_abandoned', { step: 'circuit' })).not.toThrow();
  });

  test('trackEvent drops nested / non-scalar values (no PII payloads)', () => {
    trackEvent('session_vehicle_selected', {
      step: 'vehicle',
      vehicle_name: { nested: 'Scalextric Ferrari' },
      email: ['user@example.com'],
      best_lap: undefined,
      ok: true,
    });
    expect(track).toHaveBeenCalledWith('session_vehicle_selected', {
      step: 'vehicle',
      ok: true,
    });
  });

  test('buildSessionFunnelProps only emits the allowed PII-free keys', () => {
    expect(
      buildSessionFunnelProps({
        step: 'capture',
        hasPriorCircuit: true,
        circuitCreated: false,
        laneSet: true,
        voltageSet: false,
        vehicleName: 'Ferrari F1',
        email: 'pilot@example.com',
        bestLapTime: '00:11.324',
      }),
    ).toEqual({
      step: 'capture',
      has_prior_circuit: true,
      circuit_created: false,
      lane_set: true,
      voltage_set: false,
    });
  });

  test('trackSessionEvent sends whitelisted funnel props under PRD event names', () => {
    trackSessionEvent(SESSION_EVENTS.ABANDONED, {
      step: 'vehicle',
      hasPriorCircuit: false,
      circuitCreated: true,
      vehicleName: 'should not appear',
    });
    expect(track).toHaveBeenCalledWith('session_abandoned', {
      step: 'vehicle',
      has_prior_circuit: false,
      circuit_created: true,
    });
  });
});
