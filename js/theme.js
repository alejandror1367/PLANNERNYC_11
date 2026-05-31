// ============================================================
// THEME · Modo claro / oscuro
// ============================================================
// - Aplica el tema vía atributo data-theme en <html>
// - Recuerda la preferencia en localStorage
// - Si no hay preferencia guardada, respeta la del sistema
//   (prefers-color-scheme)
// ============================================================

const STORAGE_KEY = 'tp2.theme';
const THEMES = ['light', 'dark'];

/**
 * Devuelve el tema preferido del sistema operativo.
 */
function systemPrefers() {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch (e) {
    return 'light';
  }
}

/**
 * Lee la preferencia guardada, o null si no hay.
 */
function readStored() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return THEMES.indexOf(v) !== -1 ? v : null;
  } catch (e) {
    return null;
  }
}

/**
 * Aplica un tema al documento.
 */
function apply(theme) {
  const t = THEMES.indexOf(theme) !== -1 ? theme : 'light';
  document.documentElement.setAttribute('data-theme', t);
  updateButton(t);
  updateThemeColor(t);
}

/**
 * Actualiza el ícono/label del botón de tema.
 */
function updateButton(theme) {
  const btn = document.getElementById('theme-btn');
  if (!btn) return;
  btn.textContent = theme === 'dark' ? '☀️ Tema' : '🌙 Tema';
}

/**
 * Sincroniza el theme-color del navegador (barra de estado móvil).
 */
function updateThemeColor(theme) {
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = theme === 'dark' ? '#161412' : '#ff4d2e';
}

/**
 * Devuelve el tema activo actual.
 */
export function current() {
  return document.documentElement.getAttribute('data-theme') || 'light';
}

/**
 * Alterna entre claro y oscuro y persiste la elección.
 */
export function toggle() {
  const next = current() === 'dark' ? 'light' : 'dark';
  apply(next);
  try { localStorage.setItem(STORAGE_KEY, next); } catch (e) { /* noop */ }
  return next;
}

/**
 * Inicializa el tema al arrancar la app.
 * Orden: preferencia guardada > preferencia del sistema.
 */
export function init() {
  const initial = readStored() || systemPrefers();
  apply(initial);

  // Botón de toggle
  const btn = document.getElementById('theme-btn');
  if (btn) {
    btn.addEventListener('click', () => toggle());
  }

  // Si el usuario no fijó preferencia, seguir los cambios del sistema
  try {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', (e) => {
      if (!readStored()) apply(e.matches ? 'dark' : 'light');
    });
  } catch (e) { /* navegadores viejos: ignorar */ }
}

export default { init, toggle, current };
