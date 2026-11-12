import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/axios';
import {
  consumePendingMarketingConsent,
  peekPendingMarketingConsent,
  stashPendingMarketingConsent,
  shouldWriteSignupOptIn,
} from '../utils/marketingConsentStorage';

/**
 * Tras el primer login/registro de una sesión, persiste el opt-in pendiente
 * (casilla de alta o metadata de signUp). No envía correos. Solo escribe si
 * el usuario aceptó y aún no hay una preferencia guardada.
 */
export default function MarketingConsentSync() {
  const { user } = useAuth();
  const flushedFor = useRef(null);

  useEffect(() => {
    if (!user?.id) {
      flushedFor.current = null;
      return undefined;
    }
    if (flushedFor.current === user.id) return undefined;

    const pending = peekPendingMarketingConsent();
    const metaOptIn = user.user_metadata?.marketing_email_opt_in === true;
    flushedFor.current = user.id;
    if (pending !== true && !metaOptIn) {
      consumePendingMarketingConsent();
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/marketing-consent');
        if (cancelled) return;
        if (!shouldWriteSignupOptIn(data, pending, metaOptIn)) {
          consumePendingMarketingConsent();
          return;
        }
        await api.put('/marketing-consent', { consented: true, source: 'signup' });
        consumePendingMarketingConsent();
      } catch {
        stashPendingMarketingConsent(true);
        flushedFor.current = null;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return null;
}
