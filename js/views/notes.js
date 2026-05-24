// ============================================================
// VIEW · NOTES (Notas + Wishlist + Emergencias + Reset)
// ============================================================
// Vista mixta:
// - Notas libres (textarea con auto-save)
// - Wishlist photodump (textarea con auto-save)
// - Contactos de emergencia (estático)
// - Botón reset (cuidado)
// ============================================================

import { $, on, debounce, escapeHtml, setHTML } from '../dom.js';
import { UI } from '../config.js';
import * as store from '../store.js';
import * as toast from '../toast.js';
import * as syncStatus from '../components/syncStatus.js';

let panelEl = null;
let mounted = false;
let unsubscribe = null;
let notesTextarea = null;
let wishlistTextarea = null;
let lastRenderedNotes = null;
let lastRenderedWishlist = null;

const EMERGENCY_CONTACTS = `
<b>911</b> — emergencias en USA (policía/bomberos/ambulancia)<br>
<b>311</b> — info no urgente NYC<br>
<b>Embajada Colombia NYC</b> — 10 East 46th St (a 6 cuadras del hotel) · +1 212 798 9000<br>
<b>Consulado Colombia Boston</b> — 31 Saint James Ave, Suite 905 · +1 617 536 6222<br>
<b>Trevor Project Lifeline</b> — 1-866-488-7386 (apoyo LGBT 24/7)<br>
<b>Wyndham Midtown 45</b> — 205 W 45th St, NYC · ver confirmación de reserva para teléfono<br>
<b>Copa Airlines USA</b> — 1-800-359-2672<br>
<b>American Airlines</b> — 1-800-433-7300
`;

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

    <article class="card card--accent">
      <h2 class="card__title" style="color: #fff;">🚨 Datos clave en caso de emergencia</h2>
      <div style="background: #fff; color: var(--text); padding: var(--space-3); margin-top: var(--space-3); font-size: var(--text-sm); line-height: 1.8; border-radius: var(--radius-xs);">
        ${EMERGENCY_CONTACTS}
      </div>
    </article>

    <article class="card">
      <h2 class="card__title">🔄 Resetear datos</h2>
      <p class="card__meta" style="margin-bottom: var(--space-3);">
        Borra TODOS los gastos, notas y wishlist del Sheet. Esto afecta a ambos. No se puede deshacer.
      </p>
      <button class="btn btn--outline" id="reset-btn" type="button">Borrar todos los datos</button>
    </article>
  `;
}

/**
 * Render: sincroniza el contenido de los textarea con el store.
 * Solo actualiza si el contenido cambió desde otro lado (otro dispositivo).
 * Evita pisotear lo que el usuario está escribiendo en este momento.
 */
function render(state) {
  if (!panelEl) return;
  if (!notesTextarea || !wishlistTextarea) return;

  // Notes
  if (state.notes !== lastRenderedNotes && document.activeElement !== notesTextarea) {
    notesTextarea.value = state.notes || '';
    lastRenderedNotes = state.notes;
  }

  // Wishlist
  if (state.wishlist !== lastRenderedWishlist && document.activeElement !== wishlistTextarea) {
    wishlistTextarea.value = state.wishlist || '';
    lastRenderedWishlist = state.wishlist;
  }
}

/**
 * Setup de event listeners después del primer render.
 */
function setupListeners() {
  notesTextarea = $('#notes-textarea');
  wishlistTextarea = $('#wishlist-textarea');
  const notesStatus = $('#notes-status');
  const wishlistStatus = $('#wishlist-status');
  const resetBtn = $('#reset-btn');

  if (!notesTextarea || !wishlistTextarea) return;

  // Notes: autosave debounced
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

  on(notesTextarea, 'input', (e) => {
    saveNotes(e.target.value);
  });

  // Wishlist: autosave debounced
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

  on(wishlistTextarea, 'input', (e) => {
    saveWishlist(e.target.value);
  });

  // Reset
  if (resetBtn) {
    on(resetBtn, 'click', async () => {
      const ok = confirm('¿BORRAR todos los gastos, notas y wishlist del Sheet?\n\nSe borra para ambos. NO se puede deshacer.');
      if (!ok) return;

      syncStatus.syncing('Borrando...');
      try {
        await store.resetAll();
        toast.success('Datos borrados');
      } catch (err) {
        toast.error('Error: ' + (err.message || ''));
      }
    });
  }
}

/**
 * Monta la vista.
 */
export function mount() {
  if (mounted) return;
  panelEl = $('#notes');
  if (!panelEl) return;

  setHTML(panelEl, template());
  setupListeners();
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
