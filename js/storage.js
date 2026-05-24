// ============================================================
// STORAGE · Wrapper de localStorage con namespace
// Maneja JSON, errores y fallback a memoria si está bloqueado.
// ============================================================

import { STORAGE_KEYS } from './config.js';

const memoryFallback = new Map();
let useMemory = false;

try {
  const testKey = '__tp2_test__';
  localStorage.setItem(testKey, '1');
  localStorage.removeItem(testKey);
} catch (e) {
  console.warn('localStorage no disponible, usando memoria como fallback');
  useMemory = true;
}

/**
 * Lee un valor. Si es JSON, lo parsea.
 */
export function get(key, defaultValue = null) {
  try {
    const raw = useMemory ? memoryFallback.get(key) : localStorage.getItem(key);
    if (raw === null || raw === undefined) return defaultValue;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  } catch (e) {
    console.error('storage.get error:', key, e);
    return defaultValue;
  }
}

/**
 * Guarda un valor. Si no es string, lo serializa a JSON.
 */
export function set(key, value) {
  try {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    if (useMemory) {
      memoryFallback.set(key, serialized);
    } else {
      localStorage.setItem(key, serialized);
    }
    return true;
  } catch (e) {
    console.error('storage.set error:', key, e);
    return false;
  }
}

/**
 * Elimina una clave.
 */
export function remove(key) {
  try {
    if (useMemory) {
      memoryFallback.delete(key);
    } else {
      localStorage.removeItem(key);
    }
    return true;
  } catch (e) {
    console.error('storage.remove error:', key, e);
    return false;
  }
}

/**
 * Limpia todas las claves del proyecto.
 */
export function clearAll() {
  try {
    if (useMemory) {
      memoryFallback.clear();
      return true;
    }
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('tp2.')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    return true;
  } catch (e) {
    console.error('storage.clearAll error:', e);
    return false;
  }
}

// ============================================================
// ATAJOS ESPECÍFICOS
// ============================================================

/**
 * URL del Google Sheet (para el botón "Abrir Sheet"). Opcional.
 */
export const sheetUrl = {
  get:   () => get(STORAGE_KEYS.sheetUrl, ''),
  set:   (url) => set(STORAGE_KEYS.sheetUrl, url),
  clear: () => remove(STORAGE_KEYS.sheetUrl),
};

/**
 * Cache local del último estado conocido (arranque offline).
 */
export const cache = {
  get:   () => get(STORAGE_KEYS.cache, null),
  set:   (data) => set(STORAGE_KEYS.cache, { ...data, _cachedAt: new Date().toISOString() }),
  clear: () => remove(STORAGE_KEYS.cache),
};

/**
 * Cola offline.
 */
export const queue = {
  get:   () => get(STORAGE_KEYS.queue, []),
  set:   (ops) => set(STORAGE_KEYS.queue, ops),
  clear: () => remove(STORAGE_KEYS.queue),
  push:  (op) => {
    const current = queue.get();
    current.push({ ...op, _queuedAt: new Date().toISOString() });
    queue.set(current);
  },
};
