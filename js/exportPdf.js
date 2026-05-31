// ============================================================
// EXPORT PDF · Itinerario imprimible (dossier de viaje)
// ============================================================
// Genera un documento HTML limpio con todo el itinerario y abre
// el diálogo de impresión del navegador. El usuario elige
// "Guardar como PDF". Sin librerías, sin backend, funciona en
// móvil y desktop.
// ============================================================

import * as store from './store.js';
import { escapeHtml } from './dom.js';
import { TRIP } from './config.js';

/**
 * Construye el HTML completo del dossier imprimible.
 */
function buildPrintHtml() {
  const state = store.getState();
  const itinerary = (state.itinerary || []).slice().sort((a, b) => a.day - b.day);

  const dias = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  function dayDate(dayNum) {
    const start = new Date(TRIP.startDate);
    const d = new Date(start);
    d.setDate(start.getDate() + (Number(dayNum) - 1));
    return `${dias[d.getDay()]} ${d.getDate()} ${meses[d.getMonth()]}`;
  }

  const daysHtml = itinerary.map((day) => {
    const acts = (day.activities || []).filter((a) => a && a.name);
    const actsHtml = acts.length > 0
      ? acts.map((a) => `
          <tr>
            <td class="t">${escapeHtml(a.time || '')}</td>
            <td class="a">
              <strong>${escapeHtml(a.name)}</strong>
              ${a.desc ? `<div class="d">${escapeHtml(a.desc)}</div>` : ''}
              ${a.location ? `<div class="l">📍 ${escapeHtml(a.location)}</div>` : ''}
            </td>
          </tr>`).join('')
      : '<tr><td></td><td class="a"><em>Día libre</em></td></tr>';

    return `
      <section class="day">
        <div class="day-head">
          <span class="day-num">Día ${day.day}</span>
          <span class="day-date">${dayDate(day.day)}</span>
          <span class="day-city">${escapeHtml(day.city || '')}</span>
        </div>
        <h2 class="day-title">${escapeHtml(day.title || '')}</h2>
        ${day.energy ? `<p class="day-energy">Energía: ${escapeHtml(day.energy)}</p>` : ''}
        <table class="acts"><tbody>${actsHtml}</tbody></table>
      </section>
    `;
  }).join('');

  const start = String(TRIP.startDate).slice(0, 10);
  const end = String(TRIP.endDate).slice(0, 10);

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Itinerario · Alejo & Ana · NYC + Boston</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: Georgia, 'Times New Roman', serif;
    color: #1a1815;
    background: #fff;
    padding: 32px;
    line-height: 1.5;
  }
  .cover {
    border-bottom: 3px solid #1a1815;
    padding-bottom: 16px;
    margin-bottom: 24px;
  }
  .kicker {
    font-family: 'Courier New', monospace;
    font-size: 10px;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: #ff4d2e;
    margin-bottom: 6px;
  }
  .title {
    font-size: 38px;
    font-weight: bold;
    letter-spacing: 1px;
    line-height: 1;
  }
  .subtitle {
    font-family: 'Courier New', monospace;
    font-size: 11px;
    color: #8a8275;
    margin-top: 8px;
    letter-spacing: 1px;
  }
  .day {
    margin-bottom: 22px;
    page-break-inside: avoid;
  }
  .day-head {
    display: flex;
    align-items: baseline;
    gap: 12px;
    border-bottom: 1px solid #d9d0bf;
    padding-bottom: 4px;
  }
  .day-num {
    font-family: 'Courier New', monospace;
    font-size: 11px;
    font-weight: bold;
    color: #ff4d2e;
    letter-spacing: 1px;
  }
  .day-date {
    font-family: 'Courier New', monospace;
    font-size: 11px;
    color: #8a8275;
    letter-spacing: 1px;
  }
  .day-city {
    font-family: 'Courier New', monospace;
    font-size: 10px;
    color: #8a8275;
    margin-left: auto;
    text-transform: uppercase;
  }
  .day-title {
    font-size: 20px;
    font-weight: bold;
    margin: 8px 0 2px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .day-energy {
    font-size: 11px;
    color: #8a8275;
    font-style: italic;
    margin-bottom: 8px;
  }
  table.acts { width: 100%; border-collapse: collapse; margin-top: 6px; }
  table.acts td { vertical-align: top; padding: 4px 0; border-bottom: 1px dotted #e8e0d0; }
  td.t {
    font-family: 'Courier New', monospace;
    font-size: 11px;
    font-weight: bold;
    color: #ff4d2e;
    width: 64px;
    white-space: nowrap;
  }
  td.a { font-size: 13px; }
  td.a .d { font-size: 12px; color: #5a5348; margin-top: 2px; }
  td.a .l { font-family: 'Courier New', monospace; font-size: 10px; color: #8a8275; margin-top: 2px; }
  .foot {
    margin-top: 24px;
    padding-top: 12px;
    border-top: 1px solid #d9d0bf;
    text-align: center;
    font-family: 'Courier New', monospace;
    font-size: 9px;
    color: #8a8275;
    letter-spacing: 1px;
  }
  @page { margin: 1.5cm; }
  @media print {
    body { padding: 0; }
    .no-print { display: none; }
  }
  .print-btn {
    position: fixed;
    top: 16px;
    right: 16px;
    background: #ff4d2e;
    color: #fff;
    border: none;
    padding: 12px 20px;
    border-radius: 24px;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    letter-spacing: 1px;
    font-weight: bold;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(255,77,46,0.4);
  }
</style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">🖨️ Guardar como PDF</button>
  <div class="cover">
    <p class="kicker">★ Travel Dossier ★</p>
    <h1 class="title">NYC &amp; BOSTON</h1>
    <p class="subtitle">ALEJO &amp; ANA · ${start} → ${end} · ${itinerary.length} DÍAS</p>
  </div>
  ${daysHtml}
  <p class="foot">Generado desde Travel Planner · Golden leaves. Bright lights. Good company.</p>
  <script>
    // Auto-abrir el diálogo de impresión al cargar
    window.addEventListener('load', function () {
      setTimeout(function () { window.print(); }, 400);
    });
  </script>
</body>
</html>`;
}

/**
 * Abre el dossier imprimible en una ventana nueva.
 */
export function exportItinerary() {
  const html = buildPrintHtml();
  const win = window.open('', '_blank');
  if (!win) {
    alert('Permite las ventanas emergentes para exportar el PDF.');
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

export default { exportItinerary };
