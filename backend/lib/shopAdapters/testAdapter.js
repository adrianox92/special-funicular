/**
 * Adaptador de prueba. No se registra solo: los tests llaman a registerAdapter.
 * reference "MISS" no encuentra producto. "OOS" lo encuentra sin stock.
 * checkProduct: la URL con "fail" lanza; con "gone" devuelve null; con "oos" sin stock.
 */
const testAdapter = {
  key: 'test',
  async findByReference({ reference }) {
    const ref = String(reference || '');
    if (!ref || ref === 'MISS') return null;
    return {
      productUrl: `https://shop.example/p/${encodeURIComponent(ref)}`,
      price: 19.95,
      currency: 'EUR',
      inStock: ref !== 'OOS',
    };
  },
  async checkProduct(productUrl) {
    const url = String(productUrl || '');
    if (url.includes('fail')) {
      throw new Error('timeout');
    }
    if (url.includes('gone')) return null;
    return {
      productUrl: url,
      price: 21.5,
      currency: 'EUR',
      inStock: !url.includes('oos'),
    };
  },
};

module.exports = testAdapter;
