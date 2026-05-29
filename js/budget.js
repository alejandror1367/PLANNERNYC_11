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

/**
 * Agrupa gastos por día calendario (YYYY-MM-DD del timestamp).
 * @returns {Object} { '2026-10-04': { count, totalUSD }, ... }
 */
export function groupByDay(expenses, exchangeRate) {
  const groups = {};
  for (const e of expenses) {
    if (!e.timestamp) continue;
    const day = String(e.timestamp).slice(0, 10); // YYYY-MM-DD
    if (!day || day.length !== 10) continue;
    if (!groups[day]) groups[day] = { count: 0, totalUSD: 0 };
    groups[day].count += 1;
    groups[day].totalUSD += toUSD(e.amount, e.currency, exchangeRate);
  }
  return groups;
}

/**
 * Calcula insights automáticos sobre los gastos (Fase 8.6).
 * Devuelve null si hay menos de 5 gastos (no hay suficiente señal).
 *
 * @param {Array<Expense>} expenses
 * @param {number} exchangeRate
 * @param {Object} tripPhase - resultado de getTripPhase() (para proyección)
 * @returns {null | {
 *   topCategory: {name, totalUSD, pct} | null,
 *   priciestDay: {date, totalUSD} | null,
 *   avgPerActiveDay: number,
 *   projection: {total, basis} | null,
 *   personalRatioWarning: boolean,
 *   totalSpent: number,
 *   expenseCount: number
 * }}
 */
export function computeInsights(expenses, exchangeRate, tripPhase) {
  const list = (expenses || []).filter((e) => e && !e._failed);
  if (list.length < 5) return null;

  let totalSpent = 0;
  let totalPersonal = 0;
  for (const e of list) {
    const usd = toUSD(e.amount, e.currency, exchangeRate);
    totalSpent += usd;
    if (e.type !== 'shared') totalPersonal += usd;
  }

  // 1. Categoría top
  const cats = groupByCategory(list, exchangeRate);
  let topCategory = null;
  for (const [name, data] of Object.entries(cats)) {
    if (!topCategory || data.totalUSD > topCategory.totalUSD) {
      topCategory = { name, totalUSD: data.totalUSD };
    }
  }
  if (topCategory && totalSpent > 0) {
    topCategory.pct = Math.round((topCategory.totalUSD / totalSpent) * 100);
  }

  // 2. Día más caro
  const days = groupByDay(list, exchangeRate);
  let priciestDay = null;
  for (const [date, data] of Object.entries(days)) {
    if (!priciestDay || data.totalUSD > priciestDay.totalUSD) {
      priciestDay = { date, totalUSD: data.totalUSD };
    }
  }

  // 3. Promedio por día activo (días en los que hubo al menos un gasto)
  const activeDayCount = Object.keys(days).length;
  const avgPerActiveDay = activeDayCount > 0 ? totalSpent / activeDayCount : 0;

  // 4. Proyección: solo tiene sentido durante el viaje
  let projection = null;
  if (tripPhase && tripPhase.phase === 'during' && tripPhase.dayNumber > 0) {
    const perDay = totalSpent / tripPhase.dayNumber;
    const projected = perDay * tripPhase.totalDays;
    projection = { total: projected, basis: tripPhase.dayNumber };
  }

  // 5. Ratio personal muy alto (>80%): posible olvido de marcar shared
  const personalRatioWarning = totalSpent > 0 && (totalPersonal / totalSpent) > 0.8;

  return {
    topCategory,
    priciestDay,
    avgPerActiveDay,
    projection,
    personalRatioWarning,
    totalSpent,
    expenseCount: list.length,
  };
}
