// ============================================================
// MAPS · Helpers para Google Maps (Fase 9.1)
// ============================================================
// Construye URLs de Google Maps para "cómo llegar". No usa
// coordenadas ni la ubicación del usuario: solo el nombre público
// del destino. Google resuelve el texto a un lugar real.
//
// Privacidad: nunca se pasan datos personales en la URL. La
// ubicación del usuario la maneja Google Maps localmente en el
// dispositivo cuando calcula la ruta.
// ============================================================

// Palabras que indican que el "nombre" de la actividad NO es un
// lugar geográfico (no tiene sentido buscarlo en el mapa).
const NON_PLACE_HINTS = [
  'desayuno', 'almuerzo', 'cena', 'comida', 'brunch', 'snack',
  'check-in', 'check in', 'checkout', 'check-out', 'descanso',
  'dormir', 'despertar', 'empacar', 'libre', 'free time',
  'tiempo libre', 'relax', 'siesta', 'preparar',
];

/**
 * Decide si una actividad tiene sentido en el mapa.
 * Si tiene location explícita, siempre sí. Si no, evalúa el nombre.
 *
 * @param {Object} activity - { name, location, tags }
 * @returns {boolean}
 */
export function isMappable(activity) {
  if (!activity) return false;
  // Si trae ubicación explícita, siempre es mapeable
  if (activity.location && String(activity.location).trim()) return true;

  const name = String(activity.name || '').toLowerCase().trim();
  if (!name) return false;

  // Si el nombre es SOLO una palabra genérica de comida/logística, no mapear
  for (const hint of NON_PLACE_HINTS) {
    if (name === hint) return false;
  }
  // Nombres muy cortos (1-2 chars) tampoco
  if (name.length < 3) return false;

  return true;
}

/**
 * Construye el query de búsqueda para Google Maps.
 * Prioridad: location explícita > nombre + ciudad.
 *
 * @param {Object} activity - { name, location }
 * @param {string} city - ciudad del día (NYC / Boston)
 * @returns {string} texto a buscar
 */
export function buildQuery(activity, city) {
  // Ubicación explícita gana
  if (activity.location && String(activity.location).trim()) {
    return String(activity.location).trim();
  }

  const name = String(activity.name || '').trim();

  // Expandir abreviaturas de ciudad para que Google acierte mejor
  let cityFull = '';
  const c = String(city || '').toUpperCase();
  if (c.includes('NYC') || c.includes('NUEVA YORK') || c.includes('NEW YORK')) {
    cityFull = 'New York';
  } else if (c.includes('BOS') || c.includes('BOSTON')) {
    cityFull = 'Boston';
  } else if (city) {
    cityFull = String(city).trim();
  }

  return cityFull ? `${name}, ${cityFull}` : name;
}

/**
 * URL de Google Maps en modo "direcciones" (deja elegir transporte
 * al abrir, no fuerza un travelmode).
 *
 * @param {Object} activity
 * @param {string} city
 * @returns {string} URL completa
 */
export function directionsUrl(activity, city) {
  const query = buildQuery(activity, city);
  return 'https://www.google.com/maps/dir/?api=1&destination=' +
         encodeURIComponent(query);
}

/**
 * URL de Google Maps en modo "buscar/ver lugar" (solo mostrar).
 *
 * @param {Object} activity
 * @param {string} city
 * @returns {string} URL completa
 */
export function searchUrl(activity, city) {
  const query = buildQuery(activity, city);
  return 'https://www.google.com/maps/search/?api=1&query=' +
         encodeURIComponent(query);
}

/**
 * URL para ver varios lugares como ruta (para el mini-mapa del día).
 * Usa el modo directions con waypoints.
 *
 * @param {Array<{name,location}>} activities - en orden
 * @param {string} city
 * @returns {string} URL completa
 */
export function dayRouteUrl(activities, city) {
  const mappable = (activities || []).filter(isMappable);
  if (mappable.length === 0) return '';

  if (mappable.length === 1) {
    return directionsUrl(mappable[0], city);
  }

  const queries = mappable.map((a) => encodeURIComponent(buildQuery(a, city)));
  const destination = queries[queries.length - 1];
  const origin = queries[0];
  const waypoints = queries.slice(1, -1).join('%7C'); // %7C = |

  let url = 'https://www.google.com/maps/dir/?api=1' +
            '&origin=' + origin +
            '&destination=' + destination;
  if (waypoints) url += '&waypoints=' + waypoints;
  return url;
}

export default { isMappable, buildQuery, directionsUrl, searchUrl, dayRouteUrl };
