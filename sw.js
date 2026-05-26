// Golf HCP Service Worker v1.34.210
//
// REGLA CRITICA: actualizar APP_VERSION en CADA release. Eso renombra el cache
// (golf-hcp-v<APP_VERSION>), lo que provoca que el navegador detecte SW nuevo,
// purgue el cache antiguo en 'activate', y dispare el toast "Recargar" del index.html.
//
// El bumpeo de APP_VERSION es OBLIGATORIO incluso aunque el sw.js no haya cambiado
// en logica -- es lo que dispara la actualizacion en clientes ya instalados.
const APP_VERSION = '1.34.210';
const CACHE = 'golf-hcp-v' + APP_VERSION;

// Lista de assets a precachear durante la instalacion.
// v1.34.210: añadidas las 10 fotos del set rotativo de login/splash y el manifest.
// Si añades mas fotos al set (login-bg-11.jpg, etc), añadelas tambien aqui.
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
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
  // skipWaiting inmediato: el SW nuevo no espera a que se cierren todas las pestañas.
  // Combinado con el toast del index.html, el usuario decide cuando aplicar la actualizacion.
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(cache => {
      // addAll falla si CUALQUIER asset no carga -> usar Promise.allSettled para tolerar
      // que alguna foto opcional no este (no romper la instalacion entera).
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
  // Esto purga automaticamente los de versiones anteriores (golf-hcp-v19, v1.34.209, etc).
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
  // Solo interceptar peticiones GET del mismo origen
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const isHtml = url.pathname === '/' ||
                 url.pathname.endsWith('/') ||
                 url.pathname.endsWith('index.html');

  if (isHtml) {
    // NETWORK-FIRST para HTML: asegura que el usuario siempre intenta cargar el index.html mas reciente.
    // Si la red falla (avion, sin cobertura), cae al cache.
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
    // CACHE-FIRST para assets (JS, CSS, imagenes, fuentes): rapido y funciona offline.
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
          // Sin red y sin cache: que el navegador maneje el fallo
          return new Response('', { status: 504, statusText: 'Gateway Timeout' });
        });
      })
    );
  }
});

// Mensaje del cliente para forzar activacion del SW nuevo (boton "Recargar" del toast).
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
