// service-worker.js - Service Worker simplificado para PWA
/* eslint-disable no-restricted-globals */

// Subir versión al cambiar la lista de caché o la estrategia.
const CACHE_NAME = "scalextric-cache-v3";

/**
 * Solo precarga recursos con URL estable. NO incluir "/" ni "/index.html":
 * el HTML de CRA referencia main.[hash].js; si el SW sirve un index.html
 * antiguo desde caché, los chunks ya no existen → pantalla en blanco tras un deploy.
 */
const PRECACHE_ASSETS = [
  "/manifest.json",
  "/logo192.png",
  "/logo512.png",
  "/favicon.ico",
];

// Instalación del Service Worker
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
      .catch((error) => {
        console.error("Service Worker: Error caching static files:", error);
      })
  );
});

// Activación del Service Worker
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Interceptación: caché solo para assets con nombre fijo; el documento siempre por red.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (PRECACHE_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((response) => response || fetch(request))
    );
    return;
  }

  // No interceptar navegación ni JS/CSS con hash: el navegador obtiene HTML y bundles actuales.
});

// Manejo de mensajes
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data && event.data.type === "GET_VERSION") {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});
