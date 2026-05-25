// ============================================================
// VIEW · BUDGET (Fase 4.7)
// ============================================================
// Añadidos sobre Fase 4.5:
//   ✓ Botón "Marcar como pagado" en settlement
//   ✓ Historial de pagos resueltos (anulables)
//   ✓ Filtros del historial de gastos (ciudad, categoría, persona)
//   ✓ Búsqueda por descripción
// ============================================================

import { $, $$, on, escapeHtml, setHTML, delegate, debounce } from '../dom.js';
import { fmtUSD, fmtCOP, toUSD, toCOP } from '../format.js';
import {
  TRAVELERS, EXPENSE_CATEGORIES, EXPENSE_CITIES, UI
} from '../config.js';
import {
  renderDonut, renderDonutLegend, renderHorizontalBars, toSortedArray
} from '../charts.js';
import * as store from '../store.js';
import * as toast from '../toast.js';

let panelEl = null;
let mounted = false;
let unsubscribe = null;

// Estado UI persistente entre renders
const ui = {
  expanded: {
    detailAle: false,
    detailAna: false,
    hacks: false,
    rate: false,
    payments: false,
  },
  filters: {
    city:     'all',  // 'all' | 'NYC' | 'BOS' | '—'
    category: 'all',  // 'all' | nombre
    payer:    'all',  // 'all' | 'ale' | 'ana'
    type:     'all',  // 'all' | 'shared' | 'personal'
    search:   '',
  },
};

const HACKS = [
  { title: 'OMNY tap-to-pay', body: 'En NYC acerca tu tarjeta contactless o celular en el torniquete. Después de 12 viajes en 7 días seguidos = resto de la semana GRATIS.' },
  { title: 'Happy Hour', body: 'Bares NYC y Boston tienen happy hour 4–7 PM. Tragos $6-9 vs $15-18 después.' },
  { title: 'Lunch specials', body: 'Restaurantes que de noche cobran $30+ tienen lunch combos por $12-15.' },
  { title: 'Museos gratis', body: 'MoMA viernes 4-8 PM gratis (UNIQLO Free Friday). Whitney viernes 7-10 PM pay-what-you-wish.' },
  { title: 'TKTS Times Square', body: 'Tickets Broadway con 30-50% descuento mismo día. Llegar a las 3 PM.' },
  { title: 'Pizza slice', body: '$1.50: 2 Bros, 99¢ Fresh. Slice "real": Joe\'s, Prince St Pizza, Scarr\'s ($4-5).' },
  { title: 'Staten Island Ferry', body: 'Vista gratis de la Estatua de la Libertad. Sale de Whitehall Terminal.' },
  { title: 'Charlie Card Boston', body: '$2.40 con Charlie Card vs $2.90 cash en el T.' },
  { title: 'UberX Share', body: 'Hasta 40% más barato que UberX si no tienes afán.' },
];

// ============================================================
// AGREGACIONES
// ============================================================
function aggregateByCity(expenses, exchangeRate) {
  const map = {};
  for (const e of expenses) {
    const city = e.city && e.city !== '—' ? e.city : 'Otros';
    const cityName = city === 'NYC' ? 'Nueva York' : city === 'BOS' ? 'Boston' : city;
    map[cityName] = (map[cityName] || 0) + toUSD(e.amount, e.currency, exchangeRate);
  }
  return map;
}

function aggregateByCategory(expenses, exchangeRate) {
  const map = {};
  for (const e of expenses) {
    const cat = e.category || '🏷️ Otros';
    map[cat] = (map[cat] || 0) + toUSD(e.amount, e.currency, exchangeRate);
  }
  return map;
}

function breakdownByCategoryForPayer(expenses, payer, exchangeRate) {
  const map = {};
  for (const e of expenses) {
    let contribution = 0;
    if (e.type === 'personal' && e.payer === payer) {
      contribution = toUSD(e.amount, e.currency, exchangeRate);
    } else if (e.type === 'shared') {
      contribution = toUSD(e.amount, e.currency, exchangeRate) / 2;
    }
    if (contribution > 0) {
      const cat = e.category || '🏷️ Otros';
      map[cat] = (map[cat] || 0) + contribution;
    }
  }
  return map;
}

