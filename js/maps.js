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

/**
 * Genera un mini-mapa esquemático SVG con pines numerados para las
 * actividades mapeables de un día (Fase 9.1B).
 *
 * No es un mapa geográfico real (eso lo abre Google Maps con el
 * botón de ruta). Es una representación visual del orden de paradas.
 *
 * @param {Array} activities - actividades del día
 * @param {string} city
 * @returns {string} HTML del mini-mapa, o '' si no hay paradas mapeables
 */
export function renderDayMapSvg(activities, city) {
  const mappable = (activities || []).filter(isMappable);
  if (mappable.length === 0) return '';

  const isBoston = String(city || '').toUpperCase().includes('BOS');
  const pinColor = isBoston ? '#2d6a8f' : '#ff4d2e';

  const W = 460;
  const H = 200;
  const pad = 40;
  const n = mappable.length;

  // Distribuir los pines en una diagonal suave con algo de variación
  // determinística (basada en el índice) para que se vea orgánico
  const points = mappable.map((act, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const x = pad + t * (W - 2 * pad);
    // zig-zag suave alrededor del centro vertical
    const wobble = Math.sin(i * 1.3) * 30;
    const y = H / 2 + wobble;
    return { x, y, act };
  });

  // Línea de ruta (path entre pines)
  let routePath = '';
  if (points.length > 1) {
    const d = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
    routePath = `<path d="${d}" stroke="${pinColor}" stroke-width="2.5" stroke-dasharray="5 4" fill="none" opacity="0.7"/>`;
  }

  // Pines
  const pins = points.map((p, i) => {
    const isLast = i === points.length - 1;
    const fill = isLast ? '#1a1815' : pinColor;
    const textFill = isLast ? '#ffd84d' : '#ffffff';
    return `
      <g>
        <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="13" fill="${fill}"/>
        <text x="${p.x.toFixed(1)}" y="${(p.y + 4).toFixed(1)}" text-anchor="middle"
              font-family="'Bebas Neue', 'Arial Narrow', sans-serif" font-size="14"
              font-weight="700" fill="${textFill}">${i + 1}</text>
      </g>`;
  }).join('');

  return `
    <svg viewBox="0 0 ${W} ${H}" width="100%" xmlns="http://www.w3.org/2000/svg"
         class="day-map__svg" role="img" aria-label="Mapa esquemático con ${n} paradas">
      <rect width="${W}" height="${H}" rx="8" fill="var(--surface-paper, #ece3d3)"/>
      <line x1="0" y1="${H*0.35}" x2="${W}" y2="${H*0.28}" stroke="rgba(0,0,0,0.05)" stroke-width="8"/>
      <line x1="0" y1="${H*0.7}" x2="${W}" y2="${H*0.78}" stroke="rgba(0,0,0,0.05)" stroke-width="10"/>
      <line x1="${W*0.3}" y1="0" x2="${W*0.25}" y2="${H}" stroke="rgba(0,0,0,0.05)" stroke-width="7"/>
      <line x1="${W*0.7}" y1="0" x2="${W*0.75}" y2="${H}" stroke="rgba(0,0,0,0.05)" stroke-width="8"/>
      ${routePath}
      ${pins}
    </svg>
  `;
}

/**
 * Lista de nombres de las paradas mapeables (para la leyenda).
 */
export function mappableNames(activities) {
  return (activities || []).filter(isMappable).map((a) => a.name);
}
