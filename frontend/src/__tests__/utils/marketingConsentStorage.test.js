import {
  stashPendingMarketingConsent,
  consumePendingMarketingConsent,
  peekPendingMarketingConsent,
  shouldWriteSignupOptIn,
} from '../../utils/marketingConsentStorage';

describe('marketingConsentStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('guarda y consume el opt-in pendiente', () => {
    stashPendingMarketingConsent(true);
    expect(peekPendingMarketingConsent()).toBe(true);
    expect(consumePendingMarketingConsent()).toBe(true);
    expect(consumePendingMarketingConsent()).toBeNull();
  });

  test('el rechazo pendiente se consume como false', () => {
    stashPendingMarketingConsent(false);
    expect(consumePendingMarketingConsent()).toBe(false);
  });

  test('no reescribe un consentimiento ya guardado o retirado', () => {
    expect(shouldWriteSignupOptIn(null, true, false)).toBe(true);
    expect(shouldWriteSignupOptIn({ updated_at: null }, true, false)).toBe(true);
    expect(
      shouldWriteSignupOptIn(
        { consented: false, updated_at: '2026-11-12T10:00:00.000Z' },
        true,
        true,
      ),
    ).toBe(false);
    expect(shouldWriteSignupOptIn(null, false, false)).toBe(false);
  });
});
