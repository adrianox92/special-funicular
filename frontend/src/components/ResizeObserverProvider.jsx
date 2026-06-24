import React, { useEffect } from 'react';

const RESIZE_OBSERVER_LOOP_RE =
  /ResizeObserver loop (completed with undelivered notifications|limit exceeded)/i;

function isResizeObserverLoopMessage(message) {
  if (typeof message !== 'string') return false;
  return RESIZE_OBSERVER_LOOP_RE.test(message) || message.includes('ResizeObserver loop');
}

// Suprime el aviso benigno de ResizeObserver que dispara el overlay de errores en desarrollo
// (común con Radix Dialog/Select al cambiar el tamaño dentro de modales con scroll).
const ResizeObserverProvider = ({ children }) => {
  useEffect(() => {
    const originalConsoleError = console.error;
    console.error = (...args) => {
      const first = args[0];
      if (isResizeObserverLoopMessage(first)) return;
      if (first instanceof Error && isResizeObserverLoopMessage(first.message)) return;
      originalConsoleError.apply(console, args);
    };

    const onError = (event) => {
      if (isResizeObserverLoopMessage(event.message)) {
        event.stopImmediatePropagation();
        event.preventDefault();
      }
    };

    window.addEventListener('error', onError);

    return () => {
      console.error = originalConsoleError;
      window.removeEventListener('error', onError);
    };
  }, []);

  return <>{children}</>;
};

export default ResizeObserverProvider;
