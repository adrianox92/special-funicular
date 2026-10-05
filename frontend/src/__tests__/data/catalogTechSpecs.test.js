import {
  CATALOG_TECH_SPEC_SIBLING_PAIRS,
  emptyTechSpecForm,
  hasCatalogTechSpecs,
  labelCatalogTechSpecRim,
  mergeEmptyTechSpecsFromCatalog,
  techSpecFormFromRow,
  validateTechSpecForm,
  VEHICLE_FORM_OMIT_TECH_SPEC_KEYS,
} from '../../data/catalogTechSpecs';

describe('catalogTechSpecs helpers', () => {
  test('hasCatalogTechSpecs ignora tracción y motor_position', () => {
    expect(hasCatalogTechSpecs({ traction: 'Trasera', motor_position: 'inline' })).toBe(false);
    expect(hasCatalogTechSpecs({ spec_scale: '1:32' })).toBe(true);
    expect(hasCatalogTechSpecs({ spec_color: 'Black' })).toBe(true);
    expect(hasCatalogTechSpecs({ spec_system: 'analog' })).toBe(true);
    expect(hasCatalogTechSpecs({ spec_front_axle_width_mm: 52 })).toBe(true);
    expect(hasCatalogTechSpecs({ spec_magnet: false })).toBe(true);
    expect(hasCatalogTechSpecs({ spec_front_lights: true })).toBe(true);
    expect(hasCatalogTechSpecs({ spec_rear_lights: false })).toBe(false);
    expect(hasCatalogTechSpecs({ spec_front_rim: 'plastic' })).toBe(true);
    expect(hasCatalogTechSpecs({ spec_rear_rim: 'aluminum' })).toBe(true);
    expect(hasCatalogTechSpecs({ spec_front_rim_diameter_mm: 15.8 })).toBe(true);
    expect(hasCatalogTechSpecs({ spec_rear_rim_diameter_mm: 16.5 })).toBe(true);
  });

  test('techSpecFormFromRow solo acepta claves de llanta conocidas', () => {
    const form = techSpecFormFromRow({ spec_front_rim: 'plastic', spec_rear_rim: 'carbon' });
    expect(form.spec_front_rim).toBe('plastic');
    expect(form.spec_rear_rim).toBe('');
  });

  test('labelCatalogTechSpecRim traduce claves', () => {
    const t = (key) =>
      ({
        'techSpecs.rimValues.plastic': 'Plástico',
        'techSpecs.rimValues.aluminum': 'Aluminio',
        'techSpecs.rimValues.magnesium': 'Magnesio',
      })[key];
    expect(labelCatalogTechSpecRim('aluminum', t)).toBe('Aluminio');
    expect(labelCatalogTechSpecRim('', t)).toBeNull();
  });

  test('pares delantero/trasero cubren vías, ejes, ruedas, llantas, diámetros y luces', () => {
    expect(CATALOG_TECH_SPEC_SIBLING_PAIRS).toEqual([
      ['spec_front_track_mm', 'spec_rear_track_mm'],
      ['spec_front_axle_width_mm', 'spec_rear_axle_width_mm'],
      ['spec_front_wheels', 'spec_rear_wheels'],
      ['spec_front_rim', 'spec_rear_rim'],
      ['spec_front_rim_diameter_mm', 'spec_rear_rim_diameter_mm'],
      ['spec_front_lights', 'spec_rear_lights'],
    ]);
  });

  test('validateTechSpecForm acepta vacío y rechaza negativos', () => {
    expect(validateTechSpecForm(emptyTechSpecForm())).toBeNull();
    expect(validateTechSpecForm({ ...emptyTechSpecForm(), spec_weight_g: '12.5' })).toBeNull();
    expect(validateTechSpecForm({ ...emptyTechSpecForm(), spec_front_axle_width_mm: '52' })).toBeNull();
    expect(validateTechSpecForm({ ...emptyTechSpecForm(), spec_front_rim_diameter_mm: '15.8' })).toBeNull();
    expect(validateTechSpecForm({ ...emptyTechSpecForm(), spec_length_mm: '-1' })).toBe('lengthMm');
    expect(validateTechSpecForm({ ...emptyTechSpecForm(), spec_rear_axle_width_mm: '-1' })).toBe(
      'rearAxleWidthMm',
    );
    expect(validateTechSpecForm({ ...emptyTechSpecForm(), spec_rear_rim_diameter_mm: '-1' })).toBe(
      'rearRimDiameterMm',
    );
  });

  test('mergeEmptyTechSpecsFromCatalog solo rellena huecos', () => {
    const current = {
      ...emptyTechSpecForm(),
      spec_scale: '1:24',
      spec_magnet: 'false',
    };
    const merged = mergeEmptyTechSpecsFromCatalog(current, {
      spec_scale: '1:32',
      spec_body: 'Plastic',
      spec_magnet: true,
      spec_front_lights: true,
      spec_front_rim: 'aluminum',
      spec_front_rim_diameter_mm: 15.8,
    });
    expect(merged.spec_scale).toBe('1:24');
    expect(merged.spec_magnet).toBe('false');
    expect(merged.spec_body).toBe('Plastic');
    expect(merged.spec_front_lights).toBe(true);
    expect(merged.spec_front_rim).toBe('aluminum');
    expect(merged.spec_front_rim_diameter_mm).toBe('15.8');
  });

  test('el formulario de vehículo omite motor, piñón y ruedas (componentes montados)', () => {
    expect(VEHICLE_FORM_OMIT_TECH_SPEC_KEYS).toEqual([
      'spec_motor',
      'spec_pinion_gear',
      'spec_front_wheels',
      'spec_rear_wheels',
    ]);
  });
});
