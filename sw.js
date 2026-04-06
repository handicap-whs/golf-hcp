// ── Golf HCP · Service Worker ─────────────────────────────────────
const CACHE_VERSION = 'golf-hcp-v13';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './supabase.min.js'   // ← cacheado localmente, funciona sin red
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Cache First — la app abre siempre desde caché aunque no haya red
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Ignorar requests externos (Supabase API, Google Fonts)
  if (url.origin !== self.location.origin) return;

  // Stale-While-Revalidate para archivos propios
  event.respondWith(
    caches.open(CACHE_VERSION).then(async cache => {
      const cached = await cache.match(event.request);

      const networkFetch = fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            cache.put(event.request, response.clone());
          }
          return response;
        })
        .catch(() => null);

      // Devolver caché inmediatamente si existe, red si no
      return cached || networkFetch;
    })
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
