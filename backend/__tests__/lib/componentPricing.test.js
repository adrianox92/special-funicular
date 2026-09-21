const {
  modificationLineTotal,
  vehicleModificationCost,
  vehiclePurchaseCost,
} = require('../../lib/componentPricing');

describe('componentPricing', () => {
  test('modificationLineTotal usa unidades montadas y trata qty inválida como 1', () => {
    expect(modificationLineTotal(10, 2)).toBe(20);
    expect(modificationLineTotal(10, 0)).toBe(10);
    expect(modificationLineTotal(null, 3)).toBe(0);
  });

  test('vehiclePurchaseCost ignora precios no numéricos', () => {
    expect(vehiclePurchaseCost({ price: 49.9 })).toBe(49.9);
    expect(vehiclePurchaseCost({ price: 'abc' })).toBe(0);
    expect(vehiclePurchaseCost(null)).toBe(0);
  });

  test('vehicleModificationCost suma solo specs de modificación', () => {
    const vehicle = {
      technical_specs: [
        { is_modification: false, components: [{ price: 99, mounted_qty: 1 }] },
        {
          is_modification: true,
          components: [
            { price: 10, mounted_qty: 2 },
            { price: 5, mounted_qty: 1 },
          ],
        },
        { is_modification: true },
      ],
    };
    expect(vehicleModificationCost(vehicle)).toBe(25);
    expect(vehicleModificationCost({ technical_specs: [] })).toBe(0);
    expect(vehicleModificationCost(null)).toBe(0);
  });
});
