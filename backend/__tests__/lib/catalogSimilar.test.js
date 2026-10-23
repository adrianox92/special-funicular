const {
  VIEW,
  SIMILAR_SELECT,
  escapeIlikeExact,
  finalizeSimilarRows,
  fetchCatalogSimilar,
} = require('../../lib/catalogSimilar');

const ITEM = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  model_name: 'Porsche 911 GT3',
  vehicle_type: 'GT',
  manufacturer_id: 'brand-scalextric',
};

function mockSupabase(result) {
  const calls = [];
  const builder = {
    select(cols) {
      calls.push(['select', cols]);
      return this;
    },
    eq(col, val) {
      calls.push(['eq', col, val]);
      return this;
    },
    ilike(col, val) {
      calls.push(['ilike', col, val]);
      return this;
    },
    neq(col, val) {
      calls.push(['neq', col, val]);
      return this;
    },
    order(col, opts) {
      calls.push(['order', col, opts]);
      return this;
    },
    limit(n) {
      calls.push(['limit', n]);
      return this;
    },
    then(resolve, reject) {
      return Promise.resolve(result).then(resolve, reject);
    },
  };
  return {
    calls,
    supabase: {
      from(table) {
        calls.push(['from', table]);
        return builder;
      },
    },
  };
}

function row(id) {
  return { id, model_name: 'Porsche 911 GT3', vehicle_type: 'GT', manufacturer: 'Ninco' };
}

describe('catalogSimilar', () => {
  test('model_name se recorta y los comodines ILIKE se escapan', () => {
    expect(escapeIlikeExact('  Porsche 911 GT3  ')).toBe('  Porsche 911 GT3  ');
    expect(escapeIlikeExact('A_B%C\\D')).toBe('A\\_B\\%C\\\\D');
    expect(escapeIlikeExact('Porsche 911')).not.toContain('%');
  });

  test('no consulta si faltan model_name o vehicle_type', async () => {
    const blankName = mockSupabase({ data: [], error: null });
    await expect(
      fetchCatalogSimilar(blankName.supabase, { ...ITEM, model_name: '   ' }),
    ).resolves.toEqual([]);
    expect(blankName.calls).toEqual([]);

    const blankType = mockSupabase({ data: [], error: null });
    await expect(
      fetchCatalogSimilar(blankType.supabase, { ...ITEM, vehicle_type: null }),
    ).resolves.toEqual([]);
    expect(blankType.calls).toEqual([]);
  });

  test('filtra tipo exacto y modelo sin comodines, sin marca, máximo 4', async () => {
    const { supabase, calls } = mockSupabase({
      data: [row('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), row('cccccccc-cccc-4ccc-8ccc-cccccccccccc')],
      error: null,
    });

    const similar = await fetchCatalogSimilar(supabase, {
      ...ITEM,
      model_name: '  Porsche 911 GT3  ',
    });

    expect(similar).toHaveLength(2);
    expect(calls[0]).toEqual(['from', VIEW]);
    expect(calls).toContainEqual(['select', SIMILAR_SELECT]);
    expect(calls).toContainEqual(['eq', 'vehicle_type', 'GT']);
    expect(calls).toContainEqual(['ilike', 'model_name', 'Porsche 911 GT3']);
    expect(calls).toContainEqual(['neq', 'id', ITEM.id]);
    expect(calls).toContainEqual([
      'order',
      'rating_count',
      { ascending: false, nullsFirst: false },
    ]);
    expect(calls).toContainEqual([
      'order',
      'manufacturer',
      { ascending: true, nullsFirst: false },
    ]);
    expect(calls).toContainEqual(['order', 'reference', { ascending: true }]);
    expect(calls).toContainEqual(['limit', 4]);
    expect(
      calls.some(
        (call) =>
          (call[0] === 'eq' || call[0] === 'ilike') &&
          (call[1] === 'manufacturer_id' || call[1] === 'manufacturer'),
      ),
    ).toBe(false);
  });

  test('devuelve [] si hay menos de 2 y capa a 4', () => {
    expect(finalizeSimilarRows([row('b')], ITEM.id)).toEqual([]);
    expect(finalizeSimilarRows([], ITEM.id)).toEqual([]);
    const five = ['b', 'c', 'd', 'e', 'f'].map(row);
    expect(finalizeSimilarRows(five, ITEM.id).map((item) => item.id)).toEqual(['b', 'c', 'd', 'e']);
    expect(
      finalizeSimilarRows([row(ITEM.id), row('b'), row('c')], ITEM.id).map((item) => item.id),
    ).toEqual(['b', 'c']);
  });

  test('la query con un solo resultado no publica el bloque', async () => {
    const { supabase } = mockSupabase({ data: [row('b')], error: null });
    await expect(fetchCatalogSimilar(supabase, ITEM)).resolves.toEqual([]);
  });

  test('con car_make y car_model no filtra por nombre completo ni por tipo', async () => {
    const { supabase, calls } = mockSupabase({
      data: [row('b'), row('c')],
      error: null,
    });

    await fetchCatalogSimilar(supabase, {
      ...ITEM,
      car_make: 'Toyota',
      car_model: ' Yaris ',
      vehicle_type: 'Rally',
    });

    expect(calls).toContainEqual(['ilike', 'car_make', 'Toyota']);
    expect(calls).toContainEqual(['ilike', 'car_model', 'Yaris']);
    expect(calls.some((call) => call[0] === 'eq' && call[1] === 'vehicle_type')).toBe(false);
    expect(calls.some((call) => call[1] === 'model_name')).toBe(false);
  });

  test('un error de la query se propaga', async () => {
    const { supabase } = mockSupabase({ data: null, error: { message: 'boom' } });
    await expect(fetchCatalogSimilar(supabase, ITEM)).rejects.toMatchObject({ message: 'boom' });
  });
});
