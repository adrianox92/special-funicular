import { useEffect, useState } from 'react';
import api from '../lib/axios';
import { fieldsForCatalogSearch } from '../utils/vehicleFieldSwap';

const DEBOUNCE_MS = 350;

function hasEnoughQuery({ manufacturer, model, reference }) {
  const fields = fieldsForCatalogSearch({ manufacturer, model, reference });
  return fields.model.length >= 3 || fields.reference.length >= 3;
}

export function useCatalogVehicleSuggestions({
  manufacturer,
  model,
  reference,
  catalogItemId,
  enabled = true,
} = {}) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || catalogItemId) {
      setGroups([]);
      setLoading(false);
      return undefined;
    }
    if (!hasEnoughQuery({ manufacturer, model, reference })) {
      setGroups([]);
      setLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/catalog/suggest-for-vehicle', {
          params: {
            manufacturer: manufacturer || '',
            model: model || '',
            reference: reference || '',
          },
          signal: controller.signal,
        });
        setGroups(Array.isArray(data?.groups) ? data.groups : []);
      } catch (err) {
        if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') return;
        setGroups([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [manufacturer, model, reference, catalogItemId, enabled]);

  return { groups, loading };
}
