// ============================================================
// INTENSITY TIMELINE · Energía por día (Fase 8.5)
// ============================================================
// Visual compacto de la "intensidad" de cada día del viaje:
// una barra por día con altura/color según su nivel de energía.
// Resalta el día actual cuando se está en viaje. Tocar un día
// lleva al itinerario.
//
// Lee el campo `energy` del itinerario (editable desde el día).
// Se monta en Overview.
// ============================================================

import { $, setHTML, escapeHtml, delegate } from '../dom.js';
import { getTripPhase, energyToIntensity } from '../trip.js';
import * as store from '../store.js';
import * as router from '../router.js';

let containerEl = null;

// Altura relativa de cada nivel (0-4) en porcentaje
const LEVEL_HEIGHT = { 0: 20, 1: 40, 2: 60, 3: 80, 4: 100, '-1': 30 };
// Etiqueta corta para cada nivel
const LEVEL_SHORT = { 0: 'OFF', 1: 'BAJA', 2: 'MED', 3: 'ALTA', 4: 'MAX', '-1': '—' };

function render() {
  if (!containerEl) return;

  const state = store.getState();
  const itinerary = (state.itinerary || []).slice().sort((a, b) => a.day - b.day);

  if (itinerary.length === 0) {
    containerEl.hidden = true;
    return;
  }
  containerEl.hidden = false;

  const tp = getTripPhase(new Date(), itinerary.length);
  const currentDay = tp.phase === 'during' ? tp.dayNumber : -1;

  const bars = itinerary.map((d) => {
    const intensity = energyToIntensity(d.energy);
    const level = intensity.level;
    const height = LEVEL_HEIGHT[level] !== undefined ? LEVEL_HEIGHT[level] : 30;
    const isToday = Number(d.day) === currentDay;
    const cityClass = (d.city || '').toUpperCase().includes('BOS') ? 'is-boston' : 'is-nyc';

    return `
      <button type="button"
              class="intensity-bar ${cityClass} level-${level} ${isToday ? 'is-today' : ''}"
              data-action="goto-day"
              data-day="${escapeHtml(String(d.day))}"
              aria-label="Día ${d.day}${intensity.label ? ', energía ' + intensity.label : ''}"
              title="Día ${d.day}${d.title ? ' · ' + d.title : ''}${intensity.label ? ' (' + intensity.label + ')' : ''}">
        <span class="intensity-bar__fill" style="height: ${height}%;"></span>
        <span class="intensity-bar__day">${d.day}</span>
        ${isToday ? '<span class="intensity-bar__marker" aria-hidden="true">●</span>' : ''}
      </button>
    `;
  }).join('');

  setHTML(containerEl, `
    <article class="card intensity-card">
      <header class="intensity-card__head">
        <p class="intensity-card__kicker">★ Ritmo del viaje ★</p>
        <h3 class="intensity-card__title">Intensidad por día</h3>
      </header>
      <div class="intensity-track">${bars}</div>
      <div class="intensity-legend">
        <span class="intensity-legend__item"><i class="dot is-nyc"></i> NYC</span>
        <span class="intensity-legend__item"><i class="dot is-boston"></i> Boston</span>
        <span class="intensity-legend__hint">Altura = energía del día · toca para ver el itinerario</span>
      </div>
    </article>
  `);
}

function setupListeners() {
  if (!containerEl) return;
  delegate(containerEl, 'click', '[data-action="goto-day"]', function (e, btn) {
    const dayNum = Number(btn.dataset.day);
    // Navegar al itinerario y abrir ese día
    try {
      // Marcar el día para que el itinerario lo abra al renderizar
      sessionStorageSafeSet('tp_openDay', String(dayNum));
    } catch (err) { /* noop */ }
    router.goTo('itinerary');
  });
}

/**
 * sessionStorage seguro (algunos contextos lo bloquean).
 */
function sessionStorageSafeSet(key, value) {
  try { sessionStorage.setItem(key, value); } catch (e) { /* noop */ }
}

export function mount(mountPoint) {
  containerEl = mountPoint;
  if (!containerEl) return;

  render();
  setupListeners();

  store.subscribe(() => render());
}

export default { mount };
