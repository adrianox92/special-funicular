/**
 * Registro de adaptadores de tienda.
 * Empieza vacío: cada web se añade con registerAdapter cuando exista su parser.
 * El cron ignora las tiendas cuya adapter_key no está registrada.
 */

/** @type {Map<string, ShopAdapter>} */
const adapters = new Map();

/**
 * @typedef {Object} ShopProductHit
 * @property {string} productUrl
 * @property {number|null} price
 * @property {string} currency
 * @property {boolean} inStock
 *
 * @typedef {Object} ShopAdapter
 * @property {string} key
 * @property {(ctx: { reference: string, ean: string|null, brand: string|null }) => Promise<ShopProductHit|null>} findByReference
 * @property {(productUrl: string) => Promise<ShopProductHit|null>} checkProduct
 */

function registerAdapter(adapter) {
  if (!adapter || typeof adapter.key !== 'string' || !adapter.key.trim()) {
    throw new Error('adapter.key es obligatorio');
  }
  if (typeof adapter.findByReference !== 'function' || typeof adapter.checkProduct !== 'function') {
    throw new Error(`El adaptador ${adapter.key} debe implementar findByReference y checkProduct`);
  }
  adapters.set(adapter.key.trim(), adapter);
  return adapter;
}

function getAdapter(key) {
  if (!key) return null;
  return adapters.get(String(key).trim()) || null;
}

function listAdapterKeys() {
  return [...adapters.keys()];
}

function clearAdapters() {
  adapters.clear();
}

module.exports = {
  registerAdapter,
  getAdapter,
  listAdapterKeys,
  clearAdapters,
};
