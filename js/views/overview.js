// ============================================================
// VIEW · OVERVIEW (Resumen)
// ============================================================
// Vista de lectura. Muestra:
// - Stats (días, NYC, Boston, clima)
// - Info clave (qué tienen que saber primero)
// - Pronóstico promedio
// - Cómo usar la herramienta
// - Vibe del viaje (tags)
// ============================================================

import { $, escapeHtml, setHTML } from '../dom.js';
import * as store from '../store.js';
import * as countdownHero from '../components/countdownHero.js';
import * as travelCues from '../components/travelCues.js';

const VIBE_TAGS = [
  { label: 'DRAG SHOWS',       variant: 'hot' },
  { label: 'ROOFTOPS',         variant: 'cool' },
  { label: 'THRIFT',           variant: 'eco' },
  { label: 'CAFÉS',            variant: '' },
  { label: 'PHOTODUMP',        variant: '' },
  { label: 'VIDA NOCTURNA',    variant: 'hot' },
  { label: 'AFFORDABLE EATS',  variant: 'eco' },
  { label: 'TURISMO CLÁSICO',  variant: 'cool' },
];

function renderVibeTags() {
  return VIBE_TAGS.map(t => {
    const cls = t.variant ? `tag tag--${t.variant}` : 'tag';
    return `<span class="${cls}">${escapeHtml(t.label)}</span>`;
  }).join('');
}

function template() {
  return `
    <div id="countdown-hero-mount"></div>
    <div id="travel-cues-mount"></div>

    <div class="grid grid--summary">
      <article class="card card--dark">
        <p class="card__label">Días totales</p>
        <p class="card__big">11</p>
        <p class="card__meta">3 oct → 15 oct</p>
      </article>
      <article class="card">
        <p class="card__label">NYC</p>
        <p class="card__big">7</p>
        <p class="card__meta">noches midtown</p>
      </article>
      <article class="card">
        <p class="card__label">Boston</p>
        <p class="card__big">3</p>
        <p class="card__meta">noches airbnb</p>
      </article>
      <article class="card card--accent">
        <p class="card__label">Clima esperado</p>
        <p class="card__big">15–20°</p>
        <p class="card__meta">otoño, ~7 días lluvia</p>
      </article>
    </div>

    <article class="card">
      <h2 class="card__title">⚡ Lo primero que tienes que saber</h2>
      <div class="card__body">
        <p><b>Llegan domingo 4 oct ~4 AM a JFK.</b> Su hotel (Club Wyndham Midtown 45) no permite check-in tan temprano (estándar es 4 PM), así que el plan es: dejar maletas en bell desk apenas lleguen, salir a desayunar/caminar por Midtown y volver a hacer check-in formal en la tarde.</p>
        <p><b>El Wyndham Midtown 45</b> queda en W 45th St entre 7th y 8th Ave — literalmente a 2 cuadras de Times Square. Ubicación premium para metro: están sobre líneas A/C/E, 1/2/3, N/Q/R/W y B/D/F/M.</p>
        <p><b>Octubre en NYC y Boston</b> es otoño en su mejor momento. Días con máximas de 19°C (66°F) y mínimas de 12°C (54°F). Lluvia ocasional (~7-8 días al mes). Empacar capas, chaqueta liviana impermeable, jeans, suéter, zapatos cómodos para caminar mucho.</p>
        <p><b>11 oct tarde:</b> traslado NYC → Boston. Recomiendo Amtrak Northeast Regional desde Moynihan/Penn Station (a 5 cuadras del hotel) — ver pestaña Transporte.</p>
      </div>
    </article>

    <article class="card card--dark">
      <h2 class="card__title" style="color: var(--text-highlight);">🌤️ Pronóstico promedio</h2>
      <div class="weather-strip">
        <span>NYC EARLY OCT</span> <b>20°/12°C</b> · sol predominante · ~3 días lluvia primera mitad
      </div>
      <div class="weather-strip weather-strip--cool" style="margin-bottom: 0;">
        <span>BOSTON MID OCT</span> <b>17°/8°C</b> · más fresco · foliage en pico
      </div>
    </article>

    <article class="card">
      <h2 class="card__title">🎯 Cómo usar esta herramienta</h2>
      <div class="card__body">
        <p><b>📅 Itinerario:</b> día por día con horarios, costos y opciones según energía. Toca cada día para expandir.</p>
        <p><b>💸 Presupuesto:</b> registra cada gasto. Marca si es compartido (50/50) o personal. Ve en tiempo real cuánto debe cada uno.</p>
        <p><b>🚇 Transporte:</b> tablas de comparación con tiempos, costos y la opción recomendada en cada ruta.</p>
        <p><b>📱 Apps:</b> las apps que sí valen la pena descargar antes del viaje.</p>
        <p><b>📝 Notas:</b> espacio libre para guardar links, ideas, restaurantes que les recomienden, etc.</p>
        <p style="margin-top: var(--space-3); padding: var(--space-3); background: var(--surface-paper); border-left: 3px solid var(--color-accent);"><b>💾 Todo se guarda automático.</b> Pueden cerrar y volver a abrir desde cualquier momento — sus datos se quedan ahí.</p>
      </div>
    </article>

    <article class="card">
      <h2 class="card__title">🏳️‍🌈 Vibe del viaje</h2>
      <div class="tag-row" style="margin-top: var(--space-2);">
        ${renderVibeTags()}
      </div>
    </article>
  `;
}

let panelEl = null;
let mounted = false;

/**
 * Monta la vista en el panel #overview.
 * Esta vista no depende del estado del store (es contenido estático),
 * pero respeta el patrón por consistencia.
 */
export function mount() {
  if (mounted) return;
  panelEl = $('#overview');
  if (!panelEl) return;

  setHTML(panelEl, template());
  mounted = true;

  // Montar el countdown hero (Fase 8.4) en su contenedor
  const heroMount = $('#countdown-hero-mount', panelEl);
  if (heroMount) countdownHero.mount(heroMount);

  // Montar travel cues (Fase 8.7) debajo del hero
  const cuesMount = $('#travel-cues-mount', panelEl);
  if (cuesMount) travelCues.mount(cuesMount);
}
