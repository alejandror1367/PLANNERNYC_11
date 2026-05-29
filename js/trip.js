// ============================================================
// TRIP · Lógica de fase del viaje (Fase 8.4)
// ============================================================
// Deriva en qué fase está el viaje (pre / durante / post) y los
// datos asociados. Reutilizado por:
//   - Countdown hero (8.4)
//   - Timeline de intensidad (8.5)
//   - Contextual travel cues (8.7)
//
// Todo se calcula client-side, cero llamadas a red.
// ============================================================

import { TRIP } from './config.js';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Devuelve un objeto describiendo la fase actual del viaje.
 *
 * @param {Date} [now] - momento actual (default: ahora). Útil para tests.
 * @param {number} [itineraryDays] - nº de días reales en el itinerario.
 *        Si se pasa, se usa como totalDays (más fiel que el cálculo por
 *        fechas). Si no, se calcula por las fechas de TRIP.
 * @returns {{
 *   phase: 'pre'|'during'|'post',
 *   daysUntilStart: number,
 *   dayNumber: number,
 *   totalDays: number,
 *   daysRemaining: number,
 *   start: Date, end: Date, now: Date
 * }}
 */
export function getTripPhase(now, itineraryDays) {
  now = now || new Date();
  const start = new Date(TRIP.startDate);
  const end = new Date(TRIP.endDate);

  // Total de días: preferir el conteo real del itinerario si se pasa;
  // si no, calcular por fechas (inclusivo de inicio y fin)
  const calcDays = Math.max(
    1,
    Math.round((startOfDay(end) - startOfDay(start)) / MS_PER_DAY) + 1
  );
  const totalDays = (itineraryDays && itineraryDays > 0) ? itineraryDays : calcDays;

  if (now < start) {
    // Pre-viaje: días que faltan (redondeo hacia arriba)
    const daysUntilStart = Math.ceil((startOfDay(start) - startOfDay(now)) / MS_PER_DAY);
    return {
      phase: 'pre',
      daysUntilStart,
      dayNumber: 0,
      totalDays,
      daysRemaining: totalDays,
      start, end, now,
    };
  }

  if (now <= end) {
    // En viaje: qué día es (1-indexed)
    const dayNumber = Math.min(
      totalDays,
      Math.floor((startOfDay(now) - startOfDay(start)) / MS_PER_DAY) + 1
    );
    const daysRemaining = Math.max(0, totalDays - dayNumber);
    return {
      phase: 'during',
      daysUntilStart: 0,
      dayNumber,
      totalDays,
      daysRemaining,
      start, end, now,
    };
  }

  // Post-viaje
  return {
    phase: 'post',
    daysUntilStart: 0,
    dayNumber: totalDays,
    totalDays,
    daysRemaining: 0,
    start, end, now,
  };
}

/**
 * Normaliza una fecha al inicio de su día (medianoche local).
 * Evita errores de cálculo por horas/minutos.
 */
function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Detalle fino del tiempo restante hasta el inicio (para el tick
 * del countdown: días, horas, minutos, segundos).
 *
 * @param {Date} [now]
 * @returns {{days:number, hours:number, minutes:number, seconds:number, total:number}}
 */
export function getCountdownToStart(now) {
  now = now || new Date();
  const start = new Date(TRIP.startDate);
  let diff = Math.max(0, start - now);

  const total = diff;
  const days = Math.floor(diff / MS_PER_DAY);
  diff -= days * MS_PER_DAY;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  diff -= hours * (1000 * 60 * 60);
  const minutes = Math.floor(diff / (1000 * 60));
  diff -= minutes * (1000 * 60);
  const seconds = Math.floor(diff / 1000);

  return { days, hours, minutes, seconds, total };
}

export default { getTripPhase, getCountdownToStart };

/**
 * Mapea un texto de energía a un nivel de intensidad 0–4 (Fase 8.5).
 * Acepta formatos como "BAJA — recovery day", "Alta", "Intensa", etc.
 *
 * @param {string} energyText
 * @returns {{ level: number, label: string }}
 *   level: 0 (descanso) … 4 (intensa); -1 si no se reconoce
 */
export function energyToIntensity(energyText) {
  if (!energyText) return { level: -1, label: '' };
  const t = String(energyText).toLowerCase();

  // Orden importa: chequear los más específicos primero
  if (/intens/.test(t))                return { level: 4, label: 'Intensa' };
  if (/\balta\b|\bhigh\b/.test(t))     return { level: 3, label: 'Alta' };
  if (/\bmedia\b|\bmedium\b/.test(t))  return { level: 2, label: 'Media' };
  if (/\bbaja\b|\blow\b/.test(t))      return { level: 1, label: 'Baja' };
  if (/descans|rest|off|recovery|libre/.test(t)) return { level: 0, label: 'Descanso' };

  return { level: -1, label: energyText };
}
