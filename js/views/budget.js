// ============================================================
// VIEW · BUDGET
// ============================================================
// Vista de presupuesto: registro de gastos, totales, balances,
// settlement automático y tasa de cambio editable.
//
// Estructura del HTML:
//   1. Totales generales (gastado / shared / personal)
//   2. Gasto real individual (Alejo / Ana)
//   3. Saldos (quién aportó de más)
//   4. Tasa de cambio (editable)
//   5. Settlement (quién debe a quién)
//   6. Form para agregar gasto
//   7. Historial de gastos
//   8. Hacks de ahorro
// ============================================================

import { $, $$, on, escapeHtml, setHTML, delegate, debounce } from '../dom.js';
import { fmtUSD, fmtCOP, toUSD, toCOP } from '../format.js';
import { TRAVELERS, EXPENSE_CATEGORIES, EXPENSE_CITIES, CURRENCIES, UI } from '../config.js';
import * as store from '../store.js';
import * as toast from '../toast.js';

let panelEl = null;
let mounted = false;
let unsubscribe = null;

const HACKS = [
  { title: 'OMNY tap-to-pay', body: 'En NYC simplemente acerca tu tarjeta contactless o celular en el torniquete. Después de 12 viajes en 7 días seguidos = resto de la semana GRATIS.' },
  { title: 'Happy Hour rules', body: 'Casi todos los bares en NYC y Boston tienen happy hour 4–7 PM. Tragos $6-9 vs $15-18 después. Pídelos siempre antes de las 7.' },
  { title: 'Lunch specials', body: 'Muchos restaurantes que en la noche cobran $30+ tienen lunch combos por $12-15. Especialmente sushi, ramen, dim sum.' },
  { title: 'NYC Museum free hours', body: 'MoMA viernes 4-8 PM GRATIS (UNIQLO Free Friday Nights). Whitney los viernes 7-10 PM pay-what-you-wish. Brooklyn Museum primer sábado de mes gratis.' },
  { title: 'TKTS Times Square', body: 'Tickets de Broadway con 30-50% descuento ese mismo día. Llegar a las 3 PM aprox.' },
  { title: 'Pizza por dollar slice', body: '$1.50 pizza spots: 2 Bros Pizza, 99¢ Fresh. Para "real" NYC slice: Joe\'s, Prince St Pizza, Scarr\'s ($4-5).' },
  { title: 'Free Staten Island Ferry', body: 'Vista gratis de la Estatua de la Libertad. No necesitas pagar el tour de $30. Sale del Whitehall Terminal.' },
  { title: 'Boston Charlie Card vs cash', body: '$2.40 con Charlie Card vs $2.90 cash en el T. Compra una en cualquier estación.' },
  { title: 'Uber Pool / Lyft Shared', body: 'Hasta 40% más barato que Uber X si no tienes afán. En NYC ahora se llama "UberX Share".' },
];

/**
 * Templates por sección.
 */
function tplTotalsTop(totals) {
  return `
    <div class="grid grid--summary">
      <article class="card card--dark">
        <p class="card__label">Total gastado</p>
        <p class="card__big">${fmtUSD(totals.totalSpent)}</p>
        <p class="card__meta">${fmtCOP(toCOP(totals.totalSpent, store.getState().exchangeRate))}</p>
      </article>
      <article class="card">
        <p class="card__label">Compartido</p>
        <p class="card__big">${fmtUSD(totals.totalShared)}</p>
        <p class="card__meta">${fmtCOP(toCOP(totals.totalShared, store.getState().exchangeRate))} · 50/50</p>
      </article>
      <article class="card">
        <p class="card__label">Personal</p>
        <p class="card__big">${fmtUSD(totals.totalPersonal)}</p>
        <p class="card__meta">${fmtCOP(toCOP(totals.totalPersonal, store.getState().exchangeRate))}</p>
      </article>
    </div>
  `;
}

