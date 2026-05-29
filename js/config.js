// ============================================================
// CONFIG · Constantes globales del proyecto
// Única fuente de verdad para nombres, defaults y storage keys
// ============================================================

/**
 * ⚠️ IMPORTANTE: pega aquí la URL del Apps Script (la que termina en /exec)
 * después de publicar el backend.
 *
 * Para obtenerla:
 *   1. Abre el proyecto en script.google.com
 *   2. Click en "Implementar" → "Nueva implementación"
 *   3. Tipo: "Aplicación web"
 *   4. Quién tiene acceso: "Cualquier usuario"
 *   5. Click "Implementar" → copia la URL
 *
 * Si está vacía, el frontend muestra un error claro en pantalla.
 */
export const API_URL = 'https://script.google.com/macros/s/AKfycbzjokI-lVZ3ZBIUu5Rbezb29sudaAfIpUK1X9ut9jYeUHN1bc-1tJ5bd4RAcvBTwG2WGg/exec';

/**
 * Perfiles de viajeros.
 * Si en el futuro cambian nombres, solo se edita aquí.
 * Las claves (ale, ana) NO cambian porque son IDs internos
 * que viven en el Sheet. Solo cambia el `name` visible.
 */
export const TRAVELERS = {
  ale: {
    id: 'ale',
    name: 'Alejo',
    nameShort: 'Alejo',
    avatar: '👨',                       // hombre
    color: 'var(--color-accent)',       // naranja
  },
  ana: {
    id: 'ana',
    name: 'Ana',
    nameShort: 'Ana',
    avatar: '👧',                       // niña
    color: 'var(--color-blue)',         // azul
  },
};

/**
 * Lista ordenada para iterar (Alejo primero, Ana segundo).
 */
export const TRAVELER_LIST = [TRAVELERS.ale, TRAVELERS.ana];

/**
 * Info del viaje.
 */
export const TRIP = {
  title: 'NYC + BOS',
  subtitle: 'Alejo × Ana · Two best friends · LGBT-friendly',
  startDate: '2026-10-03T18:17:00-05:00',
  endDate:   '2026-10-15T12:51:00-05:00',
  cities: ['NYC', 'BOS'],
  defaultExchangeRate: 3667,
};

/**
 * Claves de localStorage con namespace.
 */
export const STORAGE_KEYS = {
  cache:         'tp2.cache',
  queue:         'tp_pendingMutations_v1',  // Fase 6.1 — cola de mutaciones offline
  preferences:   'tp2.preferences',
  schemaVersion: 'tp2.schemaVersion',
  sheetUrl:      'tp2.sheetUrl',
};

/**
 * Versión del esquema del cliente.
 */
export const SCHEMA_VERSION = '2.0.0';

/**
 * Configuración de UI.
 */
export const UI = {
  toastDuration:     2000,
  debounceShort:     300,
  debounceLong:      1500,
  autoRefreshMs:     60000,
  fetchTimeoutMs:    10000,
};

/**
 * Configuración de la cola offline (Fase 6.1).
 * - maxAttempts: tras este número de fallos, item pasa a 'failed'
 * - backoff: array de ms entre intentos
 *   intento 1 → 1s, intento 2 → 3s, intento 3 → 8s, intento 4 → 20s, intento 5 → 60s
 */
export const QUEUE = {
  maxAttempts: 5,
  backoffMs: [1000, 3000, 8000, 20000, 60000],
  // Cuáles acciones se encolan vs cuáles fallan directo
  enqueueableActions: new Set([
    'addExpense', 'updateExpense', 'deleteExpense',
    'addActivity', 'updateActivity', 'deleteActivity',
    'updateDay',
    'addSettlement', 'deleteSettlement',
    'updateRate',
  ]),
  // Acciones que NO se encolan (textos completos, destructivas, etc.)
  // updateNotes, updateWishlist, resetAll: si no hay red, fallan y se reintenta manual
};

/**
 * Tabs disponibles.
 */
export const TABS = [
  { id: 'overview',  icon: '📌', label: 'Resumen' },
  { id: 'itinerary', icon: '📅', label: 'Itinerario' },
  { id: 'budget',    icon: '💸', label: 'Presupuesto' },
  { id: 'transport', icon: '🚇', label: 'Transporte' },
  { id: 'apps',      icon: '📱', label: 'Apps' },
  { id: 'notes',     icon: '📝', label: 'Notas' },
];

export const DEFAULT_TAB = 'overview';

export const CURRENCIES = ['USD', 'COP'];

export const EXPENSE_CATEGORIES = [
  '🍽️ Comida',
  '🏨 Hospedaje',
  '🚇 Transporte',
  '🎭 Actividades',
  '🛍️ Compras',
  '🍹 Bares/Noche',
  '☕ Café',
  '🏷️ Otros',
];

export const EXPENSE_CITIES = ['NYC', 'BOS', '—'];

export const APP_VERSION = 'v2.0';
