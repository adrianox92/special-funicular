import React, { useEffect, useState } from 'react';
import { logPWADiagnostics, showPWADiagnostics } from '../utils/pwaDiagnostics';

const InstallPWAButton = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    // Ejecutar diagnóstico al cargar
    logPWADiagnostics();

    // Verificar si la app ya está instalada
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Verificar si la app está instalada en iOS
    if (window.navigator.standalone === true) {
      setIsInstalled(true);
      return;
    }

    const handleBeforeInstallPrompt = (e) => {
      console.log('beforeinstallprompt event fired');
      e.preventDefault();
      setDeferredPrompt(e);
      setIsVisible(true);
    };

    const handleAppInstalled = () => {
      console.log('PWA was installed');
      setIsInstalled(true);
      setIsVisible(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Debug: verificar si el service worker está registrado
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        console.log('Service Workers registrados:', registrations.length);
      });
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      console.log('No deferred prompt available');
      return;
    }

    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        console.log('PWA installation accepted');
        setIsInstalled(true);
      } else {
        console.log('PWA installation dismissed');
      }
    } catch (error) {
      console.error('Error during installation:', error);
    }

    setDeferredPrompt(null);
    setIsVisible(false);
  };

  const handleDebugClick = () => {
    showPWADiagnostics();
  };

  // Mostrar botón de debug en desarrollo
  const isDevelopment = process.env.NODE_ENV === 'development';

  // No mostrar el botón si ya está instalada
  if (isInstalled) return null;

  return (
    <>
      {/* Botón de instalación */}
      {isVisible && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 1000,
          backgroundColor: '#007bff',
          color: 'white',
          padding: '10px 15px',
          borderRadius: '25px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }} onClick={handleInstallClick}>
          <span>📲</span>
          <span>Instalar App</span>
        </div>
      )}

      {/* Botón de debug (solo en desarrollo) */}
      {isDevelopment && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          left: '20px',
          zIndex: 1000,
          backgroundColor: '#6c757d',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          cursor: 'pointer',
          fontSize: '12px',
          fontFamily: 'monospace'
        }} onClick={handleDebugClick}>
          🔍 Debug PWA
        </div>
      )}
    </>
  );
};

export default InstallPWAButton;
