// ============================================================
// VIEW · ITINERARY (Itinerario)
// ============================================================
// Vista de lectura conectada al store.
// Renderiza los días + actividades obtenidos del backend.
// Cada día es colapsable (click en el header expande/colapsa).
// ============================================================

import { $, $$, on, escapeHtml, setHTML, delegate } from '../dom.js';
import * as store from '../store.js';

let panelEl = null;
let mounted = false;
let unsubscribe = null;

/**
 * Genera el HTML de una actividad.
 */
function renderActivity(act) {
  const tags = (act.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('');
  return `
    <div class="activity">
      <p class="activity__time">${escapeHtml(act.time || '')}</p>
      <h4 class="activity__name">${escapeHtml(act.name || '')}</h4>
      <p class="activity__desc">${escapeHtml(act.desc || '')}</p>
      ${tags ? `<div class="activity__meta">${tags}</div>` : ''}
    </div>
  `;
}

/**
 * Genera el HTML de un día.
 */
function renderDay(day) {
  const num = String(day.day).padStart(2, '0');
  const activities = (day.activities || []).map(renderActivity).join('');
  return `
    <article class="day-card" data-day="${escapeHtml(String(day.day))}">
      <button class="day-card__head" type="button" aria-expanded="false">
        <span class="day-card__num">${escapeHtml(num)}</span>
        <span class="day-card__info">
          <span class="day-card__date">${escapeHtml(day.date || '')} · ${escapeHtml(day.city || '')}</span>
          <span class="day-card__title">${escapeHtml(day.title || '')}</span>
        </span>
        <span class="day-card__toggle" aria-hidden="true">+</span>
      </button>
      <div class="day-card__body">
        ${day.weather || day.energy ? `
          <div class="weather-strip">
            <span>🌤️</span> <b>${escapeHtml(day.weather || '')}</b>
            ${day.energy ? `· ENERGÍA: ${escapeHtml(day.energy)}` : ''}
          </div>
        ` : ''}
        ${activities || '<p class="empty">Sin actividades cargadas.</p>'}
      </div>
    </article>
  `;
}

/**
 * Render principal: itinerario completo.
 */
function render(state) {
  if (!panelEl) return;

  if (state.status === 'loading' && state.isFirstLoad) {
    setHTML(panelEl, `
      <div class="card">
        <div class="skeleton" style="height: 60px; margin-bottom: 12px;"></div>
        <div class="skeleton" style="height: 60px; margin-bottom: 12px;"></div>
        <div class="skeleton" style="height: 60px;"></div>
      </div>
    `);
    return;
  }

  if (state.status === 'error' && (!state.itinerary || state.itinerary.length === 0)) {
    setHTML(panelEl, `
      <div class="card">
        <p class="card__label">Error</p>
        <h2 class="card__title">No se pudo cargar el itinerario</h2>
        <p>${escapeHtml(state.errorMessage || 'Intenta refrescar.')}</p>
      </div>
    `);
    return;
  }

  if (!state.itinerary || state.itinerary.length === 0) {
    setHTML(panelEl, `
      <div class="empty">
        Itinerario vacío. Toca "⟳ Refrescar" arriba ↑
      </div>
    `);
    return;
  }

  const html = state.itinerary.map(renderDay).join('');
  setHTML(panelEl, html);

  // Re-aplicar estado abierto si vuelves a renderizar
  // (por ahora todos cerrados al re-renderizar)
}

/**
 * Toggle de un día colapsable.
 */
function setupDelegation() {
  if (!panelEl) return;

  delegate(panelEl, 'click', '.day-card__head', function(e, head) {
    const card = head.closest('.day-card');
    if (!card) return;
    const isOpen = card.classList.toggle('is-open');
    head.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });
}

/**
 * Monta la vista.
 */
export function mount() {
  if (mounted) return;
  panelEl = $('#itinerary');
  if (!panelEl) return;

  mounted = true;
  setupDelegation();
  unsubscribe = store.subscribe(render);
}

/**
 * Desmonta (cleanup).
 */
export function unmount() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  mounted = false;
}
