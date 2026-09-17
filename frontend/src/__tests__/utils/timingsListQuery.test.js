import { parseTimingsListFilterFromSearch } from '../../utils/timingsListQuery';

describe('parseTimingsListFilterFromSearch', () => {
  test('lee circuit_id y vehicle del query existente del listado', () => {
    expect(parseTimingsListFilterFromSearch('circuit_id=cir-1&vehicle=veh-1')).toEqual({
      circuit_id: 'cir-1',
      vehicle: 'veh-1',
    });
  });

  test('acepta vehicle_id como alias de vehicle', () => {
    expect(
      parseTimingsListFilterFromSearch(new URLSearchParams('circuit_id=cir-9&vehicle_id=veh-9')),
    ).toEqual({
      circuit_id: 'cir-9',
      vehicle: 'veh-9',
    });
  });

  test('sin query deja los filtros vacíos', () => {
    expect(parseTimingsListFilterFromSearch('')).toEqual({
      circuit_id: '',
      vehicle: '',
    });
  });
});
