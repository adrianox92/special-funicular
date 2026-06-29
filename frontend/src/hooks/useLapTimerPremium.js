import { useEffect, useState } from 'react';
import api from '../lib/axios';
import { useAuth } from '../context/AuthContext';

/**
 * Licencia Premium de Slot Lap Timer vinculada a la cuenta web (user_licenses).
 */
export function useLapTimerPremium() {
  const { user } = useAuth();
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setIsPremium(false);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/license-account/lap-timer/me');
        if (!cancelled) setIsPremium(data?.active === true);
      } catch {
        if (!cancelled) setIsPremium(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return { isPremium, loading };
}
