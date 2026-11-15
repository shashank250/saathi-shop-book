const CACHE = 'saathi-shell-v3';
const ROOT = self.registration.scope;
const SHELL = [ROOT, ROOT + 'index.html', ROOT + 'styles.css', ROOT + 'app.js', ROOT + 'manifest.json', ROOT + 'manifest-satyam.json', ROOT + 'icon.svg', ROOT + 'satyam/index.html', ROOT + 'shop/index.html'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('saathi-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(ROOT + 'index.html', copy)); return response;
    }).catch(() => caches.match(ROOT + 'index.html')));
    return;
  }
  event.respondWith(fetch(request).then(response => {
    if (response.ok) caches.open(CACHE).then(cache => cache.put(request, response.clone()));
    return response;
  }).catch(() => caches.match(request)));
});
