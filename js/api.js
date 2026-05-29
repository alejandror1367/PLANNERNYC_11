// ============================================================
// API · Capa de red
// ============================================================
// - Wrapper sobre fetch() con timeout
// - Normaliza respuestas y errores
// - Errores tipados: VALIDATION, NOT_FOUND, LOCKED, INTERNAL, NETWORK
// - GET vía query string · POST vía text/plain (truco de Apps Script)
// ============================================================

import { API_URL, UI } from './config.js';

/**
 * Error tipado de la API.
 * Tiene .code para que el frontend reaccione específicamente.
 */
export class ApiError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    Object.assign(this, extra);
  }
}

/**
 * Verifica que API_URL esté configurada antes de cada request.
 */
function ensureConfigured() {
  if (!API_URL || !API_URL.trim()) {
    throw new ApiError('NOT_CONFIGURED', 'API_URL vacía en js/config.js');
  }
}

/**
 * Fetch con timeout. Si la red no responde en UI.fetchTimeoutMs ms, aborta.
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = UI.fetchTimeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new ApiError('NETWORK', `Timeout (${timeoutMs}ms)`);
    }
    throw new ApiError('NETWORK', err.message || 'Error de red');
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Parsea la respuesta y normaliza errores del backend.
 */
async function parseResponse(response) {
  if (!response.ok) {
    throw new ApiError('NETWORK', `HTTP ${response.status}`);
  }

  let json;
  try {
    json = await response.json();
  } catch (e) {
    throw new ApiError('INTERNAL', 'Respuesta no es JSON válido');
  }

  if (json && json.success === true) {
    return json.data;
  }

  if (json && json.success === false && json.error) {
    throw new ApiError(
      json.error.code || 'INTERNAL',
      json.error.message || 'Error desconocido',
      { field: json.error.field }
    );
  }

  throw new ApiError('INTERNAL', 'Formato de respuesta inesperado');
}

/**
 * GET: lectura. Acciones tipo "getAll", "getExpenses", etc.
 *
 * @param {string} action - nombre de la acción
 * @param {Object} [params] - parámetros adicionales
 * @returns {Promise<*>} data ya extraída del envelope
 */
export async function get(action, params = {}) {
  ensureConfigured();

  const url = new URL(API_URL);
  url.searchParams.set('action', action);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });

  const response = await fetchWithTimeout(url.toString(), { method: 'GET' });
  return await parseResponse(response);
}

/**
 * POST: escritura. Acciones tipo "addExpense", "updateNotes", etc.
 *
 * Nota: Apps Script rechaza POST con Content-Type: application/json
 * por el preflight CORS. El truco oficial es enviar JSON como text/plain.
 *
 * @param {string} action
 * @param {Object} [data]
 * @returns {Promise<*>} data extraída del envelope
 */
export async function post(action, data = {}) {
  ensureConfigured();

  const response = await fetchWithTimeout(API_URL, {
    method: 'POST',
    mode: 'cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, data })
  });

  return await parseResponse(response);
}

/**
 * Atajos por acción (más legibles desde el store).
 */
export const api = {
  // Lectura
  health:       () => get('health'),
  getAll:       () => get('getAll'),
  getExpenses:  () => get('getExpenses'),
  getItinerary: () => get('getItinerary'),
  getNotes:     () => get('getNotes'),
  getWishlist:  () => get('getWishlist'),
  getConfig:    () => get('getConfig'),

  // Escritura
  addExpense:    (data) => post('addExpense', data),
  updateExpense: (data) => post('updateExpense', data),
  deleteExpense: (id)   => post('deleteExpense', { id }),
  addActivity:    (data) => post('addActivity', data),
  updateActivity: (data) => post('updateActivity', data),
  deleteActivity: (id)   => post('deleteActivity', { id }),
  updateDay:      (data) => post('updateDay', data),
  addSettlement:    (data) => post('addSettlement', data),
  deleteSettlement: (id)   => post('deleteSettlement', { id }),
  updateNotes:   (notes)    => post('updateNotes',    { notes }),
  updateWishlist:(wishlist) => post('updateWishlist', { wishlist }),
  updateRate:    (rate)     => post('updateRate',     { rate }),
  resetAll:      ()         => post('resetAll',       { confirm: true }),
};

/**
 * Devuelve true si el error es de red/conectividad (reintentar tiene sentido).
 * Estos errores SÍ deben encolar.
 */
export function isNetworkError(err) {
  if (!err) return false;
  if (err.code === 'NETWORK') return true;
  if (err.name === 'TypeError') return true; // fetch falla con TypeError offline
  if (err.message && /network|failed to fetch|load failed/i.test(err.message)) return true;
  return false;
}

/**
 * Devuelve true si el error es de validación (reintentar NO tiene sentido).
 * Estos errores se rechazan inmediatamente sin encolar.
 */
export function isValidationError(err) {
  if (!err) return false;
  return err.code === 'VALIDATION' || err.code === 'NOT_FOUND';
}

/**
 * Llamada genérica al backend por nombre de acción.
 * Usado por la cola para drenar items.
 */
export async function callAction(action, data) {
  return await post(action, data);
}

export default api;
