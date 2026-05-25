// ============================================================
// QUEUE · Cola de mutaciones offline (Fase 6.1)
// ============================================================
// Si una mutación falla por red, se encola en localStorage y se
// reintenta con backoff exponencial. Cuando vuelve la conexión
// (o se llama drain() manualmente), se procesa en orden FIFO.
//
// API pública:
//   enqueue(action, data)     - añade item a la cola
//   drain()                   - intenta procesar todos los items
//   getItems()                - devuelve copia del estado actual
//   removeItem(id)            - elimina un item específico
//   retryFailed()             - reintenta items en estado 'failed'
//   subscribe(fn)             - notifica cambios en la cola
//   init()                    - carga desde localStorage al arrancar
//
// Estados de un item:
//   'pending'  - esperando intento
//   'retrying' - en backoff entre intentos
//   'failed'   - alcanzó maxAttempts (requiere intervención)
// ============================================================

import { STORAGE_KEYS, QUEUE } from './config.js';
import { callAction, isNetworkError, isValidationError } from './api.js';
import * as syncStatus from './components/syncStatus.js';

/**
 * Items en memoria. La fuente de verdad es localStorage,
 * pero leemos de aquí para rendimiento.
 */
let items = [];

/**
 * Suscriptores notificados cuando cambia la cola.
 */
const subscribers = new Set();

/**
 * Flag para evitar drenados concurrentes.
 */
let isDraining = false;

/**
 * Timeouts activos de retry programados.
 */
const retryTimers = new Map();

// ============================================================
// PERSISTENCIA
// ============================================================

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.queue);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (err) {
    console.warn('queue: error leyendo localStorage', err);
    return [];
  }
}

function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEYS.queue, JSON.stringify(items));
  } catch (err) {
    console.warn('queue: error guardando en localStorage', err);
  }
}

// ============================================================
// HELPERS DE ESTADO
// ============================================================

