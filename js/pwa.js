// ============================================================
// PWA · Registro del Service Worker (Fase 7.3)
// ============================================================
// Registra el service worker y expone un callback para cuando
// hay una versión nueva esperando (lo usa el banner de 7.4).
//
// API:
//   register({ onUpdateReady })
//     onUpdateReady(registration) - se llama cuando un SW nuevo
//                                    está instalado y esperando
//   applyUpdate(registration)     - activa el SW nuevo y recarga
// ============================================================

let updateCallback = null;

/**
 * Registra el service worker.
 * Solo corre en producción (https o localhost); en file:// no aplica.
 *
 * @param {Object} [opts]
 * @param {Function} [opts.onUpdateReady] - callback cuando hay update
 */
export function register(opts = {}) {
  updateCallback = opts.onUpdateReady || null;

  if (!('serviceWorker' in navigator)) {
    console.info('[PWA] Service workers no soportados en este navegador');
    return;
  }

  // Registrar después de load para no competir con el render inicial
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((registration) => {
        console.info('[PWA] Service worker registrado');

        // Detectar un SW nuevo instalándose
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            // Hay un SW nuevo instalado Y ya había uno controlando
            // (es decir: es una actualización, no la primera vez)
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.info('[PWA] Nueva versión disponible');
              if (typeof updateCallback === 'function') {
                updateCallback(registration);
              }
            }
          });
        });
      })
      .catch((err) => {
        console.warn('[PWA] Error registrando service worker:', err);
      });

    // Cuando el SW nuevo toma control, recargar para usarlo
    // Cuando el SW nuevo toma control (tras aceptar el update con el
    // banner de 7.4), recargar para usar la versión nueva.
    // No se dispara solo: requiere que el usuario acepte el update,
    // que es lo que llama applyUpdate() → postMessage SKIP_WAITING.
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  });
}

/**
 * Activa el SW que está esperando y recarga la página.
 * Lo llama el botón "Actualizar" del banner (Fase 7.4).
 *
 * @param {ServiceWorkerRegistration} registration
 */
export function applyUpdate(registration) {
  if (!registration || !registration.waiting) {
    // No hay SW esperando; recarga simple
    window.location.reload();
    return;
  }
  // Decirle al SW que se active ya
  registration.waiting.postMessage({ type: 'SKIP_WAITING' });
}

export default { register, applyUpdate };
