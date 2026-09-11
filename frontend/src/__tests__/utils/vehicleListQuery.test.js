import { appendVehicleFilterQueryParams, hasActiveVehicleFilters } from '../../utils/vehicleListQuery';

const empty = {
  model: '',
  manufacturer: '',
  type: '',
  modified: '',
  digital: '',
  scale: '',
  filterMuseo: false,
  filterTaller: false,
};

describe('vehicleListQuery', () => {
  test('sin filtros no añade params (listado y export coinciden)', () => {
    const params = appendVehicleFilterQueryParams(new URLSearchParams(), empty);
    expect(params.toString()).toBe('');
    expect(hasActiveVehicleFilters(empty)).toBe(false);
  });

  test('un filtro y varios filtros generan los mismos nombres que el API', () => {
    const single = appendVehicleFilterQueryParams(new URLSearchParams(), {
      ...empty,
      manufacturer: 'Ninco',
    });
    expect(single.get('manufacturer')).toBe('Ninco');
    expect([...single.keys()]).toEqual(['manufacturer']);

    const many = appendVehicleFilterQueryParams(new URLSearchParams(), {
      ...empty,
      model: 'Ferrari',
      type: 'GT',
      modified: 'Sí',
      digital: 'Digital',
      scale: '32',
      filterMuseo: true,
      filterTaller: true,
    });
    expect(Object.fromEntries(many)).toEqual({
      model: 'Ferrari',
      type: 'GT',
      modified: 'Sí',
      digital: 'Digital',
      filterMuseo: 'true',
      filterTaller: 'true',
      scale: '32',
    });
    expect(hasActiveVehicleFilters({ ...empty, filterMuseo: true })).toBe(true);
  });
});
