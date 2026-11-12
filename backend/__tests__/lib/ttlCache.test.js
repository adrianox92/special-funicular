'use strict';

const { createTtlCache } = require('../../lib/ttlCache');

describe('createTtlCache', () => {
  it('devuelve el valor dentro del TTL y undefined al caducar', () => {
    const cache = createTtlCache({ ttlMs: 1000, maxEntries: 10 });
    cache.set('a', 1, 0);
    expect(cache.get('a', 999)).toBe(1);
    expect(cache.get('a', 1000)).toBeUndefined();
  });

  it('al llegar al tope elimina la entrada menos usada', () => {
    const cache = createTtlCache({ ttlMs: 10_000, maxEntries: 2 });
    cache.set('a', 1, 0);
    cache.set('b', 2, 1);
    cache.get('a', 2);
    cache.set('c', 3, 3);
    expect(cache.get('b', 4)).toBeUndefined();
    expect(cache.get('a', 4)).toBe(1);
    expect(cache.get('c', 4)).toBe(3);
  });

  it('clear vacía la caché', () => {
    const cache = createTtlCache({ ttlMs: 1000, maxEntries: 5 });
    cache.set('a', 1, 0);
    cache.clear();
    expect(cache.get('a', 1)).toBeUndefined();
    expect(cache.size).toBe(0);
  });
});
