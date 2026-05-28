// ============================================================
// VIEW · ITINERARY
// ============================================================
// Vista de lectura + CRUD de actividades.
// Cada día es colapsable. Dentro de cada día:
//   - Lista de actividades con botones ✏️ Editar / 🗑️ Eliminar
//   - Botón "+ Agregar actividad" al final
// La edición usa el componente activityModal.
// ============================================================

import { $, on, escapeHtml, setHTML, delegate } from '../dom.js';
import * as store from '../store.js';
import * as toast from '../toast.js';
import * as activityModal from '../components/activityModal.js';

let panelEl = null;
let mounted = false;
let unsubscribe = null;

// Mantener qué días están abiertos durante re-renders
const openDays = new Set();

/**
 * Skeleton premium específico del itinerario.
 * Imita la forma real: 3 cards de día colapsadas.
 */
function skeletonTemplate() {
  const dayCard = `
    <article class="day-card" style="margin-bottom: var(--space-3);">
      <div class="day-card__head" style="cursor: default;">
        <div class="skeleton skeleton--text-xl" style="width: 48px; margin-bottom: 0; margin-right: var(--space-3);"></div>
        <div class="day-card__info" style="flex: 1;">
          <div class="skeleton skeleton--text skeleton--short"></div>
          <div class="skeleton skeleton--text-lg skeleton--medium" style="margin-bottom: 0;"></div>
        </div>
      </div>
    </article>
  `;
  return dayCard + dayCard + dayCard;
}

/**
 * Genera el HTML de una actividad.
 */
function renderActivity(act) {
  const tags = (act.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('');
  const stateCls = [
    act._pending ? 'is-pending' : '',
    act._queued  ? 'is-queued'  : '',
    act._failed  ? 'is-failed'  : '',
  ].filter(Boolean).join(' ');

  let stateBadge = '';
  if (act._failed) {
    stateBadge = '<span class="state-badge state-badge--failed" title="No se pudo sincronizar">⚠ falló</span>';
  } else if (act._queued) {
    stateBadge = '<span class="state-badge state-badge--queued" title="Pendiente de sincronizar">⏱ pendiente</span>';
  }

  return `
    <div class="activity ${stateCls}" data-activity-id="${escapeHtml(act.id || '')}">
      <div class="activity__row">
        <div class="activity__main">
          ${act.time ? `<p class="activity__time">${escapeHtml(act.time)}</p>` : ''}
          <h4 class="activity__name">${escapeHtml(act.name || '')} ${stateBadge}</h4>
          ${act.desc ? `<p class="activity__desc">${escapeHtml(act.desc)}</p>` : ''}
          ${tags ? `<div class="activity__meta">${tags}</div>` : ''}
        </div>
        <div class="activity__actions">
          <button type="button" class="activity-btn activity-btn--edit"
                  data-action="edit-activity"
                  data-activity-id="${escapeHtml(act.id || '')}"
                  aria-label="Editar actividad" title="Editar">✏️</button>
          <button type="button" class="activity-btn activity-btn--delete"
                  data-action="delete-activity"
                  data-activity-id="${escapeHtml(act.id || '')}"
                  aria-label="Eliminar actividad" title="Eliminar">🗑️</button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Genera el HTML de un día completo.
 */
function renderDay(day) {
  const num = String(day.day).padStart(2, '0');
  const isOpen = openDays.has(day.day);
  const activities = (day.activities || []).map(renderActivity).join('');
  return `
    <article class="day-card${isOpen ? ' is-open' : ''}" data-day="${escapeHtml(String(day.day))}">
      <button class="day-card__head" type="button" aria-expanded="${isOpen}">
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
        ${activities || '<p class="empty" style="padding: var(--space-4);">Sin actividades. Agrega la primera abajo ↓</p>'}
        <div class="day-card__footer">
          <button type="button"
                  class="btn btn--outline btn--full add-activity-btn"
                  data-action="add-activity"
                  data-day="${escapeHtml(String(day.day))}">
            ➕ Agregar actividad
          </button>
        </div>
      </div>
    </article>
  `;
}

/**
 * Render principal.
 */
function render(state) {
  if (!panelEl) return;

  if (state.status === 'loading' && state.isFirstLoad) {
    setHTML(panelEl, skeletonTemplate());
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
}

/**
 * Handlers de acciones (vía delegación de eventos).
 */
function setupDelegation() {
  if (!panelEl) return;

  // Toggle día (click en el header)
  delegate(panelEl, 'click', '.day-card__head', function(e, head) {
    const card = head.closest('.day-card');
    if (!card) return;
    const dayNum = Number(card.dataset.day);
    const isOpen = card.classList.toggle('is-open');
    head.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    if (isOpen) openDays.add(dayNum);
    else openDays.delete(dayNum);
  });

  // Agregar actividad
  delegate(panelEl, 'click', '[data-action="add-activity"]', function(e, btn) {
    e.stopPropagation();
    const day = Number(btn.dataset.day);
    activityModal.open({
      mode: 'create',
      day: day,
      onSave: async (data) => {
        try {
          const result = await store.addActivity(data);
          if (result && result._queued) {
            toast.warning('Sin conexión — actividad guardada localmente');
          } else {
            toast.success('Actividad agregada ✓');
          }
        } catch (err) {
          if (err && err.code === 'VALIDATION') {
            toast.validation('No se pudo agregar: ' + (err.message || ''));
          } else {
            toast.error('No se pudo agregar: ' + (err.message || ''));
          }
          throw err;
        }
      }
    });
  });

  // Editar actividad
  delegate(panelEl, 'click', '[data-action="edit-activity"]', function(e, btn) {
    e.stopPropagation();
    const id = btn.dataset.activityId;
    if (!id) return;

    // Encontrar la actividad y su día
    const state = store.getState();
    let activity = null;
    let dayNum = null;
    for (const d of state.itinerary) {
      const found = (d.activities || []).find((a) => a.id === id);
      if (found) {
        activity = found;
        dayNum = d.day;
        break;
      }
    }
    if (!activity) {
      toast.error('Actividad no encontrada (refresca la página)');
      return;
    }

    activityModal.open({
      mode: 'edit',
      day: dayNum,
      activity: activity,
      onSave: async (data) => {
        try {
          await store.updateActivity({ ...data, day: dayNum });
          toast.success('Actividad actualizada ✓');
        } catch (err) {
          toast.error('No se pudo actualizar: ' + (err.message || ''));
          throw err;
        }
      }
    });
  });

  // Eliminar actividad
  delegate(panelEl, 'click', '[data-action="delete-activity"]', async function(e, btn) {
    e.stopPropagation();
    const id = btn.dataset.activityId;
    if (!id) return;

    const ok = confirm('¿Eliminar esta actividad?\n\nSe borrará del Sheet para ambos. No se puede deshacer.');
    if (!ok) return;

    try {
      await store.deleteActivity(id);
      toast.success('Actividad eliminada');
    } catch (err) {
      toast.error('No se pudo eliminar: ' + (err.message || ''));
    }
  });
}

export function mount() {
  if (mounted) return;
  panelEl = $('#itinerary');
  if (!panelEl) return;

  mounted = true;
  setupDelegation();
  activityModal.init();
  unsubscribe = store.subscribe(render);
}

export function unmount() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  mounted = false;
}
