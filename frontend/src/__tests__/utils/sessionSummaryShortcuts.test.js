import { buildSessionSummaryShortcuts } from '../../utils/sessionSummaryShortcuts';

describe('buildSessionSummaryShortcuts', () => {
  test('usa los ids de circuito y vehículo guardados en query y tab', () => {
    expect(
      buildSessionSummaryShortcuts({ vehicleId: 'veh-1', circuitId: 'cir-1' }),
    ).toEqual({
      circuitHistory: '/timings?circuit_id=cir-1',
      vehicleSheet: '/vehicles/veh-1?tab=timings',
      vehicleOnCircuit: '/timings?circuit_id=cir-1&vehicle=veh-1',
    });
  });

  test('sin circuito enlaza el listado global y oculta el atajo combinado', () => {
    expect(buildSessionSummaryShortcuts({ vehicleId: 'veh-1' })).toEqual({
      circuitHistory: '/timings',
      vehicleSheet: '/vehicles/veh-1?tab=timings',
      vehicleOnCircuit: null,
    });
  });

  test('sin vehículo no hay ficha ni filtro de coche', () => {
    expect(buildSessionSummaryShortcuts({ circuitId: 'cir-1' })).toEqual({
      circuitHistory: '/timings?circuit_id=cir-1',
      vehicleSheet: null,
      vehicleOnCircuit: null,
    });
  });
});
