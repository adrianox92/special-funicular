'use strict';

/**
 * Caché en memoria con TTL absoluto y tope de claves.
 * Al llegar al tope se elimina la entrada menos usada (la más antigua del Map).
 * Un get dentro del TTL renueva el orden, no la caducidad.
 */
function createTtlCache({ ttlMs, maxEntries }) {
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
    throw new Error('ttlMs debe ser un número mayor que 0');
  }
  if (!Number.isFinite(maxEntries) || maxEntries < 1) {
    throw new Error('maxEntries debe ser un entero mayor que 0');
  }

  const map = new Map();

  function get(key, now = Date.now()) {
    const hit = map.get(key);
    if (!hit) return undefined;
    if (now - hit.at >= ttlMs) {
      map.delete(key);
      return undefined;
    }
    map.delete(key);
    map.set(key, hit);
    return hit.value;
  }

  function set(key, value, now = Date.now()) {
    if (map.has(key)) map.delete(key);
    map.set(key, { at: now, value });
    while (map.size > maxEntries) {
      const oldest = map.keys().next().value;
      map.delete(oldest);
    }
  }

  function clear() {
    map.clear();
  }

  return { get, set, clear, get size() { return map.size; } };
}

module.exports = { createTtlCache };
