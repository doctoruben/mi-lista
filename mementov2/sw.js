const CACHE_VERSION = 'mementov2-v3';
const BASE = '/mi-lista/mementov2/';
const PRECACHE = [BASE+'index.html',BASE+'admin.html',BASE+'calendar.html',BASE+'manifest.json',BASE+'icon.png',BASE+'icon-192.png',BASE+'icon-512.png'];
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE_VERSION).then(c=>c.addAll(PRECACHE)).catch(()=>{})); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = e.request.url;
  if (url.includes('firebasejs')||url.includes('firebaseapp.com')||url.includes('firebasedatabase.app')||url.includes('googleapis.com')||url.includes('gstatic.com')||url.includes('accounts.google.com')) { e.respondWith(fetch(e.request)); return; }
  if (e.request.headers.get('accept')?.includes('text/html')) { e.respondWith(fetch(e.request).then(res=>{const c=res.clone();caches.open(CACHE_VERSION).then(ca=>ca.put(e.request,c));return res;}).catch(()=>caches.match(e.request))); return; }
  e.respondWith(caches.match(e.request).then(cached=>{if(cached)return cached;return fetch(e.request).then(res=>{if(res&&res.status===200){const c=res.clone();caches.open(CACHE_VERSION).then(ca=>ca.put(e.request,c));}return res;});}));
});