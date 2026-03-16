// pwaDiagnostics.js - Utilidades para diagnosticar problemas de PWA

export const checkPWASupport = () => {
  const diagnostics = {
    serviceWorker: false,
    beforeinstallprompt: false,
    displayMode: false,
    https: false,
    manifest: false,
    icons: false,
    errors: []
  };

  // Verificar HTTPS
  diagnostics.https = window.location.protocol === 'https:' || window.location.hostname === 'localhost';

  // Verificar Service Worker
  if ('serviceWorker' in navigator) {
    diagnostics.serviceWorker = true;
  } else {
    diagnostics.errors.push('Service Worker no soportado en este navegador');
  }

  // Verificar beforeinstallprompt
  if ('onbeforeinstallprompt' in window) {
    diagnostics.beforeinstallprompt = true;
  } else {
    diagnostics.errors.push('beforeinstallprompt no soportado');
  }

  // Verificar display mode
  if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
    diagnostics.displayMode = true;
  }

  // Verificar manifest
  const manifestLink = document.querySelector('link[rel="manifest"]');
  if (manifestLink) {
    diagnostics.manifest = true;
  } else {
    diagnostics.errors.push('Manifest no encontrado');
  }

  // Verificar iconos
  const iconLinks = document.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]');
  if (iconLinks.length > 0) {
    diagnostics.icons = true;
  } else {
    diagnostics.errors.push('Iconos no encontrados');
  }

  return diagnostics;
};

export const logPWADiagnostics = () => {
  return checkPWASupport();
};

export const testInstallPrompt = () => {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({ success: false, message: 'Timeout: No se recibió beforeinstallprompt en 5 segundos' });
    }, 5000);

    const handleBeforeInstallPrompt = (e) => {
      clearTimeout(timeout);
      e.preventDefault();
      resolve({ success: true, prompt: e });
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt, { once: true });
  });
};

// Función para mostrar diagnóstico en la UI
export const showPWADiagnostics = () => {
  const diagnostics = checkPWASupport();
  
  const diagnosticDiv = document.createElement('div');
  diagnosticDiv.style.cssText = `
    position: fixed;
    top: 20px;
    left: 20px;
    background: #333;
    color: white;
    padding: 20px;
    border-radius: 10px;
    font-family: monospace;
    font-size: 12px;
    max-width: 400px;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  `;

  let html = '<h4>🔍 Diagnóstico PWA</h4>';
  html += `<div>✅ HTTPS: ${diagnostics.https}</div>`;
  html += `<div>✅ Service Worker: ${diagnostics.serviceWorker}</div>`;
  html += `<div>✅ beforeinstallprompt: ${diagnostics.beforeinstallprompt}</div>`;
  html += `<div>✅ Display Mode: ${diagnostics.displayMode}</div>`;
  html += `<div>✅ Manifest: ${diagnostics.manifest}</div>`;
  html += `<div>✅ Iconos: ${diagnostics.icons}</div>`;
  
  if (diagnostics.errors.length > 0) {
    html += '<h5>❌ Errores:</h5>';
    diagnostics.errors.forEach(error => {
      html += `<div style="color: #ff6b6b;">- ${error}</div>`;
    });
  }

  html += '<button onclick="this.parentElement.remove()" style="margin-top: 10px; padding: 5px 10px;">Cerrar</button>';
  
  diagnosticDiv.innerHTML = html;
  document.body.appendChild(diagnosticDiv);
};

// Función para limpiar cache y reinstalar
export const clearPWACache = async () => {
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (let registration of registrations) {
        await registration.unregister();
      }
    } catch (error) {
      console.error('❌ Error desregistrando Service Workers:', error);
    }
  }

  if ('caches' in window) {
    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    } catch (error) {
      console.error('❌ Error limpiando cache:', error);
    }
  }
}; 