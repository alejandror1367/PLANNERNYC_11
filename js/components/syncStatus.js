// ============================================================
// SYNC STATUS · Indicador flotante arriba a la derecha
// Estados: idle, syncing, success, error
// API: setState(state, msg), setLastSync(date)
// ============================================================

import { $ } from '../dom.js';

const STATES = ['idle', 'syncing', 'success', 'error'];

/**
 * Cambia el estado visual del indicador.
 * @param {'idle'|'syncing'|'success'|'error'} state
 * @param {string} [message]
 */
export function setState(state, message) {
  const el = $('#sync-status');
  if (!el) return;

  // Quitar estados previos
  STATES.forEach(s => el.classList.remove(`sync-status--${s}`));
  el.classList.add(`sync-status--${state}`);

  const textEl = $('#sync-status-text');
  if (textEl && message !== undefined) {
    textEl.textContent = message;
  }
}

/**
 * Atajos por estado con mensaje por defecto.
 */
export const idle    = () => setState('idle',    'Sin conectar');
export const syncing = (msg = 'Sincronizando...') => setState('syncing', msg);
export const success = (msg = '✓ Sincronizado')   => setState('success', msg);
export const error   = (msg = '✗ Error de sync')  => setState('error',   msg);

/**
 * Inicializa el componente (asegura estado inicial idle).
 */
export function init() {
  setState('idle', 'Sin conectar');
}

export default { setState, idle, syncing, success, error, init };
