// ============================================================
// DOM · Helpers para manipular el DOM
// Vanilla JS, cero dependencias.
// ============================================================

/**
 * Selector único.
 * @param {string} selector - selector CSS
 * @param {Element|Document} [ctx=document]
 * @returns {Element|null}
 */
export function $(selector, ctx = document) {
  return ctx.querySelector(selector);
}

/**
 * Selector múltiple. Devuelve array (no NodeList).
 * @param {string} selector
 * @param {Element|Document} [ctx=document]
 * @returns {Element[]}
 */
export function $$(selector, ctx = document) {
  return Array.from(ctx.querySelectorAll(selector));
}

/**
 * Atajo para addEventListener con cleanup automático opcional.
 * @param {Element|Window|Document} target
 * @param {string} event - puede ser 'click' o 'click submit' (varios)
 * @param {Function} handler
 * @param {Object} [options]
 * @returns {Function} función para remover el listener
 */
export function on(target, event, handler, options) {
  const events = event.split(/\s+/);
  events.forEach(ev => target.addEventListener(ev, handler, options));
  return () => events.forEach(ev => target.removeEventListener(ev, handler, options));
}

/**
 * Delegación de eventos: escucha en parent, dispara solo si matchea selector.
 * @param {Element} parent
 * @param {string} event
 * @param {string} selector
 * @param {Function} handler
 * @returns {Function} cleanup
 */
export function delegate(parent, event, selector, handler) {
  return on(parent, event, (e) => {
    const match = e.target.closest(selector);
    if (match && parent.contains(match)) {
      handler.call(match, e, match);
    }
  });
}

/**
 * Debounce: ejecuta fn N ms después de la última llamada.
 * Útil para inputs, búsquedas, autosave.
 * @param {Function} fn
 * @param {number} ms
 * @returns {Function}
 */
export function debounce(fn, ms) {
  let id;
  const debounced = (...args) => {
    clearTimeout(id);
    id = setTimeout(() => fn(...args), ms);
  };
  debounced.cancel = () => clearTimeout(id);
  return debounced;
}

/**
 * Throttle: ejecuta fn como máximo una vez cada N ms.
 * Útil para scroll, resize.
 * @param {Function} fn
 * @param {number} ms
 * @returns {Function}
 */
export function throttle(fn, ms) {
  let last = 0;
  let id;
  return (...args) => {
    const now = Date.now();
    const remaining = ms - (now - last);
    if (remaining <= 0) {
      clearTimeout(id);
      last = now;
      fn(...args);
    } else {
      clearTimeout(id);
      id = setTimeout(() => {
        last = Date.now();
        fn(...args);
      }, remaining);
    }
  };
}

/**
 * Crea un elemento con atributos e hijos.
 * Mucho más legible que createElement + setAttribute + appendChild.
 *
 * @example
 *   createEl('button', { class: 'btn', onclick: handler }, 'Click me')
 *   createEl('div', { class: 'card' }, [
 *     createEl('h2', {}, 'Título'),
 *     createEl('p', {}, 'Cuerpo')
 *   ])
 *
 * @param {string} tag
 * @param {Object} [attrs]
 * @param {string|Node|Array<string|Node>} [children]
 * @returns {Element}
 */
export function createEl(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);

  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class' || key === 'className') {
      el.className = value;
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(el.style, value);
    } else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'dataset' && typeof value === 'object') {
      Object.assign(el.dataset, value);
    } else if (key in el && typeof el[key] !== 'function' && key !== 'list') {
      // propiedades nativas (value, checked, disabled, etc.)
      el[key] = value;
    } else {
      el.setAttribute(key, value);
    }
  }

  const kids = Array.isArray(children) ? children : [children];
  for (const child of kids) {
    if (child === null || child === undefined || child === false) continue;
    if (typeof child === 'string' || typeof child === 'number') {
      el.appendChild(document.createTextNode(String(child)));
    } else if (child instanceof Node) {
      el.appendChild(child);
    }
  }

  return el;
}

/**
 * Escapa HTML para uso seguro en templates con backticks.
 * Para cualquier string que venga del usuario o de la API.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Inserta HTML como string dentro de un elemento de forma segura.
 * Reemplaza todo el contenido.
 * @param {Element} el
 * @param {string} html
 */
export function setHTML(el, html) {
  if (!el) return;
  el.innerHTML = html;
}

/**
 * Vacía un elemento (más rápido que innerHTML = '').
 * @param {Element} el
 */
export function empty(el) {
  if (!el) return;
  while (el.firstChild) el.removeChild(el.firstChild);
}

/**
 * Espera al próximo frame de render.
 * Útil cuando necesitas que el DOM se actualice antes de continuar.
 * @returns {Promise<void>}
 */
export function nextFrame() {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

/**
 * Espera N milisegundos.
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Verifica si el documento está visible (la pestaña está activa).
 * @returns {boolean}
 */
export function isDocumentVisible() {
  return !document.hidden;
}

/**
 * Detecta si estamos en un dispositivo móvil (por viewport).
 * @returns {boolean}
 */
export function isMobile() {
  return window.matchMedia('(max-width: 600px)').matches;
}
