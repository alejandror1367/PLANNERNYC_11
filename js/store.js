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

import { api, ApiError, isNetworkError } from './api.js';
import { cache } from './storage.js';
import { TRIP } from './config.js';
import { computeTotals } from './budget.js';
import * as queue from './queue.js';

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
  settlements:  [],

  // Estado de sync
  status:       'idle',
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
 * Genera un clientId único para idempotencia.
 * Formato: cli_<timestamp>_<random>
 */
function generateClientId() {
  return 'cli_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

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
  state.totals = computeTotals(state.expenses, state.exchangeRate, state.settlements);

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
    settlements:  cached.settlements  || [],
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
    settlements:  state.settlements,
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
      settlements:  data.settlements  || [],
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
 * Si la red falla, encola en lugar de revertir (Fase 6.1).
 * Idempotente vía clientId (Fase 6.4).
 */
export async function addExpense(data) {
  const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  const clientId = generateClientId();
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
    _clientId: clientId,
  };

  setState((s) => ({ expenses: [...s.expenses, optimistic] }));

  try {
    const result = await api.addExpense({ ...data, clientId });
    const created = result.expense;

    setState((s) => ({
      expenses: s.expenses.map((e) => e.id === tempId ? { ...created, _pending: false } : e)
    }));
    persistCache();
    return created;

  } catch (err) {
    if (isNetworkError(err)) {
      // Encolar y mantener el item optimista visible
      queue.enqueue('addExpense', { ...data, clientId });
      setState((s) => ({
        expenses: s.expenses.map((e) =>
          e.id === tempId ? { ...e, _pending: false, _queued: true } : e
        )
      }));
      persistCache();
      return optimistic;
    }
    // Error de validación o backend: revertir como antes
    setState((s) => ({ expenses: s.expenses.filter((e) => e.id !== tempId) }));
    throw err;
  }
}

/**
 * Elimina gasto. Optimistic. Encolable.
 *
 * Caso especial: si el gasto está aún en cola como add (no se ha sincronizado),
 * en lugar de encolar un delete, simplemente lo quitamos de la cola y del state.
 */
