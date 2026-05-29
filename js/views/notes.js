// ============================================================
// VIEW · NOTES (Notas + Wishlist + Emergencias + Reset)
// ============================================================
// Notas y wishlist con auto-save.
// Sección de emergencias cargada desde data/emergency.json.
// ============================================================

import { $, on, debounce, escapeHtml, setHTML } from '../dom.js';
import { UI } from '../config.js';
import { loadJSON } from '../data.js';
import * as store from '../store.js';
import * as toast from '../toast.js';
import * as syncStatus from '../components/syncStatus.js';
import * as confirmModal from '../components/confirmModal.js';

let panelEl = null;
let mounted = false;
let unsubscribe = null;
let notesTextarea = null;
let wishlistTextarea = null;
let lastRenderedNotes = null;
let lastRenderedWishlist = null;
let emergencyData = null;

function tplEmergency(data) {
  if (!data || !data.groups || data.groups.length === 0) {
    const item = `
      <li class="emergency-item">
        <div class="skeleton skeleton--text skeleton--narrow" style="margin: 0;"></div>
        <div class="skeleton skeleton--text skeleton--medium" style="margin: 0;"></div>
      </li>
    `;
    return `
      <div class="emergency-group">
        <div class="skeleton skeleton--text-lg skeleton--narrow"></div>
        <ul class="emergency-list">${item}${item}</ul>
      </div>
      <div class="emergency-group">
        <div class="skeleton skeleton--text-lg skeleton--narrow"></div>
        <ul class="emergency-list">${item}${item}</ul>
      </div>
    `;
  }
  return data.groups.map(group => `
    <div class="emergency-group">
      <h3 class="emergency-group__title">${escapeHtml(group.title)}</h3>
      <ul class="emergency-list">
        ${group.items.map(item => `
          <li class="emergency-item">
            <span class="emergency-item__label">${escapeHtml(item.label)}</span>
            <span class="emergency-item__value">${escapeHtml(item.value)}</span>
          </li>
        `).join('')}
      </ul>
    </div>
  `).join('');
}

function template() {
  return `
    <article class="card">
      <h2 class="card__title">📝 Notas libres</h2>
      <p class="card__meta" style="margin-bottom: var(--space-3);">
        Para guardar links, recomendaciones, restaurantes vistos en Instagram, etc.
      </p>
      <textarea
        id="notes-textarea"
        class="textarea"
        placeholder="Escribe aquí... se guarda automáticamente."
      ></textarea>
      <p class="field__help" id="notes-status" style="margin-top: var(--space-2);"></p>
    </article>

    <article class="card">
      <h2 class="card__title">📷 Wishlist photodump</h2>
      <p class="card__meta" style="margin-bottom: var(--space-3);">
        Spots aesthetic para tu carrete.
      </p>
      <textarea
        id="wishlist-textarea"
        class="textarea"
        placeholder="Ej: foto en escaleras Joker, Washington Square Park arch, Brooklyn Bridge atardecer..."
      ></textarea>
      <p class="field__help" id="wishlist-status" style="margin-top: var(--space-2);"></p>
    </article>

    <article class="card card--accent emergency-card">
      <h2 class="card__title" style="color: #fff;">🚨 Contactos de emergencia</h2>
      <div class="emergency-content" id="emergency-content">
        ${tplEmergency(emergencyData)}
      </div>
    </article>

    <article class="card">
      <h2 class="card__title">🔄 Resetear datos</h2>
      <p class="card__meta" style="margin-bottom: var(--space-3);">
        Borra TODOS los gastos, notas y wishlist del Sheet. Esto afecta a ambos. No se puede deshacer.
      </p>
      <button class="btn btn--outline" id="reset-btn" type="button">Borrar todos los datos</button>

      <p class="card__meta" style="margin-top: var(--space-5); padding-top: var(--space-4); border-top: 1px solid var(--border); font-size: var(--text-xs);">
        ¿La app no carga bien o se quedó en una versión vieja?
        <a href="sw-uninstall.html" style="color: var(--color-accent); text-decoration: underline;">Reiniciar caché de la app</a>
        (no toca tus datos del Sheet).
      </p>
    </article>
  `;
}

function render(state) {
  if (!panelEl) return;
  if (!notesTextarea || !wishlistTextarea) return;

  if (state.notes !== lastRenderedNotes && document.activeElement !== notesTextarea) {
    notesTextarea.value = state.notes || '';
    lastRenderedNotes = state.notes;
  }

  if (state.wishlist !== lastRenderedWishlist && document.activeElement !== wishlistTextarea) {
    wishlistTextarea.value = state.wishlist || '';
    lastRenderedWishlist = state.wishlist;
  }
}

function setupListeners() {
  notesTextarea = $('#notes-textarea');
  wishlistTextarea = $('#wishlist-textarea');
  const notesStatus = $('#notes-status');
  const wishlistStatus = $('#wishlist-status');
  const resetBtn = $('#reset-btn');

  if (!notesTextarea || !wishlistTextarea) return;

  const saveNotes = debounce(async (text) => {
    notesStatus.textContent = 'Guardando...';
    try {
      await store.updateNotes(text);
      lastRenderedNotes = text;
      notesStatus.textContent = 'Guardado ✓';
      setTimeout(() => { notesStatus.textContent = ''; }, 1500);
    } catch (err) {
      notesStatus.textContent = '✗ Error al guardar';
      toast.error('No se pudieron guardar las notas');
    }
  }, UI.debounceLong);

  on(notesTextarea, 'input', (e) => saveNotes(e.target.value));

  const saveWishlist = debounce(async (text) => {
    wishlistStatus.textContent = 'Guardando...';
    try {
      await store.updateWishlist(text);
      lastRenderedWishlist = text;
      wishlistStatus.textContent = 'Guardado ✓';
      setTimeout(() => { wishlistStatus.textContent = ''; }, 1500);
    } catch (err) {
      wishlistStatus.textContent = '✗ Error al guardar';
      toast.error('No se pudo guardar la wishlist');
    }
  }, UI.debounceLong);

  on(wishlistTextarea, 'input', (e) => saveWishlist(e.target.value));

  if (resetBtn) {
    on(resetBtn, 'click', () => {
      confirmModal.confirmDestructive({
        kicker: 'Acción irreversible',
        title: '¿Borrar TODOS los datos?',
        message: 'Se eliminarán todos los gastos, notas, wishlist y pagos resueltos del Sheet. Esto afecta a ambos viajeros y NO se puede deshacer.',
        keyword: 'BORRAR',
        confirmLabel: 'Sí, borrar todo',
        onConfirm: async () => {
          syncStatus.syncing('Borrando...');
          try {
            await store.resetAll();
            toast.success('Datos borrados');
          } catch (err) {
            toast.error('Error: ' + (err.message || ''));
            throw err;
          }
        }
      });
    });
  }
}

export async function mount() {
  if (mounted) return;
  panelEl = $('#notes');
  if (!panelEl) return;

  // Cargar emergencias (no bloqueante, montamos primero con placeholder)
  loadJSON('emergency.json').then(data => {
    emergencyData = data;
    const container = $('#emergency-content');
    if (container) setHTML(container, tplEmergency(data));
  }).catch(err => {
    console.warn('No se pudo cargar emergency.json:', err);
  });

  setHTML(panelEl, template());
  setupListeners();
  confirmModal.init();
  unsubscribe = store.subscribe(render);
  mounted = true;
}

export function unmount() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  mounted = false;
}
