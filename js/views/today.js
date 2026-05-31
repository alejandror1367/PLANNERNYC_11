// ============================================================
// TODAY · Dashboard "Hoy" (copiloto durante el viaje)
// ============================================================
// Pestaña que concentra lo más útil del momento. Solo aporta
// valor DURANTE el viaje; antes/después muestra un estado vacío.
//
// Reutiliza:
//   - trip.js       → fase del viaje, día actual
//   - weather.js    → clima en vivo del día
//   - budget.js     → gasto de hoy
//   - maps.js       → botón "ir" a la próxima actividad
//
// Todo sale de datos que ya existen. Cero APIs nuevas.
// ============================================================

import { $, on, escapeHtml, setHTML, delegate } from '../dom.js';
import * as store from '../store.js';
import * as router from '../router.js';
import { getTripPhase } from '../trip.js';
import * as weather from '../weather.js';
import * as maps from '../maps.js';
import { computeInsights, groupByDay } from '../budget.js';

let panelEl = null;
let mounted = false;
let unsubscribe = null;
let forecast = null;
let refreshInterval = null;

// Umbral para considerar un "hueco" grande entre dos actividades (minutos).
const GAP_MINUTES = 120; // 2 horas

// ---------- helpers de tiempo ----------
function timeToMinutes(timeStr) {
  if (!timeStr) return null;
  const m = String(timeStr).match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  // soportar AM/PM si viene
  if (/p\.?m\.?/i.test(timeStr) && h < 12) h += 12;
  if (/a\.?m\.?/i.test(timeStr) && h === 12) h = 0;
  return h * 60 + min;
}

