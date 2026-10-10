import {
  CATALOG_TECH_SPEC_AXLE_LENGTH_PAIR,
  CATALOG_TECH_SPEC_KEYS,
  CATALOG_TECH_SPEC_NUM_FIELDS,
  CATALOG_TECH_SPEC_SIBLING_PAIRS,
  CATALOG_TECH_SPEC_TRACK_PAIR,
  appendTechSpecsToFormData,
  emptyTechSpecForm,
  hasCatalogTechSpecs,
  labelCatalogTechSpecRim,
  mergeEmptyTechSpecsFromCatalog,
  resolveTechSpecAxleLengthMm,
  techSpecControlId,
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
    expect(hasCatalogTechSpecs({ spec_front_axle_length_mm: 52 })).toBe(true);
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

  test('pares delantero/trasero cubren ejes, ruedas, llantas, diámetros y luces (sin vía)', () => {
    expect(CATALOG_TECH_SPEC_TRACK_PAIR).toEqual(['spec_front_track_mm', 'spec_rear_track_mm']);
    expect(CATALOG_TECH_SPEC_AXLE_LENGTH_PAIR).toEqual([
      'spec_front_axle_length_mm',
      'spec_rear_axle_length_mm',
    ]);
    expect(CATALOG_TECH_SPEC_SIBLING_PAIRS).toEqual([
      CATALOG_TECH_SPEC_AXLE_LENGTH_PAIR,
      ['spec_front_wheels', 'spec_rear_wheels'],
      ['spec_front_rim', 'spec_rear_rim'],
      ['spec_front_rim_diameter_mm', 'spec_rear_rim_diameter_mm'],
      ['spec_front_lights', 'spec_rear_lights'],
    ]);
    expect(CATALOG_TECH_SPEC_SIBLING_PAIRS).not.toContainEqual(CATALOG_TECH_SPEC_TRACK_PAIR);
  });

  test('claves de specs son únicas y no incluyen axle_width', () => {
    expect(new Set(CATALOG_TECH_SPEC_KEYS).size).toBe(CATALOG_TECH_SPEC_KEYS.length);
    expect(CATALOG_TECH_SPEC_KEYS.join(',')).not.toContain('axle_width');
    expect(CATALOG_TECH_SPEC_NUM_FIELDS.map((f) => f.i18n).join(',')).not.toMatch(/Width|ancho/i);
    expect(techSpecControlId('catalog-tech', { i18n: 'frontTrackMm' })).toBe(
      'catalog-tech-frontTrackMm',
    );
    expect(techSpecControlId('catalog-tech', { i18n: 'frontAxleLengthMm' })).toBe(
      'catalog-tech-frontAxleLengthMm',
    );
  });

  test('techSpecFormFromRow mapea axle_width legado a length sin duplicar', () => {
    const form = techSpecFormFromRow({
      spec_front_axle_width_mm: 52,
      spec_rear_axle_width_mm: 53.5,
    });
    expect(form.spec_front_axle_length_mm).toBe('52');
    expect(form.spec_rear_axle_length_mm).toBe('53.5');
    expect(form.spec_front_axle_width_mm).toBeUndefined();
    const preferLength = techSpecFormFromRow({
      spec_front_axle_length_mm: 60,
      spec_front_axle_width_mm: 52,
    });
    expect(preferLength.spec_front_axle_length_mm).toBe('60');
  });

  test('techSpecFormFromRow usa vía legado si axle_length está vacío', () => {
    const form = techSpecFormFromRow({
      spec_front_track_mm: 50,
      spec_rear_track_mm: 52,
    });
    expect(form.spec_front_axle_length_mm).toBe('50');
    expect(form.spec_rear_axle_length_mm).toBe('52');
    const preferLength = techSpecFormFromRow({
      spec_front_axle_length_mm: 60,
      spec_front_track_mm: 50,
    });
    expect(preferLength.spec_front_axle_length_mm).toBe('60');
    expect(resolveTechSpecAxleLengthMm({ spec_front_track_mm: 50 }, 'front')).toBe(50);
    expect(resolveTechSpecAxleLengthMm({ spec_front_axle_length_mm: 60, spec_front_track_mm: 50 }, 'front')).toBe(60);
  });

  test('appendTechSpecsToFormData no envía columnas de vía', () => {
    const fd = new FormData();
    appendTechSpecsToFormData(fd, {
      ...emptyTechSpecForm(),
      spec_front_axle_length_mm: '52',
      spec_front_track_mm: '50',
    });
    expect(fd.get('spec_front_axle_length_mm')).toBe('52');
    expect(fd.get('spec_front_track_mm')).toBeNull();
    expect(fd.get('spec_rear_track_mm')).toBeNull();
  });

  test('validateTechSpecForm acepta vacío y rechaza negativos', () => {
    expect(validateTechSpecForm(emptyTechSpecForm())).toBeNull();
    expect(validateTechSpecForm({ ...emptyTechSpecForm(), spec_weight_g: '12.5' })).toBeNull();
    expect(validateTechSpecForm({ ...emptyTechSpecForm(), spec_front_axle_length_mm: '52' })).toBeNull();
    expect(validateTechSpecForm({ ...emptyTechSpecForm(), spec_front_rim_diameter_mm: '15.8' })).toBeNull();
    expect(validateTechSpecForm({ ...emptyTechSpecForm(), spec_length_mm: '-1' })).toBe('lengthMm');
    expect(validateTechSpecForm({ ...emptyTechSpecForm(), spec_rear_axle_length_mm: '-1' })).toBe(
      'rearAxleLengthMm',
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

  test('mergeEmptyTechSpecsFromCatalog no arrastra campos de identidad del formulario', () => {
    const prev = {
      ...emptyTechSpecForm(),
      model: '',
      reference: '',
      manufacturer: '',
      type: '',
      traction: '',
      motor_position: '',
      commercial_release_year: '',
      dorsal: '',
      anotaciones: 'nota del usuario',
    };
    const item = {
      model_name: 'Audi Quattro',
      reference: 'C123',
      manufacturer: 'Scalextric',
      vehicle_type: 'rally',
      traction: '4wd',
      motor_position: 'front',
      commercial_release_year: 2024,
      dorsal: '17',
      spec_body: 'Plastic',
    };
    const merged = mergeEmptyTechSpecsFromCatalog(prev, item);
    expect(merged.model).toBeUndefined();
    expect(merged.reference).toBeUndefined();
    expect(merged.manufacturer).toBeUndefined();
    expect(merged.anotaciones).toBeUndefined();
    expect(merged.spec_body).toBe('Plastic');

    // El prefill aplica identidad y luego mezcla las specs. Las specs no pueden
    // volver a dejar vacíos modelo, referencia, fabricante, año, tipo, tracción,
    // posición del motor ni dorsal.
    const next = {
      ...prev,
      model: item.model_name,
      manufacturer: item.manufacturer,
      type: item.vehicle_type,
      traction: item.traction,
      motor_position: item.motor_position,
      reference: item.reference,
      commercial_release_year: String(item.commercial_release_year),
      dorsal: item.dorsal,
      ...merged,
    };
    expect(next.model).toBe('Audi Quattro');
    expect(next.reference).toBe('C123');
    expect(next.manufacturer).toBe('Scalextric');
    expect(next.type).toBe('rally');
    expect(next.traction).toBe('4wd');
    expect(next.motor_position).toBe('front');
    expect(next.commercial_release_year).toBe('2024');
    expect(next.dorsal).toBe('17');
    expect(next.anotaciones).toBe('nota del usuario');
    expect(next.spec_body).toBe('Plastic');
  });

  test('mergeEmptyTechSpecsFromCatalog rellena eje vacío desde vía de catálogo', () => {
    const current = emptyTechSpecForm();
    const merged = mergeEmptyTechSpecsFromCatalog(current, {
      spec_front_track_mm: 50,
      spec_rear_track_mm: 52,
    });
    expect(merged.spec_front_axle_length_mm).toBe('50');
    expect(merged.spec_rear_axle_length_mm).toBe('52');
    const kept = mergeEmptyTechSpecsFromCatalog(
      { ...emptyTechSpecForm(), spec_front_axle_length_mm: '61' },
      { spec_front_track_mm: 50, spec_front_axle_length_mm: 60 },
    );
    expect(kept.spec_front_axle_length_mm).toBe('61');
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
