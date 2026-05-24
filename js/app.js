// ============================================================
// APP · Bootstrap principal
// ============================================================
// Orden de arranque:
//  1. Router (navegación tabs)
//  2. SyncStatus (indicador flotante)
//  3. Header actions (refresh, abrir sheet)
//  4. Counter (días al viaje)
//  5. Hidratar cache local (arranque instantáneo)
//  6. Montar vistas
//  7. Iniciar sync (loadAll + auto-refresh)
// ============================================================

import { TRIP, APP_VERSION, API_URL } from './config.js';
import { $, on } from './dom.js';
import { sheetUrl } from './storage.js';
import * as router from './router.js';
import * as syncStatus from './components/syncStatus.js';
import * as toast from './toast.js';
import * as store from './store.js';
import * as sync from './sync.js';

// Vistas
import * as overviewView  from './views/overview.js';
import * as itineraryView from './views/itinerary.js';
import * as budgetView    from './views/budget.js';
import * as notesView     from './views/notes.js';

/**
 * Contador de días al viaje.
 */
function updateCounter() {
  const el = $('#trip-counter');
  if (!el) return;

  const start = new Date(TRIP.startDate);
  const end = new Date(TRIP.endDate);
  const now = new Date();

  let text = '';
  if (now < start) {
    const days = Math.ceil((start - now) / (1000 * 60 * 60 * 24));
    text = `T-MINUS ${days} DÍAS PARA DESPEGAR`;
  } else if (now < end) {
    const days = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    text = `EN VIAJE · ${days} DÍAS RESTANTES`;
  } else {
    text = '✓ VIAJE COMPLETADO';
  }

  el.textContent = text;
}

/**
 * Botones del header (refresh, abrir sheet).
 */
function initHeaderActions() {
  const refreshBtn = $('#refresh-btn');
  const openSheetBtn = $('#open-sheet-btn');

  if (refreshBtn) {
    on(refreshBtn, 'click', () => sync.manualRefresh());
  }

  if (openSheetBtn) {
    on(openSheetBtn, 'click', () => {
      let url = sheetUrl.get();
      if (!url) {
        url = prompt('Pega aquí la URL del Google Sheet (se guarda para próximas veces):');
        if (url && url.trim()) {
          sheetUrl.set(url.trim());
        } else {
          return;
        }
      }
      window.open(url, '_blank', 'noopener,noreferrer');
    });
  }
}

/**
 * Verifica que API_URL esté configurada.
 */
function checkApiConfig() {
  if (!API_URL || !API_URL.trim()) {
    syncStatus.error('API_URL vacía en config.js');
    toast.error('Falta configurar API_URL en js/config.js', 5000);
    console.warn(
      'Travel Planner: la constante API_URL en js/config.js está vacía. ' +
      'Pega ahí la URL del Apps Script /exec y vuelve a subir el archivo.'
    );
    return false;
  }
  if (!API_URL.includes('script.google.com')) {
    syncStatus.error('API_URL con formato inválido');
    toast.error('La API_URL no parece de Apps Script');
    return false;
  }
  return true;
}

/**
 * Monta todas las vistas.
 */
function mountViews() {
  overviewView.mount();
  itineraryView.mount();
  budgetView.mount();
  notesView.mount();
  // En Fase 5: transport, apps.
}

/**
 * Bootstrap.
 */
function init() {
  console.info(`Travel Planner ${APP_VERSION} · arrancando...`);

  const versionEl = $('#app-version');
  if (versionEl) versionEl.textContent = `${APP_VERSION} · live`;

  // 1. Componentes UI
  router.init();
  syncStatus.init();
  initHeaderActions();

  // 2. Contador
  updateCounter();
  setInterval(updateCounter, 60_000);

  // 3. Hidratar desde cache (arranque instantáneo offline)
  const cached = store.hydrateFromCache();
  if (cached) {
    console.info('Hidratado desde cache local');
  }

  // 4. Montar vistas (suscritas al store; reaccionan a cambios)
  mountViews();

  // 5. Verificar config y arrancar sync
  if (checkApiConfig()) {
    sync.init();
  }

  console.info('Travel Planner listo ✓');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
