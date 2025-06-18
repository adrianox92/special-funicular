import React, { useEffect } from 'react';

// Componente provider para manejar ResizeObserver de forma segura
const ResizeObserverProvider = ({ children }) => {
  useEffect(() => {
    // Solo suprimir específicamente el warning de ResizeObserver loop limit exceeded
    const originalConsoleError = console.error;
    console.error = (...args) => {
      // Solo suprimir si es específicamente el warning de ResizeObserver loop
      if (args[0] && typeof args[0] === 'string' && 
          (args[0].includes('ResizeObserver loop limit exceeded') || 
           args[0].includes('ResizeObserver loop'))) {
        return;
      }
      originalConsoleError.apply(console, args);
    };

    // Limpiar al desmontar
    return () => {
      console.error = originalConsoleError;
    };
  }, []);

  return <>{children}</>;
};

export default ResizeObserverProvider; 