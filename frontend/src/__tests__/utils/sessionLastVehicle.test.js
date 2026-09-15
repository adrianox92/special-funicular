import {
  clearLastSessionVehicleId,
  getLastSessionVehicleId,
  pickDefaultVehicleId,
  setLastSessionVehicleId,
} from '../../utils/sessionLastVehicle';

describe('sessionLastVehicle', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('guarda y recupera el último vehículo', () => {
    expect(getLastSessionVehicleId()).toBeNull();
    setLastSessionVehicleId('abc');
    expect(getLastSessionVehicleId()).toBe('abc');
  });

  test('elige el último usado si sigue en el garaje', () => {
    setLastSessionVehicleId('v2');
    const vehicles = [{ id: 'v1' }, { id: 'v2' }];
    expect(pickDefaultVehicleId(vehicles)).toBe('v2');
  });

  test('preferredId tiene prioridad', () => {
    setLastSessionVehicleId('v2');
    const vehicles = [{ id: 'v1' }, { id: 'v2' }, { id: 'v3' }];
    expect(pickDefaultVehicleId(vehicles, 'v3')).toBe('v3');
  });

  test('no elige el primero si hay varios y no hay último válido', () => {
    const vehicles = [{ id: 'v1' }, { id: 'v2' }];
    expect(pickDefaultVehicleId(vehicles)).toBe('');
  });

  test('con un solo vehículo lo preselecciona', () => {
    expect(pickDefaultVehicleId([{ id: 'solo' }])).toBe('solo');
  });

  test('limpia el id si el vehículo ya no está en el garaje', () => {
    setLastSessionVehicleId('deleted');
    const vehicles = [{ id: 'v1' }, { id: 'v2' }];
    expect(pickDefaultVehicleId(vehicles)).toBe('');
    expect(getLastSessionVehicleId()).toBeNull();
  });

  test('clearLastSessionVehicleId borra el valor', () => {
    setLastSessionVehicleId('v1');
    clearLastSessionVehicleId();
    expect(getLastSessionVehicleId()).toBeNull();
  });
});
