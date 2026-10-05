'use strict';

const {
  parseCatalogTechSpecsFromBody,
  parseOptionalNonNegativeNumber,
  parseOptionalNullableBool,
} = require('../../lib/catalogTechSpecs');

describe('catalogTechSpecs', () => {
  test('create sin campos deja todo a null', () => {
    const parsed = parseCatalogTechSpecsFromBody({}, null);
    expect(parsed.ok).toBe(true);
    expect(parsed.specs.spec_scale).toBeNull();
    expect(parsed.specs.spec_length_mm).toBeNull();
    expect(parsed.specs.spec_magnet).toBeNull();
  });

  test('update sin campos conserva los existentes', () => {
    const parsed = parseCatalogTechSpecsFromBody(
      { reference: 'AV1' },
      { spec_scale: '1:32', spec_magnet: true, spec_length_mm: 145 },
    );
    expect(parsed.ok).toBe(true);
    expect(parsed.specs.spec_scale).toBe('1:32');
    expect(parsed.specs.spec_magnet).toBe(true);
    expect(parsed.specs.spec_length_mm).toBe(145);
  });

  test('campo vacío borra el valor', () => {
    const parsed = parseCatalogTechSpecsFromBody(
      { spec_scale: '  ', spec_magnet: '', spec_length_mm: '' },
      { spec_scale: '1:32', spec_magnet: true, spec_length_mm: 145 },
    );
    expect(parsed.ok).toBe(true);
    expect(parsed.specs.spec_scale).toBeNull();
    expect(parsed.specs.spec_magnet).toBeNull();
    expect(parsed.specs.spec_length_mm).toBeNull();
  });

  test('parsea números, imán y texto', () => {
    const parsed = parseCatalogTechSpecsFromBody({
      spec_scale: '1:32',
      spec_body: 'Plastic',
      spec_length_mm: '145,5',
      spec_magnet: 'no',
      spec_motor: 'S-Can 18,000rpm',
      spec_pinion_gear: '9/27',
      spec_lights: 'Front & Rear',
    });
    expect(parsed.ok).toBe(true);
    expect(parsed.specs.spec_scale).toBe('1:32');
    expect(parsed.specs.spec_length_mm).toBe(145.5);
    expect(parsed.specs.spec_magnet).toBe(false);
    expect(parsed.specs.spec_motor).toBe('S-Can 18,000rpm');
  });

  test('rechaza número negativo', () => {
    const parsed = parseOptionalNonNegativeNumber('-1', 'spec_weight_g');
    expect(parsed.ok).toBe(false);
  });

  test('rechaza imán inválido', () => {
    const parsed = parseOptionalNullableBool('maybe');
    expect(parsed.ok).toBe(false);
  });

  test('texto demasiado largo', () => {
    const parsed = parseCatalogTechSpecsFromBody({ spec_scale: 'x'.repeat(40) });
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toMatch(/spec_scale/);
  });
});
