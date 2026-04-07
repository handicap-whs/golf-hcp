// ── Golf HCP · Service Worker ─────────────────────────────────────
// Cambia este número en CADA despliegue para forzar actualización
const CACHE_VERSION = 'golf-hcp-v17';

const LOCAL_ASSETS = ['./', './index.html', './manifest.json'];
const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js'
];

// INSTALL: cachear assets y CDN
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(async cache => {
      await cache.addAll(LOCAL_ASSETS);
      await Promise.allSettled(
        CDN_ASSETS.map(url =>
          fetch(url, {mode:'cors',credentials:'omit'})
            .then(r => { if(r.ok) cache.put(url, r); })
            .catch(()=>{})
        )
      );
    })
  );
  // Activar inmediatamente sin esperar
  self.skipWaiting();
});

// ACTIVATE: limpiar caches viejas y tomar control inmediato
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// FETCH: Network first para index.html (detecta actualizaciones)
//        Cache first para el resto (rendimiento)
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Ignorar requests externos excepto CDN cacheado
  if (url.origin !== self.location.origin) {
    // Para CDN: cache first
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response && response.status === 200) {
            caches.open(CACHE_VERSION).then(c => c.put(event.request, response.clone()));
          }
          return response;
        });
      })
    );
    return;
  }

  // Para index.html: Network first — detecta nueva versión
  const isHtml = url.pathname === '/' || 
                 url.pathname.endsWith('index.html') || 
                 url.pathname === '/golf-hcp/' ||
                 url.pathname === '/golf-hcp';

  if (isHtml) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            // Guardar nueva versión en caché
            caches.open(CACHE_VERSION).then(c => c.put(event.request, response.clone()));
          }
          return response;
        })
        .catch(() => {
          // Sin red: servir desde caché
          return caches.match('./index.html');
        })
    );
    return;
  }

  // Para el resto: Cache first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200) {
          caches.open(CACHE_VERSION).then(c => c.put(event.request, response.clone()));
        }
        return response;
      }).catch(() => new Response('', {status: 503}));
    })
  );
});

// MENSAJE: recibir orden de activar nueva versión
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