function breakdownByCityForPayer(expenses, payer, exchangeRate) {
  const map = {};
  for (const e of expenses) {
    let contribution = 0;
    if (e.type === 'personal' && e.payer === payer) {
      contribution = toUSD(e.amount, e.currency, exchangeRate);
    } else if (e.type === 'shared') {
      contribution = toUSD(e.amount, e.currency, exchangeRate) / 2;
    }
    if (contribution > 0) {
      const city = e.city && e.city !== '—' ? e.city : 'Otros';
      const cityName = city === 'NYC' ? 'Nueva York' : city === 'BOS' ? 'Boston' : city;
      map[cityName] = (map[cityName] || 0) + contribution;
    }
  }
  return map;
}

function applyFilters(expenses) {
  const f = ui.filters;
  const search = f.search.trim().toLowerCase();
  return expenses.filter((e) => {
    if (f.city !== 'all' && e.city !== f.city) return false;
    if (f.category !== 'all' && e.category !== f.category) return false;
    if (f.payer !== 'all' && e.payer !== f.payer) return false;
    if (f.type !== 'all' && e.type !== f.type) return false;
    if (search && !String(e.desc || '').toLowerCase().includes(search)) return false;
    return true;
  });
}

// ============================================================
// TEMPLATES
// ============================================================

function tplKicker() {
  return `
    <div class="budget-kicker">
      <p class="budget-kicker__pre">★ BUDGET ★</p>
      <h2 class="budget-kicker__title">PRESUPUESTO</h2>
    </div>
  `;
}

function tplOverview(totals, rate) {
  return `
    <article class="card card--dark budget-overview">
      <p class="budget-overview__label">OVERVIEW FINANCIERO</p>
      <div class="budget-overview__grid">
        <div class="budget-overview__cell">
          <div class="budget-overview__icon" style="background: var(--color-accent);">💼</div>
          <div>
            <p class="card__label" style="color: var(--text-muted); opacity: 0.8;">Total gastado</p>
            <p class="budget-overview__big">${fmtUSD(totals.totalSpent)}</p>
            <p class="budget-overview__sub">${fmtCOP(toCOP(totals.totalSpent, rate))}</p>
          </div>
        </div>
        <div class="budget-overview__divider"></div>
        <div class="budget-overview__cell">
          <div class="budget-overview__icon" style="background: var(--color-accent-2); color: var(--color-ink);">👥</div>
          <div>
            <p class="card__label" style="color: var(--text-muted); opacity: 0.8;">Compartido (50/50)</p>
            <p class="budget-overview__big">${fmtUSD(totals.totalShared)}</p>
            <p class="budget-overview__sub">${fmtCOP(toCOP(totals.totalShared, rate))}</p>
          </div>
        </div>
      </div>

      <p class="budget-overview__sectionLabel">LO QUE HA GASTADO CADA UNO</p>
      <div class="budget-overview__people">
        ${tplPersonInline('ale', totals.aleRealTotal, totals.alePersonal, totals.fairShare, rate)}
        ${tplPersonInline('ana', totals.anaRealTotal, totals.anaPersonal, totals.fairShare, rate)}
      </div>
    </article>
  `;
}

function tplPersonInline(payerKey, total, personal, fairShare, rate) {
  const t = TRAVELERS[payerKey];
  const avatar = t.avatar;
  const variant = payerKey === 'ale' ? 'ale' : 'ana';
  return `
    <div class="person-inline person-inline--${variant}">
      <div class="person-inline__main">
        <span class="avatar avatar--${variant}">${avatar}</span>
        <div>
          <p class="person-inline__name">${escapeHtml(t.name.toUpperCase())}</p>
          <p class="person-inline__big">${fmtUSD(total)}</p>
          <p class="person-inline__cop">${fmtCOP(toCOP(total, rate))}</p>
        </div>
      </div>
      <div class="person-inline__breakdown">
        <div>
          <p class="person-inline__sublabel">Personal</p>
          <p class="person-inline__subvalue">${fmtUSD(personal)}</p>
        </div>
        <div>
          <p class="person-inline__sublabel">Compartido (50%)</p>
          <p class="person-inline__subvalue">${fmtUSD(fairShare)}</p>
        </div>
      </div>
    </div>
  `;
}

function tplAnalytics(expenses, rate) {
  const cityData = toSortedArray(aggregateByCity(expenses, rate));
  const catData = toSortedArray(aggregateByCategory(expenses, rate));

  return `
    <div class="analytics-grid">
      <article class="card analytics-card">
        <header class="analytics-card__head">
          <h3 class="analytics-card__title">📍 Gastos por ciudad</h3>
        </header>
        ${renderHorizontalBars(cityData)}
        ${cityData.length > 0 ? `
          <div class="analytics-card__total">
            <span>TOTAL</span>
            <b>${fmtUSD(cityData.reduce((s, d) => s + d.value, 0))}</b>
          </div>
        ` : ''}
      </article>

      <article class="card analytics-card">
        <header class="analytics-card__head">
          <h3 class="analytics-card__title">🍩 Gastos por categoría</h3>
        </header>
        <div class="donut-wrapper">
          ${renderDonut(catData)}
        </div>
        ${renderDonutLegend(catData)}
      </article>
    </div>
  `;
}

