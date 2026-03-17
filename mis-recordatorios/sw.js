// Cambia la versión cada vez que actualices la app
const CACHE_VERSION = 'memento-v4';
const BASE = '/mi-lista/mis-recordatorios/';

const PRECACHE_URLS = [
  BASE + 'index.html',
  BASE + 'admin.html',
  BASE + 'manifest.json',
  BASE + 'icon.png',
  BASE + 'icon-192.png',
  BASE + 'icon-512.png',
];

// INSTALL: cachear recursos principales
self.addEventListener('install', e => {
  self.skipWaiting(); // Activar inmediatamente sin esperar
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .catch(() => {}) // No fallar si algún recurso no existe
  );
});

// ACTIVATE: eliminar cachés antiguas
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_VERSION)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim()) // Tomar control de todas las pestañas
  );
});

// FETCH: network first para HTML, cache first para el resto
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Firebase, Google Fonts, APIs externas: siempre red
  if (
    url.includes('firebasejs') ||
    url.includes('firebaseapp.com') ||
    url.includes('firebasedatabase.app') ||
    url.includes('googleapis.com') ||
    url.includes('gstatic.com')
  ) {
    e.respondWith(fetch(e.request));
    return;
  }

  // HTML: network first (siempre intenta traer la versión más nueva)
  if (e.request.headers.get('accept')?.includes('text/html')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          // Actualizar caché con la versión más nueva
          const clone = res.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request)) // Si no hay red, usar caché
    );
    return;
  }

  // Resto (iconos, manifest): cache first, red como fallback
  e.respondWith(
    caches.match(e.request)
      .then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_VERSION).then(cache => cache.put(e.request, clone));
          }
          return res;
        });
      })
  );
});
