// ============================================================
// SYNC STATUS · Indicador flotante (Fase 6.3 — extendido)
// ============================================================
// Estados:
//   idle     - sin URL configurada
//   syncing  - llamada en curso
//   success  - última sync OK
//   error    - última sync falló
//   offline  - sin conexión a internet (NUEVO)
//   pending  - hay cambios encolados sin sincronizar (NUEVO)
//
// API:
//   setState(state, message?)  - cambia estado + texto
//   setPendingCount(n)         - actualiza el badge de cambios pendientes
//   idle() / syncing() / success() / error() / offline() / pending()
//
// Reglas de prioridad (de mayor a menor):
//   offline > syncing > pending > error > success > idle
// El componente respeta la prioridad: si está offline, no muestra "pending".
// ============================================================

import { $ } from '../dom.js';

const STATES = ['idle', 'syncing', 'success', 'error', 'offline', 'pending'];

// Estado interno reactivo
const state = {
  current: 'idle',
  message: 'Sin conectar',
  pendingCount: 0,
};

/**
 * Aplica el estado visual al DOM.
 */
function applyToDOM() {
  const el = $('#sync-status');
  if (!el) return;

  STATES.forEach(s => el.classList.remove(`sync-status--${s}`));
  el.classList.add(`sync-status--${state.current}`);

  const textEl = $('#sync-status-text');
  if (textEl) {
    let displayMessage = state.message;

    // Si está pending, anteponer el conteo
    if (state.current === 'pending' && state.pendingCount > 0) {
      const word = state.pendingCount === 1 ? 'cambio' : 'cambios';
      displayMessage = `${state.pendingCount} ${word} pendiente${state.pendingCount === 1 ? '' : 's'}`;
    }

    textEl.textContent = displayMessage;
  }

  // aria-live region implícita: el contenido cambia, lo lee VoiceOver
  // (se formaliza en Fase 6.10 con aria-live="polite" en el HTML)
}

/**
 * Cambia el estado visual del indicador.
 *
 * Regla: si estamos offline, ningún otro estado puede sobrescribir
 * excepto otro 'offline' explícito o un 'syncing' (cuando vuelva la red).
 *
 * @param {'idle'|'syncing'|'success'|'error'|'offline'|'pending'} newState
 * @param {string} [message]
 */
export function setState(newState, message) {
  if (!STATES.includes(newState)) {
    console.warn('syncStatus: estado inválido', newState);
    return;
  }

  // Si está offline y nos piden cambiar a algo que no sea syncing/offline,
  // ignoramos (el dispositivo realmente no tiene red).
  if (state.current === 'offline' && newState !== 'offline' && newState !== 'syncing') {
    // Excepción: si nos piden 'pending', sí lo aceptamos (tiene sentido
    // marcar que hay cambios aunque sigamos offline; pero priorizamos offline)
    if (newState === 'pending') return;
  }

  state.current = newState;
  if (message !== undefined) state.message = message;

  applyToDOM();
}

/**
 * Actualiza el contador de cambios pendientes.
 * Si count > 0 y no hay otro estado prioritario, fuerza a 'pending'.
 * Si count == 0 y estábamos en 'pending', vuelve a 'success'.
 */
export function setPendingCount(count) {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  const previous = state.pendingCount;
  state.pendingCount = n;

  // No re-render si no cambió y no estamos en pending
  if (n === previous && state.current !== 'pending') return;

  // Si no estamos offline ni sincronizando, gestionar transición pending ↔ success
  const cur = state.current;
  if (n > 0 && cur !== 'offline' && cur !== 'syncing') {
    state.current = 'pending';
  } else if (n === 0 && cur === 'pending') {
    // Volvió a sincronizarse todo
    state.current = 'success';
    state.message = '✓ Sincronizado';
  }

  applyToDOM();
}

/**
 * Devuelve el estado actual (útil para queue.js en Fase 6.1).
 */
export function getCurrentState() {
  return { ...state };
}

// Atajos por estado con mensajes por defecto
export const idle    = () => setState('idle',    'Sin conectar');
export const syncing = (msg = 'Sincronizando...') => setState('syncing', msg);
export const success = (msg = '✓ Sincronizado')   => setState('success', msg);
export const error   = (msg = '✗ Error de sync')  => setState('error',   msg);
export const offline = (msg = 'Sin conexión')     => setState('offline', msg);
export const pending = (msg)                       => setState('pending', msg);

/**
 * Inicializa el componente.
 * Si el navegador ya está offline al cargar la app, parte en 'offline'.
 */
export function init() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    setState('offline', 'Sin conexión');
  } else {
    setState('idle', 'Sin conectar');
  }
}

export default {
  setState, setPendingCount, getCurrentState,
  idle, syncing, success, error, offline, pending,
  init
};
