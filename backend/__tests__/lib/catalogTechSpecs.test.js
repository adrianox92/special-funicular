'use strict';

const {
  CATALOG_TECH_SPEC_SELECT,
  parseCatalogTechSpecsFromBody,
  parseOptionalNonNegativeNumber,
  parseOptionalNullableBool,
} = require('../../lib/catalogTechSpecs');

describe('catalogTechSpecs', () => {
  test('select de detalle incluye sistema, luces, llantas y anchos de eje', () => {
    expect(CATALOG_TECH_SPEC_SELECT).toContain('spec_color');
    expect(CATALOG_TECH_SPEC_SELECT).toContain('spec_system');
    expect(CATALOG_TECH_SPEC_SELECT).toContain('spec_front_axle_width_mm');
    expect(CATALOG_TECH_SPEC_SELECT).toContain('spec_rear_axle_width_mm');
    expect(CATALOG_TECH_SPEC_SELECT).toContain('spec_front_lights');
    expect(CATALOG_TECH_SPEC_SELECT).toContain('spec_rear_lights');
    expect(CATALOG_TECH_SPEC_SELECT).toContain('spec_front_rim');
    expect(CATALOG_TECH_SPEC_SELECT).toContain('spec_rear_rim');
    expect(CATALOG_TECH_SPEC_SELECT).not.toContain('spec_lights');
    expect(CATALOG_TECH_SPEC_SELECT).not.toContain('spec_front_tyres');
    expect(CATALOG_TECH_SPEC_SELECT).not.toContain('spec_rear_tyres');
  });

  test('create sin campos deja todo a null', () => {
    const parsed = parseCatalogTechSpecsFromBody({}, null);
    expect(parsed.ok).toBe(true);
    expect(parsed.specs.spec_scale).toBeNull();
    expect(parsed.specs.spec_color).toBeNull();
    expect(parsed.specs.spec_system).toBeNull();
    expect(parsed.specs.spec_length_mm).toBeNull();
    expect(parsed.specs.spec_front_axle_width_mm).toBeNull();
    expect(parsed.specs.spec_rear_axle_width_mm).toBeNull();
    expect(parsed.specs.spec_magnet).toBeNull();
    expect(parsed.specs.spec_front_lights).toBeNull();
    expect(parsed.specs.spec_rear_lights).toBeNull();
    expect(parsed.specs.spec_front_rim).toBeNull();
    expect(parsed.specs.spec_rear_rim).toBeNull();
  });

  test('update sin campos conserva los existentes', () => {
    const parsed = parseCatalogTechSpecsFromBody(
      { reference: 'AV1' },
      {
        spec_scale: '1:32',
        spec_magnet: true,
        spec_length_mm: 145,
        spec_system: 'analog',
        spec_front_lights: true,
        spec_front_rim: 'plastic',
        spec_rear_rim: 'aluminum',
      },
    );
    expect(parsed.ok).toBe(true);
    expect(parsed.specs.spec_scale).toBe('1:32');
    expect(parsed.specs.spec_magnet).toBe(true);
    expect(parsed.specs.spec_length_mm).toBe(145);
    expect(parsed.specs.spec_system).toBe('analog');
    expect(parsed.specs.spec_front_lights).toBe(true);
    expect(parsed.specs.spec_front_rim).toBe('plastic');
    expect(parsed.specs.spec_rear_rim).toBe('aluminum');
  });

  test('campo vacío borra el valor', () => {
    const parsed = parseCatalogTechSpecsFromBody(
      {
        spec_scale: '  ',
        spec_magnet: '',
        spec_length_mm: '',
        spec_system: '',
        spec_front_lights: '',
        spec_front_rim: '',
        spec_rear_rim: '  ',
      },
      {
        spec_scale: '1:32',
        spec_magnet: true,
        spec_length_mm: 145,
        spec_system: 'digital',
        spec_front_lights: true,
        spec_front_rim: 'plastic',
        spec_rear_rim: 'magnesium',
      },
    );
    expect(parsed.ok).toBe(true);
    expect(parsed.specs.spec_scale).toBeNull();
    expect(parsed.specs.spec_magnet).toBeNull();
    expect(parsed.specs.spec_length_mm).toBeNull();
    expect(parsed.specs.spec_system).toBeNull();
    expect(parsed.specs.spec_front_lights).toBeNull();
    expect(parsed.specs.spec_front_rim).toBeNull();
    expect(parsed.specs.spec_rear_rim).toBeNull();
  });

  test('parsea números, imán, sistema, luces y llantas', () => {
    const parsed = parseCatalogTechSpecsFromBody({
      spec_scale: '1:32',
      spec_body: 'Plastic',
      spec_color: 'Black',
      spec_system: 'Analog',
      spec_length_mm: '145,5',
      spec_front_axle_width_mm: '52',
      spec_rear_axle_width_mm: '53,5',
      spec_magnet: 'no',
      spec_motor: 'S-Can 18,000rpm',
      spec_pinion_gear: '9/27',
      spec_front_lights: 'true',
      spec_rear_lights: 'false',
      spec_front_rim: 'Plástico',
      spec_rear_rim: 'aluminium',
    });
    expect(parsed.ok).toBe(true);
    expect(parsed.specs.spec_scale).toBe('1:32');
    expect(parsed.specs.spec_color).toBe('Black');
    expect(parsed.specs.spec_system).toBe('analog');
    expect(parsed.specs.spec_length_mm).toBe(145.5);
    expect(parsed.specs.spec_front_axle_width_mm).toBe(52);
    expect(parsed.specs.spec_rear_axle_width_mm).toBe(53.5);
    expect(parsed.specs.spec_magnet).toBe(false);
    expect(parsed.specs.spec_motor).toBe('S-Can 18,000rpm');
    expect(parsed.specs.spec_front_lights).toBe(true);
    expect(parsed.specs.spec_rear_lights).toBe(false);
    expect(parsed.specs.spec_front_rim).toBe('plastic');
    expect(parsed.specs.spec_rear_rim).toBe('aluminum');
  });

  test('acepta analógico con acento como analog', () => {
    const parsed = parseCatalogTechSpecsFromBody({ spec_system: 'Analógico' });
    expect(parsed.ok).toBe(true);
    expect(parsed.specs.spec_system).toBe('analog');
  });

  test('acepta códigos Slot.it PL/AL/Ma como llanta', () => {
    const parsed = parseCatalogTechSpecsFromBody({
      spec_front_rim: 'PL',
      spec_rear_rim: 'Ma',
    });
    expect(parsed.ok).toBe(true);
    expect(parsed.specs.spec_front_rim).toBe('plastic');
    expect(parsed.specs.spec_rear_rim).toBe('magnesium');
  });

  test('rechaza sistema inválido', () => {
    const parsed = parseCatalogTechSpecsFromBody({ spec_system: 'Digital Plug Ready' });
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toMatch(/spec_system/);
  });

  test('rechaza material de llanta inválido', () => {
    const parsed = parseCatalogTechSpecsFromBody({ spec_front_rim: 'carbon' });
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toMatch(/spec_front_rim/);
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
