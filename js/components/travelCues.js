// ============================================================
// TRAVEL CUES · Card contextual del día (Fase 8.7)
// ============================================================
// Muestra una card según la fase del viaje:
//   - during: "HOY: día N · TÍTULO" + próximas actividades
//   - pre:    recordatorio de preparación
//   - post:   mensaje de cierre
//
// Reutiliza el motor de fases de trip.js. Cero llamadas a red:
// todo se deriva del itinerario ya cargado en el store.
//
// Se monta en Overview, debajo del countdown hero.
// ============================================================

import { $, setHTML, escapeHtml } from '../dom.js';
import { getTripPhase } from '../trip.js';
import * as store from '../store.js';

let containerEl = null;
let refreshInterval = null;

/**
 * Convierte una hora "HH:MM" a minutos desde medianoche.
 * Devuelve null si no parsea.
 */
function timeToMinutes(timeStr) {
  if (!timeStr) return null;
  const m = String(timeStr).match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

/**
 * Dado un día del itinerario, devuelve las próximas actividades
 * a partir de la hora actual (o las primeras si ya pasaron todas).
 *
 * @param {Object} day - día del itinerario con .activities
 * @param {Date} now
 * @param {number} limit - máximo de actividades a devolver
 */
function getUpcomingActivities(day, now, limit) {
  const acts = (day.activities || []).filter((a) => a && a.name);
  if (acts.length === 0) return [];

  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  // Separar las que tienen hora de las que no
  const withTime = acts
    .map((a) => ({ act: a, mins: timeToMinutes(a.time) }))
    .filter((x) => x.mins !== null)
    .sort((a, b) => a.mins - b.mins);

  // Próximas (hora >= ahora)
  const upcoming = withTime.filter((x) => x.mins >= nowMinutes);

  let chosen;
  if (upcoming.length > 0) {
    chosen = upcoming.slice(0, limit).map((x) => x.act);
  } else if (withTime.length > 0) {
    // Ya pasaron todas las con hora: mostrar las últimas como referencia
    chosen = withTime.slice(-limit).map((x) => x.act);
  } else {
    // Ninguna tiene hora: mostrar las primeras
    chosen = acts.slice(0, limit);
  }

  return chosen;
}

/**
 * Render principal según la fase.
 */
function render() {
  if (!containerEl) return;

  const state = store.getState();
  const itinerary = state.itinerary || [];
  const itinDays = itinerary.length;
  const now = new Date();
  const tp = getTripPhase(now, itinDays);

  if (tp.phase === 'during') {
    renderDuring(tp, itinerary, now);
  } else if (tp.phase === 'pre') {
    renderPre(tp);
  } else {
    renderPost(tp);
  }
}

/**
 * EN VIAJE: el día de hoy + próximas actividades.
 */
function renderDuring(tp, itinerary, now) {
  const today = itinerary.find((d) => Number(d.day) === tp.dayNumber);

  if (!today) {
    // Sin datos del día: ocultar la card
    containerEl.hidden = true;
    return;
  }
  containerEl.hidden = false;

  const upcoming = getUpcomingActivities(today, now, 3);
  const cityLabel = today.city ? ` · ${escapeHtml(today.city)}` : '';
  const titleLabel = today.title ? escapeHtml(today.title) : 'Día de viaje';

  let actsHtml = '';
  if (upcoming.length > 0) {
    actsHtml = `
      <ul class="cue-list">
        ${upcoming.map((a) => `
          <li class="cue-item">
            ${a.time ? `<span class="cue-item__time">${escapeHtml(a.time)}</span>` : '<span class="cue-item__time cue-item__time--none">—</span>'}
            <span class="cue-item__name">${escapeHtml(a.name)}</span>
          </li>
        `).join('')}
      </ul>
    `;
  } else {
    actsHtml = `<p class="cue-empty">No hay actividades planeadas para hoy. ¡Día libre!</p>`;
  }

  setHTML(containerEl, `
    <article class="cue-card cue-card--during">
      <div class="cue-card__head">
        <p class="cue-card__kicker">★ Hoy ★</p>
        <h3 class="cue-card__title">Día ${tp.dayNumber}${cityLabel}</h3>
        <p class="cue-card__subtitle">${titleLabel}</p>
      </div>
      ${actsHtml}
    </article>
  `);
}

/**
 * PRE-VIAJE: recordatorio de preparación.
 */
function renderPre(tp) {
  containerEl.hidden = false;

  // Mensaje según cuánto falta
  let prep;
  if (tp.daysUntilStart > 30) {
    prep = 'Tiempo de sobra. Ve reservando hoteles y actividades clave.';
  } else if (tp.daysUntilStart > 7) {
    prep = 'Última semana de planeación. Confirma reservas y arma la wishlist.';
  } else if (tp.daysUntilStart > 1) {
    prep = 'Ya casi. Revisa el clima, empaca capas y descarga mapas offline.';
  } else {
    prep = '¡Mañana es el día! Pasaporte, cargadores y boarding pass listos.';
  }

  setHTML(containerEl, `
    <article class="cue-card cue-card--pre">
      <div class="cue-card__head">
        <p class="cue-card__kicker">★ Preparación ★</p>
        <h3 class="cue-card__title">Faltan ${tp.daysUntilStart} ${tp.daysUntilStart === 1 ? 'día' : 'días'}</h3>
      </div>
      <p class="cue-card__note">${escapeHtml(prep)}</p>
    </article>
  `);
}

/**
 * POST-VIAJE: cierre.
 */
function renderPost(tp) {
  containerEl.hidden = false;
  setHTML(containerEl, `
    <article class="cue-card cue-card--post">
      <div class="cue-card__head">
        <p class="cue-card__kicker">★ Memorias ★</p>
        <h3 class="cue-card__title">El viaje terminó</h3>
      </div>
      <p class="cue-card__note">${tp.totalDays} días entre NYC y Boston. Revisa los gastos finales en Presupuesto.</p>
    </article>
  `);
}

/**
 * Monta el componente en el contenedor dado.
 */
export function mount(mountPoint) {
  containerEl = mountPoint;
  if (!containerEl) return;

  render();

  // Re-render cuando cambian los datos del store (itinerario, etc.)
  store.subscribe(() => render());

  // Refrescar cada 5 minutos para que "próximas actividades" se
  // mantenga al día conforme pasa el tiempo
  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(render, 5 * 60 * 1000);
}

export default { mount };
