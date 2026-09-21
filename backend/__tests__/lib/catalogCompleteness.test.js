const {
  CATALOG_WEIGHTED_MISSING_OR,
  catalogItemIsWeightedComplete,
  computeCatalogDashboardStats,
  aggregateCompletenessByManufacturerId,
  applyCatalogItemsMissingFilter,
} = require('../../lib/catalogCompleteness');

const completeRow = {
  model_name: 'GT3',
  vehicle_type: 'GT',
  traction: '4x2',
  motor_position: 'inline',
  image_url: 'https://example.com/car.jpg',
  commercial_release_year: 2020,
  dorsal: '17',
};

function createQuery() {
  const query = {
    or: jest.fn(function or() {
      return query;
    }),
  };
  return query;
}

describe('catalogCompleteness', () => {
  test('ítem con los 6 campos ponderados está completo (dorsal no cuenta)', () => {
    expect(catalogItemIsWeightedComplete(completeRow)).toBe(true);
    expect(catalogItemIsWeightedComplete({ ...completeRow, dorsal: '' })).toBe(true);
  });

  test('falta de imagen deja el ítem incompleto', () => {
    expect(catalogItemIsWeightedComplete({ ...completeRow, image_url: '' })).toBe(false);
  });

  test('computeCatalogDashboardStats pondera imagen 30% y el resto 14%', () => {
    const stats = computeCatalogDashboardStats([
      completeRow,
      { ...completeRow, image_url: null },
    ]);
    expect(stats.totalItems).toBe(2);
    expect(stats.fullyCompleteCount).toBe(1);
    expect(stats.incompleteCount).toBe(1);
    // (1.0 + 0.7) / 2 = 0.85 → 85%
    expect(stats.weightedCompletenessPercent).toBe(85);
    expect(stats.missing.withoutImage).toBe(1);
  });

  test('aggregateCompletenessByManufacturerId agrupa por marca e ignora sin id', () => {
    const brandA = '11111111-1111-4111-8111-111111111111';
    const brandB = '22222222-2222-4222-8222-222222222222';
    const map = aggregateCompletenessByManufacturerId([
      { ...completeRow, manufacturer_id: brandA },
      { ...completeRow, manufacturer_id: brandA, image_url: '' },
      { ...completeRow, manufacturer_id: brandB },
      { ...completeRow, manufacturer_id: null },
    ]);
    expect(map.get(brandA)).toEqual({
      catalog_items_count: 2,
      weighted_completeness_percent: 85,
      fully_complete_count: 1,
      incomplete_count: 1,
    });
    expect(map.get(brandB)).toEqual({
      catalog_items_count: 1,
      weighted_completeness_percent: 100,
      fully_complete_count: 1,
      incomplete_count: 0,
    });
    expect(map.size).toBe(2);
  });

  test('applyCatalogItemsMissingFilter weighted usa OR de los 6 campos ponderados', () => {
    const query = createQuery();
    applyCatalogItemsMissingFilter(query, 'weighted');
    expect(query.or).toHaveBeenCalledWith(CATALOG_WEIGHTED_MISSING_OR);
    expect(CATALOG_WEIGHTED_MISSING_OR).toContain('image_url.is.null');
    expect(CATALOG_WEIGHTED_MISSING_OR).toContain('model_name.is.null');
    expect(CATALOG_WEIGHTED_MISSING_OR).toContain('vehicle_type.is.null');
    expect(CATALOG_WEIGHTED_MISSING_OR).toContain('traction.is.null');
    expect(CATALOG_WEIGHTED_MISSING_OR).toContain('motor_position.is.null');
    expect(CATALOG_WEIGHTED_MISSING_OR).toContain('commercial_release_year.is.null');
    expect(CATALOG_WEIGHTED_MISSING_OR).not.toContain('dorsal');
  });

  test('applyCatalogItemsMissingFilter image mantiene el filtro existente', () => {
    const query = createQuery();
    applyCatalogItemsMissingFilter(query, 'image');
    expect(query.or).toHaveBeenCalledWith('image_url.is.null,image_url.eq.');
  });

  test('applyCatalogItemsMissingFilter vacío no toca el builder', () => {
    const query = createQuery();
    const result = applyCatalogItemsMissingFilter(query, '');
    expect(result).toBe(query);
    expect(query.or).not.toHaveBeenCalled();
  });
});
