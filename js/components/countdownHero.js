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
 * PRE-VIAJE: boarding pass con cuenta regresiva + tick.
 */
function renderPre(tp) {
  const c = getCountdownToStart();
  const pad = (n) => String(n).padStart(2, '0');

  // Ciudad de salida (primer día del itinerario) o NYC por defecto
  const state = store.getState();
  const first = (state.itinerary || []).find((d) => Number(d.day) === 1);
  const gate = first && first.city ? first.city : 'NYC';

  setHTML(containerEl, `
    <div class="boarding-pass boarding-pass--pre">
      <div class="boarding-pass__main">
        <p class="boarding-pass__kicker">Boarding in</p>
        <div class="boarding-pass__big">
          <span class="boarding-pass__num" id="hero-days">${c.days}</span>
          <span class="boarding-pass__unit">${c.days === 1 ? 'día' : 'días'}</span>
        </div>
        <p class="boarding-pass__tick" id="hero-tick">
          ${pad(c.hours)}h : ${pad(c.minutes)}m : ${pad(c.seconds)}s para despegar
        </p>
      </div>
      <div class="boarding-pass__stub">
        <div class="boarding-pass__stub-row">
          <span class="boarding-pass__stub-label">Gate</span>
          <span class="boarding-pass__stub-gate">${escapeHtml(gate)}</span>
        </div>
        <div class="boarding-pass__stub-row">
          <span class="boarding-pass__stub-label">Seat</span>
          <span class="boarding-pass__stub-seat">👨 2A · 👧 2B</span>
        </div>
      </div>
    </div>
  `);
}

/**
 * EN VIAJE: boarding pass "en tránsito" con día actual + progreso.
 */
function renderDuring(tp) {
  const pct = Math.round((tp.dayNumber / tp.totalDays) * 100);

  const state = store.getState();
  const today = (state.itinerary || []).find((d) => Number(d.day) === tp.dayNumber);
  const dayTitle = today && today.title ? today.title : '';
  const dayCity = today && today.city ? today.city : 'NYC';

  setHTML(containerEl, `
    <div class="boarding-pass boarding-pass--during">
      <div class="boarding-pass__main">
        <p class="boarding-pass__kicker">En tránsito</p>
        <div class="boarding-pass__big">
          <span class="boarding-pass__num">${tp.dayNumber}</span>
          <span class="boarding-pass__unit">/ ${tp.totalDays}</span>
        </div>
        ${dayTitle ? `<p class="boarding-pass__day-title">${escapeHtml(dayTitle)}</p>` : ''}
        <div class="boarding-pass__progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
          <div class="boarding-pass__progress-bar" style="width: ${pct}%;"></div>
        </div>
      </div>
      <div class="boarding-pass__stub">
        <div class="boarding-pass__stub-row">
          <span class="boarding-pass__stub-label">Hoy en</span>
          <span class="boarding-pass__stub-gate">${escapeHtml(dayCity)}</span>
        </div>
        <div class="boarding-pass__stub-row">
          <span class="boarding-pass__stub-label">Faltan</span>
          <span class="boarding-pass__stub-seat">${tp.daysRemaining === 0 ? 'último día' : tp.daysRemaining + (tp.daysRemaining === 1 ? ' día' : ' días')}</span>
        </div>
      </div>
    </div>
  `);
}

/**
 * POST-VIAJE: boarding pass "usado" / sellado.
 */
function renderPost(tp) {
  const state = store.getState();
  const totalSpent = state.totals && state.totals.totalSpent ? state.totals.totalSpent : 0;
  const spentStr = totalSpent > 0
    ? `$${totalSpent.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
    : '—';

  setHTML(containerEl, `
    <div class="boarding-pass boarding-pass--post">
      <div class="boarding-pass__main">
        <p class="boarding-pass__kicker">Viaje completado</p>
        <div class="boarding-pass__big">
          <span class="boarding-pass__num">✓</span>
        </div>
        <p class="boarding-pass__day-title">${tp.totalDays} días · NYC + Boston</p>
      </div>
      <div class="boarding-pass__stub">
        <div class="boarding-pass__stub-row">
          <span class="boarding-pass__stub-label">Gastado</span>
          <span class="boarding-pass__stub-gate boarding-pass__stub-gate--sm">${spentStr}</span>
        </div>
        <div class="boarding-pass__stub-row">
          <span class="boarding-pass__stub-seat">Hasta el próximo viaje</span>
        </div>
      </div>
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
