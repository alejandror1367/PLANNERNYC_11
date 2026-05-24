// ============================================================
// CONFIG · Constantes globales del proyecto
// Única fuente de verdad para nombres, defaults y storage keys
// ============================================================

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
    color: 'var(--color-accent)',     // naranja
  },
  ana: {
    id: 'ana',
    name: 'Ana',
    nameShort: 'Ana',
    color: 'var(--color-blue)',       // azul
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
  defaultExchangeRate: 3667,            // COP por USD, editable luego
};

/**
 * Claves de localStorage con namespace.
 * Centralizar evita typos y permite migrar fácilmente.
 */
export const STORAGE_KEYS = {
  apiUrl:        'tp2.apiUrl',
  sheetUrl:      'tp2.sheetUrl',
  cache:         'tp2.cache',
  queue:         'tp2.queue',
  preferences:   'tp2.preferences',
  schemaVersion: 'tp2.schemaVersion',
};

/**
 * Versión del esquema del cliente.
 * Si cambia, se invalida el cache local.
 */
export const SCHEMA_VERSION = '2.0.0';

/**
 * Configuración de UI.
 */
export const UI = {
  toastDuration:     2000,    // ms
  debounceShort:     300,     // input rápido
  debounceLong:      1500,    // autosave de notas
  autoRefreshMs:     60000,   // 60 segundos
  fetchTimeoutMs:    10000,   // 10 segundos
};

/**
 * Tabs disponibles. El orden define el orden visual.
 * Cada tab tiene un id (usado en hash de URL), icono, label.
 */
export const TABS = [
  { id: 'overview',  icon: '📌', label: 'Resumen' },
  { id: 'itinerary', icon: '📅', label: 'Itinerario' },
  { id: 'budget',    icon: '💸', label: 'Presupuesto' },
  { id: 'transport', icon: '🚇', label: 'Transporte' },
  { id: 'apps',      icon: '📱', label: 'Apps' },
  { id: 'notes',     icon: '📝', label: 'Notas' },
];

/**
 * Tab por defecto al abrir la app si no hay hash.
 */
export const DEFAULT_TAB = 'overview';

/**
 * Monedas soportadas.
 */
export const CURRENCIES = ['USD', 'COP'];

/**
 * Categorías de gastos (emoji + texto).
 */
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

/**
 * Ciudades disponibles para clasificar gastos.
 */
export const EXPENSE_CITIES = ['NYC', 'BOS', '—'];

/**
 * Versión de la app (mostrada en el subtítulo).
 */
export const APP_VERSION = 'v2.0';
