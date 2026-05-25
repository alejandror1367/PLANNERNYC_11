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
 *
 * Duraciones por defecto (Fase 6.11):
 *   default/success: UI.toastDuration (2s) — confirmación rápida
 *   warning:         3s
 *   error:           4s — errores útiles necesitan más tiempo
 *   validation:      6s — el usuario necesita leer qué hizo mal
 */
export const success    = (msg, duration) => show(msg, 'success', duration);
export const error      = (msg, duration = 4000) => show(msg, 'error', duration);
export const warning    = (msg, duration = 3000) => show(msg, 'warning', duration);
export const validation = (msg, duration = 6000) => show(msg, 'error', duration);

/**
 * Export default agrupado por si se prefiere importar como objeto.
 */
export default { show, hide, success, error, warning, validation };