function generateQueueId() {
  return 'q_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

function notify() {
  // Pendientes activos (no failed) para el contador del badge
  const activeCount = items.filter(it => it.status !== 'failed').length;
  syncStatus.setPendingCount(activeCount);

  const snapshot = items.map(it => ({ ...it }));
  subscribers.forEach(fn => {
    try { fn(snapshot); }
    catch (err) { console.warn('queue subscriber error:', err); }
  });
}

function setItem(id, patch) {
  const idx = items.findIndex(it => it.id === id);
  if (idx === -1) return;
  items[idx] = { ...items[idx], ...patch };
  saveToStorage();
  notify();
}

function dropItem(id) {
  items = items.filter(it => it.id !== id);
  saveToStorage();
  notify();
  // Cancelar timer si lo había
  const timer = retryTimers.get(id);
  if (timer) {
    clearTimeout(timer);
    retryTimers.delete(id);
  }
}

// ============================================================
// API PÚBLICA
// ============================================================

/**
 * Inicializa la cola: carga desde localStorage y notifica.
 * Si hay items pendientes y el navegador está online, dispara drain().
 */
export function init() {
  items = loadFromStorage();

  // Normalizar items en 'retrying' a 'pending' al recargar
  // (no podemos restaurar timers de retries en curso)
  items = items.map(it => {
    if (it.status === 'retrying') return { ...it, status: 'pending' };
    return it;
  });
  saveToStorage();
  notify();

  // Si hay cola y estamos online, drenar
  if (items.length > 0 && navigator.onLine) {
    drain().catch(err => console.warn('init drain:', err));
  }
}

/**
 * Devuelve copia inmutable del estado actual de la cola.
 */
export function getItems() {
  return items.map(it => ({ ...it }));
}

/**
 * Devuelve el conteo de items pendientes (no failed).
 */
export function getPendingCount() {
  return items.filter(it => it.status !== 'failed').length;
}

/**
 * Suscribe una función al estado de la cola.
 * Devuelve función para desuscribir.
 */
export function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

/**
 * Añade una nueva mutación a la cola.
 * No la ejecuta inmediatamente — eso lo hace drain().
 *
 * @param {string} action - nombre del endpoint
 * @param {Object} data   - payload (debe incluir clientId si aplica)
 * @returns {Object} el item creado
 */
export function enqueue(action, data) {
  if (!QUEUE.enqueueableActions.has(action)) {
    throw new Error(`Acción no encolable: ${action}`);
  }

  const item = {
    id: generateQueueId(),
    action,
    data,
    attempts: 0,
    firstQueuedAt: Date.now(),
    lastError: null,
    status: 'pending',
  };
  items.push(item);
  saveToStorage();
  notify();

  // Si estamos online, intentar drenar (será una llamada nueva)
  if (navigator.onLine) {
    drain().catch(err => console.warn('enqueue drain:', err));
  }

  return item;
}

/**
 * Elimina un item de la cola (cancela retries pendientes).
 */
export function removeItem(id) {
  dropItem(id);
}

/**
 * Limpia toda la cola (acción manual del usuario).
 */
export function clearAll() {
  retryTimers.forEach(t => clearTimeout(t));
  retryTimers.clear();
  items = [];
  saveToStorage();
  notify();
}

/**
 * Reintenta los items marcados como 'failed'.
 * Resetea attempts y los pone como 'pending'.
 */
export function retryFailed() {
  let changed = false;
  items = items.map(it => {
    if (it.status === 'failed') {
      changed = true;
      return { ...it, status: 'pending', attempts: 0, lastError: null };
    }
    return it;
  });
  if (changed) {
    saveToStorage();
    notify();
    if (navigator.onLine) {
      drain().catch(err => console.warn('retryFailed drain:', err));
    }
  }
}

/**
 * Procesa la cola completa en orden FIFO.
 * Para cada item:
 *   - intenta la llamada
 *   - éxito → elimina de la cola
 *   - error de validación → marca failed (no se reintenta)
 *   - error de red → programa retry con backoff
 *
 * Idempotente: si se llama varias veces simultáneas, solo una corre.
 */
export async function drain() {
  if (isDraining) return;
  if (!navigator.onLine) return;
  if (items.length === 0) return;

  isDraining = true;

  try {
    // Procesar solo items en 'pending' (los failed quedan)
    // Snapshot en el momento del drain
    let queue = items.filter(it => it.status === 'pending');

    for (const item of queue) {
      if (!navigator.onLine) break; // perdimos red en medio del drenado

      // Marcar como retrying mientras se procesa
      setItem(item.id, { status: 'retrying' });

      try {
        await callAction(item.action, item.data);
        // Éxito → quitar de la cola
        dropItem(item.id);
      } catch (err) {
        if (isValidationError(err)) {
          // No se reintenta: el payload está malo
          setItem(item.id, {
            status: 'failed',
            lastError: err.message || 'Validación falló',
            attempts: item.attempts + 1,
          });
        } else if (isNetworkError(err)) {
          // Error de red — programar retry con backoff
          const nextAttempts = item.attempts + 1;
          if (nextAttempts >= QUEUE.maxAttempts) {
            setItem(item.id, {
              status: 'failed',
              lastError: 'Sin conexión tras ' + QUEUE.maxAttempts + ' intentos',
              attempts: nextAttempts,
            });
          } else {
            const delay = QUEUE.backoffMs[nextAttempts - 1] || 60000;
            setItem(item.id, {
              status: 'pending',  // queda como pending; el timer la procesa
              attempts: nextAttempts,
              lastError: err.message || 'Error de red',
            });
            scheduleRetry(item.id, delay);
          }
          // Cortar el drenado actual: probablemente todos van a fallar
          break;
        } else {
          // Error inesperado del backend (ej. 500): tratar como reintentble
          // pero contar como intento
          const nextAttempts = item.attempts + 1;
          if (nextAttempts >= QUEUE.maxAttempts) {
            setItem(item.id, {
              status: 'failed',
              lastError: err.message || 'Error desconocido',
              attempts: nextAttempts,
            });
          } else {
            const delay = QUEUE.backoffMs[nextAttempts - 1] || 60000;
            setItem(item.id, {
              status: 'pending',
              attempts: nextAttempts,
              lastError: err.message || 'Error',
            });
            scheduleRetry(item.id, delay);
          }
        }
      }
    }
  } finally {
    isDraining = false;
  }
}

/**
 * Programa un retry individual de un item después de `delay` ms.
 */
function scheduleRetry(itemId, delay) {
  // Cancelar timer previo si lo hay
  const prev = retryTimers.get(itemId);
  if (prev) clearTimeout(prev);

  const timer = setTimeout(() => {
    retryTimers.delete(itemId);
    // Reintenta drenando toda la cola (procesa este y los que sigan)
    if (navigator.onLine) {
      drain().catch(err => console.warn('scheduled drain:', err));
    }
  }, delay);

  retryTimers.set(itemId, timer);
}

export default {
  init, enqueue, drain,
  getItems, getPendingCount, subscribe,
  removeItem, clearAll, retryFailed,
};
