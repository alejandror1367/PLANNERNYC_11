// ============================================================
// WEATHER · Clima en vivo (Fase 9.3)
// ============================================================
// Usa Open-Meteo (https://open-meteo.com): API gratuita, sin
// clave, sin límite práctico para uso personal.
//
// - Trae el pronóstico diario de NYC y Boston para las fechas
//   del viaje
// - Cachea el resultado en localStorage (12h) para no repetir
//   llamadas innecesarias
// - Si no hay red o la API falla, degrada con elegancia (la app
//   sigue funcionando sin clima)
//
// Privacidad: solo se envían coordenadas públicas de ciudades,
// nunca datos del usuario.
// ============================================================

import { TRIP } from './config.js';

const CACHE_KEY = 'tp2.weather';
const CACHE_TTL = 12 * 60 * 60 * 1000; // 12 horas

// Coordenadas de las ciudades del viaje
const CITY_COORDS = {
  NYC:    { lat: 40.7128, lon: -74.0060, tz: 'America/New_York' },
  BOSTON: { lat: 42.3601, lon: -71.0589, tz: 'America/New_York' },
};

// Mapeo de códigos WMO de Open-Meteo a emoji + etiqueta corta
// https://open-meteo.com/en/docs (WMO Weather interpretation codes)
const WMO = {
  0:  { icon: '☀️', label: 'Despejado' },
  1:  { icon: '🌤️', label: 'Mayormente despejado' },
  2:  { icon: '⛅', label: 'Parcialmente nublado' },
  3:  { icon: '☁️', label: 'Nublado' },
  45: { icon: '🌫️', label: 'Niebla' },
  48: { icon: '🌫️', label: 'Niebla' },
  51: { icon: '🌦️', label: 'Llovizna ligera' },
  53: { icon: '🌦️', label: 'Llovizna' },
  55: { icon: '🌧️', label: 'Llovizna fuerte' },
  61: { icon: '🌦️', label: 'Lluvia ligera' },
  63: { icon: '🌧️', label: 'Lluvia' },
  65: { icon: '🌧️', label: 'Lluvia fuerte' },
  66: { icon: '🌨️', label: 'Lluvia helada' },
  67: { icon: '🌨️', label: 'Lluvia helada' },
  71: { icon: '🌨️', label: 'Nieve ligera' },
  73: { icon: '❄️', label: 'Nieve' },
  75: { icon: '❄️', label: 'Nieve fuerte' },
  77: { icon: '🌨️', label: 'Aguanieve' },
  80: { icon: '🌦️', label: 'Chubascos' },
  81: { icon: '🌧️', label: 'Chubascos' },
  82: { icon: '⛈️', label: 'Chubascos fuertes' },
  85: { icon: '🌨️', label: 'Chubascos de nieve' },
  86: { icon: '❄️', label: 'Chubascos de nieve' },
  95: { icon: '⛈️', label: 'Tormenta' },
  96: { icon: '⛈️', label: 'Tormenta con granizo' },
  99: { icon: '⛈️', label: 'Tormenta fuerte' },
};

/**
 * Traduce un código WMO a { icon, label }.
 */
export function describeCode(code) {
  return WMO[code] || { icon: '🌡️', label: '—' };
}

/**
 * Determina la ciudad (clave de CITY_COORDS) desde el texto de city.
 */
function cityKey(cityText) {
  const c = String(cityText || '').toUpperCase();
  if (c.includes('BOS')) return 'BOSTON';
  return 'NYC';
}

/**
 * Lee el cache de clima si está fresco.
 */
function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.fetchedAt) return null;
    if (Date.now() - parsed.fetchedAt > CACHE_TTL) return null;
    return parsed.data;
  } catch (e) {
    return null;
  }
}

function writeCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), data }));
  } catch (e) { /* noop */ }
}

/**
 * Fetch del pronóstico de una ciudad para el rango de fechas del viaje.
 * Devuelve un objeto { 'YYYY-MM-DD': { code, max, min, precip } }.
 */
async function fetchCity(coords, startDate, endDate) {
  const url = 'https://api.open-meteo.com/v1/forecast' +
    '?latitude=' + coords.lat +
    '&longitude=' + coords.lon +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
    '&timezone=' + encodeURIComponent(coords.tz) +
    '&start_date=' + startDate +
    '&end_date=' + endDate;

  const res = await fetch(url);
  if (!res.ok) throw new Error('Open-Meteo HTTP ' + res.status);
  const json = await res.json();

  const out = {};
  const d = json.daily;
  if (!d || !d.time) return out;

  for (let i = 0; i < d.time.length; i++) {
    out[d.time[i]] = {
      code: d.weather_code ? d.weather_code[i] : null,
      max: d.temperature_2m_max ? Math.round(d.temperature_2m_max[i]) : null,
      min: d.temperature_2m_min ? Math.round(d.temperature_2m_min[i]) : null,
      precip: d.precipitation_probability_max ? d.precipitation_probability_max[i] : null,
    };
  }
  return out;
}

/**
 * Obtiene el pronóstico para todo el viaje (ambas ciudades).
 * Devuelve { NYC: {...}, BOSTON: {...} } por fecha.
 * Usa cache de 12h. Si falla la red, devuelve null (sin romper).
 */
export async function getForecast() {
  const cached = readCache();
  if (cached) return cached;

  // Rango de fechas del viaje (formato YYYY-MM-DD)
  const start = String(TRIP.startDate).slice(0, 10);
  const end = String(TRIP.endDate).slice(0, 10);

  // Open-Meteo solo da pronóstico ~16 días hacia adelante. Si el
  // viaje está muy lejos, la API devuelve lo que pueda (o vacío).
  try {
    const [nyc, boston] = await Promise.all([
      fetchCity(CITY_COORDS.NYC, start, end),
      fetchCity(CITY_COORDS.BOSTON, start, end),
    ]);
    const data = { NYC: nyc, BOSTON: boston };
    writeCache(data);
    return data;
  } catch (err) {
    console.warn('[weather] no se pudo obtener pronóstico:', err);
    return null;
  }
}

/**
 * Devuelve el clima de un día específico del itinerario.
 * @param {Object} forecast - resultado de getForecast()
 * @param {string} dateISO - 'YYYY-MM-DD'
 * @param {string} cityText - ciudad del día
 * @returns {null | { icon, label, max, min, precip }}
 */
export function dayWeather(forecast, dateISO, cityText) {
  if (!forecast || !dateISO) return null;
  const key = cityKey(cityText);
  const cityData = forecast[key];
  if (!cityData) return null;
  const day = cityData[dateISO];
  if (!day || day.code === null || day.code === undefined) return null;

  const desc = describeCode(day.code);
  return {
    icon: desc.icon,
    label: desc.label,
    max: day.max,
    min: day.min,
    precip: day.precip,
  };
}

/**
 * Convierte un número de día del viaje (1-indexed) a fecha ISO
 * 'YYYY-MM-DD', usando TRIP.startDate como día 1.
 * Más confiable que parsear el texto "DOM 4 OCT".
 *
 * @param {number} dayNumber
 * @returns {string} 'YYYY-MM-DD'
 */
export function dayNumberToISO(dayNumber) {
  const start = new Date(TRIP.startDate);
  const d = new Date(start);
  d.setDate(start.getDate() + (Number(dayNumber) - 1));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default { getForecast, dayWeather, describeCode, dayNumberToISO };