function tplIndividuals(totals, exchangeRate) {
  return `
    <article class="card card--dark">
      <h2 class="card__title" style="color: var(--text-highlight);">💰 Gasto real individual</h2>
      <p class="card__meta" style="margin-bottom: var(--space-3); opacity: 0.7; line-height: 1.5;">
        Cuánto le costó realmente el viaje a cada uno = sus gastos personales + la mitad justa de los gastos compartidos.
      </p>
      <div class="budget-individuals">
        <div class="budget-individual budget-individual--ale">
          <p class="budget-individual__label">${escapeHtml(TRAVELERS.ale.name)}</p>
          <p class="budget-individual__big">${fmtUSD(totals.aleRealTotal)}</p>
          <p class="budget-individual__cop">${fmtCOP(toCOP(totals.aleRealTotal, exchangeRate))}</p>
          <p class="budget-individual__breakdown">
            Personal: ${fmtUSD(totals.alePersonal)}<br>
            + Mitad shared: ${fmtUSD(totals.fairShare)}
          </p>
        </div>
        <div class="budget-individual budget-individual--ana">
          <p class="budget-individual__label">${escapeHtml(TRAVELERS.ana.name)}</p>
          <p class="budget-individual__big">${fmtUSD(totals.anaRealTotal)}</p>
          <p class="budget-individual__cop">${fmtCOP(toCOP(totals.anaRealTotal, exchangeRate))}</p>
          <p class="budget-individual__breakdown">
            Personal: ${fmtUSD(totals.anaPersonal)}<br>
            + Mitad shared: ${fmtUSD(totals.fairShare)}
          </p>
        </div>
      </div>
    </article>
  `;
}

function tplBalances(totals, exchangeRate) {
  const aleLabel =
    totals.totalShared === 0 ? '— sin gastos shared —' :
    totals.aleBalance > 0 ? 'le deben' :
    totals.aleBalance < 0 ? 'debe' : 'a mano';
  const anaLabel =
    totals.totalShared === 0 ? '— sin gastos shared —' :
    totals.anaBalance > 0 ? 'le deben' :
    totals.anaBalance < 0 ? 'debe' : 'a mano';

  const aleSign = totals.aleBalance >= 0 ? '+' : '';
  const anaSign = totals.anaBalance >= 0 ? '+' : '';

  return `
    <div class="grid grid--two" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));">
      <div class="budget-balance budget-balance--ale">
        <p class="budget-balance__label">Saldo ${escapeHtml(TRAVELERS.ale.name)}</p>
        <p class="budget-balance__big">${aleSign}${fmtUSD(totals.aleBalance)}</p>
        <p class="budget-balance__sub">${aleSign}${fmtCOP(toCOP(totals.aleBalance, exchangeRate))}</p>
        <p class="budget-balance__status">${escapeHtml(aleLabel)}</p>
      </div>
      <div class="budget-balance budget-balance--ana">
        <p class="budget-balance__label">Saldo ${escapeHtml(TRAVELERS.ana.name)}</p>
        <p class="budget-balance__big">${anaSign}${fmtUSD(totals.anaBalance)}</p>
        <p class="budget-balance__sub">${anaSign}${fmtCOP(toCOP(totals.anaBalance, exchangeRate))}</p>
        <p class="budget-balance__status">${escapeHtml(anaLabel)}</p>
      </div>
    </div>
  `;
}

function tplExchangeRate(exchangeRate) {
  return `
    <div class="exchange-rate-card">
      <div class="exchange-rate__row">
        <div>
          <p class="card__label">Tasa de cambio actual</p>
          <p class="exchange-rate__display">1 USD = <span id="rate-display">${escapeHtml(String(Math.round(exchangeRate)))}</span> COP</p>
          <p class="exchange-rate__hint">Editable — actualiza según la TRM del día</p>
        </div>
        <form class="exchange-rate__form" id="rate-form">
          <input
            type="number"
            id="rate-input"
            class="exchange-rate__input"
            value="${escapeHtml(String(Math.round(exchangeRate)))}"
            step="1"
            min="1"
          >
          <button type="submit" class="btn">Actualizar</button>
        </form>
      </div>
    </div>
  `;
}

