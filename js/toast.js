// ============================================================
// TOAST · Notificaciones flotantes en la parte inferior
// API simple: toast.show(msg), toast.success(msg), toast.error(msg)
// ============================================================

import { UI } from './config.js';

let toastEl = null;
let hideTimeout = null;

/**
 * Crea el elemento toast en el DOM si no existe.
 */
function ensureToastEl() {
  if (toastEl) return toastEl;

  toastEl = document.createElement('div');
  toastEl.className = 'toast';
  toastEl.setAttribute('role', 'status');
  toastEl.setAttribute('aria-live', 'polite');
  toastEl.setAttribute('aria-atomic', 'true');
  document.body.appendChild(toastEl);

  return toastEl;
}

/**
 * Muestra un toast.
 * @param {string} message
 * @param {'default'|'success'|'error'|'warning'} [type='default']
 * @param {number} [duration] - ms (usa UI.toastDuration por defecto)
 */
export function show(message, type = 'default', duration) {
  const el = ensureToastEl();

  // Reset clases (mantener 'toast')
  el.className = 'toast';
  if (type !== 'default') {
    el.classList.add(`toast--${type}`);
  }

  el.textContent = message;

  // Forzar reflow para reiniciar la animación
  void el.offsetWidth;

  // Mostrar
  el.classList.add('is-visible');

  // Programar ocultado
  clearTimeout(hideTimeout);
  const visibleFor = duration ?? UI.toastDuration;
  hideTimeout = setTimeout(() => hide(), visibleFor);
}

/**
 * Oculta el toast actual.
 */
export function hide() {
  if (!toastEl) return;
  toastEl.classList.remove('is-visible');
  clearTimeout(hideTimeout);
}

/**
 * Atajos por tipo.
 */
export const success = (msg, duration) => show(msg, 'success', duration);
export const error   = (msg, duration) => show(msg, 'error', duration);
export const warning = (msg, duration) => show(msg, 'warning', duration);

/**
 * Export default agrupado por si se prefiere importar como objeto.
 */
export default { show, hide, success, error, warning };
