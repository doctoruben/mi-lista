const CACHE_NAME = 'lupa-v3';
const FILES = ['./', './index.html', './manifest.json'];

self.addEventListener('install', e=>{
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e=>{
  // La cámara (getUserMedia) no pasa por fetch, así que cachear no afecta.
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
