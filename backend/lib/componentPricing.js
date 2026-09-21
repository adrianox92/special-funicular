/**
 * Coste de línea de un componente de modificación: precio unitario × unidades montadas.
 * @param {unknown} price
 * @param {unknown} mountedQty
 * @returns {number}
 */
function modificationLineTotal(price, mountedQty) {
  const unit = price != null && price !== '' && !Number.isNaN(Number(price)) ? Number(price) : 0;
  let q = parseInt(mountedQty, 10);
  if (Number.isNaN(q) || q < 1) q = 1;
  return unit * q;
}

/**
 * Suma el coste de componentes marcados como modificación en las specs del vehículo.
 * @param {{ technical_specs?: Array<{ is_modification?: boolean, components?: Array<{ price?: unknown, mounted_qty?: unknown }> }> } | null | undefined} vehicle
 * @returns {number}
 */
function vehicleModificationCost(vehicle) {
  const specs = vehicle?.technical_specs;
  if (!Array.isArray(specs) || specs.length === 0) return 0;
  return specs
    .filter((spec) => spec && spec.is_modification)
    .reduce((specSum, spec) => {
      const components = Array.isArray(spec.components) ? spec.components : [];
      const componentsCost = components.reduce(
        (compSum, comp) => compSum + modificationLineTotal(comp?.price, comp?.mounted_qty),
        0,
      );
      return specSum + componentsCost;
    }, 0);
}

/**
 * Precio de compra del vehículo (sin modificaciones).
 * @param {{ price?: unknown } | null | undefined} vehicle
 * @returns {number}
 */
function vehiclePurchaseCost(vehicle) {
  const n = Number(vehicle?.price);
  return Number.isFinite(n) ? n : 0;
}

module.exports = { modificationLineTotal, vehicleModificationCost, vehiclePurchaseCost };
