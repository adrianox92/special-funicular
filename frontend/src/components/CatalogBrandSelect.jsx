import React, { useEffect, useMemo, useState } from 'react';
import api from '../lib/axios';
import { Label } from './ui/label';
import { SearchableCategorySelect } from './SearchableCategorySelect';

export function useCatalogBrands() {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/public/catalog/brands');
        if (!cancelled) setBrands(data.brands ?? []);
      } catch {
        if (!cancelled) setBrands([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return { brands, loading };
}

/**
 * Una sola interacción: botón que abre panel con búsqueda + lista (mismo patrón que categorías en inventario).
 * `value` / `onChange` usan el UUID de `slot_catalog_brands`.
 *
 * @param {boolean} [showLabel=true] — si es false, solo el control (misma línea que un Input con placeholder).
 * @param {string} [emptyOptionLabel] — texto de la opción con valor vacío cuando `required` es false (p. ej. filtros: «Todas las marcas»).
 */
export default function CatalogBrandSelect({
  label = 'Marca',
  showLabel = true,
  emptyOptionLabel = '— Sin seleccionar —',
  value,
  onChange,
  required,
  disabled,
  id = 'catalog-brand-select',
}) {
  const { brands, loading } = useCatalogBrands();

  const options = useMemo(() => {
    const rows = brands.map((b) => ({ value: b.id, label: b.name }));
    if (!required) {
      return [{ value: '', label: emptyOptionLabel }, ...rows];
    }
    return rows;
  }, [brands, required, emptyOptionLabel]);

  const triggerPlaceholder = loading
    ? 'Cargando marcas…'
    : required
      ? 'Selecciona una marca'
      : emptyOptionLabel;

  return (
    <div className={showLabel ? 'space-y-2' : undefined}>
      {showLabel ? <Label htmlFor={id}>{label}</Label> : null}
      <SearchableCategorySelect
        id={id}
        value={value || ''}
        onValueChange={onChange}
        options={options}
        disabled={disabled || loading}
        placeholder={triggerPlaceholder}
        searchPlaceholder="Buscar marca…"
      />
    </div>
  );
}
