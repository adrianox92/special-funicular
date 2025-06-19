// sw-config.js - Configuración del Service Worker

const CACHE_NAME = 'scalextric-cache-v1';
const STATIC_CACHE = 'scalextric-static-v1';
const DYNAMIC_CACHE = 'scalextric-dynamic-v1';

// Archivos estáticos que se cachean inmediatamente
const STATIC_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo192.png',
  '/logo512.png',
  '/favicon.ico',
  '/static/js/bundle.js',
  '/static/css/main.css'
];

// Tipos de archivos que se cachean dinámicamente
const CACHEABLE_EXTENSIONS = [
  '.js',
  '.css',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot'
];

// Rutas de la API que se cachean
const API_CACHE_PATTERNS = [
  '/api/public/',
  '/api/competitions/',
  '/api/vehicles/',
  '/api/timings/'
];

// Configuración de cache
const CACHE_CONFIG = {
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
  maxEntries: 100
};

export {
  CACHE_NAME,
  STATIC_CACHE,
  DYNAMIC_CACHE,
  STATIC_FILES,
  CACHEABLE_EXTENSIONS,
  API_CACHE_PATTERNS,
  CACHE_CONFIG
}; 