function tplSettlement(totals, exchangeRate) {
  let inner;
  let cls = 'settlement';
  if (totals.totalShared === 0) {
    inner = 'Sin gastos compartidos aún.';
  } else if (!totals.settlement) {
    inner = `<b>✓ Están a mano</b> en gastos compartidos.<br>
      <span class="settlement__sub">Cada uno aportó ${fmtUSD(totals.fairShare)} (${fmtCOP(toCOP(totals.fairShare, exchangeRate))}).</span>`;
  } else {
    const s = totals.settlement;
    const fromName = TRAVELERS[s.from].name;
    const toName = TRAVELERS[s.to].name;
    cls += ' settlement--debt';
    inner = `<b>${escapeHtml(fromName)} le debe a ${escapeHtml(toName)}: ${fmtUSD(s.amount)}</b><br>
      <span class="settlement__sub">≈ ${fmtCOP(toCOP(s.amount, exchangeRate))}</span><br>
      <span class="settlement__sub">Alejo aportó ${fmtUSD(totals.aleShared)} · Ana aportó ${fmtUSD(totals.anaShared)} · Mitad ${fmtUSD(totals.fairShare)}.</span>`;
  }

  return `
    <article class="card">
      <h2 class="card__title">⚖️ Quién debe a quién</h2>
      <div class="${cls}">${inner}</div>
      <p class="card__meta" style="margin-top: var(--space-3); line-height: 1.6;">
        <b>Cómo funciona:</b> El <b>gasto real individual</b> (cards de arriba) muestra lo que le costará el viaje a cada uno.
        Los <b>saldos</b> muestran quién aportó de más/menos en los gastos compartidos.
      </p>
    </article>
  `;
}

function tplAddExpenseForm() {
  const categories = EXPENSE_CATEGORIES.map(c =>
    `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  const cities = EXPENSE_CITIES.map(c =>
    `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');

  return `
    <article class="card">
      <h2 class="card__title">➕ Agregar gasto</h2>
      <form class="expense-form" id="expense-form" autocomplete="off">
        <div class="field">
          <label class="field__label" for="exp-desc">Descripción *</label>
          <input
            type="text"
            id="exp-desc"
            class="input"
            placeholder="ej: Dim sum Joe's Shanghai"
            maxlength="200"
            required
          >
        </div>

        <div class="expense-form__row expense-form__row--3">
          <div class="field">
            <label class="field__label" for="exp-amount">Monto *</label>
            <input
              type="number"
              id="exp-amount"
              class="input"
              placeholder="0.00"
              step="0.01"
              min="0.01"
              required
            >
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

        <button type="submit" class="btn btn--full">Agregar gasto</button>
      </form>
    </article>
  `;
}

function tplExpenseRow(e, exchangeRate) {
  const curr = e.currency || 'USD';
  const amountDisplay = curr === 'COP' ? fmtCOP(e.amount) : fmtUSD(e.amount);
  const usdEquiv = toUSD(e.amount, curr, exchangeRate);
  const altDisplay = curr === 'COP' ? `≈ ${fmtUSD(usdEquiv)}` : `≈ ${fmtCOP(toCOP(e.amount, exchangeRate))}`;
  const typeTag = e.type === 'shared'
    ? '<span class="tag tag--eco">50/50</span>'
    : '<span class="tag">PERSONAL</span>';
  const payerName = TRAVELERS[e.payer]?.nameShort || e.payer;
  const pendingCls = e._pending ? ' is-pending' : '';

  return `
    <div class="expense-row${pendingCls}">
      <div class="expense-row__desc">
        <b>${escapeHtml(e.desc)}</b>
        <span class="expense-row__meta">${escapeHtml(e.category)} · ${escapeHtml(e.city)} · ${escapeHtml(payerName)}</span>
      </div>
      <div class="expense-row__amount">
        ${amountDisplay}
        <span class="expense-row__amount-sub">${altDisplay}</span>
      </div>
      <div class="expense-row__payer">${escapeHtml(payerName)}</div>
      <div>${typeTag}</div>
      <button type="button"
              class="expense-row__del"
              data-action="delete-expense"
              data-id="${escapeHtml(e.id)}"
              aria-label="Eliminar gasto" title="Eliminar">×</button>
    </div>
  `;
}

function tplExpensesList(expenses, exchangeRate) {
  if (!expenses || expenses.length === 0) {
    return `<div class="empty">Sin gastos aún. Agrega el primero arriba ↑</div>`;
  }
  // Más recientes primero
  const rows = expenses.slice().reverse().map(e => tplExpenseRow(e, exchangeRate)).join('');
  return `
    <div class="expense-row expense-row--head">
      <div>Descripción</div>
      <div style="text-align: right;">Monto</div>
      <div style="text-align: center;">Pagó</div>
      <div>Tipo</div>
      <div></div>
    </div>
    <div class="expenses-list">${rows}</div>
  `;
}

function tplHacks() {
  const items = HACKS.map(h => `<div class="hack"><b>${escapeHtml(h.title)}:</b> ${escapeHtml(h.body)}</div>`).join('');
  return `
    <article class="card">
      <h2 class="card__title">⚡ Hacks para ahorrar</h2>
      ${items}
    </article>
  `;
}

/**
 * Render principal.
 */
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

  const html = `
    ${tplTotalsTop(totals)}
    ${tplIndividuals(totals, rate)}
    ${tplBalances(totals, rate)}
    ${tplExchangeRate(rate)}
    ${tplSettlement(totals, rate)}
    ${tplAddExpenseForm()}
    <article class="card">
      <h2 class="card__title">📊 Historial de gastos</h2>
      ${tplExpensesList(state.expenses, rate)}
    </article>
    ${tplHacks()}
  `;
  setHTML(panelEl, html);
}

