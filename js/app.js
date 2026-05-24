// ============================================================
// APP · Bootstrap principal
// Punto de entrada del JavaScript de la app.
// Importa todos los módulos y los inicializa en orden.
// ============================================================

import { TRIP, APP_VERSION } from './config.js';
import { $, on } from './dom.js';
import * as router from './router.js';
import * as setupModal from './components/setupModal.js';
import * as syncStatus from './components/syncStatus.js';
import * as toast from './toast.js';

/**
 * Actualiza el contador de días en el header.
 * Se ejecuta cada minuto y al cargar.
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
 * Inicializa los botones de utilidad del header
 * (refresh, abrir sheet).
 *
 * En Fase 1 son visibles pero no hacen nada real (los conectaremos
 * a la API en Fase 3).
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
 * Inicializa la app.
 */
function init() {
  console.info(`Travel Planner ${APP_VERSION} · arrancando...`);

  // Versión visible en el subtítulo
  const versionEl = $('#app-version');
  if (versionEl) versionEl.textContent = `${APP_VERSION} · BUILDING`;

  // Componentes
  router.init();
  syncStatus.init();
  setupModal.init();
  initHeaderActions();

  // Contador
  updateCounter();
  setInterval(updateCounter, 60_000);

  // Suscribir al evento de "URL conectada"
  setupModal.onConnect(() => {
    syncStatus.success('✓ URL guardada');
    toast.success('Conectado. Datos disponibles en Fase 3.');
  });

  console.info('Travel Planner listo ✓');
}

// Arrancar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
