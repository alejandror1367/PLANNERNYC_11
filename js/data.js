// ============================================================
// DATA · Loader de archivos JSON estáticos
// ============================================================
// Carga archivos de /data/*.json con cache en memoria.
// Útil para contenido que no vive en el Sheet: hacks,
// transporte, apps, emergencias.
//
// Uso:
//   import { loadJSON } from './data.js';
//   const data = await loadJSON('transport.json');
// ============================================================

const cache = new Map();

/**
 * Carga un JSON desde /data/. Si ya se cargó antes, devuelve
 * la versión cacheada en memoria.
 *
 * @param {string} filename - nombre del archivo, ej "transport.json"
 * @returns {Promise<*>}
 */
export async function loadJSON(filename) {
  if (cache.has(filename)) return cache.get(filename);

  const url = `./data/${filename}`;
  try {
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} cargando ${filename}`);
    }
    const data = await response.json();
    cache.set(filename, data);
    return data;
  } catch (err) {
    console.error('loadJSON error:', filename, err);
    throw err;
  }
}

/**
 * Invalida el cache (útil para tests o forzar reload).
 */
export function clearCache() {
  cache.clear();
}
