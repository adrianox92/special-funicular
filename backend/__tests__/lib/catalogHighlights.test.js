'use strict';

const {
  fetchCatalogCompleteHighlights,
  clearCatalogHighlightCache,
} = require('../../lib/catalogHighlights');

const COMPLETE = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  reference: 'C1',
  manufacturer_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  manufacturer: 'Scalextric',
  model_name: 'Audi',
  vehicle_type: 'Turismo',
  traction: '4x4',
  motor_position: 'longitudinal',
  commercial_release_year: 2020,
  image_url: 'https://img.example/a.webp',
};

describe('fetchCatalogCompleteHighlights', () => {
  beforeEach(() => {
    clearCatalogHighlightCache();
  });

  it('pide una sola vez catalog_public_highlights y descarta filas incompletas', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: [COMPLETE, { ...COMPLETE, id: 'incomplete', model_name: '' }],
      error: null,
    });

    const first = await fetchCatalogCompleteHighlights({ rpc });
    const second = await fetchCatalogCompleteHighlights({ rpc });

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('catalog_public_highlights');
    expect(first).toEqual([COMPLETE]);
    expect(second).toEqual(first);
  });

  it('force vuelve a consultar', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: [COMPLETE], error: null });
    await fetchCatalogCompleteHighlights({ rpc });
    await fetchCatalogCompleteHighlights({ rpc }, { force: true });
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});
