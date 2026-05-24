// ============================================================
// SETUP MODAL · Modal de primera vez
// Pide la URL del Apps Script y la guarda en localStorage.
// En Fase 1 está visualmente listo pero todavía no valida con backend
// (eso entra en Fase 2). Por ahora solo guarda y oculta el modal.
// ============================================================

import { $, on } from '../dom.js';
import { apiUrl, sheetUrl } from '../storage.js';
import * as toast from '../toast.js';

/**
 * Suscriptores a "URL conectada".
 */
const onConnectCallbacks = new Set();

/**
 * Verifica si una URL parece válida de Apps Script.
 * @param {string} url
 * @returns {boolean}
 */
function looksValid(url) {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  return trimmed.includes('script.google.com') && trimmed.includes('/exec');
}

/**
 * Muestra el modal.
 */
export function show() {
  const modal = $('#setup-modal');
  if (!modal) return;
  modal.hidden = false;
  // foco en el input al abrir
  requestAnimationFrame(() => {
    const input = $('#setup-url-input');
    if (input) input.focus();
  });
}

/**
 * Oculta el modal.
 */
export function hide() {
  const modal = $('#setup-modal');
  if (modal) modal.hidden = true;
}

/**
 * Devuelve true si ya hay URL guardada.
 */
export function isConfigured() {
  return apiUrl.exists();
}

/**
 * Suscribe un callback que se llama cuando el usuario conecta.
 */
export function onConnect(fn) {
  onConnectCallbacks.add(fn);
  return () => onConnectCallbacks.delete(fn);
}

/**
 * Inicializa el listener del botón "Conectar".
 */
export function init() {
  const saveBtn = $('#setup-save-btn');
  const input = $('#setup-url-input');

  if (!saveBtn || !input) {
    console.warn('setupModal: elementos del modal no encontrados');
    return;
  }

  const tryConnect = () => {
    const url = input.value.trim();

    if (!looksValid(url)) {
      toast.error('La URL no parece válida. Debe contener script.google.com y terminar en /exec');
      input.focus();
      return;
    }

    apiUrl.set(url);
    toast.success('URL guardada ✓');
    hide();

    // Notificar suscriptores (app.js arrancará la sincronización)
    onConnectCallbacks.forEach(fn => {
      try { fn(url); } catch (e) { console.error('onConnect callback error:', e); }
    });
  };

  on(saveBtn, 'click', tryConnect);
  on(input, 'keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      tryConnect();
    }
  });

  // Si no hay URL configurada, mostrar el modal
  if (!isConfigured()) {
    show();
  }
}
