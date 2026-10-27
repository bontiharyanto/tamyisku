const CACHE = 'tamyizku-static-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const audio = url.pathname.includes('/storage/v1/object/') || url.pathname.endsWith('.mp3') || url.pathname.endsWith('.m4a');
  if (event.request.method !== 'GET' || audio) {
    event.respondWith(fetch(event.request));
    return;
  }
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      const response = await fetch(event.request);
      if (response.ok && (url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname === '/')) {
        cache.put(event.request, response.clone());
      }
      return response;
    }),
  );
});
