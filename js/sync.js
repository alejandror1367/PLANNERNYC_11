// ============================================================
// SYNC · Auto-refresh + listeners de red (Fase 6.3)
// ============================================================
// - Refresca cada UI.autoRefreshMs si el tab está visible
// - Refresca al volver visible después de estar oculto
// - Conecta el estado del store con el componente sync status
// - Detecta online/offline del navegador
// - Cuando vuelve la red: dispara refresh inmediato
// ============================================================

import { UI } from './config.js';
import { on, isDocumentVisible } from './dom.js';
import * as store from './store.js';
import * as queue from './queue.js';
import * as syncStatus from './components/syncStatus.js';
import * as errorBanner from './components/errorBanner.js';
import * as toast from './toast.js';

let intervalId = null;
let initialized = false;
let wasOffline = false;
let consecutiveLoadErrors = 0;
const LOAD_ERROR_THRESHOLD = 3;

/**
 * Refresca silenciosamente (sin toast).
 * Lleva cuenta de fallos consecutivos para mostrar banner persistente.
 */
async function silentRefresh() {
  try {
    await store.refresh();
    // Éxito: resetear contador y ocultar banner si estaba mostrado por load error
    if (consecutiveLoadErrors > 0) {
      consecutiveLoadErrors = 0;
      // Solo ocultar si el banner era de load error (no de failed items)
      if (errorBanner.isVisible()) {
        // No tocamos el de failed items; ese lo maneja queue subscriber
      }
    }
  } catch (err) {
    consecutiveLoadErrors += 1;
    console.warn(`silentRefresh (fallo ${consecutiveLoadErrors}/${LOAD_ERROR_THRESHOLD}):`, err);

    if (consecutiveLoadErrors >= LOAD_ERROR_THRESHOLD && navigator.onLine) {
      // Backend persistentemente caído
      errorBanner.showLoadError({
        onRetry: () => {
          consecutiveLoadErrors = 0;
          errorBanner.hide();
          silentRefresh();
        }
      });
    }
  }
}

/**
 * Refresh manual desde un botón (con toast).
 */
export async function manualRefresh() {
  if (!navigator.onLine) {
    toast.error('Sin conexión — no se puede refrescar');
    return;
  }
  syncStatus.syncing('Refrescando...');
  try {
    await store.refresh();
    toast.success('Datos actualizados ✓');
  } catch (err) {
    toast.error('Error al refrescar: ' + (err.message || ''));
  }
}

/**
 * Reacciona a cambios de estado del store y actualiza el sync status.
 * Respeta el estado offline: si no hay red, no sobrescribimos con success.
 */
function bindStoreToSyncStatus() {
  store.subscribe((state) => {
    // Si no hay red, dejar que offline mande
    if (!navigator.onLine) {
      syncStatus.offline();
      return;
    }

    switch (state.status) {
      case 'loading':
        syncStatus.syncing('Sincronizando...');
        break;
      case 'ready':
        syncStatus.success('✓ Sincronizado');
        break;
      case 'error':
        syncStatus.error('✗ ' + (state.errorMessage || 'Error'));
        break;
      case 'idle':
        syncStatus.idle();
        break;
    }
  });
}

/**
 * Handler de evento "online": volvió la red.
 * Si estábamos offline, drena la cola y refresca.
 */
async function handleOnline() {
  if (!wasOffline) return;
  wasOffline = false;

  syncStatus.syncing('Reconectando...');
  toast.success('Conexión restaurada');

  // Drenar la cola primero (envía cambios pendientes al backend)
  try {
    await queue.drain();
  } catch (err) {
    console.warn('handleOnline drain:', err);
  }

  // Después refrescar para reconciliar el state con el backend
  silentRefresh();
}

/**
 * Handler de evento "offline": se perdió la red.
 */
function handleOffline() {
  wasOffline = true;
  syncStatus.offline('Sin conexión');
  toast.error('Sin conexión — los cambios quedarán pendientes');
}

/**
 * Inicializa todo el sistema de sync.
 * Llama una vez al arrancar.
 */
export function init() {
  if (initialized) return;
  initialized = true;

  // Estado inicial del componente sync status (detecta offline al cargar)
  syncStatus.init();

  // Conectar store ↔ sync status
  bindStoreToSyncStatus();

  // Si ya está offline al cargar, no intentar loadAll
  if (!navigator.onLine) {
    wasOffline = true;
    syncStatus.offline('Sin conexión');
  } else {
    // Carga inicial
    syncStatus.syncing('Cargando datos...');
    store.loadAll().catch((err) => {
      console.error('init loadAll:', err);
    });
  }

  // Auto-refresh periódico (solo si tab visible Y hay red)
  intervalId = setInterval(() => {
    if (isDocumentVisible() && navigator.onLine) silentRefresh();
  }, UI.autoRefreshMs);

  // Refresh al volver visible (si hay red)
  on(document, 'visibilitychange', () => {
    if (isDocumentVisible() && navigator.onLine) silentRefresh();
  });

  // Listeners de red — claves para la UX offline
  on(window, 'online',  handleOnline);
  on(window, 'offline', handleOffline);

  // Suscripción a la cola: muestra/oculta el banner según items 'failed'
  queue.subscribe((items) => {
    const failed = items.filter((it) => it.status === 'failed');
    if (failed.length === 0) {
      // Si el banner mostraba "failed items" y ya no hay, ocultarlo
      // (no afectar si está mostrando "load error")
      if (errorBanner.isVisible()) {
        // Heurística: si los hay failed, mantener; si no, ocultar.
        // showLoadError reabrirá si hace falta.
        errorBanner.hide();
      }
      return;
    }
    errorBanner.showFailedItems({
      count: failed.length,
      onRetry: () => {
        queue.retryFailed();
        // El banner se ocultará en la próxima notificación si dejan de estar failed
      },
      onClear: () => {
        // Eliminar cada item failed (no toda la cola, solo los failed)
        failed.forEach((it) => queue.removeItem(it.id));
      }
    });
  });
}

/**
 * Cleanup (para tests o si se necesita reiniciar).
 */
export function stop() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  initialized = false;
}
