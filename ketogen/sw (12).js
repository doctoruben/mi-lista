// KetoGen Service Worker
// Estrategia: Cache First para assets estáticos, Network First para Firebase

const CACHE_NAME = 'ketogen-v1';
const STATIC_CACHE = 'ketogen-static-v1';
const DYNAMIC_CACHE = 'ketogen-dynamic-v1';

// Assets a cachear en la instalación
const STATIC_ASSETS = [
  '/mi-lista/ketogen/index.html',
  'https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@400;500;600&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-database-compat.js'
];

// Dominios que siempre van a la red (APIs dinámicas)
const NETWORK_ONLY_HOSTS = [
  'generativelanguage.googleapis.com',  // Gemini
  'api.groq.com',                        // Groq
  'lista-compra-9d6f5-default-rtdb.europe-west1.firebasedatabase.app' // Firebase RTDB
];

// ── INSTALL ──────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Error en install:', err))
  );
});

// ── ACTIVATE ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map(key => {
            console.log('[SW] Eliminando caché antigua:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1. Siempre red para APIs dinámicas
  if (NETWORK_ONLY_HOSTS.some(host => url.hostname.includes(host))) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 2. Solo GET se cachea
  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }

  // 3. Cache First para assets estáticos conocidos
  const isStatic = STATIC_ASSETS.includes(event.request.url);
  if (isStatic) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        return cached || fetchAndCache(event.request, STATIC_CACHE);
      })
    );
    return;
  }

  // 4. Network First con fallback a caché para el resto
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cachear respuestas válidas
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(DYNAMIC_CACHE).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // Fallback offline para navegación
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/mi-lista/ketogen/index.html');
          }
        });
      })
  );
});

// ── HELPER ───────────────────────────────────────────────────────────────────
function fetchAndCache(request, cacheName) {
  return fetch(request).then(response => {
    if (response && response.status === 200) {
      const clone = response.clone();
      caches.open(cacheName).then(cache => cache.put(request, clone));
    }
    return response;
  });
}
