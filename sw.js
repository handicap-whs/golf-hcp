// Golf HCP Service Worker
//
// REGLA CRITICA: actualizar APP_VERSION en CADA release. Eso renombra el cache
// (golf-hcp-v<APP_VERSION>), lo que provoca que el navegador detecte SW nuevo,
// purgue el cache antiguo en 'activate', y el cliente se autoactualice silenciosamente.
//
// El bumpeo de APP_VERSION es OBLIGATORIO incluso aunque el sw.js no haya cambiado
// en logica -- es lo que dispara la actualizacion en clientes ya instalados.
//
// v1.34.223: VUELTO a self.skipWaiting() automatico en 'install'. Eliminado el banner
// "Nueva version disponible / Recargar" del index.html porque era redundante:
// el HTML cacheado se sirve via network-first, asi que el usuario ya ve la version
// nueva (numero de version actualizado en Inicio) cuando aparecia el banner.
// Estrategia ahora: el SW nuevo toma el control silenciosamente, el cliente lo
// detecta via 'controllerchange' y hace location.reload() automatico.
const APP_VERSION = '1.34.224';
const CACHE = 'golf-hcp-v' + APP_VERSION;

// Lista de assets a precachear durante la instalacion.
const ASSETS = [
  './',
  './index.html',
  './404.html',
  './manifest.json',
  './apple-splash.png',
  './login-bg-1.jpg',
  './login-bg-2.jpg',
  './login-bg-3.jpg',
  './login-bg-4.jpg',
  './login-bg-5.jpg',
  './login-bg-6.jpg',
  './login-bg-7.jpg',
  './login-bg-8.jpg',
  './login-bg-9.jpg',
  './login-bg-10.jpg'
];

self.addEventListener('install', event => {
  // v1.34.223: skipWaiting() automatico. El SW nuevo toma el control sin esperar
  // confirmacion del usuario. La actualizacion es transparente.
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(cache => {
      // allSettled para tolerar que alguna foto opcional no este sin romper instalacion
      return Promise.allSettled(
        ASSETS.map(url => cache.add(url).catch(err => {
          console.warn('[SW] No se pudo precachear ' + url + ':', err);
        }))
      );
    })
  );
});

self.addEventListener('activate', event => {
  // Al activar: borrar TODOS los caches que no sean el actual.
  // Esto purga automaticamente los de versiones anteriores.
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => {
          console.log('[SW] Purgando cache antiguo:', k);
          return caches.delete(k);
        })
      ))
      .then(() => self.clients.claim())
  );
});

// Network-first para index.html: siempre intenta descargar la version mas reciente.
// Si falla la red (offline), sirve el index.html cacheado.
// Cache-first para todo lo demas: rendimiento sin sacrificar frescura del HTML.
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const isHtml = url.pathname === '/' ||
                 url.pathname.endsWith('/') ||
                 url.pathname.endsWith('index.html');

  if (isHtml) {
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
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(event.request, clone)).catch(() => {});
          }
          return res;
        }).catch(() => {
          return new Response('', { status: 504, statusText: 'Gateway Timeout' });
        });
      })
    );
  }
});
