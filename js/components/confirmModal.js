// ============================================================
// CONFIRM MODAL · Confirmación robusta para acciones destructivas
// (Fase 6.9)
// ============================================================
// Reemplaza el confirm() nativo del navegador con un modal
// editorial que exige tipear una palabra clave (ej. "BORRAR")
// antes de habilitar el botón de confirmación.
//
// API:
//   confirmDestructive({ title, message, keyword, confirmLabel, onConfirm })
//
// Características:
//   - Botón Confirmar deshabilitado hasta que el usuario tipee
//     exactamente la keyword
//   - Escape cierra
//   - Click fuera del card cierra
//   - Focus trap dentro del modal
//   - Devuelve el foco al elemento que lo abrió
// ============================================================

import { $, on, escapeHtml, setHTML } from '../dom.js';

let modalEl = null;
let initialized = false;
let lastFocusedElement = null;
let currentConfig = null;

function ensureModalDom() {
  if (modalEl) return modalEl;
  modalEl = $('#confirm-modal');
  if (modalEl) return modalEl;

  modalEl = document.createElement('div');
  modalEl.id = 'confirm-modal';
  modalEl.className = 'modal';
  modalEl.setAttribute('role', 'dialog');
  modalEl.setAttribute('aria-modal', 'true');
  modalEl.setAttribute('aria-labelledby', 'confirm-modal-title');
  modalEl.hidden = true;
  document.body.appendChild(modalEl);
  return modalEl;
}

function renderForm(config) {
  return `
    <div class="modal__card">
      <p class="modal__kicker">⚠ ${escapeHtml(config.kicker || 'Acción destructiva')} ⚠</p>
      <h2 class="modal__title" id="confirm-modal-title">${escapeHtml(config.title)}</h2>

      <p class="confirm-modal__message">${escapeHtml(config.message)}</p>

      <div class="field" style="margin-top: var(--space-4);">
        <label class="field__label" for="confirm-input">
          Para confirmar, tipea exactamente: <b>${escapeHtml(config.keyword)}</b>
        </label>
        <input
          type="text"
          id="confirm-input"
          class="input"
          autocomplete="off"
          autocapitalize="characters"
          spellcheck="false"
          placeholder="${escapeHtml(config.keyword)}"
        >
      </div>

      <div class="modal__actions">
        <button type="button" class="btn btn--outline" id="confirm-cancel-btn">Cancelar</button>
        <button type="button" class="btn btn--accent" id="confirm-ok-btn" disabled>
          ${escapeHtml(config.confirmLabel || 'Confirmar')}
        </button>
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

/**
 * Abre el modal de confirmación destructiva.
 *
 * @param {Object} config
 * @param {string} config.title          - título del modal
 * @param {string} config.message        - mensaje principal
 * @param {string} config.keyword        - palabra que debe tipear (ej "BORRAR")
 * @param {string} [config.confirmLabel] - label del botón de confirmar
 * @param {string} [config.kicker]       - kicker arriba del título
 * @param {Function} config.onConfirm    - callback al confirmar
 */
export function confirmDestructive(config) {
  ensureModalDom();
  lastFocusedElement = document.activeElement;
  currentConfig = config;
  setHTML(modalEl, renderForm(config));
  modalEl.hidden = false;

  requestAnimationFrame(() => {
    const input = $('#confirm-input', modalEl);
    if (input) input.focus();
  });
}

function setupListeners() {
  if (initialized) return;
  ensureModalDom();

  // Click fuera del card cierra
  on(modalEl, 'click', (e) => {
    if (e.target === modalEl) close();
  });

  // Cancel
  on(modalEl, 'click', (e) => {
    if (e.target.id === 'confirm-cancel-btn') close();
  });

  // Input: habilitar/deshabilitar OK según texto
  on(modalEl, 'input', (e) => {
    if (e.target.id !== 'confirm-input' || !currentConfig) return;
    const okBtn = $('#confirm-ok-btn', modalEl);
    if (!okBtn) return;
    const matches = e.target.value.trim() === currentConfig.keyword;
    okBtn.disabled = !matches;
  });

  // Click OK
  on(modalEl, 'click', async (e) => {
    if (e.target.id !== 'confirm-ok-btn' || !currentConfig) return;
    const input = $('#confirm-input', modalEl);
    if (!input || input.value.trim() !== currentConfig.keyword) return;

    const okBtn = e.target;
    okBtn.disabled = true;
    okBtn.textContent = 'Procesando...';

    try {
      await currentConfig.onConfirm();
      close();
    } catch (err) {
      console.error('confirmModal error:', err);
      okBtn.disabled = false;
      okBtn.textContent = currentConfig.confirmLabel || 'Confirmar';
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
        'a[href], button:not([disabled]), input:not([disabled]), select, [tabindex]:not([tabindex="-1"])'
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

export default { confirmDestructive, close, init };
