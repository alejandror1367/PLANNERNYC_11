// ============================================================
// SYNC · Auto-refresh y visibility handler
// ============================================================
// - Refresca cada UI.autoRefreshMs si el tab está visible
// - Refresca al volver visible después de estar oculto
// - Conecta el estado del store con el componente sync status
// ============================================================

import { UI } from './config.js';
import { on, isDocumentVisible } from './dom.js';
import * as store from './store.js';
import * as syncStatus from './components/syncStatus.js';
import * as toast from './toast.js';

let intervalId = null;
let initialized = false;

/**
 * Refresca silenciosamente (sin toast).
 */
async function silentRefresh() {
  try {
    await store.refresh();
  } catch (err) {
    console.warn('silentRefresh:', err);
  }
}

/**
 * Refresh manual desde un botón (con toast).
 */
export async function manualRefresh() {
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
 */
function bindStoreToSyncStatus() {
  store.subscribe((state) => {
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
 * Inicializa todo el sistema de sync.
 * Llama una vez al arrancar.
 */
export function init() {
  if (initialized) return;
  initialized = true;

  // Conectar store ↔ sync status
  bindStoreToSyncStatus();

  // Carga inicial
  syncStatus.syncing('Cargando datos...');
  store.loadAll().catch((err) => {
    console.error('init loadAll:', err);
  });

  // Auto-refresh periódico (solo si tab visible)
  intervalId = setInterval(() => {
    if (isDocumentVisible()) silentRefresh();
  }, UI.autoRefreshMs);

  // Refresh al volver visible
  on(document, 'visibilitychange', () => {
    if (isDocumentVisible()) silentRefresh();
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
