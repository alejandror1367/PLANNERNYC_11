// ============================================================
// VIEW · APPS
// ============================================================
// Grid de apps recomendadas con filtro por categoría.
// Sección final con tips "antes de salir de Bogotá".
// ============================================================

import { $, escapeHtml, setHTML, delegate } from '../dom.js';
import { loadJSON } from '../data.js';

let panelEl = null;
let mounted = false;
let data = null;
let activeCategory = 'all';

function tplCategoryChips(categories, apps) {
  // Contar apps por categoría
  const counts = {};
  for (const a of apps) counts[a.category] = (counts[a.category] || 0) + 1;

  const chips = [`
    <button type="button" class="chip ${activeCategory === 'all' ? 'is-active' : ''}"
            data-cat="all">Todas (${apps.length})</button>
  `];

  for (const c of categories) {
    if (!counts[c.id]) continue;
    chips.push(`
      <button type="button" class="chip ${activeCategory === c.id ? 'is-active' : ''}"
              data-cat="${escapeHtml(c.id)}">${escapeHtml(c.label)} (${counts[c.id]})</button>
    `);
  }

  return `<div class="apps-filters">${chips.join('')}</div>`;
}

function tplAppCard(app, categoryLabel) {
  return `
    <article class="app-card">
      <p class="app-card__category">${escapeHtml(categoryLabel)}</p>
      <h3 class="app-card__name">${escapeHtml(app.name)}</h3>
      <p class="app-card__desc">${escapeHtml(app.desc)}</p>
    </article>
  `;
}

function tplGrid(filtered, categoriesMap) {
  if (filtered.length === 0) {
    return '<p class="empty">Sin apps en esta categoría.</p>';
  }
  return `
    <div class="apps-grid">
      ${filtered.map(a => tplAppCard(a, categoriesMap[a.category]?.label || a.category)).join('')}
    </div>
  `;
}

function tplBeforeLeaving(items) {
  if (!items || items.length === 0) return '';
  return `
    <article class="card card--dark before-leaving">
      <h2 class="card__title" style="color: var(--text-highlight);">💳 Antes de salir de Bogotá</h2>
      <ul class="before-leaving__list">
        ${items.map(i => `<li>${escapeHtml(i)}</li>`).join('')}
      </ul>
    </article>
  `;
}

function render() {
  if (!panelEl || !data) return;

  const categoriesMap = {};
  for (const c of (data.categories || [])) categoriesMap[c.id] = c;

  const filtered = activeCategory === 'all'
    ? data.apps
    : data.apps.filter(a => a.category === activeCategory);

  const html = `
    <article class="card">
      <h2 class="card__title">📲 Apps esenciales</h2>
      <p class="card__meta" style="margin-bottom: var(--space-3);">
        Descargar antes de viajar. Filtra por categoría:
      </p>
      ${tplCategoryChips(data.categories || [], data.apps || [])}
      ${tplGrid(filtered, categoriesMap)}
    </article>

    ${tplBeforeLeaving(data.beforeLeaving)}
  `;
  setHTML(panelEl, html);
}

function tplLoading() {
  const chip = `<div class="skeleton" style="display:inline-block; width:80px; height:32px; margin:0 var(--space-1) var(--space-1) 0; border-radius: var(--radius-pill);"></div>`;
  const card = `
    <article class="app-card">
      <div class="skeleton skeleton--text skeleton--short"></div>
      <div class="skeleton skeleton--text-lg skeleton--medium"></div>
      <div class="skeleton skeleton--text"></div>
      <div class="skeleton skeleton--text skeleton--narrow"></div>
    </article>
  `;
  return `
    <article class="card">
      <div class="skeleton skeleton--text-lg skeleton--medium"></div>
      <div class="skeleton skeleton--text skeleton--narrow" style="margin-bottom: var(--space-3);"></div>
      <div style="margin-bottom: var(--space-4);">
        ${chip}${chip}${chip}${chip}${chip}${chip}
      </div>
      <div class="apps-grid">
        ${card}${card}${card}${card}
      </div>
    </article>
  `;
}

function tplError(msg) {
  return `
    <div class="card">
      <p class="card__label">Error</p>
      <h2 class="card__title">No se pudo cargar apps</h2>
      <p>${escapeHtml(msg || '')}</p>
    </div>
  `;
}

function setupDelegation() {
  if (!panelEl) return;
  delegate(panelEl, 'click', '[data-cat]', function(e, btn) {
    activeCategory = btn.dataset.cat;
    render();
  });
}

export async function mount() {
  if (mounted) return;
  panelEl = $('#apps');
  if (!panelEl) return;
  mounted = true;

  setHTML(panelEl, tplLoading());
  setupDelegation();

  try {
    data = await loadJSON('apps.json');
    render();
  } catch (err) {
    setHTML(panelEl, tplError(err.message));
  }
}

export function unmount() {
  mounted = false;
}
