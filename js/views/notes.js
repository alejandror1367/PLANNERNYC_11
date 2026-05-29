// ============================================================
// VIEW · NOTES (Notas + Wishlist + Emergencias + Reset)
// ============================================================
// Notas y wishlist con auto-save.
// Sección de emergencias cargada desde data/emergency.json.
// ============================================================

import { $, on, debounce, escapeHtml, setHTML, delegate } from '../dom.js';
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
let lastRenderedNotes = null;
let lastRenderedPhotodump = null;  // JSON serializado para detectar cambios
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
      <h2 class="card__title">📷 Photodump</h2>
      <p class="card__meta" style="margin-bottom: var(--space-4);">
        Links a álbumes compartidos (Google Photos, iCloud) y spots para el carrete.
      </p>

      <div class="photodump-form">
        <input type="text" id="pd-title" class="input" maxlength="80"
               placeholder="Título (ej: Álbum NYC, Spots Brooklyn)" autocomplete="off">
        <input type="url" id="pd-url" class="input" maxlength="500"
               placeholder="Link (https://...)" autocomplete="off">
        <input type="text" id="pd-desc" class="input" maxlength="160"
               placeholder="Nota corta (opcional)" autocomplete="off">
        <button type="button" class="btn btn--accent" id="pd-add-btn">Agregar link</button>
        <p class="field__help" id="pd-status"></p>
      </div>

      <div class="photodump-list" id="photodump-list"></div>
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
        Borra TODOS los gastos, notas y photodump del Sheet. Esto afecta a ambos. No se puede deshacer.
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

function tplPhotodumpList(links) {
  if (!links || links.length === 0) {
    return `<p class="photodump-empty">Aún no hay links. Agrega el primero arriba ↑</p>`;
  }
  return links.map((l) => `
    <div class="photodump-item motion-item" data-id="${escapeHtml(l.id)}">
      <div class="photodump-item__body">
        <p class="photodump-item__title">${escapeHtml(l.title || 'Sin título')}</p>
        ${l.desc ? `<p class="photodump-item__desc">${escapeHtml(l.desc)}</p>` : ''}
        <p class="photodump-item__url">${escapeHtml(truncateUrl(l.url))}</p>
      </div>
      <div class="photodump-item__actions">
        ${l.url ? `<a href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer" class="photodump-item__open" aria-label="Abrir link">↗</a>` : ''}
        <button type="button" class="photodump-item__del" data-action="pd-delete" data-id="${escapeHtml(l.id)}" aria-label="Eliminar link" title="Eliminar">×</button>
      </div>
    </div>
  `).join('');
}

function truncateUrl(url) {
  if (!url) return '';
  const clean = String(url).replace(/^https?:\/\//, '');
  return clean.length > 42 ? clean.slice(0, 42) + '…' : clean;
}

function render(state) {
  if (!panelEl) return;
  if (!notesTextarea) return;

  if (state.notes !== lastRenderedNotes && document.activeElement !== notesTextarea) {
    notesTextarea.value = state.notes || '';
    lastRenderedNotes = state.notes;
  }

  // Photodump: re-renderizar la lista si cambió
  if (state.wishlist !== lastRenderedPhotodump) {
    const listEl = $('#photodump-list', panelEl);
    if (listEl) {
      const links = store.getPhotodump();
      setHTML(listEl, tplPhotodumpList(links));
    }
    lastRenderedPhotodump = state.wishlist;
  }
}

function setupListeners() {
  notesTextarea = $('#notes-textarea');
  const notesStatus = $('#notes-status');
  const resetBtn = $('#reset-btn');

  if (!notesTextarea) return;

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

  // ---------- PHOTODUMP (Fase 8.9) ----------
  const pdTitle = $('#pd-title');
  const pdUrl = $('#pd-url');
  const pdDesc = $('#pd-desc');
  const pdAddBtn = $('#pd-add-btn');
  const pdStatus = $('#pd-status');

  if (pdAddBtn) {
    on(pdAddBtn, 'click', async () => {
      const title = (pdTitle?.value || '').trim();
      const url = (pdUrl?.value || '').trim();
      const desc = (pdDesc?.value || '').trim();

      // Validación: al menos título o url
      if (!title && !url) {
        pdStatus.textContent = '✗ Agrega al menos un título o un link';
        return;
      }
      // Validar URL si se puso
      if (url && !/^https?:\/\/.+/i.test(url)) {
        pdStatus.textContent = '✗ El link debe empezar con http:// o https://';
        return;
      }

      pdAddBtn.disabled = true;
      pdStatus.textContent = 'Guardando...';
      try {
        await store.addPhotodumpLink({ title, url, desc });
        // Limpiar form
        if (pdTitle) pdTitle.value = '';
        if (pdUrl) pdUrl.value = '';
        if (pdDesc) pdDesc.value = '';
        pdStatus.textContent = 'Agregado ✓';
        setTimeout(() => { pdStatus.textContent = ''; }, 1500);
      } catch (err) {
        pdStatus.textContent = '✗ No se pudo guardar';
        toast.error('No se pudo agregar el link');
      } finally {
        pdAddBtn.disabled = false;
      }
    });
  }

  // Eliminar link (delegado)
  if (panelEl) {
    delegate(panelEl, 'click', '[data-action="pd-delete"]', async function (e, btn) {
      const id = btn.dataset.id;
      if (!id) return;
      const item = btn.closest('.photodump-item');
      if (item) item.classList.add('motion-out');
      try {
        await store.removePhotodumpLink(id);
      } catch (err) {
        if (item) item.classList.remove('motion-out');
        toast.error('No se pudo eliminar');
      }
    });
  }

  if (resetBtn) {
    on(resetBtn, 'click', () => {
      confirmModal.confirmDestructive({
        kicker: 'Acción irreversible',
        title: '¿Borrar TODOS los datos?',
        message: 'Se eliminarán todos los gastos, notas, photodump y pagos resueltos del Sheet. Esto afecta a ambos viajeros y NO se puede deshacer.',
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
  // Pintar la lista del photodump inmediatamente con el estado actual
  const listEl = $('#photodump-list', panelEl);
  if (listEl) setHTML(listEl, tplPhotodumpList(store.getPhotodump()));
  lastRenderedPhotodump = store.getState().wishlist;
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
