const {
  applyVehicleListFilters,
  buildIlikeContainsPattern,
  buildPostgrestIlikeContainsFilter,
} = require('../../lib/vehicleListFilters');

function createQuery() {
  const query = {
    ilike: jest.fn(function ilike() {
      return query;
    }),
    eq: jest.fn(function eq() {
      return query;
    }),
    or: jest.fn(function or() {
      return query;
    }),
  };
  return query;
}

describe('applyVehicleListFilters', () => {
  test('sin filtros no toca el builder', () => {
    const query = createQuery();
    const result = applyVehicleListFilters(query, {});
    expect(result).toBe(query);
    expect(query.ilike).not.toHaveBeenCalled();
    expect(query.eq).not.toHaveBeenCalled();
    expect(query.or).not.toHaveBeenCalled();
  });

  test('un solo filtro (fabricante) usa or con ilike citado (PostgREST)', () => {
    const query = createQuery();
    applyVehicleListFilters(query, { manufacturer: 'Ninco' });
    expect(query.or).toHaveBeenCalledWith('manufacturer.ilike."%Ninco%"');
    expect(query.ilike).not.toHaveBeenCalled();
    expect(query.eq).not.toHaveBeenCalled();
  });

  test('marcas con punto (Slot.it) van citadas en or para no romper el parseo PostgREST', () => {
    const query = createQuery();
    applyVehicleListFilters(query, { manufacturer: 'Slot.it' });
    expect(query.or).toHaveBeenCalledWith('manufacturer.ilike."%Slot.it%"');
    expect(query.ilike).not.toHaveBeenCalled();
  });

  test('buildIlikeContainsPattern escapa comodines SQL y recorta (sin comillas SQL)', () => {
    expect(buildIlikeContainsPattern('  Ninco  ')).toBe('%Ninco%');
    expect(buildIlikeContainsPattern('N_R')).toBe('%N\\_R%');
    expect(buildIlikeContainsPattern('100%')).toBe('%100\\%%');
    expect(buildIlikeContainsPattern('   ')).toBeNull();
    expect(buildIlikeContainsPattern('')).toBeNull();
    expect(buildPostgrestIlikeContainsFilter('manufacturer', 'Slot.it')).toBe(
      'manufacturer.ilike."%Slot.it%"',
    );
  });

  test('museo y taller juntos usan OR', () => {
    const query = createQuery();
    applyVehicleListFilters(query, { filterMuseo: 'true', filterTaller: 'true' });
    expect(query.or).toHaveBeenCalledWith('museo.eq.true,taller.eq.true');
    expect(query.eq).not.toHaveBeenCalled();
  });

  test('varios filtros se combinan (AND) y scale_factor es alias de scale', () => {
    const query = createQuery();
    applyVehicleListFilters(query, {
      model: 'Ferrari',
      type: 'GT',
      modified: 'Sí',
      digital: 'Digital',
      scale_factor: '32',
    });
    expect(query.or).toHaveBeenCalledWith('model.ilike."%Ferrari%"');
    expect(query.ilike).not.toHaveBeenCalled();
    expect(query.eq).toHaveBeenCalledWith('type', 'GT');
    expect(query.eq).toHaveBeenCalledWith('modified', true);
    expect(query.eq).toHaveBeenCalledWith('digital', true);
    expect(query.eq).toHaveBeenCalledWith('scale_factor', 32);
  });
});
