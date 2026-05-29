// ============================================================
// ERROR BANNER · Banner persistente arriba del contenido
// (Fase 6.11)
// ============================================================
// A diferencia del toast (que desaparece), el banner persiste
// hasta que el usuario lo resuelve.
//
// Usado para:
//   - Items en la cola con status 'failed' (botón Reintentar/Borrar)
//   - 3+ fallos de loadAll seguidos (problema persistente del backend)
//
// API:
//   showFailedItems({ count, onRetry, onClear })
//   showLoadError({ onRetry })
//   hide()
// ============================================================

import { $, on, escapeHtml, setHTML } from '../dom.js';

let bannerEl = null;
let currentHandlers = null;

function ensureBanner() {
  if (bannerEl) return bannerEl;

  bannerEl = $('#error-banner');
  if (!bannerEl) {
    bannerEl = document.createElement('div');
    bannerEl.id = 'error-banner';
    bannerEl.className = 'error-banner';
    bannerEl.setAttribute('role', 'alert');
    bannerEl.setAttribute('aria-live', 'assertive');
    bannerEl.hidden = true;
    // Insertar al inicio del body (encima de todo)
    document.body.insertBefore(bannerEl, document.body.firstChild);
  }

  // Delegación: capturar clicks en botones del banner
  on(bannerEl, 'click', (e) => {
    const action = e.target?.dataset?.action;
    if (!action || !currentHandlers) return;

    if (action === 'retry' && typeof currentHandlers.onRetry === 'function') {
      currentHandlers.onRetry();
    } else if (action === 'clear' && typeof currentHandlers.onClear === 'function') {
      currentHandlers.onClear();
    } else if (action === 'dismiss') {
      hide();
    }
  });

  return bannerEl;
}

/**
 * Muestra el banner por items 'failed' en la cola.
 *
 * @param {Object} opts
 * @param {number} opts.count - cantidad de items failed
 * @param {Function} opts.onRetry - callback al tocar "Reintentar"
 * @param {Function} opts.onClear - callback al tocar "Descartar"
 */
export function showFailedItems({ count, onRetry, onClear }) {
  const el = ensureBanner();
  currentHandlers = { onRetry, onClear };

  const plural = count === 1 ? 'cambio' : 'cambios';
  const pluralVerb = count === 1 ? 'pudo' : 'pudieron';

  setHTML(el, `
    <div class="error-banner__inner">
      <div class="error-banner__icon">⚠️</div>
      <div class="error-banner__body">
        <p class="error-banner__title">${count} ${escapeHtml(plural)} no se ${escapeHtml(pluralVerb)} sincronizar</p>
        <p class="error-banner__sub">Tras 5 intentos siguen fallando. Puedes reintentar o descartarlos.</p>
      </div>
      <div class="error-banner__actions">
        <button type="button" class="btn btn--small btn--accent" data-action="retry">Reintentar</button>
        <button type="button" class="btn btn--small btn--outline" data-action="clear">Descartar</button>
      </div>
    </div>
  `);

  el.classList.remove('error-banner--load-error', 'error-banner--schema');
  el.classList.add('error-banner--failed-items');
  el.hidden = false;
}

/**
 * Muestra el banner por problema persistente de carga (loadAll falla).
 *
 * @param {Object} opts
 * @param {Function} opts.onRetry
 */
export function showLoadError({ onRetry }) {
  const el = ensureBanner();
  currentHandlers = { onRetry };

  setHTML(el, `
    <div class="error-banner__inner">
      <div class="error-banner__icon">🔌</div>
      <div class="error-banner__body">
        <p class="error-banner__title">No se puede conectar con el backend</p>
        <p class="error-banner__sub">Múltiples intentos fallaron. Verifica que la URL del Apps Script esté correcta en <code>js/config.js</code>.</p>
      </div>
      <div class="error-banner__actions">
        <button type="button" class="btn btn--small btn--accent" data-action="retry">Reintentar</button>
        <button type="button" class="btn btn--small btn--outline" data-action="dismiss">Cerrar</button>
      </div>
    </div>
  `);

  el.classList.remove('error-banner--failed-items', 'error-banner--schema');
  el.classList.add('error-banner--load-error');
  el.hidden = false;
}

/**
 * Muestra el banner cuando la versión del esquema del backend cambió
 * y el frontend está en una versión vieja (Fase 6.7).
 *
 * @param {Object} opts
 * @param {string} opts.backendVersion
 * @param {string} opts.clientVersion
 * @param {Function} opts.onReload
 */
export function showSchemaMismatch({ backendVersion, clientVersion, onReload }) {
  const el = ensureBanner();
  currentHandlers = { onRetry: onReload };

  setHTML(el, `
    <div class="error-banner__inner">
      <div class="error-banner__icon">✨</div>
      <div class="error-banner__body">
        <p class="error-banner__title">Hay una nueva versión disponible</p>
        <p class="error-banner__sub">El backend está en v${escapeHtml(backendVersion)} y esta app en v${escapeHtml(clientVersion)}. Recarga para obtener los cambios más recientes.</p>
      </div>
      <div class="error-banner__actions">
        <button type="button" class="btn btn--small btn--accent" data-action="retry">Recargar</button>
        <button type="button" class="btn btn--small btn--outline" data-action="dismiss">Después</button>
      </div>
    </div>
  `);

  el.classList.remove('error-banner--failed-items', 'error-banner--load-error');
  el.classList.add('error-banner--schema');
  el.hidden = false;
}

/**
 * Muestra el banner cuando hay una versión nueva del app esperando
 * (service worker nuevo instalado y en waiting) — Fase 7.4.
 *
 * @param {Object} opts
 * @param {Function} opts.onUpdate - callback al tocar "Actualizar"
 */
export function showUpdateAvailable({ onUpdate }) {
  const el = ensureBanner();
  currentHandlers = { onRetry: onUpdate };

  setHTML(el, `
    <div class="error-banner__inner">
      <div class="error-banner__icon">✨</div>
      <div class="error-banner__body">
        <p class="error-banner__title">Nueva versión disponible</p>
        <p class="error-banner__sub">Hay una actualización lista. Actualiza cuando quieras; tus cambios pendientes están a salvo.</p>
      </div>
      <div class="error-banner__actions">
        <button type="button" class="btn btn--small btn--accent" data-action="retry">Actualizar</button>
        <button type="button" class="btn btn--small btn--outline" data-action="dismiss">Después</button>
      </div>
    </div>
  `);

  el.classList.remove('error-banner--failed-items', 'error-banner--load-error', 'error-banner--schema');
  el.classList.add('error-banner--update');
  el.hidden = false;
}

/**
 * Oculta el banner.
 */
export function hide() {
  if (!bannerEl) return;
  bannerEl.hidden = true;
  currentHandlers = null;
}

/**
 * Devuelve true si el banner está visible.
 */
export function isVisible() {
  return !!(bannerEl && !bannerEl.hidden);
}

export default { showFailedItems, showLoadError, showSchemaMismatch, showUpdateAvailable, hide, isVisible };