function tplIndividualDetail(payerKey, expenses, rate) {
  const t = TRAVELERS[payerKey];
  const avatar = t.avatar;
  const variant = payerKey === 'ale' ? 'ale' : 'ana';
  const isOpen = ui.expanded[payerKey === 'ale' ? 'detailAle' : 'detailAna'];

  const total = expenses.reduce((s, e) => {
    if (e.type === 'personal' && e.payer === payerKey) return s + toUSD(e.amount, e.currency, rate);
    if (e.type === 'shared') return s + toUSD(e.amount, e.currency, rate) / 2;
    return s;
  }, 0);

  const byCategory = toSortedArray(breakdownByCategoryForPayer(expenses, payerKey, rate));
  const byCity = toSortedArray(breakdownByCityForPayer(expenses, payerKey, rate));

  return `
    <article class="person-detail person-detail--${variant} ${isOpen ? 'is-open' : ''}" data-payer="${payerKey}">
      <button class="person-detail__head" type="button" aria-expanded="${isOpen}">
        <div class="person-detail__head-main">
          <span class="avatar avatar--${variant}">${avatar}</span>
          <div>
            <p class="person-detail__name">${escapeHtml(t.name.toUpperCase())}</p>
            <p class="person-detail__big">${fmtUSD(total)}</p>
            <p class="person-detail__cop">${fmtCOP(toCOP(total, rate))}</p>
          </div>
        </div>
        <span class="person-detail__chev" aria-hidden="true">${isOpen ? '▴' : '▾'}</span>
      </button>
      <div class="person-detail__body">
        <div class="person-detail__cols">
          <div class="person-detail__col">
            <h4 class="person-detail__colTitle">Por categoría</h4>
            ${byCategory.length === 0 ? '<p class="person-detail__empty">Sin gastos aún</p>' : `
              <ul class="kv-list">
                ${byCategory.map(d => `
                  <li class="kv-list__item">
                    <span class="kv-list__label">${escapeHtml(d.label)}</span>
                    <span class="kv-list__value">${fmtUSD(d.value)}</span>
                  </li>
                `).join('')}
              </ul>
            `}
          </div>
          <div class="person-detail__col">
            <h4 class="person-detail__colTitle">Por ciudad</h4>
            ${byCity.length === 0 ? '<p class="person-detail__empty">Sin gastos aún</p>' : `
              <ul class="kv-list">
                ${byCity.map(d => `
                  <li class="kv-list__item">
                    <span class="kv-list__label">${escapeHtml(d.label)}</span>
                    <span class="kv-list__value">${fmtUSD(d.value)}</span>
                  </li>
                `).join('')}
              </ul>
            `}
          </div>
        </div>
      </div>
    </article>
  `;
}

function tplIndividualSection(expenses, rate) {
  return `
    <section class="section-block">
      <header class="section-block__head">
        <h3 class="section-block__title">👥 Gasto real individual</h3>
        <p class="section-block__sub">Lo que le cuesta realmente el viaje a cada uno.</p>
      </header>
      ${tplIndividualDetail('ale', expenses, rate)}
      ${tplIndividualDetail('ana', expenses, rate)}
    </section>
  `;
}

