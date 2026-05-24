// ============================================================
// COMPONENT · ActivityModal
// ============================================================
// Modal reutilizable para crear y editar actividades del itinerario.
//
// API:
//   activityModal.open({ mode, day, activity, onSave })
//     - mode: 'create' | 'edit'
//     - day:  número de día (obligatorio en create)
//     - activity: objeto actividad (obligatorio en edit)
//     - onSave: async (data) => void · llamado al confirmar
//   activityModal.close()
// ============================================================

import { $, on, escapeHtml, setHTML } from '../dom.js';
import * as toast from '../toast.js';

let modalEl = null;
let currentConfig = null;
let initialized = false;

/**
 * Crea el contenedor del modal en el DOM si no existe.
 */
function ensureModalDom() {
  if (modalEl) return modalEl;
  modalEl = $('#activity-modal');
  if (modalEl) return modalEl;

  // Si el index.html no lo tiene, lo creamos dinámicamente
  modalEl = document.createElement('div');
  modalEl.id = 'activity-modal';
  modalEl.className = 'modal';
  modalEl.setAttribute('role', 'dialog');
  modalEl.setAttribute('aria-modal', 'true');
  modalEl.hidden = true;
  document.body.appendChild(modalEl);
  return modalEl;
}

/**
 * Template del formulario.
 */
function renderForm(config) {
  const a = config.activity || {};
  const isEdit = config.mode === 'edit';
  const title = isEdit ? 'Editar actividad' : 'Agregar actividad';
  const kicker = isEdit ? '★ Editar ★' : '★ Nueva actividad ★';
  const dayLabel = isEdit && a.day ? `Día ${a.day}` : `Día ${config.day || ''}`;

  return `
    <div class="modal__card">
      <p class="modal__kicker">${escapeHtml(kicker)}</p>
      <h2 class="modal__title">${escapeHtml(title)}</h2>
      <p class="card__meta" style="margin: 0 0 var(--space-3); font-family: var(--font-mono); font-size: 10px; letter-spacing: var(--tracking-wide); text-transform: uppercase;">
        ${escapeHtml(dayLabel)}
      </p>

      <form id="activity-form" class="activity-form" autocomplete="off">
        <div class="field">
          <label class="field__label" for="act-time">Hora</label>
          <input
            type="text"
            id="act-time"
            class="input"
            placeholder="ej: 09:00 AM"
            value="${escapeHtml(a.time || '')}"
            maxlength="30"
          >
          <span class="field__help">Formato libre (opcional). Ej: "09:00 AM", "Mediodía", "Después de cena".</span>
        </div>

        <div class="field">
          <label class="field__label" for="act-name">Nombre *</label>
          <input
            type="text"
            id="act-name"
            class="input"
            placeholder="ej: Brunch en Sunday in Brooklyn"
            value="${escapeHtml(a.name || '')}"
            maxlength="200"
            required
          >
        </div>

        <div class="field">
          <label class="field__label" for="act-desc">Descripción</label>
          <textarea
            id="act-desc"
            class="textarea"
            placeholder="Detalles, dirección, hack para ahorrar..."
            maxlength="1000"
            style="min-height: 100px;"
          >${escapeHtml(a.desc || '')}</textarea>
        </div>

        <div class="field">
          <label class="field__label" for="act-tags">Tags</label>
          <input
            type="text"
            id="act-tags"
            class="input"
            placeholder="ej: ☕ Brunch, 💰 $20-30, 📷 Photodump"
            value="${escapeHtml((a.tags || []).join(', '))}"
            maxlength="500"
          >
          <span class="field__help">Separa con comas. Máximo 10 tags.</span>
        </div>

        <div class="modal__actions">
          <button type="button" class="btn btn--outline" id="act-cancel-btn">Cancelar</button>
          <button type="submit" class="btn" id="act-save-btn">${isEdit ? 'Guardar cambios' : 'Agregar actividad'}</button>
        </div>
      </form>
    </div>
  `;
}

/**
 * Cierra el modal.
 */
export function close() {
  if (!modalEl) return;
  modalEl.hidden = true;
  currentConfig = null;
}

/**
 * Abre el modal con configuración.
 */
export function open(config) {
  ensureModalDom();
  currentConfig = config;
  setHTML(modalEl, renderForm(config));
  modalEl.hidden = false;

  // Foco en el nombre
  requestAnimationFrame(() => {
    const nameInput = $('#act-name', modalEl);
    if (nameInput) nameInput.focus();
  });
}

/**
 * Recoge los datos del formulario.
 */
function collectFormData() {
  return {
    time: $('#act-time')?.value.trim() || '',
    name: $('#act-name')?.value.trim() || '',
    desc: $('#act-desc')?.value.trim() || '',
    tags: ($('#act-tags')?.value || '')
      .split(',')
      .map((t) => t.trim())
      .filter((t) => !!t),
  };
}

/**
 * Setup de event listeners (una sola vez, vía delegación).
 */
function setupListeners() {
  if (initialized) return;
  ensureModalDom();

  // Delegación: click fuera del card cierra
  on(modalEl, 'click', (e) => {
    if (e.target === modalEl) close();
  });

  // Submit del form
  on(modalEl, 'submit', async (e) => {
    if (e.target.id !== 'activity-form') return;
    e.preventDefault();
    if (!currentConfig) return;

    const data = collectFormData();
    if (!data.name) {
      toast.error('El nombre es obligatorio');
      return;
    }

    const saveBtn = $('#act-save-btn');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Guardando...';
    }

    try {
      // Construir el payload según modo
      let payload;
      if (currentConfig.mode === 'edit') {
        payload = { id: currentConfig.activity.id, ...data };
      } else {
        payload = { day: currentConfig.day, ...data };
      }
      await currentConfig.onSave(payload);
      close();
    } catch (err) {
      console.error('activityModal save error:', err);
      toast.error('Error: ' + (err.message || 'No se pudo guardar'));
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = currentConfig.mode === 'edit' ? 'Guardar cambios' : 'Agregar actividad';
      }
    }
  });

  // Click en botones (delegación)
  on(modalEl, 'click', (e) => {
    if (e.target.id === 'act-cancel-btn') {
      close();
    }
  });

  // Escape cierra
  on(document, 'keydown', (e) => {
    if (e.key === 'Escape' && modalEl && !modalEl.hidden) close();
  });

  initialized = true;
}

export function init() {
  setupListeners();
}

export default { open, close, init };
