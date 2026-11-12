import { useCallback, useEffect, useState } from 'react';
import api from '../lib/axios';

export function useMarketingConsent({ enabled = true } = {}) {
  const [consented, setConsented] = useState(false);
  const [givenAt, setGivenAt] = useState(null);
  const [withdrawnAt, setWithdrawnAt] = useState(null);
  const [source, setSource] = useState(null);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/marketing-consent');
      setConsented(Boolean(data?.consented));
      setGivenAt(data?.given_at ?? null);
      setWithdrawnAt(data?.withdrawn_at ?? null);
      setSource(data?.source ?? null);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = useCallback(async (next, sourceOverride = 'profile') => {
    setSaving(true);
    setError(null);
    try {
      const { data } = await api.put('/marketing-consent', {
        consented: Boolean(next),
        source: sourceOverride,
      });
      setConsented(Boolean(data?.consented));
      setGivenAt(data?.given_at ?? null);
      setWithdrawnAt(data?.withdrawn_at ?? null);
      setSource(data?.source ?? null);
      return data;
    } catch (err) {
      setError(err.response?.data?.error || err.message);
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  return {
    consented,
    givenAt,
    withdrawnAt,
    source,
    loading,
    saving,
    error,
    save,
    refresh,
  };
}
