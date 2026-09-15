jest.mock('../lib/supabase', () => ({ supabase: { auth: { updateUser: jest.fn() } } }));
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: null, refreshUser: jest.fn() }),
}));
jest.mock('../lib/axios', () => ({
  __esModule: true,
  default: { get: jest.fn() },
  invalidateApiAccessTokenCache: jest.fn(),
}));

import { ONBOARDING_STEPS, getOnboardingPrimaryStep } from '../hooks/useOnboardingStatus';
import { primerosPasos } from '../content/helpGuide';

describe('primer tiempo → /session', () => {
  test('el checklist de onboarding apunta a modo sesión', () => {
    expect(ONBOARDING_STEPS.find((step) => step.id === 'timing')?.path).toBe('/session');
  });

  test('con vehículo y sin tiempos el paso primario es timing aunque falte circuito', () => {
    const withVehicle = ONBOARDING_STEPS.map((step) => ({
      ...step,
      done: step.id === 'vehicle',
    }));
    const noneDone = ONBOARDING_STEPS.map((step) => ({ ...step, done: false }));
    expect(getOnboardingPrimaryStep(withVehicle, { hasVehicle: true, hasTiming: false })?.id).toBe('timing');
    expect(getOnboardingPrimaryStep(noneDone, { hasVehicle: false, hasTiming: false })?.id).toBe('vehicle');
  });

  test('la guía de ayuda enlaza Nueva sesión', () => {
    const step = primerosPasos.steps.find((s) => s.linkTo === '/session');
    expect(step).toBeTruthy();
    expect(step.linkLabel).toMatch(/sesión|session/i);
  });
});
