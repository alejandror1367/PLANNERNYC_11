// ============================================================
// STORE · Estado central + pub/sub
// ============================================================
// Único lugar donde vive el estado de la app.
// Las vistas se suscriben y reaccionan a cambios.
//
// Patrón:
//   1. View se suscribe: store.subscribe((state) => render(state))
//   2. View dispara acción: store.addExpense(data)
//   3. Store hace optimistic update + llama API + notifica
//   4. Suscriptores reciben nuevo estado y se re-renderizan
// ============================================================

import { api, ApiError } from './api.js';
import { cache } from './storage.js';
import { TRIP } from './config.js';
import { computeTotals } from './budget.js';

/**
 * Estado inicial.
 */
const initialState = {
  // Datos del backend
  expenses:     [],
  itinerary:    [],
  notes:        '',
  wishlist:     '',
  exchangeRate: TRIP.defaultExchangeRate,

  // Estado de sync
  status:       'idle',        // 'idle' | 'loading' | 'ready' | 'error'
  lastSync:     null,
  errorMessage: null,

  // Estado de UI
  isFirstLoad:  true,

  // Derivados (computed)
  totals:       null,
};

let state = { ...initialState };
const subscribers = new Set();

/**
 * Devuelve una copia del estado actual.
 */
export function getState() {
  return { ...state };
}

/**
 * Actualiza el estado y notifica a todos los suscriptores.
 * @param {Object|Function} update - objeto a mergear o función (state) => partial
 */
function setState(update) {
  const partial = typeof update === 'function' ? update(state) : update;
  state = { ...state, ...partial };

  // Recalcular derivados
  state.totals = computeTotals(state.expenses, state.exchangeRate);

  // Notificar
  for (const fn of subscribers) {
    try { fn(state); } catch (e) { console.error('store subscriber error:', e); }
  }
}

/**
 * Se suscribe a cambios del estado.
 * @param {Function} fn - recibe (state) cada vez que cambia
 * @returns {Function} unsubscribe
 */
export function subscribe(fn) {
  subscribers.add(fn);
  // Notificar inmediatamente con el estado actual
  try { fn(state); } catch (e) { console.error('store subscribe immediate:', e); }
  return () => subscribers.delete(fn);
}

// ============================================================
// CACHE LOCAL: arranque rápido offline
// ============================================================

/**
 * Hidrata el estado con el último cache local.
 * Útil para mostrar algo en pantalla apenas abre la app,
 * antes de que llegue la respuesta del backend.
 */
export function hydrateFromCache() {
  const cached = cache.get();
  if (!cached) return false;

  setState({
    expenses:     cached.expenses     || [],
    itinerary:    cached.itinerary    || [],
    notes:        cached.notes        || '',
    wishlist:     cached.wishlist     || '',
    exchangeRate: cached.exchangeRate || TRIP.defaultExchangeRate,
    lastSync:     cached._cachedAt    || null,
  });
  return true;
}

/**
 * Guarda el estado actual en cache local.
 */
function persistCache() {
  cache.set({
    expenses:     state.expenses,
    itinerary:    state.itinerary,
    notes:        state.notes,
    wishlist:     state.wishlist,
    exchangeRate: state.exchangeRate,
  });
}

// ============================================================
// ACCIONES (las que dispara la UI)
// ============================================================

/**
 * Carga todo el estado desde el backend.
 * Se llama al arranque y en cada refresh.
 */
export async function loadAll() {
  setState({ status: 'loading', errorMessage: null });

  try {
    const data = await api.getAll();

    setState({
      expenses:     data.expenses     || [],
      itinerary:    data.itinerary    || [],
      notes:        data.notes        || '',
      wishlist:     data.wishlist     || '',
      exchangeRate: (data.config && Number(data.config.exchangeRate)) || TRIP.defaultExchangeRate,
      status:       'ready',
      lastSync:     new Date().toISOString(),
      isFirstLoad:  false,
      errorMessage: null,
    });

    persistCache();
    return data;

  } catch (err) {
    console.error('store.loadAll error:', err);
    setState({
      status:       'error',
      errorMessage: err instanceof ApiError ? err.message : String(err),
      isFirstLoad:  false,
    });
    throw err;
  }
}

/**
 * Refresh manual: alias de loadAll.
 */
export async function refresh() {
  return loadAll();
}

/**
 * Actualiza notas. Optimistic.
 */
export async function updateNotes(notes) {
  const prev = state.notes;
  setState({ notes }); // optimistic
  try {
    await api.updateNotes(notes);
    persistCache();
  } catch (err) {
    setState({ notes: prev }); // revertir
    throw err;
  }
}

/**
 * Actualiza wishlist. Optimistic.
 */
export async function updateWishlist(wishlist) {
  const prev = state.wishlist;
  setState({ wishlist });
  try {
    await api.updateWishlist(wishlist);
    persistCache();
  } catch (err) {
    setState({ wishlist: prev });
    throw err;
  }
}

/**
 * Actualiza tasa de cambio. Optimistic.
 */
export async function updateRate(rate) {
  const prev = state.exchangeRate;
  setState({ exchangeRate: Number(rate) });
  try {
    await api.updateRate(rate);
    persistCache();
  } catch (err) {
    setState({ exchangeRate: prev });
    throw err;
  }
}

/**
 * Agrega gasto. Optimistic con tempId.
 */
export async function addExpense(data) {
  const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  const optimistic = {
    id: tempId,
    timestamp: new Date().toISOString(),
    desc:     data.desc,
    amount:   Number(data.amount),
    currency: data.currency,
    payer:    data.payer,
    type:     data.type,
    category: data.category,
    city:     data.city,
    _pending: true,
  };

  setState((s) => ({ expenses: [...s.expenses, optimistic] }));

  try {
    const result = await api.addExpense(data);
    const created = result.expense;

    // Reemplazar el optimista por el real
    setState((s) => ({
      expenses: s.expenses.map((e) => e.id === tempId ? { ...created, _pending: false } : e)
    }));
    persistCache();
    return created;

  } catch (err) {
    // Revertir
    setState((s) => ({ expenses: s.expenses.filter((e) => e.id !== tempId) }));
    throw err;
  }
}

/**
 * Elimina gasto. Optimistic.
 */
export async function deleteExpense(id) {
  const prev = state.expenses;
  setState((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) }));

  try {
    await api.deleteExpense(id);
    persistCache();
  } catch (err) {
    setState({ expenses: prev });
    throw err;
  }
}

/**
 * Reset de todos los datos.
 */
export async function resetAll() {
  await api.resetAll();
  await loadAll();
}
