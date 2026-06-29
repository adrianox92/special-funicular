import { useEffect, useRef, useState } from 'react';

const FALLBACK_POLL_MS = 60000;

function buildStreamUrl(slug) {
  const base = (process.env.REACT_APP_API_URL || 'http://localhost:5001/api').replace(/\/+$/, '');
  return `${base}/public-signup/${encodeURIComponent(slug)}/presentation/stream`;
}

/**
 * SSE en vivo para modo presentación con polling de respaldo.
 * @param {string|undefined} slug
 * @param {() => void|Promise<void>} onRefresh
 */
export function usePresentationLive(slug, onRefresh) {
  const [isLive, setIsLive] = useState(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    if (!slug) return undefined;

    let closed = false;
    let eventSource = null;
    let fallbackInterval = null;

    const triggerRefresh = () => {
      Promise.resolve(onRefreshRef.current()).catch((err) => {
        console.error('[usePresentationLive] refresh error', err);
      });
    };

    const startFallback = () => {
      if (fallbackInterval) return;
      fallbackInterval = setInterval(triggerRefresh, FALLBACK_POLL_MS);
    };

    const stopFallback = () => {
      if (fallbackInterval) {
        clearInterval(fallbackInterval);
        fallbackInterval = null;
      }
    };

    try {
      eventSource = new EventSource(buildStreamUrl(slug));

      eventSource.onopen = () => {
        if (closed) return;
        setIsLive(true);
        stopFallback();
      };

      eventSource.onmessage = (event) => {
        if (closed) return;
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'refresh') {
            triggerRefresh();
          }
        } catch {
          // ignore malformed events
        }
      };

      eventSource.onerror = () => {
        if (closed) return;
        setIsLive(false);
        startFallback();
      };
    } catch (err) {
      console.error('[usePresentationLive] EventSource failed', err);
      setIsLive(false);
      startFallback();
    }

    return () => {
      closed = true;
      setIsLive(false);
      stopFallback();
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [slug]);

  return { isLive };
}
