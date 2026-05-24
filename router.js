// ============================================================
// ROUTER · Navegación entre tabs vía hash en URL
// La URL cambia: example.com/#budget, #itinerary, etc.
// Permite refresh, compartir links, botón atrás del navegador.
// ============================================================

import { TABS, DEFAULT_TAB } from './config.js';
import { $, $$, on } from './dom.js';

const validTabIds = new Set(TABS.map(t => t.id));

/**
 * Listeners suscritos a cambios de tab.
 * @type {Set<Function>}
 */
const subscribers = new Set();

/**
 * Tab actualmente activa.
 */
let currentTab = DEFAULT_TAB;

/**
 * Lee la tab desde el hash de la URL.
 * @returns {string} ID de tab válido
 */
function readTabFromHash() {
  const hash = window.location.hash.replace(/^#/, '');
  return validTabIds.has(hash) ? hash : DEFAULT_TAB;
}

/**
 * Aplica el cambio de tab al DOM:
 * - actualiza aria-selected en .tab
 * - muestra el .panel correspondiente
 * - notifica a suscriptores
 */
function applyTab(tabId, { scroll = true } = {}) {
  if (!validTabIds.has(tabId)) tabId = DEFAULT_TAB;
  currentTab = tabId;

  // Botones
  $$('.tab').forEach(btn => {
    const isActive = btn.dataset.tab === tabId;
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    btn.setAttribute('tabindex', isActive ? '0' : '-1');
  });

  // Paneles
  $$('.panel').forEach(panel => {
    panel.classList.toggle('is-active', panel.id === tabId);
    panel.setAttribute('aria-hidden', panel.id === tabId ? 'false' : 'true');
  });

  // Scroll al top (opcional)
  if (scroll) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Notificar suscriptores (ej: vistas que quieren refrescar al activarse)
  subscribers.forEach(fn => {
    try { fn(tabId); } catch (e) { console.error('router subscriber error:', e); }
  });
}

/**
 * Navega a un tab específico (cambia hash en URL).
 * @param {string} tabId
 */
export function goTo(tabId) {
  if (!validTabIds.has(tabId)) tabId = DEFAULT_TAB;
  if (window.location.hash === `#${tabId}`) {
    // ya estamos ahí, forzar reaplicación
    applyTab(tabId);
  } else {
    window.location.hash = `#${tabId}`;
  }
}

/**
 * Devuelve el tab actual.
 */
export function getCurrent() {
  return currentTab;
}

/**
 * Se suscribe a cambios de tab.
 * @param {Function} fn - recibe (tabId)
 * @returns {Function} unsubscribe
 */
export function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

/**
 * Inicializa el router:
 * - escucha clicks en botones .tab
 * - escucha cambios de hash
 * - aplica el tab inicial
 */
export function init() {
  // Click en botones
  on(document, 'click', (e) => {
    const btn = e.target.closest('.tab');
    if (!btn || !btn.dataset.tab) return;
    e.preventDefault();
    goTo(btn.dataset.tab);
  });

  // Navegación por teclado entre tabs (flechas izq/der)
  on(document, 'keydown', (e) => {
    const tabsContainer = e.target.closest('.tabs');
    if (!tabsContainer) return;

    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const tabs = $$('.tab', tabsContainer);
      const currentIdx = tabs.findIndex(t => t.classList.contains('is-active'));
      const delta = e.key === 'ArrowRight' ? 1 : -1;
      const nextIdx = (currentIdx + delta + tabs.length) % tabs.length;
      const nextTab = tabs[nextIdx];
      if (nextTab) {
        goTo(nextTab.dataset.tab);
        nextTab.focus();
      }
    }
  });

  // Cambio de hash (botón atrás/adelante del navegador)
  on(window, 'hashchange', () => {
    applyTab(readTabFromHash(), { scroll: false });
  });

  // Inicial
  applyTab(readTabFromHash(), { scroll: false });
}
