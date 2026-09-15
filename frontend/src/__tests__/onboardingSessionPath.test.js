jest.mock('../lib/supabase', () => ({ supabase: { auth: { updateUser: jest.fn() } } }));
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: null, refreshUser: jest.fn() }),
}));
jest.mock('../lib/axios', () => ({
  __esModule: true,
  default: { get: jest.fn() },
  invalidateApiAccessTokenCache: jest.fn(),
}));

import { ONBOARDING_STEPS } from '../hooks/useOnboardingStatus';
import { primerosPasos } from '../content/helpGuide';

describe('primer tiempo → /session', () => {
  test('el checklist de onboarding apunta a modo sesión', () => {
    expect(ONBOARDING_STEPS.find((step) => step.id === 'timing')?.path).toBe('/session');
  });

  test('la guía de ayuda enlaza Nueva sesión', () => {
    const step = primerosPasos.steps.find((s) => s.linkTo === '/session');
    expect(step).toBeTruthy();
    expect(step.linkLabel).toMatch(/sesión|session/i);
  });
});