function tplSettlement(totals, rate) {
  let centerHtml;
  let cls = 'settlement-card';
  const aleSign = totals.aleBalance >= 0 ? '+' : '−';
  const anaSign = totals.anaBalance >= 0 ? '+' : '−';
  const aleAbs = Math.abs(totals.aleBalance);
  const anaAbs = Math.abs(totals.anaBalance);

  if (totals.totalShared === 0) {
    centerHtml = `
      <p class="settlement-card__title">Sin gastos compartidos aún</p>
      <p class="settlement-card__sub">Agrega un gasto 50/50 para ver la liquidación.</p>
    `;
  } else if (!totals.settlement) {
    centerHtml = `
      <div class="settlement-card__check">✓</div>
      <p class="settlement-card__title">Están a mano</p>
      <p class="settlement-card__sub">${totals.totalSettled > 0
        ? 'Se registraron ' + fmtUSD(totals.totalSettled) + ' en pagos.'
        : 'Cada uno aportó ' + fmtUSD(totals.fairShare) + '.'
      }</p>
    `;
    cls += ' settlement-card--even';
  } else {
    const s = totals.settlement;
    const fromName = TRAVELERS[s.from].name;
    const toName = TRAVELERS[s.to].name;
    const fromAvatar = TRAVELERS[s.from].avatar;
    const toAvatar = TRAVELERS[s.to].avatar;
    const fromVariant = s.from === 'ale' ? 'ale' : 'ana';
    const toVariant = s.to === 'ale' ? 'ale' : 'ana';
    cls += ' settlement-card--debt';
    centerHtml = `
      <div class="settlement-card__avatars">
        <span class="avatar avatar--${fromVariant}">${fromAvatar}</span>
        <span class="settlement-card__arrow" aria-hidden="true">→</span>
        <span class="avatar avatar--${toVariant}">${toAvatar}</span>
      </div>
      <p class="settlement-card__title">${escapeHtml(fromName)} le debe a ${escapeHtml(toName)}</p>
      <p class="settlement-card__big">${fmtUSD(s.amount)}</p>
      <p class="settlement-card__sub">${fmtCOP(toCOP(s.amount, rate))}</p>
      <p class="settlement-card__hint">Equilibra los gastos al 50/50</p>
      <button type="button" class="btn btn--accent settlement-card__pay-btn"
              data-action="mark-paid"
              data-from="${escapeHtml(s.from)}"
              data-to="${escapeHtml(s.to)}"
              data-amount="${s.amount.toFixed(2)}">
        ✓ Marcar como pagado
      </button>
    `;
  }

  const aleStatus = totals.totalShared === 0 ? '—' :
    totals.aleBalance > 0.005 ? 'Le deben' :
    totals.aleBalance < -0.005 ? 'Debe' : 'A mano';
  const anaStatus = totals.totalShared === 0 ? '—' :
    totals.anaBalance > 0.005 ? 'Le deben' :
    totals.anaBalance < -0.005 ? 'Debe' : 'A mano';

  return `
    <section class="section-block">
      <header class="section-block__head">
        <h3 class="section-block__title">⚖️ Balance y liquidación</h3>
      </header>
      <div class="settlement-grid">
        <div class="balance-side balance-side--ale ${totals.aleBalance < 0 ? 'is-negative' : ''}">
          <p class="balance-side__label">${escapeHtml(TRAVELERS.ale.name.toUpperCase())}</p>
          <p class="balance-side__big">${Math.abs(totals.aleBalance) < 0.005 ? '$0.00' : aleSign + fmtUSD(aleAbs)}</p>
          <p class="balance-side__cop">${aleSign} ${fmtCOP(toCOP(aleAbs, rate))}</p>
          <p class="balance-side__status">${aleStatus}</p>
        </div>
        <div class="${cls}">${centerHtml}</div>
        <div class="balance-side balance-side--ana ${totals.anaBalance < 0 ? 'is-negative' : ''}">
          <p class="balance-side__label">${escapeHtml(TRAVELERS.ana.name.toUpperCase())}</p>
          <p class="balance-side__big">${Math.abs(totals.anaBalance) < 0.005 ? '$0.00' : anaSign + fmtUSD(anaAbs)}</p>
          <p class="balance-side__cop">${anaSign} ${fmtCOP(toCOP(anaAbs, rate))}</p>
          <p class="balance-side__status">${anaStatus}</p>
        </div>
      </div>
    </section>
  `;
}

