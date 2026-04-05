// ── Golf HCP · Service Worker ────────────────────────────────────
// Incrementa este número con cada despliegue para forzar actualización
const CACHE_VERSION = 'golf-hcp-v11';
const ASSETS = ['./', './index.html', './manifest.json'];

// ── INSTALL: cachear assets — NO llamar skipWaiting aquí ─────────
// Si llamamos skipWaiting en install, el SW se activa solo sin pasar
// por estado "waiting", y el banner de actualización nunca aparece.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => cache.addAll(ASSETS))
  );
  // NO llamar self.skipWaiting() aquí — esperamos orden del usuario
});

// ── ACTIVATE: borrar caches antiguas ─────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: Network first para HTML, cache first para el resto ─────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname === '/' || url.pathname.endsWith('index.html')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200)
            caches.open(CACHE_VERSION).then(c => c.put(event.request, response.clone()));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200)
          caches.open(CACHE_VERSION).then(c => c.put(event.request, response.clone()));
        return response;
      });
    })
  );
});

// ── MENSAJE desde la página: el usuario pulsó "Actualizar" ───────
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting(); // Solo ahora activamos el nuevo SW
  }
});
