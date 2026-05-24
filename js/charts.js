// ============================================================
// CHARTS · Donut y barras horizontales en SVG puro
// ============================================================
// Cero dependencias. Genera SVG como string para inyectar en
// el DOM. Pensado para datos pequeños (< 20 segmentos).
// ============================================================

import { escapeHtml } from './dom.js';
import { fmtUSD } from './format.js';

/**
 * Paleta default para gráficos.
 * El orden importa: el primero pinta el primer segmento.
 */
export const CHART_COLORS = {
  primary:    '#ff4d2e',  // accent — naranja
  secondary:  '#2d4a7c',  // blue — azul
  tertiary:   '#4a7c4e',  // green — verde
  quaternary: '#ffd84d',  // accent-2 — amarillo
  fifth:      '#8a8275',  // muted — gris
  sixth:      '#1a1815',  // ink — negro
  seventh:    '#d97706',  // warning — naranja oscuro
  eighth:     '#a8c4e8',  // azul claro
};

const PALETTE = Object.values(CHART_COLORS);

/**
 * Asigna un color a cada item por índice.
 */
export function colorFor(index) {
  return PALETTE[index % PALETTE.length];
}

/**
 * Convierte un objeto {label: value} en array ordenado descendente.
 * @param {Object} obj - { 'Comida': 627.85, 'Transporte': 413.20 }
 * @returns {Array<{label, value}>}
 */
