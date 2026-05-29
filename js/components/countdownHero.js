// ============================================================
// COUNTDOWN HERO · Hero dinámico del viaje (Fase 8.4)
// ============================================================
// Reemplaza el contador de texto plano por un hero editorial que
// cambia según la fase del viaje:
//   - pre:    T-MINUS con días + tick de horas/min/seg
//   - during: DÍA N / TOTAL con barra de progreso
//   - post:   VIAJE COMPLETADO con resumen
//
// Se monta en el panel Overview (arriba del todo).
// Se actualiza cada segundo en pre-viaje (para el tick) y cada
// minuto en las otras fases.
// ============================================================

import { $, setHTML, escapeHtml } from '../dom.js';
import { getTripPhase, getCountdownToStart } from '../trip.js';
import * as store from '../store.js';

let containerEl = null;
let tickInterval = null;

/**
 * Renderiza el hero según la fase actual.
 */
function render() {
  if (!containerEl) return;

  const state = store.getState();
  const itinDays = (state.itinerary || []).length;
  const tp = getTripPhase(new Date(), itinDays);

  if (tp.phase === 'pre') {
    renderPre(tp);
  } else if (tp.phase === 'during') {
    renderDuring(tp);
  } else {
    renderPost(tp);
  }
}

/**
 * PRE-VIAJE: cuenta regresiva grande + tick.
 */
function renderPre(tp) {
  const c = getCountdownToStart();
  const pad = (n) => String(n).padStart(2, '0');

  setHTML(containerEl, `
    <div class="hero hero--pre">
      <p class="hero__kicker">★ Cuenta regresiva ★</p>
      <div class="hero__big">
        <span class="hero__big-num" id="hero-days">${c.days}</span>
        <span class="hero__big-label">${c.days === 1 ? 'día' : 'días'}</span>
      </div>
      <p class="hero__tick" id="hero-tick">
        ${pad(c.hours)}h : ${pad(c.minutes)}m : ${pad(c.seconds)}s para despegar
      </p>
      <p class="hero__sub">Próxima parada: Nueva York &amp; Boston</p>
    </div>
  `);
}

/**
 * EN VIAJE: día actual + barra de progreso.
 */
function renderDuring(tp) {
  const pct = Math.round((tp.dayNumber / tp.totalDays) * 100);

  // Intentar tomar el título del día desde el itinerario
  const state = store.getState();
  const today = (state.itinerary || []).find((d) => Number(d.day) === tp.dayNumber);
  const dayTitle = today && today.title ? today.title : '';
  const dayCity = today && today.city ? today.city : '';

  setHTML(containerEl, `
    <div class="hero hero--during">
      <p class="hero__kicker">★ En viaje ★</p>
      <div class="hero__big">
        <span class="hero__big-num">${tp.dayNumber}</span>
        <span class="hero__big-label">/ ${tp.totalDays}</span>
      </div>
      ${dayTitle ? `<p class="hero__day-title">${escapeHtml(dayTitle)}${dayCity ? ` · ${escapeHtml(dayCity)}` : ''}</p>` : ''}
      <div class="hero__progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
        <div class="hero__progress-bar" style="width: ${pct}%;"></div>
      </div>
      <p class="hero__sub">${tp.daysRemaining === 0 ? 'Último día del viaje' : `${tp.daysRemaining} ${tp.daysRemaining === 1 ? 'día' : 'días'} por delante`}</p>
    </div>
  `);
}

/**
 * POST-VIAJE: resumen.
 */
function renderPost(tp) {
  const state = store.getState();
  const totalSpent = state.totals && state.totals.totalSpent ? state.totals.totalSpent : 0;
  const spentStr = totalSpent > 0
    ? `$${totalSpent.toLocaleString('en-US', { maximumFractionDigits: 0 })} USD`
    : '';

  setHTML(containerEl, `
    <div class="hero hero--post">
      <p class="hero__kicker">★ Viaje completado ★</p>
      <div class="hero__big">
        <span class="hero__big-num">✓</span>
      </div>
      <p class="hero__day-title">${tp.totalDays} días · NYC + Boston</p>
      ${spentStr ? `<p class="hero__sub">Gastado: ${spentStr}</p>` : '<p class="hero__sub">Hasta el próximo viaje</p>'}
    </div>
  `);
}

/**
 * Actualiza solo el tick (sin re-render completo) en pre-viaje,
 * para el segundero.
 */
function updateTick() {
  const state = store.getState();
  const itinDays = (state.itinerary || []).length;
  const tp = getTripPhase(new Date(), itinDays);

  // Si cambió de fase, re-render completo
  if (tp.phase !== 'pre') {
    render();
    restartInterval(tp.phase);
    return;
  }

  const c = getCountdownToStart();
  const pad = (n) => String(n).padStart(2, '0');

  const daysEl = $('#hero-days', containerEl);
  const tickEl = $('#hero-tick', containerEl);
  if (daysEl) daysEl.textContent = String(c.days);
  if (tickEl) tickEl.textContent = `${pad(c.hours)}h : ${pad(c.minutes)}m : ${pad(c.seconds)}s para despegar`;
}

/**
 * Arranca el intervalo según la fase:
 *   pre    → cada 1s (para el tick)
 *   during → cada 60s
 *   post   → sin intervalo
 */
function restartInterval(phase) {
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }

  if (phase === 'pre') {
    tickInterval = setInterval(updateTick, 1000);
  } else if (phase === 'during') {
    tickInterval = setInterval(render, 60000);
  }
}

/**
 * Monta el hero en el contenedor dado.
 * @param {HTMLElement} mountPoint
 */
export function mount(mountPoint) {
  containerEl = mountPoint;
  if (!containerEl) return;

  render();
  const tp = getTripPhase();
  restartInterval(tp.phase);

  // Re-render cuando cambian los datos (para el resumen post-viaje
  // y el título del día en viaje)
  store.subscribe(() => {
    const phase = getTripPhase().phase;
    if (phase === 'during' || phase === 'post') render();
  });
}

export default { mount };
