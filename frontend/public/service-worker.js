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

// Web Push (récord personal / ranking vía API sync)
self.addEventListener("push", (event) => {
  let title = "Scalextric Collection";
  let body = "";
  let data = {};

  try {
    if (event.data) {
      const parsed = event.data.json();
      title = parsed.title || title;
      body = parsed.body || "";
      data = parsed.data && typeof parsed.data === "object" ? parsed.data : {};
    }
  } catch (e) {
    body = event.data ? event.data.text() : "";
  }

  const tag = data.type ? `scalextric-${data.type}` : "scalextric-push";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/logo192.png",
      badge: "/logo192.png",
      data,
      tag,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const d = event.notification.data || {};
  const rel = d.url || "/timings";
  const origin = self.location.origin;
  const fullUrl =
    rel.startsWith("http") ? rel : origin + (rel.startsWith("/") ? rel : "/" + rel);

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(origin) && "focus" in client) {
          if (typeof client.navigate === "function") {
            client.navigate(fullUrl);
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(fullUrl);
      }
    })
  );
});