function tplPaymentsHistory(settlements, rate) {
  if (!settlements || settlements.length === 0) return '';
  const isOpen = ui.expanded.payments;

  const items = settlements.slice().reverse().map((s) => {
    const fromName = TRAVELERS[s.from]?.name || s.from;
    const toName = TRAVELERS[s.to]?.name || s.to;
    const fromAvatar = TRAVELERS[s.from]?.avatar || '·';
    const toAvatar = TRAVELERS[s.to]?.avatar || '·';
    const fromVariant = s.from === 'ale' ? 'ale' : 'ana';
    const toVariant = s.to === 'ale' ? 'ale' : 'ana';
    const date = s.timestamp ? new Date(s.timestamp).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
    const pendingCls = s._pending ? ' is-pending' : '';
    return `
      <li class="payment-item${pendingCls}">
        <div class="payment-item__avatars">
          <span class="avatar avatar--small avatar--${fromVariant}">${fromAvatar}</span>
          <span class="payment-item__arrow" aria-hidden="true">→</span>
          <span class="avatar avatar--small avatar--${toVariant}">${toAvatar}</span>
        </div>
        <div class="payment-item__main">
          <p class="payment-item__title">${escapeHtml(fromName)} pagó a ${escapeHtml(toName)}</p>
          <p class="payment-item__meta">${escapeHtml(date)}${s.note ? ' · ' + escapeHtml(s.note) : ''}</p>
        </div>
        <div class="payment-item__amount">
          <p class="payment-item__amount-main">${fmtUSD(s.amountUSD)}</p>
          <p class="payment-item__amount-sub">${fmtCOP(toCOP(s.amountUSD, rate))}</p>
        </div>
        <button type="button" class="expense-item__del"
                data-action="delete-settlement"
                data-id="${escapeHtml(s.id)}"
                aria-label="Anular pago" title="Anular pago">×</button>
      </li>
    `;
  }).join('');

  return `
    <article class="card accordion ${isOpen ? 'is-open' : ''}">
      <button type="button" class="accordion__head" data-action="toggle-payments" aria-expanded="${isOpen}">
        <span class="accordion__title">💸 Pagos resueltos (${settlements.length})</span>
        <span class="accordion__chev" aria-hidden="true">${isOpen ? '▴' : '▾'}</span>
      </button>
      <div class="accordion__body">
        <ul class="payment-list">${items}</ul>
      </div>
    </article>
  `;
}