export function toSortedArray(obj) {
  return Object.entries(obj || {})
    .map(([label, value]) => ({
      label,
      value: typeof value === 'object' ? (value.totalUSD || 0) : Number(value) || 0
    }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value);
}

// ============================================================
// DONUT CHART
// ============================================================

/**
 * Calcula el path SVG de un segmento de donut.
 * @param {number} cx - centro X
 * @param {number} cy - centro Y
 * @param {number} rOuter - radio exterior
 * @param {number} rInner - radio interior
 * @param {number} startAngle - en radianes
 * @param {number} endAngle - en radianes
 * @returns {string} path d
 */
function donutSlicePath(cx, cy, rOuter, rInner, startAngle, endAngle) {
  // Para evitar problemas cuando es un único segmento de 360°
  const fullCircle = Math.abs(endAngle - startAngle) >= 2 * Math.PI - 0.0001;
  if (fullCircle) {
    return [
      `M ${cx + rOuter} ${cy}`,
      `A ${rOuter} ${rOuter} 0 1 1 ${cx - rOuter} ${cy}`,
      `A ${rOuter} ${rOuter} 0 1 1 ${cx + rOuter} ${cy}`,
      `M ${cx + rInner} ${cy}`,
      `A ${rInner} ${rInner} 0 1 0 ${cx - rInner} ${cy}`,
      `A ${rInner} ${rInner} 0 1 0 ${cx + rInner} ${cy}`,
      'Z'
    ].join(' ');
  }

  const x1 = cx + rOuter * Math.cos(startAngle);
  const y1 = cy + rOuter * Math.sin(startAngle);
  const x2 = cx + rOuter * Math.cos(endAngle);
  const y2 = cy + rOuter * Math.sin(endAngle);
  const x3 = cx + rInner * Math.cos(endAngle);
  const y3 = cy + rInner * Math.sin(endAngle);
  const x4 = cx + rInner * Math.cos(startAngle);
  const y4 = cy + rInner * Math.sin(startAngle);

  const largeArc = (endAngle - startAngle) > Math.PI ? 1 : 0;

  return [
    `M ${x1} ${y1}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${x4} ${y4}`,
    'Z'
  ].join(' ');
}

/**
 * Renderiza un donut chart como SVG.
 * @param {Array<{label, value}>} data
 * @param {Object} [opts]
 * @param {number} [opts.size=200] - lado del SVG
 * @param {number} [opts.thickness=40] - grosor del anillo
 * @param {boolean} [opts.showCenter=true] - mostrar total en el centro
 * @returns {string} HTML SVG
 */
export function renderDonut(data, opts = {}) {
  const size = opts.size || 200;
  const thickness = opts.thickness || 38;
  const showCenter = opts.showCenter !== false;
  const showLabels = opts.showLabels !== false;

  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size / 2 - 4;
  const rInner = rOuter - thickness;

  const total = data.reduce((s, d) => s + d.value, 0);

  if (total === 0 || data.length === 0) {
    return `
      <svg viewBox="0 0 ${size} ${size}" class="chart-donut chart-donut--empty" role="img" aria-label="Sin datos">
        <circle cx="${cx}" cy="${cy}" r="${rOuter}" fill="none" stroke="var(--color-line)" stroke-width="${thickness}"/>
        <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" class="chart-donut__empty-text">
          Sin datos
        </text>
      </svg>
    `;
  }

  let cursor = -Math.PI / 2; // empezar arriba (12 en punto)
  const slices = data.map((d, i) => {
    const fraction = d.value / total;
    const startAngle = cursor;
    const endAngle = cursor + fraction * 2 * Math.PI;
    cursor = endAngle;

    const path = donutSlicePath(cx, cy, rOuter, rInner, startAngle, endAngle);
    const color = colorFor(i);

    // Label position (centro del slice, radio medio)
    const midAngle = (startAngle + endAngle) / 2;
    const labelR = (rOuter + rInner) / 2;
    const lx = cx + labelR * Math.cos(midAngle);
    const ly = cy + labelR * Math.sin(midAngle);
    const pct = Math.round(fraction * 100);
    const showLabel = showLabels && pct >= 5; // no mostrar % en slices muy pequeños

    return `
      <path d="${path}" fill="${color}"
            class="chart-donut__slice"
            data-label="${escapeHtml(d.label)}"
            data-value="${d.value.toFixed(2)}"
            data-pct="${pct}">
        <title>${escapeHtml(d.label)}: ${fmtUSD(d.value)} (${pct}%)</title>
      </path>
      ${showLabel ? `
        <text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" class="chart-donut__pct">
          ${pct}%
        </text>
      ` : ''}
    `;
  }).join('');

  const center = showCenter ? `
    <text x="${cx}" y="${cy - 6}" text-anchor="middle" dominant-baseline="middle" class="chart-donut__total">
      ${fmtUSD(total)}
    </text>
    <text x="${cx}" y="${cy + 12}" text-anchor="middle" dominant-baseline="middle" class="chart-donut__total-label">
      TOTAL
    </text>
  ` : '';

  return `
    <svg viewBox="0 0 ${size} ${size}" class="chart-donut" role="img" aria-label="Distribución por categoría">
      ${slices}
      ${center}
    </svg>
  `;
}

/**
 * Renderiza la leyenda del donut con valores.
 */
export function renderDonutLegend(data) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return '';

  return `
    <ul class="chart-legend">
      ${data.map((d, i) => {
        const pct = Math.round((d.value / total) * 100);
        return `
          <li class="chart-legend__item">
            <span class="chart-legend__dot" style="background: ${colorFor(i)}"></span>
            <span class="chart-legend__label">${escapeHtml(d.label)}</span>
            <span class="chart-legend__value">${fmtUSD(d.value)}</span>
            <span class="chart-legend__pct">${pct}%</span>
          </li>
        `;
      }).join('')}
    </ul>
  `;
}

// ============================================================
// BARRAS HORIZONTALES
// ============================================================

/**
 * Renderiza un set de barras horizontales.
 * Cada barra muestra label, monto, porcentaje y la barra coloreada.
 * @param {Array<{label, value}>} data
 * @param {Object} [opts]
 * @returns {string} HTML
 */
export function renderHorizontalBars(data, opts = {}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0 || data.length === 0) {
    return `<div class="chart-bars chart-bars--empty">Sin datos aún</div>`;
  }

  const max = Math.max(...data.map(d => d.value));

  const items = data.map((d, i) => {
    const widthPct = max > 0 ? (d.value / max) * 100 : 0;
    const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
    const color = colorFor(i);
    return `
      <li class="chart-bar">
        <div class="chart-bar__header">
          <span class="chart-bar__label">${escapeHtml(d.label)}</span>
          <span class="chart-bar__value">${fmtUSD(d.value)}</span>
        </div>
        <div class="chart-bar__track">
          <div class="chart-bar__fill" style="width: ${widthPct}%; background: ${color}"></div>
        </div>
        <div class="chart-bar__pct">${pct}%</div>
      </li>
    `;
  }).join('');

  return `<ul class="chart-bars">${items}</ul>`;
}
