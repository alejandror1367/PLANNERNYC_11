// ============================================================
// DAY MODAL · Editar título y energía de un día
// ============================================================
// Modal editorial para editar la metadata de un día del
// itinerario (título + nivel de energía). Sigue el patrón de
// activityModal: focus trap, Escape, restaurar foco.
//
// API:
//   open({ day, date, city, title, energy, onSave })
//   close()
//   init()
// ============================================================

import { $, on, escapeHtml, setHTML } from '../dom.js';

let modalEl = null;
let initialized = false;
let lastFocusedElement = null;
let currentConfig = null;

// Niveles de energía sugeridos (chips de acceso rápido)
const ENERGY_PRESETS = ['Baja', 'Media', 'Alta', 'Intensa', 'Descanso'];

function ensureModalDom() {
  if (modalEl) return modalEl;
  modalEl = $('#day-modal');
  if (modalEl) return modalEl;

  modalEl = document.createElement('div');
  modalEl.id = 'day-modal';
  modalEl.className = 'modal';
  modalEl.setAttribute('role', 'dialog');
  modalEl.setAttribute('aria-modal', 'true');
  modalEl.setAttribute('aria-labelledby', 'day-modal-title');
  modalEl.hidden = true;
  document.body.appendChild(modalEl);
  return modalEl;
}

function renderForm(config) {
  const dayLabel = `Día ${config.day || ''}`;
  const meta = [config.date, config.city].filter(Boolean).join(' · ');
  const currentEnergy = config.energy || '';

  const energyChips = ENERGY_PRESETS.map((preset) => {
    const active = currentEnergy.toLowerCase() === preset.toLowerCase();
    return `<button type="button" class="energy-chip${active ? ' is-active' : ''}" data-energy="${escapeHtml(preset)}">${escapeHtml(preset)}</button>`;
  }).join('');

  return `
    <div class="modal__card">
      <p class="modal__kicker">★ Editar ${escapeHtml(dayLabel)} ★</p>
      <h2 class="modal__title" id="day-modal-title">Título y energía</h2>
      ${meta ? `<p class="modal__meta">${escapeHtml(meta)}</p>` : ''}

      <div class="field">
        <label class="field__label" for="day-title">Título del día</label>
        <input
          type="text"
          id="day-title"
          class="input"
          maxlength="120"
          autocomplete="off"
          placeholder="Ej: Brooklyn & DUMBO, Día de museos…"
          value="${escapeHtml(config.title || '')}"
        >
      </div>

      <div class="field">
        <label class="field__label" for="day-energy">Nivel de energía</label>
        <div class="energy-chips" id="day-energy-chips">${energyChips}</div>
        <input
          type="text"
          id="day-energy"
          class="input"
          maxlength="60"
          autocomplete="off"
          placeholder="Toca un nivel o escribe el tuyo"
          value="${escapeHtml(currentEnergy)}"
        >
      </div>

      <div class="modal__actions">
        <button type="button" class="btn btn--outline" id="day-cancel-btn">Cancelar</button>
        <button type="button" class="btn btn--accent" id="day-save-btn">Guardar</button>
      </div>
    </div>
  `;
}

export function close() {
  if (!modalEl) return;
  modalEl.hidden = true;
  currentConfig = null;

  if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
    lastFocusedElement.focus();
  }
  lastFocusedElement = null;
}

export function open(config) {
  ensureModalDom();
  lastFocusedElement = document.activeElement;
  currentConfig = config;
  setHTML(modalEl, renderForm(config));
  modalEl.hidden = false;

  requestAnimationFrame(() => {
    const titleInput = $('#day-title', modalEl);
    if (titleInput) {
      titleInput.focus();
      titleInput.select();
    }
  });
}

function setupListeners() {
  if (initialized) return;
  ensureModalDom();

  // Click fuera del card cierra
  on(modalEl, 'click', (e) => {
    if (e.target === modalEl) close();
  });

  // Cancelar
  on(modalEl, 'click', (e) => {
    if (e.target.id === 'day-cancel-btn') close();
  });

  // Chips de energía → rellenan el input
  on(modalEl, 'click', (e) => {
    const chip = e.target.closest('.energy-chip');
    if (!chip) return;
    const energyInput = $('#day-energy', modalEl);
    if (energyInput) energyInput.value = chip.dataset.energy || '';
    // Actualizar estado visual de los chips
    modalEl.querySelectorAll('.energy-chip').forEach((c) => c.classList.remove('is-active'));
    chip.classList.add('is-active');
  });

  // Guardar
  on(modalEl, 'click', async (e) => {
    if (e.target.id !== 'day-save-btn' || !currentConfig) return;

    const title = ($('#day-title', modalEl)?.value || '').trim();
    const energy = ($('#day-energy', modalEl)?.value || '').trim();

    const saveBtn = e.target;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Guardando...';

    try {
      await currentConfig.onSave({ day: currentConfig.day, title, energy });
      close();
    } catch (err) {
      console.error('dayModal save error:', err);
      saveBtn.disabled = false;
      saveBtn.textContent = 'Guardar';
    }
  });

  // Escape + focus trap
  on(document, 'keydown', (e) => {
    if (!modalEl || modalEl.hidden) return;

    if (e.key === 'Escape') {
      close();
      return;
    }

    if (e.key === 'Tab') {
      const focusables = modalEl.querySelectorAll(
        'a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (e.shiftKey) {
        if (active === first || !modalEl.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  });

  initialized = true;
}

export function init() {
  setupListeners();
}

export default { open, close, init };
