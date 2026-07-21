import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/axios';
import { supabase } from '../lib/supabase';

export const ONBOARDING_STEPS = [
  { id: 'vehicle', path: '/vehicles/new' },
  { id: 'circuit', path: '/circuits' },
  { id: 'timing', path: '/timings' },
];

const STATUS_KEYS = ['hasVehicle', 'hasCircuit', 'hasTiming'];

/**
 * Estado del checklist de onboarding derivado de la API y user_metadata.
 */
export function useOnboardingStatus() {
  const { user, refreshUser } = useAuth();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const dismissed = Boolean(user?.user_metadata?.onboarding_dismissed_at);

  const refetch = useCallback(async () => {
    if (!user) {
      setStatus(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/onboarding/status');
      setStatus(data);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Error');
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const steps = useMemo(
    () =>
      ONBOARDING_STEPS.map((step, index) => ({
        ...step,
        done: Boolean(status?.[STATUS_KEYS[index]]),
      })),
    [status],
  );

  const completedCount = steps.filter((s) => s.done).length;
  const completed = Boolean(status?.completed);
  const visible = Boolean(user && !loading && status && !completed && !dismissed);

  const dismiss = useCallback(async () => {
    const { error: dismissError } = await supabase.auth.updateUser({
      data: { onboarding_dismissed_at: new Date().toISOString() },
    });
    if (dismissError) throw dismissError;
    await refreshUser();
  }, [refreshUser]);

  const firstIncompleteStep = steps.find((s) => !s.done) ?? null;

  return {
    steps,
    completedCount,
    completed,
    dismissed,
    visible,
    dismiss,
    loading,
    error,
    refetch,
    firstIncompleteStep,
  };
}
