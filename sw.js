// ============================================================
// SERVICE WORKER · Travel Planner PWA (Fase 7.3 + 7.5)
// ============================================================
// Da soporte offline a la app:
//   - Precachea todos los assets estáticos al instalar
//   - Cache-first para estáticos (HTML/CSS/JS/JSON/iconos)
//   - Network-first con fallback a cache para la lectura del backend
//   - Stale-while-revalidate para fuentes externas
//   - Limpia caches viejos al activar una versión nueva
//
// VERSIONADO (Fase 7.5):
//   CACHE_VERSION se bumpea en cada deploy. Cambiar este string
//   invalida todo el cache viejo y fuerza una recarga de assets.
//   Convención: 'tpYYYYMMDD-HHMMSS' (timestamp del build).
// ============================================================

const CACHE_VERSION = 'tp20260530-031936';
const STATIC_CACHE  = `tp-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `tp-runtime-${CACHE_VERSION}`;
const DATA_CACHE    = `tp-data-${CACHE_VERSION}`;

// Assets estáticos a precachear en la instalación.
// Rutas relativas al scope del SW (raíz del repo).
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './sw-uninstall.html',

  // CSS
  './css/tokens.css',
  './css/base.css',
  './css/layout.css',
  './css/components.css',
  './css/views.css',
  './css/budget.css',
  './css/responsive.css',
  './css/motion.css',

  // JS core
  './js/config.js',
  './js/app.js',
  './js/api.js',
  './js/store.js',
  './js/sync.js',
  './js/queue.js',
  './js/router.js',
  './js/storage.js',
  './js/dom.js',
  './js/format.js',
  './js/toast.js',
  './js/data.js',
  './js/budget.js',
  './js/charts.js',
  './js/trip.js',
  './js/pwa.js',
  './js/maps.js',

  // JS componentes
  './js/components/activityModal.js',
  './js/components/confirmModal.js',
  './js/components/errorBanner.js',
  './js/components/syncStatus.js',
  './js/components/countdownHero.js',
  './js/components/travelCues.js',
  './js/components/dayModal.js',
  './js/components/intensityTimeline.js',

  // JS vistas
  './js/views/overview.js',
  './js/views/itinerary.js',
  './js/views/budget.js',
  './js/views/transport.js',
  './js/views/apps.js',
  './js/views/notes.js',

  // Data estática
  './data/transport.json',
  './data/apps.json',
  './data/emergency.json',

  // Iconos
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './icons/favicon-16.png',
];

// ============================================================
// INSTALL · precachea los assets estáticos
// ============================================================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        // addAll falla entero si un solo asset falla; usamos
        // un enfoque tolerante para no romper la instalación
        return Promise.allSettled(
          PRECACHE_ASSETS.map((url) =>
            cache.add(url).catch((err) => {
              console.warn('[SW] No se pudo precachear:', url, err);
            })
          )
        );
      })
      .then(() => {
        // Activar inmediatamente sin esperar a que cierren las pestañas
        return self.skipWaiting();
      })
  );
});

// ============================================================
// ACTIVATE · limpia caches de versiones anteriores
// ============================================================
self.addEventListener('activate', (event) => {
  const validCaches = [STATIC_CACHE, RUNTIME_CACHE, DATA_CACHE];

  event.waitUntil(
    caches.keys()
      .then((keys) => {
        return Promise.all(
          keys
            .filter((key) => key.startsWith('tp-') && !validCaches.includes(key))
            .map((key) => {
              console.log('[SW] Borrando cache viejo:', key);
              return caches.delete(key);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// ============================================================
// FETCH · enruta cada petición a su estrategia
// ============================================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo manejamos GET. POST (mutaciones) pasan directo a la red:
  // el offline de mutaciones lo maneja la cola (Fase 6.1).
  if (request.method !== 'GET') {
    return; // deja que el navegador lo maneje normal
  }

  // El kill switch (sw-uninstall.html) NUNCA se cachea ni se sirve
  // desde cache: debe llegar siempre fresco de la red para poder
  // desinstalar el SW de forma confiable (Fase 7.6).
  if (url.pathname.endsWith('sw-uninstall.html')) {
    return; // pasa directo a la red
  }

  // 1. Llamadas al backend Apps Script → network-first
  if (isBackendRequest(url)) {
    event.respondWith(networkFirst(request));
    return;
  }

  // 2. Fuentes de Google → stale-while-revalidate
  if (isFontRequest(url)) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
    return;
  }

  // 3. Mismo origen (assets de la app) → cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // 4. Cualquier otra cosa externa → stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
});

// ============================================================
// ESTRATEGIAS
// ============================================================

/**
 * Cache-first: sirve del cache; si no está, va a la red y guarda.
 * Ideal para assets que no cambian dentro de una versión.
 */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // Sin red y sin cache: para navegación devolvemos el index
    if (request.mode === 'navigate') {
      const fallback = await caches.match('./index.html');
      if (fallback) return fallback;
    }
    throw err;
  }
}

/**
 * Network-first: intenta la red; si falla, usa cache.
 * Ideal para la lectura del backend (getAll): datos frescos si hay
 * red, última copia conocida si no.
 */
async function networkFirst(request) {
  const cache = await caches.open(DATA_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}

/**
 * Stale-while-revalidate: sirve cache al instante y actualiza
 * en background. Ideal para fuentes e imágenes externas.
 */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response && response.status === 200) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached); // si falla la red, usa lo cacheado

  return cached || fetchPromise;
}

// ============================================================
// HELPERS de detección
// ============================================================

function isBackendRequest(url) {
  // Apps Script vive en script.google.com / googleusercontent
  return url.hostname.includes('script.google.com') ||
         url.hostname.includes('googleusercontent.com');
}

function isFontRequest(url) {
  return url.hostname.includes('fonts.googleapis.com') ||
         url.hostname.includes('fonts.gstatic.com');
}

// ============================================================
// MENSAJES · permite al frontend forzar activación (Fase 7.4)
// ============================================================
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
