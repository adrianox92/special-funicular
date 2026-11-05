function cleanOptionalUrl(value, label) {
  if (value == null || String(value).trim() === '') return { value: null };
  const raw = String(value).trim();
  if (!/^https?:\/\//i.test(raw)) {
    return { error: `${label} debe empezar por http:// o https://` };
  }
  return { value: raw };
}

/**
 * Alta y edición de tienda. partial=true solo valida los campos presentes.
 */
function validateShopInput(body, { partial = false } = {}) {
  const src = body && typeof body === 'object' ? body : {};
  const errors = [];
  const value = {};

  const has = (key) => !partial || Object.prototype.hasOwnProperty.call(src, key);

  if (has('name')) {
    const name = String(src.name ?? '').trim();
    if (!name) errors.push('name es obligatorio');
    else if (name.length > 120) errors.push('name es demasiado largo');
    else value.name = name;
  }

  if (has('country_code')) {
    const country = String(src.country_code ?? '').trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(country)) errors.push('country_code debe ser ISO de 2 letras');
    else value.country_code = country;
  }

  if (has('adapter_key')) {
    const key = String(src.adapter_key ?? '').trim();
    if (!key) errors.push('adapter_key es obligatorio');
    else if (key.length > 64) errors.push('adapter_key es demasiado largo');
    else value.adapter_key = key;
  }

  if (has('currency')) {
    const currency = String(src.currency ?? 'EUR').trim().toUpperCase() || 'EUR';
    if (!/^[A-Z]{3}$/.test(currency)) errors.push('currency debe ser un código de 3 letras');
    else value.currency = currency;
  } else if (!partial) {
    value.currency = 'EUR';
  }

  if (has('logo_url')) {
    const parsed = cleanOptionalUrl(src.logo_url, 'logo_url');
    if (parsed.error) errors.push(parsed.error);
    else value.logo_url = parsed.value;
  }

  if (has('site_url')) {
    const parsed = cleanOptionalUrl(src.site_url, 'site_url');
    if (parsed.error) errors.push(parsed.error);
    else value.site_url = parsed.value;
  }

  if (has('active')) {
    value.active = src.active !== false && src.active !== 'false';
  } else if (!partial) {
    value.active = true;
  }

  return { ok: errors.length === 0, errors, value };
}

function parseManualPrice(value) {
  if (value == null || String(value).trim() === '') return { value: null };
  const raw = String(value).trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return { error: 'El precio no es válido' };
  const n = Math.round(Number(raw) * 100) / 100;
  if (!Number.isFinite(n) || n < 0 || n > 99999.99) return { error: 'El precio no es válido' };
  return { value: n };
}

/**
 * Alta manual de una oferta: tienda, referencia, URL y precio.
 * in_stock por defecto es true para publicar primero lo que se puede comprar.
 */
function validateManualOffer(body) {
  const src = body && typeof body === 'object' ? body : {};
  const errors = [];
  const shopId = String(src.shop_id ?? '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(shopId)) {
    errors.push('shop_id no es un UUID válido');
  }
  const reference = String(src.reference ?? '').trim();
  if (reference.length < 2 || reference.length > 80) errors.push('La referencia no es válida');

  const url = cleanOptionalUrl(src.product_url, 'La URL del producto');
  if (url.error) errors.push(url.error);
  else if (!url.value) errors.push('La URL del producto es obligatoria');

  const price = parseManualPrice(src.price);
  if (price.error) errors.push(price.error);

  const inStock = src.in_stock !== false && src.in_stock !== 'false';
  if (inStock && price.value == null && !price.error) {
    errors.push('El precio es obligatorio si hay stock');
  }

  return {
    ok: errors.length === 0,
    errors,
    value: {
      shop_id: shopId,
      reference,
      product_url: url.value || null,
      price: price.value,
      in_stock: inStock,
    },
  };
}

module.exports = { validateShopInput, validateManualOffer };