// Formatea una duración en minutos como "3 h", "45 min" o "2 h 30 min".
function fmtGap(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

/**
 * Clasifica las actividades del día en: hechas, actual, próximas.
 */
function classifyActivities(day, now) {
  const acts = (day.activities || []).filter((a) => a && a.name);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const withMin = acts.map((a) => ({ act: a, mins: timeToMinutes(a.time) }));
  // Ordenar por hora (las sin hora al final, en su orden original)
  const sorted = withMin.slice().sort((a, b) => {
    if (a.mins === null) return 1;
    if (b.mins === null) return -1;
    return a.mins - b.mins;
  });

  let current = null;
  let next = null;
  const done = [];
  const upcoming = [];

  for (let i = 0; i < sorted.length; i++) {
    const item = sorted[i];
    if (item.mins === null) {
      upcoming.push(item.act);
      continue;
    }
    if (item.mins <= nowMin) {
      // ¿es la "actual"? la última cuya hora ya pasó, si la siguiente aún no llega
      const nextItem = sorted[i + 1];
      const nextMin = nextItem ? nextItem.mins : null;
      if (nextMin === null || nextMin > nowMin) {
        current = item.act;
      } else {
        done.push(item.act);
      }
    } else {
      upcoming.push(item.act);
    }
  }

  // La "próxima" es la primera de upcoming (con hora)
  next = upcoming.length > 0 ? upcoming[0] : null;

  return { done, current, next, upcoming, all: sorted.map((s) => s.act) };
}

// ---------- estado vacío (fuera del viaje) ----------
function renderEmpty(tp) {
  let msg, sub;
  if (tp.phase === 'pre') {
    msg = 'El viaje aún no empieza';
    sub = `Faltan ${tp.daysUntilStart} ${tp.daysUntilStart === 1 ? 'día' : 'días'}. El dashboard de "Hoy" se activa cuando arranque el viaje. Mientras tanto, revisa el Resumen y el Itinerario.`;
  } else {
    msg = 'El viaje terminó';
    sub = 'Esperamos que haya sido increíble. Revisa los gastos finales en Presupuesto y los recuerdos en Notas.';
  }
  setHTML(panelEl, `
    <div class="today-empty">
      <p class="today-empty__icon" aria-hidden="true">🧭</p>
      <h2 class="today-empty__title">${escapeHtml(msg)}</h2>
      <p class="today-empty__sub">${escapeHtml(sub)}</p>
    </div>
  `);
}

// ---------- header del día ----------
function renderHeader(day, tp) {
  const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const iso = weather.dayNumberToISO(day.day);
  const d = new Date(iso + 'T12:00:00');
  const dateLabel = `${dias[d.getDay()]} · ${d.getDate()} ${meses[d.getMonth()]}`.toUpperCase();

  // Clima
  let climaShort = '';
  if (forecast) {
    const w = weather.dayWeather(forecast, iso, day.city);
    if (w) climaShort = `${w.icon} ${w.max !== null ? w.max + '°' : ''}`;
  }

  return `
    <div class="today-header">
      <div class="today-header__left">
        <p class="today-header__date">${escapeHtml(dateLabel)}</p>
        <h1 class="today-header__city">${escapeHtml((day.city || 'Hoy').toUpperCase())}</h1>
      </div>
      <div class="today-header__right">
        ${climaShort ? `<span class="today-header__clima">${climaShort}</span>` : ''}
        <span class="today-header__day-badge">Día ${tp.dayNumber}/${tp.totalDays}</span>
      </div>
    </div>
  `;
}

// ---------- próxima actividad ----------
function renderNext(cls, day) {
  const act = cls.current || cls.next;
  if (!act) {
    return `
      <p class="today-kicker">★ Ahora / próximo ★</p>
      <div class="today-card today-card--empty">
        <p class="today-empty-line">No quedan actividades con hora hoy. ¡Día libre o improvisación!</p>
      </div>
    `;
  }
  const isNow = !!cls.current;
  const mapUrl = maps.isMappable(act) ? maps.directionsUrl(act, day.city) : '';

  return `
    <p class="today-kicker">★ ${isNow ? 'Ahora' : 'Próximo'} ★</p>
    <article class="today-card today-card--next">
      <div class="today-next__body">
        ${act.time ? `<p class="today-next__time">${escapeHtml(act.time)}</p>` : ''}
        <h3 class="today-next__name">${escapeHtml(act.name)}</h3>
        ${act.desc ? `<p class="today-next__desc">${escapeHtml(act.desc)}</p>` : ''}
        ${act.location ? `<p class="today-next__loc">📍 ${escapeHtml(act.location)}</p>` : ''}
      </div>
      ${mapUrl ? `
        <a href="${escapeHtml(mapUrl)}" target="_blank" rel="noopener noreferrer"
           class="today-next__go" aria-label="Cómo llegar">
          📍<span>Ir</span>
        </a>` : ''}
    </article>
  `;
}

// ---------- timeline de hoy ----------
function renderTimeline(cls) {
  if (cls.all.length === 0) {
    return '';
  }
  const items = cls.all.map((a) => {
    let state = 'pending';
    if (cls.current && a === cls.current) state = 'current';
    else if (cls.done.indexOf(a) !== -1) state = 'done';

    const dot = state === 'done' ? 'today-tl__dot--done'
              : state === 'current' ? 'today-tl__dot--current'
              : 'today-tl__dot--pending';
    const txt = state === 'done' ? 'today-tl__label--done'
              : state === 'current' ? 'today-tl__label--current'
              : '';
    return `
      <li class="today-tl__item">
        <span class="today-tl__dot ${dot}"></span>
        <span class="today-tl__label ${txt}">
          ${a.time ? `<span class="today-tl__time">${escapeHtml(a.time)}</span> ` : ''}${escapeHtml(a.name)}
        </span>
      </li>
    `;
  }).join('');

  return `
    <p class="today-kicker today-kicker--muted">Hoy</p>
    <article class="today-card">
      <ul class="today-tl">${items}</ul>
    </article>
  `;
}

// ---------- widget "Ritmo del día": huecos y choques ----------
/**
 * Analiza las actividades CON hora del día y detecta:
 *   - clashes: dos actividades a la misma hora exacta (choque de plan).
 *   - gaps:    espacios >= GAP_MINUTES entre actividades consecutivas.
 * Solo usa datos existentes (la hora de inicio); cero backend.
 */
function detectPacing(day) {
  const timed = (day.activities || [])
    .filter((a) => a && a.name)
    .map((a) => ({ act: a, mins: timeToMinutes(a.time) }))
    .filter((x) => x.mins !== null)
    .sort((a, b) => a.mins - b.mins);

  const gaps = [];
  const clashes = [];
  for (let i = 0; i < timed.length - 1; i++) {
    const cur = timed[i];
    const nxt = timed[i + 1];
    const diff = nxt.mins - cur.mins;
    if (diff === 0) {
      clashes.push({ a: cur.act, b: nxt.act });
    } else if (diff >= GAP_MINUTES) {
      gaps.push({ a: cur.act, b: nxt.act, mins: diff });
    }
  }
  return { gaps, clashes };
}

function renderPacing(day) {
  const { gaps, clashes } = detectPacing(day);
  // Solo avisamos si hay algo que decir; si el plan está equilibrado,
  // no añadimos ruido al dashboard.
  if (gaps.length === 0 && clashes.length === 0) return '';

  const clashItems = clashes.map((c) => `
    <li class="today-pace__item today-pace__item--clash">
      <span class="today-pace__icon" aria-hidden="true">⚠️</span>
      <span class="today-pace__text">
        <span class="today-pace__head">Choque de hora</span>
        <span class="today-pace__detail">${escapeHtml(c.a.name)} y ${escapeHtml(c.b.name)} están a las ${escapeHtml(c.a.time)}</span>
      </span>
    </li>
  `).join('');

  const gapItems = gaps.map((g) => `
    <li class="today-pace__item today-pace__item--gap">
      <span class="today-pace__icon" aria-hidden="true">⏳</span>
      <span class="today-pace__text">
        <span class="today-pace__head">${fmtGap(g.mins)} sin plan</span>
        <span class="today-pace__detail">entre ${escapeHtml(g.a.name)} (${escapeHtml(g.a.time)}) y ${escapeHtml(g.b.name)} (${escapeHtml(g.b.time)})</span>
      </span>
    </li>
  `).join('');

  return `
    <p class="today-kicker">★ Ritmo del día ★</p>
    <article class="today-card today-pace">
      <ul class="today-pace__list">
        ${clashItems}
        ${gapItems}
      </ul>
    </article>
  `;
}

// ---------- gasto hoy + clima ----------
function renderBudgetWeather(day, tp) {
  const state = store.getState();
  const rate = state.exchangeRate || 3667;
  const iso = weather.dayNumberToISO(day.day);

  // Gasto de hoy
  const byDay = groupByDay(state.expenses || [], rate);
  const todaySpent = byDay[iso] ? byDay[iso].totalUSD : 0;

  // Promedio para comparar
  const insights = computeInsights(state.expenses || [], rate, tp);
  const avg = insights ? insights.avgPerActiveDay : 0;
  let budgetNote = '';
  if (avg > 0 && todaySpent > 0) {
    budgetNote = todaySpent <= avg
      ? '<span class="today-budget__ok">✓ bajo el promedio</span>'
      : '<span class="today-budget__over">↑ sobre el promedio</span>';
  } else if (todaySpent === 0) {
    budgetNote = '<span class="today-budget__none">sin gastos aún</span>';
  }

  const spentStr = '$' + Math.round(todaySpent).toLocaleString('en-US');

  // Clima detallado
  let climaCard;
  const w = forecast ? weather.dayWeather(forecast, iso, day.city) : null;
  if (w) {
    const rango = (w.max !== null && w.min !== null) ? `${w.min}-${w.max}°` : '';
    const lluvia = (w.precip !== null && w.precip >= 30) ? `· 💧 ${w.precip}%` : '· sin lluvia';
    climaCard = `
      <article class="today-card today-card--dark today-half">
        <p class="today-half__label today-half__label--accent">Clima</p>
        <p class="today-half__big">${w.icon} ${w.max !== null ? w.max + '°' : ''}</p>
        <p class="today-half__note today-half__note--light">${rango} ${lluvia}</p>
      </article>
    `;
  } else {
    climaCard = `
      <article class="today-card today-card--dark today-half">
        <p class="today-half__label today-half__label--accent">Clima</p>
        <p class="today-half__big">${escapeHtml(day.weather || '—')}</p>
        <p class="today-half__note today-half__note--light">pronóstico al acercarse</p>
      </article>
    `;
  }

  return `
    <div class="today-row">
      <article class="today-card today-half">
        <p class="today-half__label">Gasto hoy</p>
        <p class="today-half__big">${spentStr}</p>
        <p class="today-half__note">${budgetNote}</p>
      </article>
      ${climaCard}
    </div>
  `;
}

// ---------- quick actions ----------
function renderQuickActions() {
  return `
    <p class="today-kicker today-kicker--muted">¿Qué necesitas?</p>
    <div class="today-actions">
      <button type="button" class="btn btn--accent today-action" data-action="qa-expense">
        💸 Registrar gasto
      </button>
      <button type="button" class="btn btn--outline today-action" data-action="qa-where">
        📍 ¿Dónde estoy?
      </button>
    </div>
  `;
}

// ---------- render principal ----------
function render() {
  if (!panelEl) return;
  const state = store.getState();
  const itinerary = state.itinerary || [];
  const tp = getTripPhase(new Date(), itinerary.length);

  // Solo durante el viaje
  if (tp.phase !== 'during') {
    renderEmpty(tp);
    return;
  }

  const today = itinerary.find((d) => Number(d.day) === tp.dayNumber);
  if (!today) {
    renderEmpty(tp);
    return;
  }

  const now = new Date();
  const cls = classifyActivities(today, now);

  setHTML(panelEl, `
    ${renderHeader(today, tp)}
    ${renderNext(cls, today)}
    ${renderTimeline(cls)}
    ${renderPacing(today)}
    ${renderBudgetWeather(today, tp)}
    ${renderQuickActions()}
  `);
}

// ---------- quick action handlers ----------
function handleWhereAmI() {
  const state = store.getState();
  const itinerary = state.itinerary || [];
  const tp = getTripPhase(new Date(), itinerary.length);
  const today = itinerary.find((d) => Number(d.day) === tp.dayNumber);
  if (!today) return;
  const cls = classifyActivities(today, new Date());
  const anchor = cls.current || cls.next;
  if (anchor && maps.isMappable(anchor)) {
    window.open(maps.directionsUrl(anchor, today.city), '_blank', 'noopener');
  } else {
    // Sin ancla: abrir búsqueda de la ciudad
    const q = encodeURIComponent((today.city || '').replace('NYC', 'New York').replace('BOS', 'Boston'));
    window.open('https://www.google.com/maps/search/?api=1&query=' + q, '_blank', 'noopener');
  }
}

function setupListeners() {
  delegate(panelEl, 'click', '[data-action="qa-expense"]', () => {
    router.goTo('budget');
    // pequeño delay para que monte, luego enfocar el form si existe
    setTimeout(() => {
      const form = document.getElementById('expense-form');
      if (form) form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
  });

  delegate(panelEl, 'click', '[data-action="qa-where"]', handleWhereAmI);
}

export function mount() {
  if (mounted) return;
  panelEl = $('#today');
  if (!panelEl) return;

  mounted = true;
  render();
  setupListeners();
  unsubscribe = store.subscribe(render);

  // Clima en vivo
  weather.getForecast().then((data) => {
    if (data) { forecast = data; render(); }
  }).catch(() => {});

  // Refrescar cada 5 min (para que "ahora/próximo" se mantenga al día)
  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(render, 5 * 60 * 1000);

  // Al volver a la pestaña, re-render para refrescar la hora
  router.subscribe((tabId) => {
    if (tabId === 'today' && mounted) render();
  });
}

export function unmount() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  if (refreshInterval) { clearInterval(refreshInterval); refreshInterval = null; }
  mounted = false;
}

export default { mount, unmount };