function tplAddForm() {
  const categories = EXPENSE_CATEGORIES.map(c =>
    `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  const cities = EXPENSE_CITIES.map(c =>
    `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');

  return `
    <section class="section-block">
      <header class="section-block__head">
        <h3 class="section-block__title">➕ Agregar gasto</h3>
      </header>
      <article class="card form-card">
        <form class="expense-form" id="expense-form" autocomplete="off" novalidate>
          <div class="field">
            <label class="field__label" for="exp-desc">Descripción *</label>
            <input type="text" id="exp-desc" class="input"
                   placeholder="ej: Dim sum Joe's Shanghai" maxlength="200" required>
          </div>
          <div class="expense-form__row expense-form__row--3">
            <div class="field">
              <label class="field__label" for="exp-amount">Monto *</label>
              <input type="number" id="exp-amount" class="input"
                     placeholder="0.00" step="0.01" min="0.01" required>
            </div>
            <div class="field">
              <label class="field__label" for="exp-currency">Moneda</label>
              <select id="exp-currency" class="select">
                <option value="USD">💵 USD</option>
                <option value="COP">💰 COP</option>
              </select>
            </div>
            <div class="field">
              <label class="field__label" for="exp-payer">Pagó</label>
              <select id="exp-payer" class="select">
                <option value="ale">${escapeHtml(TRAVELERS.ale.name)}</option>
                <option value="ana">${escapeHtml(TRAVELERS.ana.name)}</option>
              </select>
            </div>
          </div>
          <div class="expense-form__row expense-form__row--3">
            <div class="field">
              <label class="field__label" for="exp-type">Tipo</label>
              <select id="exp-type" class="select">
                <option value="shared">Compartido 50/50</option>
                <option value="personal">Personal</option>
              </select>
            </div>
            <div class="field">
              <label class="field__label" for="exp-category">Categoría</label>
              <select id="exp-category" class="select">${categories}</select>
            </div>
            <div class="field">
              <label class="field__label" for="exp-city">Ciudad</label>
              <select id="exp-city" class="select">${cities}</select>
            </div>
          </div>
          <button type="submit" class="btn btn--full btn--accent">Agregar gasto</button>
        </form>
      </article>
    </section>
  `;
}

function tplFilterChips(expenses) {
  const f = ui.filters;

  // Conjunto de categorías existentes en gastos actuales
  const usedCats = new Set();
  for (const e of expenses) if (e.category) usedCats.add(e.category);
  const catChips = Array.from(usedCats).sort();

  return `
    <div class="filters">
      <input type="text" class="input filters__search"
             placeholder="🔍 Buscar gasto..."
             id="filter-search"
             value="${escapeHtml(f.search)}">

      <div class="filters__row">
        <span class="filters__label">Ciudad:</span>
        <div class="filters__chips">
          <button type="button" class="chip ${f.city === 'all' ? 'is-active' : ''}" data-filter="city" data-value="all">Todas</button>
          <button type="button" class="chip ${f.city === 'NYC' ? 'is-active' : ''}" data-filter="city" data-value="NYC">NYC</button>
          <button type="button" class="chip ${f.city === 'BOS' ? 'is-active' : ''}" data-filter="city" data-value="BOS">Boston</button>
        </div>
      </div>

      <div class="filters__row">
        <span class="filters__label">Persona:</span>
        <div class="filters__chips">
          <button type="button" class="chip ${f.payer === 'all' ? 'is-active' : ''}" data-filter="payer" data-value="all">Todos</button>
          <button type="button" class="chip chip--ale ${f.payer === 'ale' ? 'is-active' : ''}" data-filter="payer" data-value="ale">${TRAVELERS.ale.avatar} ${escapeHtml(TRAVELERS.ale.name)}</button>
          <button type="button" class="chip chip--ana ${f.payer === 'ana' ? 'is-active' : ''}" data-filter="payer" data-value="ana">${TRAVELERS.ana.avatar} ${escapeHtml(TRAVELERS.ana.name)}</button>
        </div>
      </div>

      <div class="filters__row">
        <span class="filters__label">Tipo:</span>
        <div class="filters__chips">
          <button type="button" class="chip ${f.type === 'all' ? 'is-active' : ''}" data-filter="type" data-value="all">Todos</button>
          <button type="button" class="chip ${f.type === 'shared' ? 'is-active' : ''}" data-filter="type" data-value="shared">50/50</button>
          <button type="button" class="chip ${f.type === 'personal' ? 'is-active' : ''}" data-filter="type" data-value="personal">Personal</button>
        </div>
      </div>

      ${catChips.length > 0 ? `
        <div class="filters__row">
          <span class="filters__label">Categoría:</span>
          <div class="filters__chips">
            <button type="button" class="chip ${f.category === 'all' ? 'is-active' : ''}" data-filter="category" data-value="all">Todas</button>
            ${catChips.map(c => `
              <button type="button" class="chip ${f.category === c ? 'is-active' : ''}"
                      data-filter="category" data-value="${escapeHtml(c)}">${escapeHtml(c)}</button>
            `).join('')}
          </div>
        </div>
      ` : ''}

      ${(f.city !== 'all' || f.payer !== 'all' || f.type !== 'all' || f.category !== 'all' || f.search) ? `
        <button type="button" class="filters__clear" data-action="clear-filters">
          ✕ Limpiar filtros
        </button>
      ` : ''}
    </div>
  `;
}

function tplExpenseItem(e, rate) {
  const curr = e.currency || 'USD';
  const amountDisplay = curr === 'COP' ? fmtCOP(e.amount) : fmtUSD(e.amount);
  const usdEquiv = toUSD(e.amount, curr, rate);
  const altDisplay = curr === 'COP' ? `≈ ${fmtUSD(usdEquiv)}` : fmtCOP(toCOP(e.amount, rate));
  const payerVariant = e.payer === 'ale' ? 'ale' : 'ana';
  const payerAvatar = TRAVELERS[e.payer]?.avatar || '·';
  const typeTag = e.type === 'shared'
    ? '<span class="tag tag--eco">50/50</span>'
    : '<span class="tag">Personal</span>';
  const pendingCls = e._pending ? ' is-pending' : '';

  return `
    <li class="expense-item${pendingCls}">
      <span class="avatar avatar--${payerVariant} expense-item__avatar">${payerAvatar}</span>
      <div class="expense-item__main">
        <p class="expense-item__desc">${escapeHtml(e.desc)}</p>
        <div class="expense-item__meta">
          <span>${escapeHtml(e.category)}</span>
          <span aria-hidden="true">·</span>
          <span>${escapeHtml(e.city)}</span>
          <span aria-hidden="true">·</span>
          ${typeTag}
        </div>
      </div>
      <div class="expense-item__amount">
        <p class="expense-item__amount-main">${amountDisplay}</p>
        <p class="expense-item__amount-sub">${altDisplay}</p>
      </div>
      <button type="button" class="expense-item__del"
              data-action="delete-expense"
              data-id="${escapeHtml(e.id)}"
              aria-label="Eliminar">×</button>
    </li>
  `;
}

function tplHistory(expenses, rate) {
  const totalCount = expenses.length;
  const filtered = applyFilters(expenses);
  const visibleCount = filtered.length;

  return `
    <section class="section-block">
      <header class="section-block__head">
        <h3 class="section-block__title">📊 Historial de gastos</h3>
        <p class="section-block__sub">
          ${visibleCount === totalCount
            ? `${totalCount} ${totalCount === 1 ? 'gasto' : 'gastos'} registrados`
            : `${visibleCount} de ${totalCount} ${totalCount === 1 ? 'gasto' : 'gastos'} (filtrados)`
          }
        </p>
      </header>
      <article class="card">
        ${totalCount > 0 ? tplFilterChips(expenses) : ''}
        ${visibleCount === 0
          ? (totalCount === 0
              ? '<p class="empty">Sin gastos aún. Agrega el primero arriba ↑</p>'
              : '<p class="empty">Ningún gasto coincide con los filtros activos.</p>')
          : `<ul class="expense-list">${filtered.slice().reverse().map(e => tplExpenseItem(e, rate)).join('')}</ul>`
        }
      </article>
    </section>
  `;
}

function tplUtilities(rate) {
  return `
    <section class="section-block">
      <header class="section-block__head">
        <h3 class="section-block__title">🛠️ Utilidades</h3>
      </header>

      <article class="card utility-card">
        <div class="utility-card__row">
          <div>
            <p class="utility-card__label">Tasa de cambio actual</p>
            <p class="utility-card__big">1 USD = <span id="rate-display">${escapeHtml(String(Math.round(rate)))}</span> COP</p>
            <p class="utility-card__hint">Editable — actualiza según la TRM del día</p>
          </div>
          <button type="button" class="btn btn--outline btn--small" data-action="toggle-rate">
            ${ui.expanded.rate ? 'Cerrar' : 'Editar tasa'}
          </button>
        </div>
        ${ui.expanded.rate ? `
          <form class="utility-card__form" id="rate-form">
            <input type="number" id="rate-input" class="input" value="${escapeHtml(String(Math.round(rate)))}" step="1" min="1">
            <button type="submit" class="btn btn--accent">Actualizar</button>
          </form>
        ` : ''}
      </article>

      <article class="card accordion ${ui.expanded.hacks ? 'is-open' : ''}" data-accordion="hacks">
        <button type="button" class="accordion__head" data-action="toggle-hacks" aria-expanded="${ui.expanded.hacks}">
          <span class="accordion__title">⚡ Hacks para ahorrar</span>
          <span class="accordion__chev" aria-hidden="true">${ui.expanded.hacks ? '▴' : '▾'}</span>
        </button>
        <div class="accordion__body">
          ${HACKS.map(h => `<div class="hack"><b>${escapeHtml(h.title)}:</b> ${escapeHtml(h.body)}</div>`).join('')}
        </div>
      </article>
    </section>
  `;
}

// ============================================================
// RENDER PRINCIPAL
// ============================================================

function render(state) {
  if (!panelEl) return;

  if (state.status === 'loading' && state.isFirstLoad) {
    setHTML(panelEl, `
      <div class="card">
        <div class="skeleton" style="height: 100px; margin-bottom: 12px;"></div>
        <div class="skeleton" style="height: 100px;"></div>
      </div>
    `);
    return;
  }

  const totals = state.totals;
  const rate = state.exchangeRate;
  const expenses = state.expenses || [];
  const settlements = state.settlements || [];

  const html = `
    ${tplKicker()}
    ${tplOverview(totals, rate)}
    ${tplAnalytics(expenses, rate)}
    ${tplIndividualSection(expenses, rate)}
    ${tplSettlement(totals, rate)}
    ${tplPaymentsHistory(settlements, rate)}
    ${tplAddForm()}
    ${tplHistory(expenses, rate)}
    ${tplUtilities(rate)}
  `;
  setHTML(panelEl, html);
}

// ============================================================
// HANDLERS
// ============================================================

async function handleAddExpense(e) {
  e.preventDefault();

  const desc     = $('#exp-desc')?.value.trim() || '';
  const amount   = parseFloat($('#exp-amount')?.value || '0');
  const currency = $('#exp-currency')?.value || 'USD';
  const payer    = $('#exp-payer')?.value || 'ale';
  const type     = $('#exp-type')?.value || 'shared';
  const category = $('#exp-category')?.value || '🏷️ Otros';
  const city     = $('#exp-city')?.value || '—';

  if (!desc) { toast.error('Falta la descripción'); return; }
  if (!amount || amount <= 0) { toast.error('Monto inválido'); return; }

  const submitBtn = e.target.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Agregando...';
  }

  try {
    await store.addExpense({ desc, amount, currency, payer, type, category, city });
    toast.success('Gasto agregado ✓');
  } catch (err) {
    toast.error('Error: ' + (err.message || 'No se pudo agregar'));
  }
}

