// ============================================================
// FORMAT · Helpers de formato (puros, sin DOM)
// ============================================================
// Funciones puras → fáciles de testear, no tocan estado externo.
// Manejan: dinero (USD, COP), conversiones, fechas, números.
// ============================================================

/**
 * Formatea un monto en USD.
 * @param {number} n
 * @returns {string} ej "$1,234.56"
 */
export function fmtUSD(n) {
  const num = Number(n);
  if (!isFinite(num)) return '$0.00';
  const sign = num < 0 ? '-' : '';
  const abs = Math.abs(num);
  // Formato con coma como separador de miles y punto como decimal
  return sign + '$' + abs.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Formatea un monto en COP.
 * @param {number} n
 * @returns {string} ej "COP $1.234.567"
 */
export function fmtCOP(n) {
  const num = Number(n);
  if (!isFinite(num)) return 'COP $0';
  const rounded = Math.round(num);
  const sign = rounded < 0 ? '-' : '';
  const abs = Math.abs(rounded).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return sign + 'COP $' + abs;
}

/**
 * Convierte cualquier monto + moneda → USD.
 * @param {number} amount
 * @param {'USD'|'COP'} currency
 * @param {number} exchangeRate - COP por USD
 * @returns {number}
 */
export function toUSD(amount, currency, exchangeRate) {
  const n = Number(amount);
  if (!isFinite(n)) return 0;
  if (currency === 'COP') {
    const rate = Number(exchangeRate);
    if (!isFinite(rate) || rate <= 0) return 0;
    return n / rate;
  }
  return n;
}

/**
 * Convierte USD → COP.
 * @param {number} amountUSD
 * @param {number} exchangeRate
 * @returns {number}
 */
export function toCOP(amountUSD, exchangeRate) {
  const n = Number(amountUSD);
  const rate = Number(exchangeRate);
  if (!isFinite(n) || !isFinite(rate)) return 0;
  return n * rate;
}

/**
 * Formatea un número con separadores de miles (sin moneda).
 * @param {number} n
 * @returns {string}
 */
export function fmtNumber(n) {
  const num = Number(n);
  if (!isFinite(num)) return '0';
  return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Formatea una fecha ISO o Date a algo legible.
 * Por defecto: "4 oct 2026"
 */
export function fmtDate(input) {
  if (!input) return '';
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return '';
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${d.getDate()} ${meses[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Calcula días entre dos fechas (ceiling).
 */
export function daysBetween(start, end) {
  const a = new Date(start);
  const b = new Date(end);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return 0;
  return Math.ceil((b - a) / (1000 * 60 * 60 * 24));
}

/**
 * Devuelve "hace X min/h" relativo a ahora.
 */
export function fmtRelative(input) {
  if (!input) return '';
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return 'hace un momento';
  const min = Math.floor(sec / 60);
  if (min < 60) return `hace ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `hace ${hr} h`;
  const days = Math.floor(hr / 24);
  return `hace ${days} d`;
}

/**
 * Hora corta tipo "14:35".
 */
export function fmtTime(input) {
  if (!input) return '';
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}
