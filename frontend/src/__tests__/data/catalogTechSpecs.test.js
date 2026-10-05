import { emptyTechSpecForm, hasCatalogTechSpecs, validateTechSpecForm } from '../../data/catalogTechSpecs';

describe('catalogTechSpecs helpers', () => {
  test('hasCatalogTechSpecs ignora tracción y motor_position', () => {
    expect(hasCatalogTechSpecs({ traction: 'Trasera', motor_position: 'inline' })).toBe(false);
    expect(hasCatalogTechSpecs({ spec_scale: '1:32' })).toBe(true);
    expect(hasCatalogTechSpecs({ spec_color: 'Black' })).toBe(true);
    expect(hasCatalogTechSpecs({ spec_system: 'Analog' })).toBe(true);
    expect(hasCatalogTechSpecs({ spec_front_axle_width_mm: 52 })).toBe(true);
    expect(hasCatalogTechSpecs({ spec_magnet: false })).toBe(true);
  });

  test('validateTechSpecForm acepta vacío y rechaza negativos', () => {
    expect(validateTechSpecForm(emptyTechSpecForm())).toBeNull();
    expect(validateTechSpecForm({ ...emptyTechSpecForm(), spec_weight_g: '12.5' })).toBeNull();
    expect(validateTechSpecForm({ ...emptyTechSpecForm(), spec_front_axle_width_mm: '52' })).toBeNull();
    expect(validateTechSpecForm({ ...emptyTechSpecForm(), spec_length_mm: '-1' })).toBe('lengthMm');
    expect(validateTechSpecForm({ ...emptyTechSpecForm(), spec_rear_axle_width_mm: '-1' })).toBe(
      'rearAxleWidthMm',
    );
  });
});