async function handleRateUpdate(e) {
  e.preventDefault();
  const input = $('#rate-input');
  if (!input) return;
  const rate = parseFloat(input.value);
  if (!rate || rate <= 0) { toast.error('Tasa inválida'); return; }
  try {
    await store.updateRate(rate);
    ui.expanded.rate = false;
    render(store.getState());
    toast.success(`Tasa actualizada: ${Math.round(rate)} COP/USD`);
  } catch (err) {
    toast.error('Error al actualizar tasa');
  }
}

async function handleMarkPaid(btn) {
  const from = btn.dataset.from;
  const to = btn.dataset.to;
  const amount = parseFloat(btn.dataset.amount);
  if (!from || !to || !amount) return;

  const fromName = TRAVELERS[from]?.name || from;
  const toName = TRAVELERS[to]?.name || to;

  // Modal simple con prompt — luego se puede mejorar con un modal real
  const ok = confirm(
    `Confirmar pago:\n\n${fromName} pagó a ${toName}: $${amount.toFixed(2)}\n\n` +
    `Esto registra que ${fromName} ya saldó esta deuda con ${toName}.`
  );
  if (!ok) return;

  const state = store.getState();
  try {
    await store.addSettlement({
      from: from,
      to: to,
      amountUSD: amount,
      exchangeRate: state.exchangeRate,
      note: 'Marcado como pagado',
    });
    toast.success('Pago registrado ✓');
  } catch (err) {
    toast.error('No se pudo registrar el pago: ' + (err.message || ''));
  }
}

