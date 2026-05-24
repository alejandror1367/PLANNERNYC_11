// ============================================================
// BUDGET · Cálculos puros de presupuesto
// ============================================================
// Funciones puras: reciben datos, devuelven resultados.
// Sin DOM, sin estado externo, fácil de testear.
//
// Se usará principalmente en Fase 4 (vista Budget). Lo dejamos
// aquí desde Fase 3 para que el store pueda calcular totales
// derivados al actualizar los gastos.
// ============================================================

import { toUSD } from './format.js';

/**
 * Calcula totales y balances a partir de una lista de gastos.
 *
 * @param {Array<Expense>} expenses
 * @param {number} exchangeRate
 * @returns {Object} totales calculados
 *   {
 *     totalSpent,         // suma de todo, en USD
 *     totalShared,        // suma de gastos compartidos, en USD
 *     totalPersonal,      // suma de gastos personales, en USD
 *     aleShared,          // aporte de Ale a gastos compartidos
 *     anaShared,
 *     alePersonal,        // gasto personal de Ale
 *     anaPersonal,
 *     fairShare,          // mitad de totalShared
 *     aleBalance,         // aleShared - fairShare (positivo = le deben)
 *     anaBalance,
 *     aleRealTotal,       // alePersonal + fairShare (lo que realmente le cuesta el viaje)
 *     anaRealTotal,
 *     settlement          // { from, to, amount } o null si están a mano
 *   }
 */
export function computeTotals(expenses, exchangeRate) {
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
  const aleBalance = aleShared - fairShare;
  const anaBalance = anaShared - fairShare;

  const aleRealTotal = alePersonal + fairShare;
  const anaRealTotal = anaPersonal + fairShare;

  // Settlement: quién debe a quién
  let settlement = null;
  if (totalShared > 0 && Math.abs(aleBalance) >= 0.01) {
    if (aleBalance > 0) {
      // Ale pagó de más → Ana le debe
      settlement = { from: 'ana', to: 'ale', amount: aleBalance };
    } else {
      // Ana pagó de más → Ale le debe
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
    settlement
  };
}

/**
 * Agrupa gastos por categoría.
 * @returns {Object<string, {count, totalUSD}>}
 */
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

/**
 * Agrupa gastos por ciudad.
 */
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
