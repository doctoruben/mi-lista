const CACHE = 'memento-v1';
const BASE  = '/mi-lista/mis-recordatorios/';

// Archivos a cachear al instalar
const PRECACHE = [
  BASE + 'index.html',
  BASE + 'manifest.json',
  BASE + 'icon.png',
  BASE + 'icon-192.png',
  BASE + 'icon-512.png',
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE).catch(() => {}))
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Firebase y Google Fonts: siempre red, nunca caché
  if (url.includes('firebasejs') || url.includes('firebaseapp') ||
      url.includes('googleapis.com') || url.includes('gstatic.com')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // App shell: caché primero, red como fallback
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        // Guardar en caché solo respuestas válidas de nuestra app
        if (res && res.status === 200 && url.startsWith(self.location.origin + BASE)) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match(BASE + 'index.html'));
    })
  );
});
