const CACHE_NAME = 'keto-tracker-v1';
const ASSETS = [
  './index.html',
  './manifest.json'
];

// Instalación
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Estrategia de carga: Red primero, si falla, Caché
self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request).catch(() => {
      return caches.match(e.request);
    })
  );
});