export async function deleteExpense(id) {
  // Caso 1: el gasto es uno que NO se sincronizó todavía (está en cola o es temp).
  // Buscar en la cola un add con el mismo clientId.
  const target = state.expenses.find((e) => e.id === id);
  if (target && target._clientId && (id.startsWith('temp_') || target._queued)) {
    // Quitar el add encolado correspondiente
    const queuedAdd = queue.getItems().find((qi) =>
      qi.action === 'addExpense' && qi.data && qi.data.clientId === target._clientId
    );
    if (queuedAdd) queue.removeItem(queuedAdd.id);

    setState((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) }));
    persistCache();
    return;
  }

  // Caso 2: gasto ya sincronizado en el backend
  const prev = state.expenses;
  setState((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) }));

  try {
    await api.deleteExpense(id);
    persistCache();
  } catch (err) {
    if (isNetworkError(err)) {
      queue.enqueue('deleteExpense', { id });
      persistCache();
      return;
    }
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

// ============================================================
// ACTIVIDADES DEL ITINERARIO (CRUD)
// ============================================================

/**
 * Helper interno: actualiza el itinerario en el state aplicando una mutación.
 * @param {Function} mutate - (itinerary) => newItinerary
 */
function mutateItinerary(mutate) {
  setState((s) => ({ itinerary: mutate(s.itinerary) }));
}

/**
 * Encuentra el día por su número.
 */
function findDay(itinerary, dayNum) {
  return itinerary.find((d) => Number(d.day) === Number(dayNum));
}

/**
 * Agrega una actividad nueva. Optimistic. Encolable.
 * Idempotente vía clientId (Fase 6.4).
 * @param {Object} data - { day, time, name, desc, tags }
 */
export async function addActivity(data) {
  const tempId = 'temp_act_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  const clientId = generateClientId();
  const optimistic = {
    id: tempId,
    time: data.time || '',
    name: data.name,
    desc: data.desc || '',
    tags: Array.isArray(data.tags) ? data.tags : [],
    _pending: true,
    _clientId: clientId,
  };

  mutateItinerary((itinerary) =>
    itinerary.map((d) => {
      if (Number(d.day) !== Number(data.day)) return d;
      return { ...d, activities: [...(d.activities || []), optimistic] };
    })
  );

  try {
    const result = await api.addActivity({ ...data, clientId });
    const created = result.activity;

    mutateItinerary((itinerary) =>
      itinerary.map((d) => {
        if (Number(d.day) !== Number(data.day)) return d;
        return {
          ...d,
          activities: d.activities.map((a) =>
            a.id === tempId ? { ...created, _pending: false } : a
          ),
        };
      })
    );
    persistCache();
    return created;
  } catch (err) {
    if (isNetworkError(err)) {
      queue.enqueue('addActivity', { ...data, clientId });
      mutateItinerary((itinerary) =>
        itinerary.map((d) => {
          if (Number(d.day) !== Number(data.day)) return d;
          return {
            ...d,
            activities: d.activities.map((a) =>
              a.id === tempId ? { ...a, _pending: false, _queued: true } : a
            ),
          };
        })
      );
      persistCache();
      return optimistic;
    }
    // Revertir
    mutateItinerary((itinerary) =>
      itinerary.map((d) => {
        if (Number(d.day) !== Number(data.day)) return d;
        return { ...d, activities: d.activities.filter((a) => a.id !== tempId) };
      })
    );
    throw err;
  }
}

/**
 * Actualiza una actividad. Optimistic.
 * @param {Object} data - { id, day, time, name, desc, tags }
 */
export async function updateActivity(data) {
  if (!data || !data.id) throw new Error('ID requerido');

  // Snapshot del estado anterior para revertir
  let previous = null;
  mutateItinerary((itinerary) =>
    itinerary.map((d) => ({
      ...d,
      activities: (d.activities || []).map((a) => {
        if (a.id === data.id) {
          previous = { ...a };
          return {
            ...a,
            time: data.time ?? a.time,
            name: data.name ?? a.name,
            desc: data.desc ?? a.desc,
            tags: data.tags ?? a.tags,
            _pending: true,
          };
        }
        return a;
      }),
    }))
  );

  try {
    const result = await api.updateActivity(data);
    const updated = result.activity;

    mutateItinerary((itinerary) =>
      itinerary.map((d) => ({
        ...d,
        activities: (d.activities || []).map((a) =>
          a.id === data.id ? { ...updated, _pending: false } : a
        ),
      }))
    );
    persistCache();
    return updated;
  } catch (err) {
    if (isNetworkError(err)) {
      // Encolar
      queue.enqueue('updateActivity', data);
      mutateItinerary((itinerary) =>
        itinerary.map((d) => ({
          ...d,
          activities: (d.activities || []).map((a) =>
            a.id === data.id ? { ...a, _pending: false, _queued: true } : a
          ),
        }))
      );
      persistCache();
      return;
    }
    // Revertir
    if (previous) {
      mutateItinerary((itinerary) =>
        itinerary.map((d) => ({
          ...d,
          activities: (d.activities || []).map((a) =>
            a.id === data.id ? previous : a
          ),
        }))
      );
    }
    throw err;
  }
}

/**
 * Elimina una actividad. Optimistic.
 */
export async function deleteActivity(id) {
  if (!id) throw new Error('ID requerido');

  // Snapshot
  let removed = null;
  let removedDay = null;
  let removedIdx = -1;

  // Si la actividad es temporal/encolada (aún no en backend), cancelar el add
  const target = state.itinerary
    .flatMap((d) => d.activities || [])
    .find((a) => a.id === id);
  if (target && target._clientId && (id.startsWith('temp_') || target._queued)) {
    const queuedAdd = queue.getItems().find((qi) =>
      qi.action === 'addActivity' && qi.data && qi.data.clientId === target._clientId
    );
    if (queuedAdd) queue.removeItem(queuedAdd.id);

    mutateItinerary((itinerary) =>
      itinerary.map((d) => ({
        ...d,
        activities: (d.activities || []).filter((a) => a.id !== id),
      }))
    );
    persistCache();
    return;
  }

  mutateItinerary((itinerary) =>
    itinerary.map((d) => {
      const idx = (d.activities || []).findIndex((a) => a.id === id);
      if (idx === -1) return d;
      removed = d.activities[idx];
      removedDay = d.day;
      removedIdx = idx;
      return { ...d, activities: d.activities.filter((a) => a.id !== id) };
    })
  );

  try {
    await api.deleteActivity(id);
    persistCache();
  } catch (err) {
    if (isNetworkError(err)) {
      queue.enqueue('deleteActivity', { id });
      persistCache();
      return;
    }
    // Revertir
    if (removed && removedDay !== null) {
      mutateItinerary((itinerary) =>
        itinerary.map((d) => {
          if (Number(d.day) !== Number(removedDay)) return d;
          const acts = [...d.activities];
          acts.splice(removedIdx, 0, removed);
          return { ...d, activities: acts };
        })
      );
    }
    throw err;
  }
}

// ============================================================
// SETTLEMENTS (pagos resueltos)
// ============================================================

/**
 * Registra un pago resuelto. Optimistic. Encolable.
 * Idempotente vía clientId (Fase 6.4).
 * @param {Object} data - { from, to, amountUSD, exchangeRate, note }
 */
export async function addSettlement(data) {
  const tempId = 'temp_stl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  const clientId = generateClientId();
  const optimistic = {
    id: tempId,
    timestamp: new Date().toISOString(),
    from: data.from,
    to: data.to,
    amountUSD: Number(data.amountUSD),
    exchangeRate: Number(data.exchangeRate) || 0,
    note: data.note || '',
    _pending: true,
    _clientId: clientId,
  };

  setState((s) => ({ settlements: [...s.settlements, optimistic] }));

  try {
    const result = await api.addSettlement({ ...data, clientId });
    const created = result.settlement;
    setState((s) => ({
      settlements: s.settlements.map((x) =>
        x.id === tempId ? { ...created, _pending: false } : x
      ),
    }));
    persistCache();
    return created;
  } catch (err) {
    if (isNetworkError(err)) {
      queue.enqueue('addSettlement', { ...data, clientId });
      setState((s) => ({
        settlements: s.settlements.map((x) =>
          x.id === tempId ? { ...x, _pending: false, _queued: true } : x
        ),
      }));
      persistCache();
      return optimistic;
    }
    setState((s) => ({ settlements: s.settlements.filter((x) => x.id !== tempId) }));
    throw err;
  }
}

/**
 * Elimina (anula) un pago resuelto. Optimistic. Encolable.
 */
export async function deleteSettlement(id) {
  if (!id) throw new Error('ID requerido');

  // Si aún está encolado como add, cancelar el add
  const target = state.settlements.find((s) => s.id === id);
  if (target && target._clientId && (id.startsWith('temp_') || target._queued)) {
    const queuedAdd = queue.getItems().find((qi) =>
      qi.action === 'addSettlement' && qi.data && qi.data.clientId === target._clientId
    );
    if (queuedAdd) queue.removeItem(queuedAdd.id);

    setState((s) => ({ settlements: s.settlements.filter((x) => x.id !== id) }));
    persistCache();
    return;
  }

  const prev = state.settlements;
  setState((s) => ({ settlements: s.settlements.filter((x) => x.id !== id) }));

  try {
    await api.deleteSettlement(id);
    persistCache();
  } catch (err) {
    if (isNetworkError(err)) {
      queue.enqueue('deleteSettlement', { id });
      persistCache();
      return;
    }
    setState({ settlements: prev });
    throw err;
  }
}