/**
 * Maneja el submit del form de agregar gasto.
 */
async function handleAddExpense(e) {
  e.preventDefault();

  const desc     = $('#exp-desc')?.value.trim() || '';
  const amount   = parseFloat($('#exp-amount')?.value || '0');
  const currency = $('#exp-currency')?.value || 'USD';
  const payer    = $('#exp-payer')?.value || 'ale';
  const type     = $('#exp-type')?.value || 'shared';
  const category = $('#exp-category')?.value || '🏷️ Otros';
  const city     = $('#exp-city')?.value || '—';

  if (!desc) {
    toast.error('Falta la descripción');
    return;
  }
  if (!amount || amount <= 0) {
    toast.error('Monto inválido');
    return;
  }

  const data = { desc, amount, currency, payer, type, category, city };

  const submitBtn = e.target.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Agregando...';
  }

  try {
    await store.addExpense(data);
    toast.success('Gasto agregado ✓');
    // Limpiar form (mantener selects)
    const descEl = $('#exp-desc');
    const amtEl = $('#exp-amount');
    if (descEl) descEl.value = '';
    if (amtEl) amtEl.value = '';
    if (descEl) descEl.focus();
  } catch (err) {
    toast.error('Error: ' + (err.message || 'No se pudo agregar'));
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Agregar gasto';
    }
  }
}

/**
 * Maneja actualización de tasa.
 */
async function handleRateUpdate(e) {
  e.preventDefault();
  const input = $('#rate-input');
  if (!input) return;
  const rate = parseFloat(input.value);
  if (!rate || rate <= 0) {
    toast.error('Tasa inválida');
    return;
  }
  try {
    await store.updateRate(rate);
    toast.success(`Tasa actualizada: ${Math.round(rate)} COP/USD`);
  } catch (err) {
    toast.error('Error al actualizar tasa');
  }
}

/**
 * Setup de event listeners vía delegación.
 */
function setupDelegation() {
  if (!panelEl) return;

  // Submit del form de gasto
  on(panelEl, 'submit', (e) => {
    if (e.target.id === 'expense-form') {
      handleAddExpense(e);
    } else if (e.target.id === 'rate-form') {
      handleRateUpdate(e);
    }
  });

  // Eliminar gasto
  delegate(panelEl, 'click', '[data-action="delete-expense"]', async function(e, btn) {
    const id = btn.dataset.id;
    if (!id) return;
    const ok = confirm('¿Eliminar este gasto?\n\nSe borrará del Sheet para ambos. No se puede deshacer.');
    if (!ok) return;
    try {
      await store.deleteExpense(id);
      toast.success('Gasto eliminado');
    } catch (err) {
      toast.error('No se pudo eliminar');
    }
  });
}

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
