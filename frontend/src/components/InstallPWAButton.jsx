import React, { useEffect, useState } from 'react';
import { Smartphone } from 'lucide-react';
import { Button } from './ui/button';
const InstallPWAButton = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
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
      e.preventDefault();
      setDeferredPrompt(e);
      setIsVisible(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsVisible(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
    } catch (error) {
      console.error('Error during installation:', error);
    }

    setDeferredPrompt(null);
    setIsVisible(false);
  };

  // No mostrar el botón si ya está instalada
  if (isInstalled) return null;

  // No mostrar el botón si no es visible
  if (!isVisible) return null;

  return (
    <Button
      onClick={handleInstallClick}
      className="fixed bottom-5 right-5 z-[1000] rounded-full shadow-lg gap-2"
    >
      <Smartphone className="size-4" />
      Instalar App
    </Button>
  );
};

export default InstallPWAButton;
