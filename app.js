// ============================================================
// APP · Bootstrap principal
// Punto de entrada del JavaScript de la app.
// ============================================================

import { TRIP, APP_VERSION, API_URL } from './config.js';
import { $, on } from './dom.js';
import * as router from './router.js';
import * as syncStatus from './components/syncStatus.js';
import * as toast from './toast.js';

/**
 * Actualiza el contador de días en el header.
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
 * Botones del header.
 */
function initHeaderActions() {
  const refreshBtn = $('#refresh-btn');
  const openSheetBtn = $('#open-sheet-btn');

  if (refreshBtn) {
    on(refreshBtn, 'click', () => {
      toast.show('Refresh disponible en Fase 3');
    });
  }

  if (openSheetBtn) {
    on(openSheetBtn, 'click', () => {
      toast.show('Vincular Sheet disponible en Fase 3');
    });
  }
}

/**
 * Verifica que la API_URL esté configurada en config.js.
 * Si no lo está, muestra un mensaje claro en el sync status.
 */
function checkApiConfig() {
  if (!API_URL || API_URL.trim() === '') {
    syncStatus.error('API_URL vacía en config.js');
    console.warn(
      'Travel Planner: la constante API_URL en js/config.js está vacía. ' +
      'Después de publicar el backend de Apps Script, pega la URL ahí y vuelve a subir el archivo.'
    );
    return false;
  }

  if (!API_URL.includes('script.google.com')) {
    syncStatus.error('API_URL con formato extraño');
    console.warn('API_URL no parece de Apps Script:', API_URL);
    return false;
  }

  syncStatus.success('✓ Lista para Fase 3');
  return true;
}

/**
 * Inicializa la app.
 */
function init() {
  console.info(`Travel Planner ${APP_VERSION} · arrancando...`);

  const versionEl = $('#app-version');
  if (versionEl) versionEl.textContent = `${APP_VERSION} · BUILDING`;

  router.init();
  syncStatus.init();
  initHeaderActions();

  updateCounter();
  setInterval(updateCounter, 60_000);

  // Verificar configuración del backend
  checkApiConfig();

  console.info('Travel Planner listo ✓');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
