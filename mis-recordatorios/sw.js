const CACHE_VERSION = 'memento-v6';
const BASE = '/mi-lista/mis-recordatorios/';

const PRECACHE_URLS = [
  BASE + 'index.html',
  BASE + 'admin.html',
  BASE + 'manifest.json',
  BASE + 'icon.png',
  BASE + 'icon-192.png',
  BASE + 'icon-512.png',
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then(c => c.addAll(PRECACHE_URLS))
      .catch(() => {})
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;
  if (
    url.includes('firebasejs') || url.includes('firebaseapp.com') ||
    url.includes('firebasedatabase.app') || url.includes('googleapis.com') ||
    url.includes('gstatic.com')
  ) {
    e.respondWith(fetch(e.request));
    return;
  }
  if (e.request.headers.get('accept')?.includes('text/html')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});

// ── BACKGROUND SYNC: notificaciones cuando la app está cerrada ──
// Recibe mensajes desde la app principal con los datos de la alarma
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SCHEDULE_ALARM') {
    const { id, name, alarmTs } = e.data;
    const delay = alarmTs - Date.now();
    if (delay <= 0) return;
    // Programar con setTimeout (funciona mientras el SW está vivo)
    setTimeout(() => {
      self.registration.showNotification('🔔 MEMENTO', {
        body: name,
        icon: BASE + 'icon-192.png',
        badge: BASE + 'icon-72x72.png',
        tag: 'memento-' + id,
        requireInteraction: true,
        vibrate: [200, 100, 200],
        data: { url: BASE + 'index.html' }
      });
    }, delay);
  }
});

// Al pulsar la notificación, abrir la app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        for (const client of clientList) {
          if (client.url.includes('mis-recordatorios') && 'focus' in client) {
            return client.focus();
          }
        }
        return clients.openWindow(BASE + 'index.html');
      })
  );
});
