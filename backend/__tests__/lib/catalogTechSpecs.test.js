'use strict';

const {
  CATALOG_TECH_SPEC_SELECT,
  parseCatalogTechSpecsFromBody,
  parseVehicleTechSpecsFromBody,
  fillEmptyTechSpecsFromCatalog,
  parseOptionalNonNegativeNumber,
  parseOptionalNullableBool,
} = require('../../lib/catalogTechSpecs');

describe('catalogTechSpecs', () => {
  test('select de detalle incluye sistema, luces, llantas y longitud de ejes', () => {
    expect(CATALOG_TECH_SPEC_SELECT).toContain('spec_color');
    expect(CATALOG_TECH_SPEC_SELECT).toContain('spec_system');
    expect(CATALOG_TECH_SPEC_SELECT).toContain('spec_front_axle_length_mm');
    expect(CATALOG_TECH_SPEC_SELECT).toContain('spec_rear_axle_length_mm');
    expect(CATALOG_TECH_SPEC_SELECT).toContain('spec_front_lights');
    expect(CATALOG_TECH_SPEC_SELECT).toContain('spec_rear_lights');
    expect(CATALOG_TECH_SPEC_SELECT).toContain('spec_front_rim');
    expect(CATALOG_TECH_SPEC_SELECT).toContain('spec_rear_rim');
    expect(CATALOG_TECH_SPEC_SELECT).toContain('spec_front_rim_diameter_mm');
    expect(CATALOG_TECH_SPEC_SELECT).toContain('spec_rear_rim_diameter_mm');
    expect(CATALOG_TECH_SPEC_SELECT).not.toContain('spec_lights');
    expect(CATALOG_TECH_SPEC_SELECT).not.toContain('spec_front_tyres');
    expect(CATALOG_TECH_SPEC_SELECT).not.toContain('spec_rear_tyres');
    expect(CATALOG_TECH_SPEC_SELECT).not.toContain('axle_width');
  });

  test('create sin campos deja todo a null', () => {
    const parsed = parseCatalogTechSpecsFromBody({}, null);
    expect(parsed.ok).toBe(true);
    expect(parsed.specs.spec_scale).toBeNull();
    expect(parsed.specs.spec_color).toBeNull();
    expect(parsed.specs.spec_system).toBeNull();
    expect(parsed.specs.spec_length_mm).toBeNull();
    expect(parsed.specs.spec_front_axle_length_mm).toBeNull();
    expect(parsed.specs.spec_rear_axle_length_mm).toBeNull();
    expect(parsed.specs.spec_magnet).toBeNull();
    expect(parsed.specs.spec_front_lights).toBeNull();
    expect(parsed.specs.spec_rear_lights).toBeNull();
    expect(parsed.specs.spec_front_rim).toBeNull();
    expect(parsed.specs.spec_rear_rim).toBeNull();
    expect(parsed.specs.spec_front_rim_diameter_mm).toBeNull();
    expect(parsed.specs.spec_rear_rim_diameter_mm).toBeNull();
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
        spec_front_rim_diameter_mm: 15.8,
        spec_rear_rim_diameter_mm: 16.5,
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
    expect(parsed.specs.spec_front_rim_diameter_mm).toBe(15.8);
    expect(parsed.specs.spec_rear_rim_diameter_mm).toBe(16.5);
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
        spec_front_rim_diameter_mm: '',
        spec_rear_rim_diameter_mm: '  ',
      },
      {
        spec_scale: '1:32',
        spec_magnet: true,
        spec_length_mm: 145,
        spec_system: 'digital',
        spec_front_lights: true,
        spec_front_rim: 'plastic',
        spec_rear_rim: 'magnesium',
        spec_front_rim_diameter_mm: 15.8,
        spec_rear_rim_diameter_mm: 16.5,
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
    expect(parsed.specs.spec_front_rim_diameter_mm).toBeNull();
    expect(parsed.specs.spec_rear_rim_diameter_mm).toBeNull();
  });

  test('parsea números, imán, sistema, luces y llantas', () => {
    const parsed = parseCatalogTechSpecsFromBody({
      spec_scale: '1:32',
      spec_body: 'Plastic',
      spec_color: 'Black',
      spec_system: 'Analog',
      spec_length_mm: '145,5',
      spec_front_axle_length_mm: '52',
      spec_rear_axle_length_mm: '53,5',
      spec_magnet: 'no',
      spec_motor: 'S-Can 18,000rpm',
      spec_pinion_gear: '9/27',
      spec_front_lights: 'true',
      spec_rear_lights: 'false',
      spec_front_rim: 'Plástico',
      spec_rear_rim: 'aluminium',
      spec_front_rim_diameter_mm: '15,8',
      spec_rear_rim_diameter_mm: '16.5',
    });
    expect(parsed.ok).toBe(true);
    expect(parsed.specs.spec_scale).toBe('1:32');
    expect(parsed.specs.spec_color).toBe('Black');
    expect(parsed.specs.spec_system).toBe('analog');
    expect(parsed.specs.spec_length_mm).toBe(145.5);
    expect(parsed.specs.spec_front_axle_length_mm).toBe(52);
    expect(parsed.specs.spec_rear_axle_length_mm).toBe(53.5);
    expect(parsed.specs.spec_magnet).toBe(false);
    expect(parsed.specs.spec_motor).toBe('S-Can 18,000rpm');
    expect(parsed.specs.spec_front_lights).toBe(true);
    expect(parsed.specs.spec_rear_lights).toBe(false);
    expect(parsed.specs.spec_front_rim).toBe('plastic');
    expect(parsed.specs.spec_rear_rim).toBe('aluminum');
    expect(parsed.specs.spec_front_rim_diameter_mm).toBe(15.8);
    expect(parsed.specs.spec_rear_rim_diameter_mm).toBe(16.5);
  });

  test('alias axle_width legado a axle_length sin duplicar columnas', () => {
    const fromLegacy = parseCatalogTechSpecsFromBody({
      spec_front_axle_width_mm: '52',
      spec_rear_axle_width_mm: '53,5',
    });
    expect(fromLegacy.ok).toBe(true);
    expect(fromLegacy.specs.spec_front_axle_length_mm).toBe(52);
    expect(fromLegacy.specs.spec_rear_axle_length_mm).toBe(53.5);
    expect(fromLegacy.specs).not.toHaveProperty('spec_front_axle_width_mm');

    const preferLength = parseCatalogTechSpecsFromBody({
      spec_front_axle_length_mm: '60',
      spec_front_axle_width_mm: '52',
    });
    expect(preferLength.ok).toBe(true);
    expect(preferLength.specs.spec_front_axle_length_mm).toBe(60);
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

  test('fillEmptyTechSpecsFromCatalog no pisa campos rellenos', () => {
    const filled = fillEmptyTechSpecsFromCatalog(
      {
        spec_scale: '1:24',
        spec_magnet: false,
        spec_body: null,
        spec_front_lights: false,
        spec_rear_rim: null,
        spec_front_rim_diameter_mm: 15.8,
      },
      {
        spec_scale: '1:32',
        spec_magnet: true,
        spec_body: 'Plastic',
        spec_front_lights: true,
        spec_rear_rim: 'magnesium',
        spec_front_rim_diameter_mm: 16.9,
        spec_rear_rim_diameter_mm: 17.2,
      },
    );
    expect(filled.spec_scale).toBe('1:24');
    expect(filled.spec_magnet).toBe(false);
    expect(filled.spec_body).toBe('Plastic');
    expect(filled.spec_front_lights).toBe(true);
    expect(filled.spec_rear_rim).toBe('magnesium');
    expect(filled.spec_front_rim_diameter_mm).toBe(15.8);
    expect(filled.spec_rear_rim_diameter_mm).toBe(17.2);
  });

  test('fillEmptyTechSpecsFromCatalog copia vía de catálogo a eje si axle_length está vacío', () => {
    const fromTrack = fillEmptyTechSpecsFromCatalog(
      { spec_front_axle_length_mm: null, spec_rear_axle_length_mm: null },
      { spec_front_track_mm: 50, spec_rear_track_mm: 52 },
    );
    expect(fromTrack.spec_front_axle_length_mm).toBe(50);
    expect(fromTrack.spec_rear_axle_length_mm).toBe(52);

    const keepAxle = fillEmptyTechSpecsFromCatalog(
      { spec_front_axle_length_mm: 61 },
      { spec_front_axle_length_mm: 60, spec_front_track_mm: 50 },
    );
    expect(keepAxle.spec_front_axle_length_mm).toBe(61);
  });

  test('parseVehicleTechSpecsFromBody rellena huecos solo si fillFromCatalog', () => {
    const catalogRow = {
      spec_scale: '1:32',
      spec_system: 'digital',
      spec_front_rim: 'plastic',
      spec_front_rim_diameter_mm: 15.8,
    };
    const withoutFill = parseVehicleTechSpecsFromBody({ spec_body: 'ABS' }, null, catalogRow, {
      fillFromCatalog: false,
    });
    expect(withoutFill.ok).toBe(true);
    expect(withoutFill.specs.spec_scale).toBeNull();
    expect(withoutFill.specs.spec_body).toBe('ABS');
    expect(withoutFill.specs.spec_front_rim_diameter_mm).toBeNull();

    const withFill = parseVehicleTechSpecsFromBody({ spec_body: 'ABS' }, null, catalogRow, {
      fillFromCatalog: true,
    });
    expect(withFill.ok).toBe(true);
    expect(withFill.specs.spec_body).toBe('ABS');
    expect(withFill.specs.spec_scale).toBe('1:32');
    expect(withFill.specs.spec_system).toBe('digital');
    expect(withFill.specs.spec_front_rim).toBe('plastic');
    expect(withFill.specs.spec_front_rim_diameter_mm).toBe(15.8);
  });
});
