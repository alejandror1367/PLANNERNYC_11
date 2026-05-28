// ============================================================
// VIEW · TRANSPORT
// ============================================================
// Vista de solo lectura. Carga data/transport.json y renderiza
// tablas comparativas por cada sección.
// ============================================================

import { $, escapeHtml, setHTML } from '../dom.js';
import { loadJSON } from '../data.js';

let panelEl = null;
let mounted = false;

function tplRow(row) {
  const recCls = row.recommended ? ' transport-row--recommended' : '';
  const pickBadge = row.recommended
    ? `<span class="pick-badge">★ PICK</span>`
    : '';

  return `
    <div class="transport-row${recCls}">
      <div class="transport-row__main">
        <p class="transport-row__name">${escapeHtml(row.name)} ${pickBadge}</p>
        ${row.subtitle ? `<p class="transport-row__subtitle">${escapeHtml(row.subtitle)}</p>` : ''}
      </div>
      <div class="transport-row__time">${escapeHtml(row.time || '—')}</div>
      <div class="transport-row__cost">${escapeHtml(row.cost || '—')}</div>
      <div class="transport-row__verdict">${escapeHtml(row.verdict || '')}</div>
    </div>
  `;
}

function tplSection(section) {
  const variant = section.variant === 'dark' ? 'transport-section--dark'
              : section.variant === 'accent' ? 'transport-section--accent'
              : '';
  return `
    <article class="card transport-section ${variant}">
      <h2 class="transport-section__title">${escapeHtml(section.title)}</h2>
      ${section.intro ? `<p class="transport-section__intro">${escapeHtml(section.intro)}</p>` : ''}

      <div class="transport-table">
        <div class="transport-row transport-row--head">
          <div>Opción</div>
          <div>Tiempo</div>
          <div>Costo</div>
          <div>Veredicto</div>
        </div>
        ${section.rows.map(tplRow).join('')}
      </div>

      ${section.tip ? `<div class="transport-section__tip">${escapeHtml(section.tip)}</div>` : ''}
    </article>
  `;
}

function tplLoading() {
  const row = `
    <div class="transport-row">
      <div style="flex: 1.5;">
        <div class="skeleton skeleton--text skeleton--medium"></div>
        <div class="skeleton skeleton--text skeleton--short"></div>
      </div>
      <div class="skeleton skeleton--text skeleton--short" style="flex: 0.8;"></div>
      <div class="skeleton skeleton--text skeleton--short" style="flex: 0.9;"></div>
      <div class="skeleton skeleton--text skeleton--short" style="flex: 0.9;"></div>
    </div>
  `;
  const card = `
    <article class="card transport-section">
      <div class="skeleton skeleton--text-lg skeleton--medium"></div>
      <div class="skeleton skeleton--text skeleton--narrow"></div>
      <div class="transport-table" style="margin-top: var(--space-3);">
        ${row}${row}${row}
      </div>
    </article>
  `;
  return card + card;
}

function tplError(msg) {
  return `
    <div class="card">
      <p class="card__label">Error</p>
      <h2 class="card__title">No se pudo cargar transporte</h2>
      <p>${escapeHtml(msg || 'Intenta recargar la página.')}</p>
    </div>
  `;
}

export async function mount() {
  if (mounted) return;
  panelEl = $('#transport');
  if (!panelEl) return;
  mounted = true;

  setHTML(panelEl, tplLoading());

  try {
    const data = await loadJSON('transport.json');
    const html = (data.sections || []).map(tplSection).join('');
    setHTML(panelEl, html);
  } catch (err) {
    setHTML(panelEl, tplError(err.message));
  }
}

export function unmount() {
  mounted = false;
}
