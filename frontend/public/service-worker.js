// service-worker.js - Service Worker simplificado para PWA
/* eslint-disable no-restricted-globals */

const CACHE_NAME = "scalextric-cache-v1";

// Archivos estáticos que se cachean inmediatamente
const STATIC_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo192.png',
  '/logo512.png',
  '/favicon.ico'
];

// Instalación del Service Worker
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_FILES))
      .then(() => self.skipWaiting())
      .catch(error => {
        console.error('Service Worker: Error caching static files:', error);
      })
  );
});

// Activación del Service Worker
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Interceptación de peticiones - SOLO archivos estáticos
self.addEventListener("fetch", event => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo interceptar archivos estáticos específicos
  if (STATIC_FILES.includes(url.pathname)) {
    event.respondWith(
      caches.match(request)
        .then(response => {
          if (response) {
            return response;
          }
          return fetch(request);
        })
    );
    return;
  }

  // Para todas las demás peticiones, NO interceptar
  // Esto permite que React Router maneje la navegación normalmente
});

// Manejo de mensajes
self.addEventListener("message", event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});
