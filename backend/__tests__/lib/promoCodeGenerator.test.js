const {
  generatePromoCode,
  normalizePromoCode,
  formatPromoCode,
} = require('../../lib/promoCodeGenerator');

describe('promoCodeGenerator', () => {
  it('generates codes in XXXX-XXXX-XXXX format', () => {
    const code = generatePromoCode();
    expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  });

  it('normalizes user input ignoring spaces and dashes', () => {
    expect(normalizePromoCode('abcd-efgh-ijkl')).toBe('ABCDEFGHIJKL');
    expect(normalizePromoCode(' ABCD EFGH IJKL ')).toBe('ABCDEFGHIJKL');
  });

  it('formats normalized codes with dashes', () => {
    expect(formatPromoCode('ABCDEFGHIJKL')).toBe('ABCD-EFGH-IJKL');
    expect(formatPromoCode('ABC')).toBeNull();
  });
});
