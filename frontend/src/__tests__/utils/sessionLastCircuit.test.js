import {
  getLastSessionCircuitId,
  pickDefaultCircuitId,
  setLastSessionCircuitId,
} from '../../utils/sessionLastCircuit';

describe('sessionLastCircuit', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('guarda y recupera el último circuito', () => {
    expect(getLastSessionCircuitId()).toBeNull();
    setLastSessionCircuitId('abc');
    expect(getLastSessionCircuitId()).toBe('abc');
  });

  test('elige el último usado si sigue en la lista', () => {
    setLastSessionCircuitId('c2');
    const circuits = [{ id: 'c1' }, { id: 'c2' }];
    expect(pickDefaultCircuitId(circuits)).toBe('c2');
  });

  test('preferredId tiene prioridad', () => {
    setLastSessionCircuitId('c2');
    const circuits = [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }];
    expect(pickDefaultCircuitId(circuits, 'c3')).toBe('c3');
  });

  test('si no hay último usado, usa el primero', () => {
    const circuits = [{ id: 'c1' }, { id: 'c2' }];
    expect(pickDefaultCircuitId(circuits)).toBe('c1');
  });
});