function setFilter(name, value) {
  ui.filters[name] = value;
  render(store.getState());
}

const debouncedSearchUpdate = debounce((value) => {
  ui.filters.search = value;
  render(store.getState());
}, 250);

function setupDelegation() {
  if (!panelEl) return;

  on(panelEl, 'submit', (e) => {
    if (e.target.id === 'expense-form') handleAddExpense(e);
    else if (e.target.id === 'rate-form') handleRateUpdate(e);
  });

  // Búsqueda en el historial
  on(panelEl, 'input', (e) => {
    if (e.target.id === 'filter-search') {
      debouncedSearchUpdate(e.target.value);
    }
  });

  // Eliminar gasto
  delegate(panelEl, 'click', '[data-action="delete-expense"]', async function(e, btn) {
    const id = btn.dataset.id;
    if (!id) return;
    if (!confirm('¿Eliminar este gasto?')) return;
    try {
      await store.deleteExpense(id);
      toast.success('Gasto eliminado');
    } catch (err) {
      toast.error('No se pudo eliminar');
    }
  });

  // Anular pago
  delegate(panelEl, 'click', '[data-action="delete-settlement"]', async function(e, btn) {
    const id = btn.dataset.id;
    if (!id) return;
    if (!confirm('¿Anular este pago?\n\nLos balances volverán al estado previo a este pago.')) return;
    try {
      await store.deleteSettlement(id);
      toast.success('Pago anulado');
    } catch (err) {
      toast.error('No se pudo anular');
    }
  });

  // Marcar como pagado
  delegate(panelEl, 'click', '[data-action="mark-paid"]', function(e, btn) {
    handleMarkPaid(btn);
  });

  // Accordions
  delegate(panelEl, 'click', '.person-detail--ale .person-detail__head', function() {
    ui.expanded.detailAle = !ui.expanded.detailAle;
    render(store.getState());
  });
  delegate(panelEl, 'click', '.person-detail--ana .person-detail__head', function() {
    ui.expanded.detailAna = !ui.expanded.detailAna;
    render(store.getState());
  });
  delegate(panelEl, 'click', '[data-action="toggle-hacks"]', function() {
    ui.expanded.hacks = !ui.expanded.hacks;
    render(store.getState());
  });
  delegate(panelEl, 'click', '[data-action="toggle-rate"]', function() {
    ui.expanded.rate = !ui.expanded.rate;
    render(store.getState());
  });
  delegate(panelEl, 'click', '[data-action="toggle-payments"]', function() {
    ui.expanded.payments = !ui.expanded.payments;
    render(store.getState());
  });

  // Filtros (chips)
  delegate(panelEl, 'click', '[data-filter]', function(e, btn) {
    const name = btn.dataset.filter;
    const value = btn.dataset.value;
    if (name && value !== undefined) setFilter(name, value);
  });

  // Limpiar filtros
  delegate(panelEl, 'click', '[data-action="clear-filters"]', function() {
    ui.filters = { city: 'all', category: 'all', payer: 'all', type: 'all', search: '' };
    render(store.getState());
  });
}

// ============================================================
// MOUNT
// ============================================================

export function mount() {
  if (mounted) return;
  panelEl = $('#budget');
  if (!panelEl) return;
  mounted = true;
  setupDelegation();
  unsubscribe = store.subscribe(render);
}

export function unmount() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  mounted = false;
}
