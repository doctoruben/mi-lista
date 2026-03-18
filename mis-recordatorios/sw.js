const CACHE_VERSION = 'memento-v7';
const BASE = '/mi-lista/mis-recordatorios/';

const PRECACHE_URLS = [
  BASE + 'index.html',
  BASE + 'admin.html',
  BASE + 'manifest.json',
  BASE + 'icon.png',
  BASE + 'icon-192.png',
  BASE + 'icon-512.png',
];

// Alarmas programadas en memoria del SW
// { id: { name, alarmTs, timerId } }
const scheduledAlarms = {};

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_VERSION).then(c => c.addAll(PRECACHE_URLS)).catch(() => {}));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;
  if (url.includes('firebasejs') || url.includes('firebaseapp.com') ||
      url.includes('firebasedatabase.app') || url.includes('googleapis.com') ||
      url.includes('gstatic.com')) {
    e.respondWith(fetch(e.request));
    return;
  }
  if (e.request.headers.get('accept')?.includes('text/html')) {
    e.respondWith(
      fetch(e.request)
        .then(res => { const c = res.clone(); caches.open(CACHE_VERSION).then(ca => ca.put(e.request, c)); return res; })
        .catch(() => caches.match(e.request))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.status === 200) { const c = res.clone(); caches.open(CACHE_VERSION).then(ca => ca.put(e.request, c)); }
        return res;
      });
    })
  );
});

// ── RECIBIR ALARMAS DESDE LA APP ─────────────────────────
self.addEventListener('message', e => {
  if (!e.data) return;

  if (e.data.type === 'SCHEDULE_ALARM') {
    const { id, name, alarmTs } = e.data;
    scheduleAlarm(id, name, alarmTs);
  }

  if (e.data.type === 'CANCEL_ALARM') {
    cancelAlarm(e.data.id);
  }

  if (e.data.type === 'SYNC_ALARMS') {
    // La app manda todas las alarmas activas al SW al arrancar
    const { alarms } = e.data; // [ {id, name, alarmTs} ]
    // Cancelar las que ya no existen
    Object.keys(scheduledAlarms).forEach(id => {
      if (!alarms.find(a => a.id === id)) cancelAlarm(id);
    });
    // Programar las nuevas
    alarms.forEach(({ id, name, alarmTs }) => {
      if (!scheduledAlarms[id]) scheduleAlarm(id, name, alarmTs);
    });
  }
});

function scheduleAlarm(id, name, alarmTs) {
  cancelAlarm(id); // Cancelar si ya había una
  const delay = alarmTs - Date.now();
  if (delay <= 0) return; // Ya pasó
  const timerId = setTimeout(() => {
    delete scheduledAlarms[id];
    self.registration.showNotification('🔔 MEMENTO', {
      body: name,
      icon: BASE + 'icon-192.png',
      badge: BASE + 'icon-72x72.png',
      tag: 'memento-' + id,
      requireInteraction: true,
      vibrate: [300, 100, 300, 100, 300],
      data: { id, url: BASE + 'index.html' }
    });
  }, Math.min(delay, 2147483647)); // Max timeout safe value
  scheduledAlarms[id] = { name, alarmTs, timerId };
}

function cancelAlarm(id) {
  if (scheduledAlarms[id]) {
    clearTimeout(scheduledAlarms[id].timerId);
    delete scheduledAlarms[id];
  }
}

// ── CLIC EN NOTIFICACIÓN ─────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(list => {
        for (const client of list) {
          if (client.url.includes('mis-recordatorios') && 'focus' in client) return client.focus();
        }
        return clients.openWindow(BASE + 'index.html');
      })
  );
});
