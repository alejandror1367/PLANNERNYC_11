// ============================================================
// BUDGET · Cálculos puros de presupuesto
// ============================================================
// Funciones puras: reciben datos, devuelven resultados.
// Sin DOM, sin estado externo.
// ============================================================

import { toUSD } from './format.js';

/**
 * Calcula totales y balances a partir de gastos y settlements.
 *
 * @param {Array<Expense>} expenses
 * @param {number} exchangeRate
 * @param {Array<Settlement>} [settlements=[]] - pagos resueltos
 */
export function computeTotals(expenses, exchangeRate, settlements = []) {
  let totalSpent = 0;
  let totalShared = 0;
  let totalPersonal = 0;
  let aleShared = 0;
  let anaShared = 0;
  let alePersonal = 0;
  let anaPersonal = 0;

  for (const e of expenses) {
    const usd = toUSD(e.amount, e.currency, exchangeRate);
    totalSpent += usd;

    if (e.type === 'shared') {
      totalShared += usd;
      if (e.payer === 'ale') aleShared += usd;
      else if (e.payer === 'ana') anaShared += usd;
    } else {
      totalPersonal += usd;
      if (e.payer === 'ale') alePersonal += usd;
      else if (e.payer === 'ana') anaPersonal += usd;
    }
  }

  const fairShare = totalShared / 2;

  // Balance bruto (sin pagos resueltos): aleShared - fairShare = lo que Alejo aportó de más
  let aleBalance = aleShared - fairShare;
  let anaBalance = anaShared - fairShare;

  // Aplicar settlements: cuando Alejo le paga a Ana, el balance de Alejo SUBE
  // (Alejo ya cubrió esa deuda, por lo que es como si hubiera aportado más).
  // El balance de Ana BAJA (recibió ese pago).
  let totalSettled = 0;
  for (const s of (settlements || [])) {
    const amt = Number(s.amountUSD) || 0;
    if (amt <= 0) continue;
    totalSettled += amt;
    if (s.from === 'ale' && s.to === 'ana') {
      aleBalance += amt;
      anaBalance -= amt;
    } else if (s.from === 'ana' && s.to === 'ale') {
      anaBalance += amt;
      aleBalance -= amt;
    }
  }

  const aleRealTotal = alePersonal + fairShare;
  const anaRealTotal = anaPersonal + fairShare;

  // Settlement pendiente: quién aún debe a quién después de los pagos resueltos
  let settlement = null;
  if (Math.abs(aleBalance) >= 0.01) {
    if (aleBalance > 0) {
      settlement = { from: 'ana', to: 'ale', amount: aleBalance };
    } else {
      settlement = { from: 'ale', to: 'ana', amount: -aleBalance };
    }
  }

  return {
    totalSpent,
    totalShared,
    totalPersonal,
    aleShared,
    anaShared,
    alePersonal,
    anaPersonal,
    fairShare,
    aleBalance,
    anaBalance,
    aleRealTotal,
    anaRealTotal,
    settlement,
    totalSettled,
    settlementsCount: (settlements || []).length
  };
}

export function groupByCategory(expenses, exchangeRate) {
  const groups = {};
  for (const e of expenses) {
    const cat = e.category || '🏷️ Otros';
    if (!groups[cat]) groups[cat] = { count: 0, totalUSD: 0 };
    groups[cat].count += 1;
    groups[cat].totalUSD += toUSD(e.amount, e.currency, exchangeRate);
  }
  return groups;
}

export function groupByCity(expenses, exchangeRate) {
  const groups = {};
  for (const e of expenses) {
    const city = e.city || '—';
    if (!groups[city]) groups[city] = { count: 0, totalUSD: 0 };
    groups[city].count += 1;
    groups[city].totalUSD += toUSD(e.amount, e.currency, exchangeRate);
  }
  return groups;
}
