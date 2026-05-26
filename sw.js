// Golf HCP Service Worker — versión minimalista (v1.34.225)
//
// Estrategia: SIN versionado de cache, SIN precache de assets.
// Network-first para HTML, cache-first dinamico para todo lo demas.
// El cache se rellena progresivamente segun el usuario va navegando.
//
// Ventaja clave: este sw.js NO necesita modificarse en cada release.
// Una vez subido funciona indefinidamente. Solo el index.html cambia en
// cada release y se distribuye correctamente porque su fetch es network-first.
//
// skipWaiting + clients.claim aseguran que cualquier cambio que SI hagamos
// al sw.js en el futuro se aplique sin intervencion del usuario.

const CACHE = 'golf-hcp-cache';

self.addEventListener('install', event => {
  // Toma el control inmediatamente sin esperar
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  // Reclamar control de las pestañas existentes
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  // Solo interceptar GET del mismo origen
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const isHtml = url.pathname === '/' ||
                 url.pathname.endsWith('/') ||
                 url.pathname.endsWith('index.html');

  if (isHtml) {
    // NETWORK-FIRST para HTML: siempre buscar la version mas reciente.
    // Si la red falla, servir el index.html cacheado (modo offline).
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' })
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(event.request, clone)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
  } else {
    // CACHE-FIRST para assets (JS, CSS, imagenes, fuentes): rapido y offline-friendly.
    // Si no esta en cache, descarga de red y guarda en cache para la proxima vez.
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(event.request, clone)).catch(() => {});
          }
          return res;
        }).catch(() => new Response('', { status: 504, statusText: 'Gateway Timeout' }));
      })
    );
  }
});
