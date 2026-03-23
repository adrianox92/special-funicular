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

module.exports = { modificationLineTotal };
