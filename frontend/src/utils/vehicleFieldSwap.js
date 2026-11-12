/**
 * Detecta cuando el usuario ha puesto la referencia en el modelo y el nombre
 * en la referencia (p. ej. modelo "U10522S300", referencia "CUPRA LEÓN …").
 */

function trimStr(value) {
  return value == null ? '' : String(value).trim();
}

/**
 * Código corto tipo referencia de catálogo: alfanumérico, sin espacios, con dígitos.
 * Ej. U10522S300, 27131, C4034, A10068S300.
 */
export function looksLikeCatalogReference(value) {
  const t = trimStr(value);
  if (t.length < 3 || t.length > 28) return false;
  if (/\s/.test(t)) return false;
  return /^[A-Za-z0-9][A-Za-z0-9._\-/]*$/.test(t) && /\d/.test(t);
}

/**
 * Nombre de modelo: texto largo con varias palabras.
 */
export function looksLikeVehicleName(value) {
  const t = trimStr(value);
  if (t.length < 8) return false;
  const words = t.split(/\s+/).filter(Boolean);
  return words.length >= 2 && /[A-Za-zÀ-ÿ]/.test(t);
}

export function detectSwappedVehicleFields({ model, reference } = {}) {
  return looksLikeCatalogReference(model) && looksLikeVehicleName(reference);
}

/**
 * Campos listos para buscar en catálogo: si están intercambiados, se corrigen
 * solo para la consulta (no muta el formulario).
 */
export function fieldsForCatalogSearch({ manufacturer, model, reference } = {}) {
  const mfg = trimStr(manufacturer);
  const modelTrim = trimStr(model);
  const refTrim = trimStr(reference);
  if (detectSwappedVehicleFields({ model, reference })) {
    return {
      manufacturer: mfg,
      model: refTrim,
      reference: modelTrim,
      swapped: true,
    };
  }
  if (looksLikeCatalogReference(modelTrim) && !refTrim) {
    return {
      manufacturer: mfg,
      model: '',
      reference: modelTrim,
      swapped: false,
    };
  }
  return {
    manufacturer: mfg,
    model: modelTrim,
    reference: refTrim,
    swapped: false,
  };
}

export function swapModelAndReference(fields = {}) {
  return {
    ...fields,
    model: trimStr(fields.reference),
    reference: trimStr(fields.model),
  };
}
